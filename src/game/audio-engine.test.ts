import { describe, expect, test } from 'vitest';
import { createRaceAudioEngine } from './audio-engine';

type Deferred<T> = {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe('RaceAudioEngine', () => {
  test('does not report started while a suspended context is still resuming', async () => {
    const resume = createDeferred<void>();
    const FakeAudioContext = createFakeAudioContext({
      initialState: 'suspended',
      resume,
    });
    const engine = createRaceAudioEngine({
      AudioContext: FakeAudioContext,
    } as unknown as Window);

    const startPromise = engine.start();

    expect(engine.getDebugState()).toMatchObject({
      started: false,
      contextState: 'suspended',
    });

    resume.reject(new Error('resume failed'));
    await startPromise;
    expect(engine.getDebugState().started).toBe(false);
  });

  test('reports started and running after a suspended context resumes', async () => {
    const resume = createDeferred<void>();
    const FakeAudioContext = createFakeAudioContext({
      initialState: 'suspended',
      resume,
      stateAfterResume: 'running',
    });
    const engine = createRaceAudioEngine({
      AudioContext: FakeAudioContext,
    } as unknown as Window);

    const startPromise = engine.start();
    resume.resolve();
    await startPromise;

    expect(engine.getDebugState()).toMatchObject({
      started: true,
      contextState: 'running',
    });
  });

  test('reuses debug state object across reads', () => {
    const resume = createDeferred<void>();
    const FakeAudioContext = createFakeAudioContext({
      initialState: 'running',
      resume,
    });
    const engine = createRaceAudioEngine({
      AudioContext: FakeAudioContext,
    } as unknown as Window);

    const firstDebug = engine.getDebugState();
    engine.update({
      masterGain: 0.42,
      engineFrequency: 240,
      engineGain: 0.11,
      skidGain: 0.2,
      boostGain: 0.08,
    });
    const secondDebug = engine.getDebugState();

    expect(secondDebug).toBe(firstDebug);
    expect(secondDebug.engineFrequency).toBe(240);
  });
});

function createFakeAudioContext(options: {
  readonly initialState: AudioContextState;
  readonly resume: Deferred<void>;
  readonly stateAfterResume?: AudioContextState;
}): new () => AudioContext {
  return class FakeAudioContext {
    currentTime = 0;
    sampleRate = 32;
    destination = createConnectable();
    state = options.initialState;

    createGain(): GainNode {
      return {
        ...createConnectable(),
        gain: createAudioParam(0),
      } as unknown as GainNode;
    }

    createOscillator(): OscillatorNode {
      return {
        ...createConnectable(),
        type: 'sine',
        frequency: createAudioParam(0),
        start() {},
        stop() {},
        addEventListener() {},
        disconnect() {},
      } as unknown as OscillatorNode;
    }

    createBufferSource(): AudioBufferSourceNode {
      return {
        ...createConnectable(),
        buffer: null,
        loop: false,
        start() {},
      } as unknown as AudioBufferSourceNode;
    }

    createBiquadFilter(): BiquadFilterNode {
      return {
        ...createConnectable(),
        type: 'bandpass',
        frequency: createAudioParam(0),
        Q: createAudioParam(0),
      } as unknown as BiquadFilterNode;
    }

    createBuffer(_channels: number, length: number): AudioBuffer {
      const data = new Float32Array(length);
      return {
        getChannelData: () => data,
      } as unknown as AudioBuffer;
    }

    async resume(): Promise<void> {
      await options.resume.promise;
      this.state = options.stateAfterResume ?? this.state;
    }
  } as unknown as new () => AudioContext;
}

function createConnectable(): { connect(): void; disconnect(): void } {
  return {
    connect() {},
    disconnect() {},
  };
}

function createAudioParam(value: number): AudioParam {
  const param = {
    value,
    setTargetAtTime(nextValue: number) {
      param.value = nextValue;
      return param;
    },
    setValueAtTime(nextValue: number) {
      param.value = nextValue;
      return param;
    },
    exponentialRampToValueAtTime(nextValue: number) {
      param.value = nextValue;
      return param;
    },
    linearRampToValueAtTime(nextValue: number) {
      param.value = nextValue;
      return param;
    },
  };
  return param as unknown as AudioParam;
}
