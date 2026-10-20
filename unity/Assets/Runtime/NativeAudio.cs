using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using UnityEngine;
namespace Azarashi.UnityView
{
    [Serializable] public struct NativeAudioCue { public string clip; public float at; }
    /// <summary>Original Web Audio PCM and the motionAudio.ts cue schedule, in seconds.</summary>
    public sealed class NativeAudio : MonoBehaviour
    {
        private readonly Dictionary<string, AudioClip> clips = new Dictionary<string, AudioClip>();
        private readonly List<AudioSource> sources = new List<AudioSource>();
        private NativeMotion current;
        private float started;
        private string stage;
        private bool muted;
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void AzarashiAudioAdd(string name, float[] samples, int length, int rate);
        [DllImport("__Internal")] private static extern void AzarashiAudioPlay(string name, float delay);
        [DllImport("__Internal")] private static extern void AzarashiAudioStop(bool pendingOnly);
        [DllImport("__Internal")] private static extern void AzarashiAudioMute(bool muted);
#endif
        private void Awake()
        {
            var bytes = Resources.Load<TextAsset>("Native/Audio/Bite").bytes;
            var rate = BitConverter.ToInt32(bytes, 0);
            var count = BitConverter.ToInt32(bytes, 4);
            var samples = new float[count];
            Buffer.BlockCopy(bytes, 8, samples, 0, count * sizeof(float));
            AddClip("bite", samples, rate);
            using (var reader = new BinaryReader(new MemoryStream(Resources.Load<TextAsset>("Native/Audio/Tones").bytes)))
            {
                rate = reader.ReadInt32();
                count = reader.ReadInt32();
                for (var i = 0; i < count; i++)
                {
                    var name = Encoding.UTF8.GetString(reader.ReadBytes(reader.ReadInt32()));
                    samples = new float[reader.ReadInt32()];
                    for (var j = 0; j < samples.Length; j++) samples[j] = reader.ReadSingle();
                    AddClip(name, samples, rate);
                }
            }
        }
        private void AddClip(string name, float[] samples, int rate)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            AzarashiAudioAdd(name, samples, samples.Length, rate);
#else
            var clip = AudioClip.Create("Original " + name, samples.Length, 1, rate, false);
            if (!clip.SetData(samples, 0)) throw new InvalidOperationException("Could not load original audio: " + name);
            clips.Add(name, clip);
#endif
        }
        public void Preview()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            AzarashiAudioPlay("landing", 0);
#else
            AudioSource.PlayClipAtPoint(clips["landing"], Camera.main != null ? Camera.main.transform.position : Vector3.zero);
#endif
        }
        public static NativeAudioCue[] Cues(NativeMotion motion)
        {
            var cues = new List<NativeAudioCue>();
            if (motion.Stage == "return") return cues.ToArray();
            if (motion.Stage != "resolve") cues.Add(new NativeAudioCue { clip = "move", at = .01f });
            if (motion.Waiting) return cues.ToArray();
            foreach (var bite in motion.Action.captured.Select(p => motion.CaptureMoment(p)).Distinct())
                cues.Add(new NativeAudioCue { clip = "bite", at = bite * motion.Duration });
            cues.Add(new NativeAudioCue { clip = motion.Action.piece.kind == "walrus" ? "kingLanding" : motion.Action.captured.Length > 0 ? "captureLanding" : "landing", at = motion.Duration * motion.LandingMoment });
            if (motion.Transformed)
            {
                var start = motion.Stage == "resolve" ? .18f : .44f;
                var names = new[] { "transform660", "transform880", "transform1320" };
                for (var i = 0; i < names.Length; i++) cues.Add(new NativeAudioCue { clip = names[i], at = motion.Duration * start + i * .08f });
            }
            return cues.ToArray();
        }
        public void Sync(NativeMotion motion, bool isMuted)
        {
            var nextStage = motion?.Waiting == true ? "choice" : motion?.Stage;
            if (current == motion && started == (motion?.Started ?? 0) && stage == nextStage && muted == isMuted) return;
            var completed = current != null && motion == null && current.Done;
#if UNITY_WEBGL && !UNITY_EDITOR
            AzarashiAudioMute(isMuted);
            AzarashiAudioStop(completed && !isMuted);
#else
            if (!completed || isMuted) foreach (var source in sources) source.Stop();
#endif
            current = motion;
            started = motion?.Started ?? 0;
            stage = nextStage;
            muted = isMuted;
            if (motion == null || muted) return;
            var elapsed = Mathf.Max(0, Time.unscaledTime - motion.Started);
            var index = 0;
            foreach (var cue in Cues(motion))
            {
                if (cue.at < elapsed - .04f) continue;
#if UNITY_WEBGL && !UNITY_EDITOR
                AzarashiAudioPlay(cue.clip, Mathf.Max(0, cue.at - elapsed));
#else
                if (index == sources.Count)
                {
                    var source = gameObject.AddComponent<AudioSource>();
                    source.playOnAwake = false;
                    source.spatialBlend = 0;
                    sources.Add(source);
                }
                var player = sources[index++];
                player.clip = clips[cue.clip];
                player.PlayScheduled(AudioSettings.dspTime + Mathf.Max(0, cue.at - elapsed));
#endif
            }
        }
        private void OnDestroy()
        {
            foreach (var clip in clips.Values) Destroy(clip);
        }
    }
}
