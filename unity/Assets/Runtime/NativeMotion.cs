using UnityEngine;

namespace Azarashi.UnityView
{
    public struct NativePose { public Vector3 position;public float yaw,scale,morph;public bool promoted; }
    public sealed class NativeMotion
    {
        public Preview Action;
        public PieceState Before;
        public Position BeforeState;
        public float Started,Duration;
        public string Stage;
        private NativePose resolveFrom;
        private readonly NativeGameData data;
        public bool Aerial=>Stage=="choice"||Stage=="choice-preview"||Stage=="resolve"||Action.action.transformation!=null;
        public float Progress=>Mathf.Clamp01((Time.unscaledTime-Started)/Duration);
        public bool Done=>Stage!="choice"&&Stage!="choice-preview"&&Time.unscaledTime-Started>=Duration+.65f;
        public NativeMotion(NativeGameData data,Position before,Preview action,bool choice=false)
        {
            this.data=data;BeforeState=before;Action=action;Before=action.action.type=="move"?System.Array.Find(before.pieces,p=>p.id==action.piece.id):null;
            Stage=choice?"choice":"travel";Started=Time.unscaledTime;
            Duration=choice?.65f:Before==null?.64f:action.action.transformation!=null?1.85f:action.captured.Length>0?1.1f:Before.kind=="walrus"?1.05f:.76f;
        }
        public void Preview(Preview candidate){resolveFrom=Sample();Action=candidate;Stage="choice-preview";Started=Time.unscaledTime;Duration=.28f;}
        public void Resolve(Preview candidate){resolveFrom=Sample();Action=candidate;Stage="resolve";Started=Time.unscaledTime;Duration=candidate.action.transformation!=null?1.1f:.65f;}
        public void Return(){resolveFrom=Sample();Stage="return";Started=Time.unscaledTime;Duration=.32f;}
        private static float Smooth(float t)=>Mathf.SmoothStep(0,1,Mathf.Clamp01(t));
        public NativePose Sample(float sampleAt=-1)
        {
            var t=sampleAt<0?Progress:Mathf.Clamp01(sampleAt);var after=Action.piece;var final=data.Center(after);
            if(Stage=="return")return new NativePose{position=Vector3.Lerp(resolveFrom.position,data.Center(Before),Smooth(t)),yaw=Mathf.Lerp(resolveFrom.yaw,NativeGameData.Facing(Before),Smooth(t)),scale=1,promoted=Before.promoted,morph=Before.promoted?1:0};
            if(Stage=="choice-preview")return new NativePose{position=Vector3.Lerp(resolveFrom.position,final+Vector3.up*1.45f,Smooth(t)),yaw=Mathf.Lerp(resolveFrom.yaw,NativeGameData.Facing(after),Smooth(t)),scale=1,promoted=t>.5f?after.promoted:Before.promoted,morph=Mathf.Lerp(resolveFrom.morph,after.promoted?1:0,Smooth(t))};
            if(Before==null)return new NativePose{position=final+Vector3.up*(1-Smooth(t/.7f))*1.8f,yaw=NativeGameData.Facing(after),scale=.5f+.5f*Smooth(t/.45f),promoted=after.promoted,morph=after.promoted?1:0};
            var landingPiece=new PieceState{kind=Before.kind,promoted=Before.promoted,at=Action.action.to};var landing=data.Center(landingPiece);
            var move=Stage=="resolve"?1:Smooth(t/(Stage=="choice"?1:Aerial?.34f:.56f));
            var change=Stage=="choice"?0:Action.action.transformation==null?0:Smooth((t-(Stage=="resolve"?.08f:.4f))/(Stage=="resolve"?.54f:.34f));
            var position=Vector3.Lerp(data.Center(Before),landing,move);var yaw=NativeGameData.Facing(Before);
            if(Action.action.transformation?.type=="rotate"&&change>0)
            {
                var cells=new System.Collections.Generic.List<Cell>(data.Body(landingPiece));var pivot=cells[Action.action.transformation.pivot];var center=new Vector3(pivot.x-4.5f,0,pivot.y-4.5f);var angle=Action.action.transformation.direction*Mathf.PI*.5f*change;var delta=landing-center;
                position=center+new Vector3(delta.x*Mathf.Cos(angle)-delta.z*Mathf.Sin(angle),0,delta.x*Mathf.Sin(angle)+delta.z*Mathf.Cos(angle));yaw=Mathf.Lerp(NativeGameData.Facing(Before),NativeGameData.Facing(after),change);
            }
            if(Aerial){var descent=Stage=="choice"?0:Smooth((t-(Stage=="resolve"?(Action.action.transformation!=null?.68f:.1f):.78f))/(Stage=="resolve"?(Action.action.transformation!=null?.32f:.9f):.22f));position.y=1.45f*move*(1-descent);}
            else position.y=Mathf.Sin(move*Mathf.PI)*(Before.kind=="bear"?1.65f:Before.kind=="orca"?.12f:Before.kind=="walrus"?.55f:Before.kind=="penguin"&&Before.promoted?.15f:.28f);
            if(Stage=="resolve"){var blend=Smooth(t/.62f);position.x=Mathf.Lerp(resolveFrom.position.x,final.x,blend);position.z=Mathf.Lerp(resolveFrom.position.z,final.z,blend);yaw=Mathf.Lerp(resolveFrom.yaw,NativeGameData.Facing(after),blend);}
            return new NativePose{position=position,yaw=yaw,scale=1+Mathf.Sin(change*Mathf.PI)*.12f,promoted=change>.5f?after.promoted:Before.promoted,morph=Before.promoted?1-change:change};
        }
        public float CaptureProgress(PieceState victim)
        {
            if(Stage=="choice"||Stage=="choice-preview"||Stage=="return")return 0;
            var at=Aerial?.84f:Before==null?.66f:.56f;return Smooth((Progress-at)/(Aerial?.12f:.16f));
        }
        public float Landing=>Stage=="choice"||Stage=="choice-preview"||Stage=="return"?float.PositiveInfinity:Started+Duration*(Aerial?.84f:Before==null?.66f:.56f);
    }
}
