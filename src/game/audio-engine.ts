import type { RaceAudioCue, RaceAudioMix } from './audio-state';

export type RaceAudioDebugState = {
  readonly available: boolean;
  readonly started: boolean;
  readonly contextState: string;
  readonly engineFrequency: number;
  readonly engineGain: number;
  readonly skidGain: number;
  readonly boostGain: number;
  readonly cueCount: number;
  readonly lastCue: string | null;
};

export type RaceAudioEngine = {
  start(): Promise<void>;
  update(mix: RaceAudioMix): void;
  playCue(cue: RaceAudioCue): void;
  getDebugState(): RaceAudioDebugState;
};

type AudioContextConstructor = new () => AudioContext;

type WebAudioWindow = Window & {
  readonly AudioContext?: AudioContextConstructor;
  readonly webkitAudioContext?: AudioContextConstructor;
};

type RaceAudioGraph = {
  readonly context: AudioContext;
  readonly masterGain: GainNode;
  readonly engineOscillator: OscillatorNode;
  readonly engineGain: GainNode;
  readonly skidGain: GainNode;
  readonly skidSource: AudioBufferSourceNode;
  readonly boostOscillator: OscillatorNode;
  readonly boostGain: GainNode;
};

const initialMix: RaceAudioMix = {
  masterGain: 0.16,
  engineFrequency: 72,
  engineGain: 0,
  skidGain: 0,
  boostGain: 0,
};

export function createRaceAudioEngine(win: Window = window): RaceAudioEngine {
  return new BrowserRaceAudioEngine(win as WebAudioWindow);
}

class BrowserRaceAudioEngine implements RaceAudioEngine {
  private readonly AudioContextConstructor: AudioContextConstructor | null;
  private graph: RaceAudioGraph | null = null;
  private currentMix = initialMix;
  private unavailable = false;
  private started = false;
  private cueCount = 0;
  private lastCue: RaceAudioCue | null = null;

  constructor(win: WebAudioWindow) {
    this.AudioContextConstructor = win.AudioContext ?? win.webkitAudioContext ?? null;
  }

  async start(): Promise<void> {
    if (!this.AudioContextConstructor || this.unavailable) {
      return;
    }

    if (!this.graph) {
      try {
        const context = new this.AudioContextConstructor();
        this.graph = createAudioGraph(context, this.currentMix);
      } catch {
        this.unavailable = true;
        return;
      }
    }

    this.started = true;
    this.update(this.currentMix);

    if (this.graph.context.state === 'suspended') {
      try {
        await this.graph.context.resume();
      } catch {
        this.started = false;
      }
    }
  }

  update(mix: RaceAudioMix): void {
    this.currentMix = sanitizeMix(mix);

    if (!this.graph) {
      return;
    }

    const now = this.graph.context.currentTime;
    this.graph.masterGain.gain.setTargetAtTime(this.currentMix.masterGain, now, 0.045);
    this.graph.engineOscillator.frequency.setTargetAtTime(this.currentMix.engineFrequency, now, 0.035);
    this.graph.engineGain.gain.setTargetAtTime(this.currentMix.engineGain, now, 0.035);
    this.graph.skidGain.gain.setTargetAtTime(this.currentMix.skidGain, now, 0.028);
    this.graph.boostOscillator.frequency.setTargetAtTime(Math.max(96, this.currentMix.engineFrequency * 0.54), now, 0.04);
    this.graph.boostGain.gain.setTargetAtTime(this.currentMix.boostGain, now, 0.03);
  }

