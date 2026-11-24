/**
 * Microphone recorder for 🎤 voice input: live levels for the waveform, and
 * the finished clip as 16 kHz mono samples (what Whisper expects).
 */

const TARGET_RATE = 16_000;
const MAX_SECONDS = 15 * 60;

export class MicError extends Error {}

export class Recorder {
  private chunks: Float32Array[] = [];
  private length = 0;
  private stream: MediaStream;
  private ctx: AudioContext;
  private analyser: AnalyserNode;
  private processor: ScriptProcessorNode;
  private source: MediaStreamAudioSourceNode;

  private constructor(
    stream: MediaStream,
    ctx: AudioContext,
    analyser: AnalyserNode,
    processor: ScriptProcessorNode,
    source: MediaStreamAudioSourceNode,
  ) {
    this.stream = stream;
    this.ctx = ctx;
    this.analyser = analyser;
    this.processor = processor;
    this.source = source;
  }

  static async start(): Promise<Recorder> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MicError("This window can't use the microphone.");
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        throw new MicError(
          /Mac/i.test(navigator.userAgent)
            ? 'Flow needs microphone access: System Settings → Privacy & Security → Microphone → turn on Flow Notes.'
            : 'Flow needs microphone access. Allow it in your system settings and try again.',
        );
      }
      if (name === 'NotFoundError') throw new MicError('No microphone found.');
      throw new MicError(`Couldn't start the microphone (${name ?? 'unknown error'}).`);
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    // ScriptProcessor is deprecated but works in every web view Flow runs in.
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(analyser);
    source.connect(processor);
    processor.connect(mute);
    mute.connect(ctx.destination);
    const rec = new Recorder(stream, ctx, analyser, processor, source);
    processor.onaudioprocess = (e) => {
      if (rec.length > MAX_SECONDS * ctx.sampleRate) return;
      const data = new Float32Array(e.inputBuffer.getChannelData(0));
      rec.chunks.push(data);
      rec.length += data.length;
    };
    return rec;
  }

  get seconds(): number {
    return this.length / this.ctx.sampleRate;
  }

  /** Current loudness, 0..1. */
  level(): number {
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    return Math.min(1, Math.pow(rms * 6, 0.7));
  }

  private release() {
    this.processor.onaudioprocess = null;
    try {
      this.source.disconnect();
      this.processor.disconnect();
    } catch {
      /* already disconnected */
    }
    this.stream.getTracks().forEach((t) => t.stop());
    void this.ctx.close().catch(() => {});
  }

  cancel() {
    this.release();
    this.chunks = [];
  }

  /** Stop and return the clip as 16 kHz mono samples. */
  async stop(): Promise<Float32Array> {
    const rate = this.ctx.sampleRate;
    this.release();
    const all = new Float32Array(this.length);
    let at = 0;
    for (const c of this.chunks) {
      all.set(c, at);
      at += c.length;
    }
    this.chunks = [];
    return resample(all, rate);
  }
}

async function resample(input: Float32Array, rate: number): Promise<Float32Array> {
  if (!input.length || rate === TARGET_RATE) return input;
  try {
    const frames = Math.ceil((input.length * TARGET_RATE) / rate);
    const Offline =
      window.OfflineAudioContext ||
      (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    const off = new Offline(1, frames, TARGET_RATE);
    const buffer = off.createBuffer(1, input.length, rate);
    buffer.getChannelData(0).set(input);
    const src = off.createBufferSource();
    src.buffer = buffer;
    src.connect(off.destination);
    src.start();
    const out = await off.startRendering();
    return out.getChannelData(0).slice();
  } catch {
    // Fallback: linear interpolation.
    const ratio = rate / TARGET_RATE;
    const out = new Float32Array(Math.floor(input.length / ratio));
    for (let i = 0; i < out.length; i++) {
      const x = i * ratio;
      const j = Math.floor(x);
      const f = x - j;
      out[i] = input[j] * (1 - f) + (input[j + 1] ?? input[j]) * f;
    }
    return out;
  }
}
