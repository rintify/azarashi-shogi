using System;
using System.IO;
using System.Linq;
using UnityEngine;

namespace Azarashi.UnityView.Editor
{
    /// <summary>Checks the Unity serializer and native Rust boundary before spending time on a Web build.</summary>
    public static class NativeValidation
    {
        public static void Run()
        {
            var data=new NativeGameData();var host=new GameObject("NativeEngine validation");
            try
            {
                var engine=host.AddComponent<NativeEngine>();engine.Initialize(data);
                var record=NativeJson.Record(Resources.Load<TextAsset>("Native/smoke").text);
                var state=data.Config.initial.Copy();var captures=0;var changes=0;
                foreach(var action in record.actions)
                {
                    var inspection=engine.Inspect(state);
                    if(NativeActions.Find(inspection,new GameAction{type="move",pieceId="not-a-piece",to=new Cell(-1,-1)})!=null)throw new Exception("Invalid action accepted.");
                    var preview=NativeActions.Find(inspection,action);
                    if(preview==null)throw new Exception("Native replay diverges at ply "+state.revision);
                    captures+=preview.captured.Length;if(preview.action.transformation!=null)changes++;
                    state=preview.after;
                    if(data.Body(preview.piece).Any(c=>c.x<0||c.x>9||c.y<0||c.y>9))throw new Exception("Native footprint is outside board.");
                }
                if(state.phase!="finished"||captures<3||changes<2)throw new Exception("Smoke record did not exercise capture, both transformations and a finished match.");
                var library=NativeJson.Library(NativeJson.Encode(new ReplayList{items=new System.Collections.Generic.List<MatchRecord>{record}}));
                if(library.items.Count!=1||library.items[0].settings.aiLevels!=null)throw new Exception("Optional AI levels changed during library persistence.");
                record=library.items[0];
                var encoded=NativeJson.Encode(record,true);
                if(encoded.Contains("\"type\": \"\"")||encoded.Contains("\"south\": 0"))throw new Exception("Absent optional fields were not normalized.");
                // Keep a concrete Unity-produced record for the original TypeScript decoder to verify.
                var directory=Path.GetFullPath("../.openai");Directory.CreateDirectory(directory);
                File.WriteAllText(Path.Combine(directory,"unity-roundtrip.json"),encoded);
                Debug.Log("Native Unity validation passed: "+record.actions.Count+" plies, "+captures+" captures, "+changes+" transformations; winner="+state.result.winner);
            }
            finally{UnityEngine.Object.DestroyImmediate(host);}
        }
    }
}
