using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Azarashi.UnityView
{
    public sealed class NativeEngine : MonoBehaviour
    {
        public bool Ready
        {
            get; private set;
        }
        public event Action<AiResult> Completed;
        public string Error
        {
            get; private set;
        }
        private Task<string> task;
        private int taskRevision;
        private int generation;
        private static readonly object SearchGate = new object();
        private readonly Dictionary<string, Inspection> cache = new Dictionary<string, Inspection>();
        private SearchProfile inspectionProfile;
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void AzarashiInit(byte[] bytes,int length);
        [DllImport("__Internal")] private static extern string AzarashiInspect(string request);
        [DllImport("__Internal")] private static extern void AzarashiSearch(string request,int revision);
        [DllImport("__Internal")] private static extern void AzarashiCancel();
        [DllImport("__Internal")] public static extern void AzarashiDownload(string name,string text);
        [DllImport("__Internal")] public static extern void AzarashiChooseReplay();
#else
        [DllImport("azarashi_engine")] private static extern IntPtr azarashi_process(byte[] input, UIntPtr length, [MarshalAs(UnmanagedType.I1)] bool inspect);
        [DllImport("azarashi_engine")] private static extern void azarashi_free(IntPtr pointer);
        [DllImport("azarashi_engine")] private static extern void azarashi_cancel();
        public static void AzarashiDownload(string name, string text)
        {
#if UNITY_EDITOR
            var path=UnityEditor.EditorUtility.SaveFilePanel("棋譜を保存","",name,System.IO.Path.GetExtension(name).TrimStart('.'));if(string.IsNullOrEmpty(path))return;
#else
            var path = System.IO.Path.Combine(Application.persistentDataPath, name);
#endif
            System.IO.File.WriteAllText(path, text);
        }
        public static void AzarashiChooseReplay()
        {
#if UNITY_EDITOR
            var path=UnityEditor.EditorUtility.OpenFilePanel("棋譜を読み込む","","json");if(!string.IsNullOrEmpty(path))GameObject.Find("NativeMatch").SendMessage("ImportReplay",System.IO.File.ReadAllText(path));
#endif
        }
#endif
        public void Initialize(NativeGameData data)
        {
            name = "NativeEngine";
            inspectionProfile = data.Profile(6);
#if UNITY_WEBGL && !UNITY_EDITOR
            var bytes=Resources.Load<TextAsset>("Native/azarashi_engine").bytes;AzarashiInit(bytes,bytes.Length);
#else
            Ready = true;
#endif
        }
        public void EngineReady(string _)
        {
            Ready = true;
        }
        public void EngineError(string message)
        {
            Error = message;
            Debug.LogError(message);
        }
        public void AiCompleted(string json)
        {
            var result = JsonUtility.FromJson<AiResult>(json);
            if (result.error != null)
                Error = result.error;
            Completed?.Invoke(result);
        }
        public void ClearCache() => cache.Clear();
        public Inspection Inspect(Position state, bool includePlacements = true)
        {
            var key = JsonUtility.ToJson(state) + includePlacements;
            if (cache.TryGetValue(key, out var found))
                return found;
            var request = RequestJson(new EngineRequest { state = state, profile = inspectionProfile, positionHistory = Array.Empty<string>() });
#if UNITY_WEBGL && !UNITY_EDITOR
            var response=AzarashiInspect(request);
#else
            var response = Call(request, true);
#endif
            var result = JsonUtility.FromJson<Inspection>(response);
            if (!string.IsNullOrEmpty(result.error))
                throw new InvalidOperationException(result.error);
            foreach (var move in result.moves)
            {
                if (string.IsNullOrEmpty(move.action.transformation?.type))
                    move.action.transformation = null;
                if (move.after.phase != "finished")
                    move.after.result = null;
                else if (string.IsNullOrEmpty(move.after.result?.winner))
                    move.after.result.winner = null;
            }
            if (!includePlacements)
                result.moves = Array.FindAll(result.moves, m => m.action.type == "move");
            if (cache.Count > 128)
                cache.Clear();
            cache[key] = result;
            return result;
        }
        public void Search(EngineRequest request)
        {
            var json = RequestJson(request);
            taskRevision = request.state.revision;
#if UNITY_WEBGL && !UNITY_EDITOR
            AzarashiSearch(json,taskRevision);
#else
            var token = System.Threading.Interlocked.Increment(ref generation);
            task = Task.Run(() => { lock (SearchGate) { if (System.Threading.Volatile.Read(ref generation) != token) return "{\"error\":\"cancelled\"}"; return Call(json, false); } });
#endif
        }
        public void Cancel()
        {
            System.Threading.Interlocked.Increment(ref generation);
#if UNITY_WEBGL && !UNITY_EDITOR
            AzarashiCancel();
#else
            azarashi_cancel();
#endif
            task = null;
        }
#if !UNITY_WEBGL || UNITY_EDITOR
        private static string Call(string request, bool inspect)
        {
            var input = Encoding.UTF8.GetBytes(request);
            var pointer = azarashi_process(input, (UIntPtr)input.Length, inspect);
            try
            {
                return Marshal.PtrToStringUTF8(pointer);
            }
            finally { azarashi_free(pointer); }
        }
#endif
        private void Update()
        {
            if (task == null || !task.IsCompleted)
                return;
            var completed = task;
            task = null;
            if (completed.IsFaulted)
            {
                EngineError(completed.Exception.ToString());
                return;
            }
            var result = JsonUtility.FromJson<AiResult>(completed.Result);
            result.revision = taskRevision;
            Completed?.Invoke(result);
        }
        private void OnDestroy()
        {
            Cancel();
        }
        // Unity's serializer expands null Serializable classes to empty objects. The Rust wire
        // contract deliberately uses JSON null for an ongoing outcome and absent transformation.
        private static string RequestJson(EngineRequest request)
        {
            var json = JsonUtility.ToJson(request);
            if (request.state.phase != "finished")
                json = Regex.Replace(json, "\"result\":\\{[^}]*\\}", "\"result\":null");
            else if (string.IsNullOrEmpty(request.state.result?.winner))
                json = json.Replace("\"winner\":\"\"", "\"winner\":null");
            return json;
        }
    }
}
