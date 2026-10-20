mergeInto(LibraryManager.library, {
  $AzarashiAudio: {
    context: null, clips: {}, voices: new Set(), muted: false, generation: 0,
    init: function() {
      if (this.context) return;
      var Context = window.AudioContext || window.webkitAudioContext;
      this.context = new Context();
      var self = this;
      this.unlock = function() {
        if (self.context.state !== 'running' && self.context.state !== 'closed')
          self.context.resume().catch(function(error) { console.warn('Game audio could not start:', error); });
      };
      // Resume inside the actual browser gesture, including after an iOS interruption.
      ['pointerdown', 'touchend', 'keydown'].forEach(function(event) {
        window.addEventListener(event, self.unlock, true);
      });
      this.output = this.context.destination;
      if (new URLSearchParams(window.location.search).has('audio-check')) {
        this.output = this.context.createAnalyser();
        this.output.fftSize = 256;
        this.output.connect(this.context.destination);
        this.diagnostic = document.createElement('output');
        this.diagnostic.id = 'azarashi-audio-check';
        this.diagnostic.style.cssText = 'position:fixed;bottom:0;left:0;z-index:10000;background:#fff;color:#123;padding:6px;font:12px monospace;pointer-events:none';
        document.body.appendChild(this.diagnostic);
        this.peak = 0; this.played = 0;
        var samples = new Float32Array(this.output.fftSize);
        this.timer = setInterval(function() {
          self.output.getFloatTimeDomainData(samples);
          for (var i = 0; i < samples.length; i++) self.peak = Math.max(self.peak, Math.abs(samples[i]));
          self.diagnostic.textContent = 'audio: ' + self.context.state + '; clips: ' + Object.keys(self.clips).length + '; played: ' + self.played + '; output peak: ' + self.peak.toFixed(5) + '; muted: ' + self.muted;
        }, 20);
      }
      Module.deinitializers.push(function() {
        ['pointerdown', 'touchend', 'keydown'].forEach(function(event) { window.removeEventListener(event, self.unlock, true); });
        self.stop(false);
        if (self.timer) clearInterval(self.timer);
        if (self.diagnostic) self.diagnostic.remove();
        self.context.close();
      });
    },
    stop: function(pendingOnly) {
      this.generation++;
      var now = this.context.currentTime;
      this.voices.forEach(function(voice) {
        if (pendingOnly && voice.at <= now) return;
        voice.source.stop();
      });
    },
    play: function(name, delay) {
      if (this.muted) return;
      var buffer = this.clips[name];
      if (!buffer) throw new Error('Unknown original audio clip: ' + name);
      var self = this, requested = performance.now(), generation = this.generation;
      var start = function() {
        // Do not replay stale moves after the browser finally grants audio access.
        if (self.muted || self.context.state !== 'running' || self.generation !== generation) return;
        var elapsed = (performance.now() - requested) / 1000;
        if (elapsed > delay + .1) return;
        var source = self.context.createBufferSource();
        source.buffer = buffer;
        source.connect(self.output);
        var voice = {source: source, at: self.context.currentTime + Math.max(0, delay - elapsed)};
        self.voices.add(voice);
        source.onended = function() { source.disconnect(); self.voices.delete(voice); };
        source.start(voice.at);
        if (self.diagnostic) self.played++;
      };
      if (this.context.state === 'running') start();
      else this.context.resume().then(start).catch(function(error) { console.warn('Game audio could not play:', error); });
    }
  },
  AzarashiAudioAdd__deps: ['$AzarashiAudio'],
  AzarashiAudioAdd: function(name, pointer, length, rate) {
    AzarashiAudio.init();
    var buffer = AzarashiAudio.context.createBuffer(1, length, rate);
    buffer.copyToChannel(HEAPF32.slice(pointer >> 2, (pointer >> 2) + length), 0);
    AzarashiAudio.clips[UTF8ToString(name)] = buffer;
  },
  AzarashiAudioPlay__deps: ['$AzarashiAudio'],
  AzarashiAudioPlay: function(name, delay) { AzarashiAudio.play(UTF8ToString(name), delay); },
  AzarashiAudioStop__deps: ['$AzarashiAudio'],
  AzarashiAudioStop: function(pendingOnly) { AzarashiAudio.stop(!!pendingOnly); },
  AzarashiAudioMute__deps: ['$AzarashiAudio'],
  AzarashiAudioMute: function(muted) {
    AzarashiAudio.muted = !!muted;
    if (muted) AzarashiAudio.stop(false);
  }
});
