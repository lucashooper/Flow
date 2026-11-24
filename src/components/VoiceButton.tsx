import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Mic, Square, X } from 'lucide-react';
import { isDesktopApp, isIOSApp } from '../lib/platform';
import { MicError, Recorder } from '../lib/voice/recorder';

/**
 * 🎤 Voice input. Click the mic, talk (a live waveform shows Flow is
 * listening), press Stop, and the words are typed where your cursor was.
 *
 * Desktop app: speech is turned into text on this computer with Whisper
 * (the model downloads once, ~60 MB). Browser: the Web Speech API.
 * iPhone app: the keyboard's own 🎤 dictation.
 */

// ---------------------------------------------------------------- cursor memory
// Remember the last text box (and caret) the user was in, so the words land
// there even after clicking the mic or the Stop button.
let lastEditable: HTMLElement | null = null;
let lastRange: Range | null = null;

function isEditable(el: Element | null): el is HTMLElement {
  return (
    !!el &&
    (el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement && (el.type === 'text' || el.type === 'search')) ||
      (el as HTMLElement).isContentEditable)
  );
}

if (typeof document !== 'undefined') {
  document.addEventListener('selectionchange', () => {
    const el = document.activeElement;
    if (!isEditable(el)) return;
    lastEditable = el;
    if (el.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) lastRange = sel.getRangeAt(0).cloneRange();
    } else {
      lastRange = null;
    }
  });
}

function insertText(text: string, fallback: HTMLElement | null | undefined) {
  if (!text) return;
  let target: HTMLElement | null = lastEditable && lastEditable.isConnected ? lastEditable : null;
  if (!target && fallback) target = fallback;
  if (!target) return;

  target.focus();
  let before = '';
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    const at = target.selectionStart ?? target.value.length;
    before = target.value.slice(0, at);
  } else {
    const sel = window.getSelection();
    if (lastRange && target.contains(lastRange.startContainer)) {
      sel?.removeAllRanges();
      sel?.addRange(lastRange);
    } else if (sel && (!sel.rangeCount || !target.contains(sel.anchorNode))) {
      const r = document.createRange();
      r.selectNodeContents(target);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    const r = sel?.rangeCount ? sel.getRangeAt(0) : null;
    if (r && r.startContainer.nodeType === Node.TEXT_NODE) before = (r.startContainer.nodeValue ?? '').slice(0, r.startOffset);
  }
  const needsSpace = before.length > 0 && !/\s$/.test(before);
  // insertText keeps undo history and fires the box's normal input events.
  document.execCommand('insertText', false, `${needsSpace ? ' ' : ''}${text}`);
}

// ---------------------------------------------------------------- engines
async function tauri() {
  return import('@tauri-apps/api/core');
}

/** Desktop: make sure the Whisper model is here (downloads once). */
function prepareModel(onProgress: (pct: number | null) => void): Promise<void> {
  return (async () => {
    const { invoke } = await tauri();
    if (await invoke<boolean>('voice_model_status')) return;
    const { listen } = await import('@tauri-apps/api/event');
    onProgress(0);
    const un = await listen<{ downloaded: number; total: number }>('voice-model-progress', (e) => {
      const { downloaded, total } = e.payload;
      onProgress(total ? Math.round((downloaded / total) * 100) : null);
    });
    try {
      await invoke('voice_model_download');
    } finally {
      un();
    }
  })();
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => SpeechRecognitionLike) | null;
}

// ---------------------------------------------------------------- UI
const BARS = 32;
type Phase = 'idle' | 'starting' | 'recording' | 'working';

interface VoiceButtonProps {
  /** The text box to type into if none had the cursor. */
  getTarget?: () => HTMLElement | null;
  variant?: 'icon' | 'pill';
  className?: string;
}

