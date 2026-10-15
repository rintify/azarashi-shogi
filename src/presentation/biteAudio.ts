const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();
/** A soft two-syllable nibble, with a rounded voice and a quiet breath. */
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
    filter.Q.value = 0.45;
    filter.frequency.setValueAtTime(780, start);
    filter.frequency.exponentialRampToValueAtTime(260, start + 0.12);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(delay ? 0.018 : 0.025, start + 0.018);
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
  jaw.type = 'sine';
  jaw.frequency.setValueAtTime(310, at);
  jaw.frequency.exponentialRampToValueAtTime(220, at + 0.055);
  jaw.frequency.exponentialRampToValueAtTime(340, at + 0.085);
  jaw.frequency.exponentialRampToValueAtTime(155, at + 0.2);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.065, at + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.018, at + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.055, at + 0.095);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.23);
  jaw.connect(gain);
  gain.connect(ctx.destination);
  jaw.start(at);
  jaw.stop(at + 0.25);
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
