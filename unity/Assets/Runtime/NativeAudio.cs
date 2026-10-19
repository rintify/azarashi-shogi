using UnityEngine;
namespace Azarashi.UnityView
{
    public sealed class NativeAudio:MonoBehaviour
    {
        private AudioSource source;private AudioClip bite;
        private void Awake(){source=gameObject.AddComponent<AudioSource>();var rate=24000;var samples=new float[(int)(rate*.17f)];var phase=0f;for(var i=0;i<samples.Length;i++){var t=(float)i/rate;phase+=2*Mathf.PI*Mathf.Lerp(310,145,t/.17f)/rate;var envelope=Mathf.Sin(Mathf.PI*t/.17f)*Mathf.Exp(-t*16);samples[i]=(Mathf.Sin(phase)*.65f+Mathf.Sin(phase*2.1f)*.15f)*envelope*.32f;}bite=AudioClip.Create("Soft cute bite",samples.Length,1,rate,false);bite.SetData(samples,0);}
        public void Bite()=>source.PlayOneShot(bite,.55f);
    }
}