  playCue(cue: RaceAudioCue): void {
    this.cueCount += 1;
    this.lastCue = cue;

    if (!this.graph || !this.started) {
      return;
    }

    const profile = getCueProfile(cue);
    const now = this.graph.context.currentTime;
    const oscillator = this.graph.context.createOscillator();
    const gain = this.graph.context.createGain();

    oscillator.type = profile.type;
    oscillator.frequency.setValueAtTime(profile.startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(profile.endFrequency, now + profile.duration * 0.82);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(profile.gain, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);

    oscillator.connect(gain);
    gain.connect(this.graph.masterGain);
    oscillator.start(now);
    oscillator.stop(now + profile.duration + 0.04);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      gain.disconnect();
    });
  }

  getDebugState(): RaceAudioDebugState {
    const available = Boolean(this.AudioContextConstructor) && !this.unavailable;
    return {
      available,
      started: this.started,
      contextState: available ? (this.graph?.context.state ?? 'not-started') : 'unavailable',
      engineFrequency: this.currentMix.engineFrequency,
      engineGain: this.currentMix.engineGain,
      skidGain: this.currentMix.skidGain,
      boostGain: this.currentMix.boostGain,
      cueCount: this.cueCount,
      lastCue: this.lastCue,
    };
  }
}

function createAudioGraph(context: AudioContext, mix: RaceAudioMix): RaceAudioGraph {
  const masterGain = context.createGain();
  masterGain.gain.value = mix.masterGain;
  masterGain.connect(context.destination);

  const engineOscillator = context.createOscillator();
  engineOscillator.type = 'sawtooth';
  engineOscillator.frequency.value = mix.engineFrequency;
  const engineGain = context.createGain();
  engineGain.gain.value = mix.engineGain;
  engineOscillator.connect(engineGain);
  engineGain.connect(masterGain);
  engineOscillator.start();

  const skidSource = context.createBufferSource();
  skidSource.buffer = createSkidNoiseBuffer(context);
  skidSource.loop = true;
  const skidFilter = context.createBiquadFilter();
  skidFilter.type = 'bandpass';
  skidFilter.frequency.value = 950;
  skidFilter.Q.value = 0.72;
  const skidGain = context.createGain();
  skidGain.gain.value = mix.skidGain;
  skidSource.connect(skidFilter);
  skidFilter.connect(skidGain);
  skidGain.connect(masterGain);
  skidSource.start();

  const boostOscillator = context.createOscillator();
  boostOscillator.type = 'triangle';
  boostOscillator.frequency.value = Math.max(96, mix.engineFrequency * 0.54);
  const boostGain = context.createGain();
  boostGain.gain.value = mix.boostGain;
  boostOscillator.connect(boostGain);
  boostGain.connect(masterGain);
  boostOscillator.start();

  return {
    context,
    masterGain,
    engineOscillator,
    engineGain,
    skidGain,
    skidSource,
    boostOscillator,
    boostGain,
  };
}

function createSkidNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 1337;

  for (let index = 0; index < data.length; index += 1) {
    seed = (seed * 16807) % 2147483647;
    const white = (seed / 2147483647) * 2 - 1;
    data[index] = white * 0.82;
  }

  return buffer;
}

function sanitizeMix(mix: RaceAudioMix): RaceAudioMix {
  return {
    masterGain: finiteOr(mix.masterGain, initialMix.masterGain),
    engineFrequency: finiteOr(mix.engineFrequency, initialMix.engineFrequency),
    engineGain: finiteOr(mix.engineGain, initialMix.engineGain),
    skidGain: finiteOr(mix.skidGain, initialMix.skidGain),
    boostGain: finiteOr(mix.boostGain, initialMix.boostGain),
  };
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function getCueProfile(cue: RaceAudioCue): {
  readonly startFrequency: number;
  readonly endFrequency: number;
  readonly duration: number;
  readonly gain: number;
  readonly type: OscillatorType;
} {
  switch (cue) {
    case 'start':
      return { startFrequency: 260, endFrequency: 620, duration: 0.26, gain: 0.11, type: 'triangle' };
    case 'checkpoint':
      return { startFrequency: 640, endFrequency: 880, duration: 0.16, gain: 0.075, type: 'sine' };
    case 'lap':
      return { startFrequency: 520, endFrequency: 1040, duration: 0.28, gain: 0.095, type: 'triangle' };
    case 'finish':
      return { startFrequency: 390, endFrequency: 980, duration: 0.44, gain: 0.12, type: 'triangle' };
  }
}
