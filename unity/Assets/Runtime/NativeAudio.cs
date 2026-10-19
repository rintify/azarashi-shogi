using System;
using UnityEngine;
namespace Azarashi.UnityView
{
    /// <summary>PCM rendered from the original scheduleBite, including its envelopes and low-pass breath.</summary>
    public sealed class NativeAudio : MonoBehaviour
    {
        private AudioSource source;
        private AudioClip bite;
        private void Awake()
        {
            source = gameObject.AddComponent<AudioSource>();
            var bytes = Resources.Load<TextAsset>("Native/Audio/Bite").bytes;
            var rate = BitConverter.ToInt32(bytes, 0);
            var count = BitConverter.ToInt32(bytes, 4);
            var samples = new float[count];
            Buffer.BlockCopy(bytes, 8, samples, 0, count * sizeof(float));
            bite = AudioClip.Create("Original soft bite", count, 1, rate, false);
            bite.SetData(samples, 0);
        }
        public void Bite() => source.PlayOneShot(bite);
        private void OnDestroy()
        {
            if (bite != null)
                Destroy(bite);
        }
    }
}
