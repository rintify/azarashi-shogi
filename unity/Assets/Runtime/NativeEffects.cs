using UnityEngine;
namespace Azarashi.UnityView
{
    public static class NativeEffects
    {
        public static void Draw(NativeBoard board,NativeMotion motion,NativeGameData data)
        {
            if(motion==null||motion.Stage=="return")return;var t=motion.Progress;var pose=motion.Sample();var before=motion.Before;var held=motion.Stage=="choice"||motion.Stage=="choice-preview";
            var end=held?1:motion.Aerial?.34f:.56f;
            if(before!=null&&motion.Stage!="resolve"&&motion.Stage!="choice-preview"&&t>0&&t<end+.12f)
            {
                var jet=before.kind=="penguin"&&before.promoted;var orca=before.kind=="orca";
                if(jet||orca)
                {
                    for(var i=0;i<20;i++)
                    {var age=(t*5+i/20f)%1;var at=t-age*.22f;if(at<0||at>end)continue;var old=motion.Sample(at);var side=i%2==0?-1:1;var position=old.position+new Vector3(orca?side*(.35f+age*.45f):Mathf.Sin(i*7)*age*.2f,jet?.52f:.2f,0);board.Effect("trail"+i,position,Vector3.one*(jet?.09f:.06f)*(1-age),jet?"#6ce8ff":"#f4feff",(1-age)*.75f);}
                    if(jet){var direction=Quaternion.Euler(0,NativeGameData.Facing(before),0)*Vector3.forward;var thrust=Mathf.Sin(Mathf.Clamp01(t/end)*Mathf.PI);board.Effect("jet-flame",pose.position+Vector3.up*.54f-direction*.85f,new Vector3(.13f,.13f,.7f)*( .4f+thrust),"#32d9ff",.7f,false,NativeGameData.Facing(before));board.Effect("jet-core",pose.position+Vector3.up*.54f-direction*.62f,new Vector3(.065f,.065f,.38f),"#effeff",1,false,NativeGameData.Facing(before));}
                    if(orca)for(var i=0;i<5;i++){var age=(t*2.6f+i/5f)%1;var at=t-age*.22f;if(at<0||at>end)continue;var old=motion.Sample(at);board.Effect("wave"+i,new Vector3(old.position.x,.19f,old.position.z),new Vector3(.6f+age,1,.5f+age),i%2==0?"#53cfed":"#e8fdff",(1-age)*.65f,true);}
                }
            }
            if(!held&&motion.Action.action.transformation!=null)
            {
                var start=motion.Stage=="resolve"?.08f:.4f;var duration=motion.Stage=="resolve"?.54f:.34f;var change=Mathf.Clamp01((t-start)/duration);var intensity=Mathf.Sin(change*Mathf.PI);
                if(change>0&&change<1)for(var i=0;i<14;i++){var a=i*Mathf.PI*2/14+change*.8f;var radius=.55f+change*.6f;board.Effect("glint"+i,pose.position+Vector3.up*.8f+new Vector3(Mathf.Cos(a)*radius,Mathf.Sin(a*2)*radius*.65f,Mathf.Sin(a)*radius),new Vector3(.05f,.18f*intensity,.05f),i%3==0?"#ffec9e":"#d3faff",intensity);}
            }
            if(held||Time.unscaledTime<motion.Landing)return;
            var p=Mathf.Clamp01((Time.unscaledTime-motion.Landing)/.55f);if(p>=1)return;var center=data.Center(motion.Action.piece)+Vector3.up*.19f;
            board.Effect("impact",center,Vector3.one*(.3f+p*2.2f),motion.Action.captured.Length>0?"#ffbb74":"#a4f0ff",(1-p)*.65f,true);
            var king=motion.Action.piece.kind=="walrus";
            for(var i=0;i<(king?20:10);i++){var angle=i*2.39996f;var distance=king?.6f+Mathf.Sqrt(p)*(1+(i%3)*.18f):p*1.4f;var position=center+new Vector3(Mathf.Cos(angle)*distance,Mathf.Sin(p*Mathf.PI)*(king?.3f:.4f),Mathf.Sin(angle)*distance);var scale=king?(.16f+Mathf.Sin(p*Mathf.PI)*.22f):(1-p)*.07f;board.Effect("snow"+i,position,Vector3.one*scale,i%3==0?"#ffffff":"#d7edf7",(1-p)*(king?.58f:1));}
        }
    }
}
