import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped WebGL bridge, including gestures and asynchronous resume.
const library = {};
const listeners = new Map();
let clock = 0;
let pendingResume;
const context = {
  state: 'suspended', currentTime: 10, destination: {},
  resume() { return new Promise(resolve => { pendingResume = () => { this.state = 'running'; resolve(); }; }); },
  createBuffer(channels, length, rate) {
    return { copyToChannel(data) { assert.equal(channels, 1); assert.equal(data.length, length); assert.equal(rate, 48000); assert.equal(data[1], .25); } };
  },
  createBufferSource() {
    return { connect() {}, disconnect() {}, start(at) { this.at = at; }, stop() { this.stopped = true; } };
  },
  close() {},
};
const sandbox = {
  LibraryManager: { library }, mergeInto: Object.assign,
  window: { AudioContext: function() { return context; }, location: { search: '' },
    addEventListener(name, callback, capture) { assert.equal(capture, true); listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); } },
  Module: { deinitializers: [] }, URLSearchParams, Float32Array,
  performance: { now: () => clock }, console,
  HEAPF32: new Float32Array([0, .25, -.5]), UTF8ToString: value => value,
};
vm.runInNewContext(readFileSync(new URL('../unity/Assets/Plugins/WebGL/NativeAudio.jslib', import.meta.url), 'utf8'), sandbox);
sandbox.AzarashiAudio = library.$AzarashiAudio;
const audio = sandbox.AzarashiAudio;
library.AzarashiAudioAdd('landing', 0, 3, 48000);
assert.deepEqual([...listeners.keys()], ['pointerdown', 'touchend', 'keydown']);
listeners.get('touchend')(); pendingResume(); await Promise.resolve();
library.AzarashiAudioPlay('landing', .2);
const voice = [...audio.voices][0];
assert.equal(voice.at, 10.2);
library.AzarashiAudioStop(1);
assert.equal(voice.source.stopped, true);
voice.source.onended();
library.AzarashiAudioPlay('landing', 0);
const tail = [...audio.voices][0];
library.AzarashiAudioStop(1);
assert.equal(tail.source.stopped, undefined, 'completed motions retain their sound tail');
library.AzarashiAudioMute(1);
assert.equal(tail.source.stopped, true);
tail.source.onended();
library.AzarashiAudioPlay('landing', 0);
assert.equal(audio.voices.size, 0, 'mute prevents playback');
library.AzarashiAudioMute(0);
context.state = 'suspended';
library.AzarashiAudioPlay('landing', 0);
clock = 1000;
pendingResume(); await Promise.resolve();
assert.equal(audio.voices.size, 0, 'late browser access cannot replay stale moves');
context.state = 'suspended';
library.AzarashiAudioPlay('landing', 0);
library.AzarashiAudioStop(0);
pendingResume(); await Promise.resolve();
assert.equal(audio.voices.size, 0, 'cancel applies to pending resume');
sandbox.Module.deinitializers[0]();
assert.equal(listeners.size, 0);
console.log('Unity Web audio bridge passed: PCM copy, touch unlock, timing, tails, mute, stale/canceled resume, cleanup.');
