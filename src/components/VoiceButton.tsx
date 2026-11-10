import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { isDesktopApp } from '../lib/platform';

/**
 * 🎤 Voice input. In the desktop app this starts the operating system's own
 * dictation (Windows voice typing = Win + H), which types into whichever box
 * has the cursor. In a browser that supports it, the Web Speech API is used.
 */

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => SpeechRecognitionLike) | null;
}

function isEditable(el: Element | null): el is HTMLElement {
  return !!el && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type === 'text') || (el as HTMLElement).isContentEditable);
}

/** Put the cursor in `target` (at the end) unless a text box already has it. */
function focusTarget(target: HTMLElement | null | undefined) {
  if (isEditable(document.activeElement)) return;
  if (!target) return;
  target.focus();
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    const end = target.value.length;
    target.setSelectionRange(end, end);
  } else {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
}

interface VoiceButtonProps {
  /** The text box to dictate into (used when no box has the cursor). */
  getTarget?: () => HTMLElement | null;
  variant?: 'icon' | 'pill';
  className?: string;
}

export function VoiceButton({ getTarget, variant = 'pill', className = '' }: VoiceButtonProps) {
  const [hint, setHint] = useState('');
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => recognition.current?.stop(), []);

  const showHint = (text: string) => {
    setHint(text);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(''), 5000);
  };

  const start = async () => {
    focusTarget(getTarget?.());

    if (isDesktopApp()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const platform = await invoke<string>('start_dictation');
        if (platform === 'windows') showHint('Speak now. Windows voice typing is listening (Win + H).');
        else if (platform === 'macos') showHint('Press Fn twice (or the 🎤 key) to dictate.');
        else if (platform === 'ios') showHint('Tap 🎤 on the keyboard to dictate.');
        else showHint("Use your system's dictation to speak into this box.");
      } catch {
        showHint('Press Win + H (Windows) or Fn twice (Mac) to dictate.');
      }
      return;
    }

    // Browser: Web Speech API where available (Chrome, Edge, Safari).
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      showHint('Press Win + H (Windows) or Fn twice (Mac) to dictate.');
      return;
    }
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = navigator.language || 'en-GB';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r.isFinal) continue;
        focusTarget(getTarget?.());
        // insertText keeps undo history and fires the box's normal input events.
        document.execCommand('insertText', false, `${r[0].transcript.trim()} `);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === 'not-allowed') showHint('Allow microphone access to use voice input.');
    };
    recognition.current = rec;
    rec.start();
    setListening(true);
  };

  const label = listening ? 'Stop listening' : 'Speak instead of typing';

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        // Keep the cursor where it is: dictation types at the cursor.
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
            ? { color: listening ? 'var(--accent)' : '#888888' }
            : {
                backgroundColor: listening ? 'var(--accent)' : 'var(--bg-elev)',
                color: listening ? '#fff' : 'var(--text)',
                border: '1px solid var(--divider)',
              }
        }
      >
        <Mic className={variant === 'icon' ? 'w-5 h-5' : 'w-4 h-4'} />
        {variant === 'pill' && (listening ? 'Listening…' : 'Speak')}
      </button>
      {hint && (
        <span
          role="status"
          className={`absolute z-[10001] right-0 w-64 rounded-lg px-3 py-2 text-xs shadow-xl ${variant === 'icon' ? 'top-full mt-2' : 'bottom-full mb-2'}`}
          style={{ backgroundColor: 'var(--bg-panel, #161616)', border: '1px solid var(--divider, #2a2a2a)', color: 'var(--text, #e5e5e5)' }}
        >
          {hint}
        </span>
      )}
    </span>
  );
}