export function VoiceButton({ getTarget, variant = 'pill', className = '' }: VoiceButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [hint, setHint] = useState('');
  const [download, setDownload] = useState<number | null | undefined>(undefined); // undefined = not downloading
  const [seconds, setSeconds] = useState(0);

  const recorder = useRef<Recorder | null>(null);
  const speech = useRef<{ rec: SpeechRecognitionLike; text: string[]; ended: Promise<void> } | null>(null);
  const model = useRef<Promise<void> | null>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const levels = useRef<number[]>(new Array(BARS).fill(0));
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showHint = (text: string, ms = 6000) => {
    setHint(text);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(''), ms);
  };

  // Live waveform: a scrolling history of loudness, drawn without React renders.
  useEffect(() => {
    if (phase !== 'recording') return;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const rec = recorder.current;
      if (!rec || t - last < 70) return;
      last = t;
      levels.current.push(rec.level());
      levels.current.shift();
      const bars = barsRef.current?.children;
      if (bars) {
        for (let i = 0; i < bars.length; i++) {
          (bars[i] as HTMLElement).style.height = `${Math.max(3, Math.round(levels.current[i] * 26))}px`;
        }
      }
      setSeconds(Math.floor(rec.seconds));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const cancel = () => {
    recorder.current?.cancel();
    recorder.current = null;
    speech.current?.rec.abort();
    speech.current = null;
    setPhase('idle');
  };

  const stop = async () => {
    const rec = recorder.current;
    if (!rec) return;
    recorder.current = null;
    setPhase('working');
    try {
      const audio = await rec.stop();
      let text = '';
      if (isDesktopApp()) {
        if (audio.length < 16_000 * 0.3) {
          setPhase('idle');
          return;
        }
        await model.current;
        const { invoke } = await tauri();
        text = await invoke<string>('voice_transcribe', new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength));
      } else if (speech.current) {
        const s = speech.current;
        speech.current = null;
        s.rec.stop();
        await Promise.race([s.ended, new Promise((r) => setTimeout(r, 4000))]);
        text = s.text.join(' ').replace(/\s+/g, ' ').trim();
      }
      if (text) insertText(text, getTarget?.());
      else showHint("Didn't catch anything. Try again a little closer to the mic.", 4000);
    } catch (e) {
      showHint(String((e as Error)?.message ?? e));
    } finally {
      setDownload(undefined);
      setPhase('idle');
    }
  };

  const start = async () => {
    if (phase === 'recording') return void stop();
    if (phase !== 'idle') return;

    if (isIOSApp()) {
      showHint('Tap 🎤 on the keyboard to dictate.');
      return;
    }
    const Speech = getSpeechRecognition();
    if (!isDesktopApp() && !Speech) {
      showHint("Voice typing isn't supported in this browser. Try Chrome, Edge or Safari, or the Flow desktop app.");
      return;
    }

    // Remember where the words should go if no box has had the cursor yet.
    if (!lastEditable || !lastEditable.isConnected) {
      const t = getTarget?.();
      if (t) lastEditable = t;
    }

    setPhase('starting');
    setHint('');
    try {
      recorder.current = await Recorder.start();
    } catch (e) {
      setPhase('idle');
      showHint(e instanceof MicError ? e.message : `Couldn't start the microphone: ${String(e)}`, 9000);
      return;
    }

    if (isDesktopApp()) {
      // Fetch the speech model while the user talks (first time only).
      model.current = prepareModel((pct) => setDownload(pct));
      model.current.catch(() => {}); // the error is shown when Stop awaits it
    } else if (Speech) {
      const rec = new Speech();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = navigator.language || 'en-GB';
      const text: string[] = [];
      let resolveEnded = () => {};
      const ended = new Promise<void>((r) => (resolveEnded = r));
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) text.push(e.results[i][0].transcript.trim());
        }
      };
      rec.onend = () => resolveEnded();
      rec.onerror = (e) => {
        if (e.error === 'not-allowed') showHint('Allow microphone access to use voice input.');
        resolveEnded();
      };
      speech.current = { rec, text, ended };
      try {
        rec.start();
      } catch {
        /* already started */
      }
    }
    levels.current = new Array(BARS).fill(0);
    setSeconds(0);
    setPhase('recording');
  };

  // Esc cancels, Enter (outside a text box) or ⌘/Ctrl + Enter stops.
  useEffect(() => {
    if (phase !== 'recording') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        void stop();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(
    () => () => {
      recorder.current?.cancel();
      speech.current?.rec.abort();
    },
    [],
  );

  const active = phase === 'recording' || phase === 'starting';
  const label = active ? 'Stop and type what I said' : 'Speak instead of typing';
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const pill =
    phase === 'idle' && !hint
      ? null
      : createPortal(
          <div
            data-floating-panel
            className="fixed left-1/2 -translate-x-1/2 bottom-8 z-[10003] flex flex-col items-center gap-2"
            onMouseDown={(e) => e.preventDefault() /* keep the cursor in the note */}
          >
            {(phase === 'recording' || phase === 'starting' || phase === 'working') && (
              <div
                className="flex items-center gap-3 rounded-full pl-2 pr-2 py-2 shadow-2xl"
                style={{ backgroundColor: 'var(--bg-panel, #161616)', border: '1px solid var(--divider, #2a2a2a)', color: 'var(--text, #e5e5e5)' }}
              >
                {phase === 'working' ? (
                  <div className="flex items-center gap-2 px-3 py-1 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
                    {download !== undefined ? `Getting voice ready${download != null ? ` · ${download}%` : '…'}` : 'Writing it down…'}
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={cancel}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
                      title="Cancel (Esc)"
                      aria-label="Cancel recording"
                    >
                      <X className="w-4 h-4" style={{ color: 'var(--muted, #888)' }} />
                    </button>
                    <span className="relative flex w-2.5 h-2.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping" />
                      <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-red-500" />
                    </span>
                    <div ref={barsRef} className="flex items-center gap-[3px] h-7" aria-hidden>
                      {Array.from({ length: BARS }, (_, i) => (
                        <div
                          key={i}
                          className="w-[3px] rounded-full"
                          style={{ height: 3, backgroundColor: 'var(--text, #e5e5e5)', opacity: 0.85, transition: 'height 70ms linear' }}
                        />
                      ))}
                    </div>
                    <span className="text-xs tabular-nums w-9" style={{ color: 'var(--muted, #888)' }}>
                      {time}
                    </span>
                    <button
                      type="button"
                      onClick={() => void stop()}
                      className="flex items-center gap-1.5 h-8 pl-3 pr-3.5 rounded-full text-sm font-medium hover:opacity-90"
                      style={{ backgroundColor: 'var(--accent, #8b5cf6)', color: '#fff' }}
                      title="Stop and type what I said (⌘/Ctrl + Enter)"
                    >
                      <Square className="w-3 h-3 fill-current" /> Stop
                    </button>
                  </>
                )}
              </div>
            )}
            {phase === 'recording' && download !== undefined && (
              <span className="text-xs px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--bg-panel, #161616)', color: 'var(--muted, #888)' }}>
                Setting up voice, first time only{download != null ? ` (${download}%)` : '…'} · keep talking
              </span>
            )}
            {hint && (
              <span
                role="status"
                className="max-w-sm text-center text-xs rounded-lg px-3 py-2 shadow-xl"
                style={{ backgroundColor: 'var(--bg-panel, #161616)', border: '1px solid var(--divider, #2a2a2a)', color: 'var(--text, #e5e5e5)' }}
              >
                {hint}
              </span>
            )}
          </div>,
          document.body,
        );

  return (
    <>
      <button
        type="button"
        // Keep the cursor where it is: the words are typed at the cursor.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void start()}
        title={label}
        aria-label={label}
        className={
          variant === 'icon'
            ? `p-2 rounded-lg transition-colors hover:bg-[#2a2a2a] ${className}`
            : `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-85 ${className}`
        }
        style={
          variant === 'icon'
            ? { color: active ? '#ef4444' : '#888888' }
            : {
                backgroundColor: active ? '#ef4444' : 'var(--bg-elev)',
                color: active ? '#fff' : 'var(--text)',
                border: '1px solid var(--divider)',
              }
        }
      >
        <Mic className={variant === 'icon' ? 'w-5 h-5' : 'w-4 h-4'} />
        {variant === 'pill' && (active ? 'Listening…' : 'Speak')}
      </button>
      {pill}
    </>
  );
}
