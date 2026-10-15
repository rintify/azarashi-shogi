const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();
/** Rounded jaw snap plus two short filtered crunches: a playful, non-verbal "gab". */
export function scheduleBite(ctx: AudioContext, at: number): () => void {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.22), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  const nodes: (AudioBufferSourceNode | OscillatorNode)[] = [];
  for (const delay of [0, 0.065]) {
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = delay ? 0.7 : 1.1;
    const start = at + delay;
    filter.type = 'lowpass';
    filter.Q.value = 1.6;
    filter.frequency.setValueAtTime(2200, start);
    filter.frequency.exponentialRampToValueAtTime(190, start + 0.12);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(delay ? 0.12 : 0.19, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(start);
    source.stop(start + 0.14);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    nodes.push(source);
  }
  const jaw = ctx.createOscillator(),
    gain = ctx.createGain();
  jaw.type = 'triangle';
  jaw.frequency.setValueAtTime(240, at);
  jaw.frequency.exponentialRampToValueAtTime(75, at + 0.13);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.1, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
  jaw.connect(gain);
  gain.connect(ctx.destination);
  jaw.start(at);
  jaw.stop(at + 0.2);
  jaw.onended = () => {
    jaw.disconnect();
    gain.disconnect();
  };
  nodes.push(jaw);
  return () =>
    nodes.forEach((node) => {
      try {
        node.stop();
      } catch {
        /* already ended */
      }
    });
}
