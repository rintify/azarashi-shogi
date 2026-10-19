using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Azarashi.UnityView
{
    // Files use Unity's persistent storage (IndexedDB on WebGL), without a silent replay cap.
    public static class NativeStorage
    {
        private static string FilePath(string key) => Path.Combine(Application.persistentDataPath, "azarashi-" + key + ".json");
        public static string Read(string key, string legacyKey)
        {
            var path = FilePath(key);
            return File.Exists(path) ? File.ReadAllText(path) : PlayerPrefs.GetString(legacyKey, "");
        }
        public static void Write(string key, string json)
        {
            Directory.CreateDirectory(Application.persistentDataPath);
            var path = FilePath(key);
            var temporary = path + ".tmp";
            File.WriteAllText(temporary, json);
            if (File.Exists(path))
                File.Copy(path, path + ".backup", true);
            File.Copy(temporary, path, true);
            File.Delete(temporary);
        }
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void AzarashiFlushStorage();
#endif
        public static void Flush()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            AzarashiFlushStorage();
#endif
        }
    }
    public static class NativeJson
    {
        // JsonUtility represents absent inline classes as empty objects; restore the shared wire contract.
        private static MatchRecord Normalize(MatchRecord record)
        {
            if (record?.settings != null)
            {
                if (string.IsNullOrEmpty(record.settings.mode))
                    record.settings.mode = "human-vs-ai";
                if (record.settings.aiLevels?.south == 0 && record.settings.aiLevels?.north == 0)
                    record.settings.aiLevels = null;
            }
            return record;
        }
        public static MatchRecord Record(string json) => Normalize(JsonUtility.FromJson<MatchRecord>(json));
        public static ReplayList Library(string json)
        {
            var library = JsonUtility.FromJson<ReplayList>(json) ?? new ReplayList();
            if (library.items == null)
                library.items = new System.Collections.Generic.List<MatchRecord>();
            foreach (var record in library.items)
                Normalize(record);
            return library;
        }
        public static string Encode(object value, bool pretty = false)
        {
            var json = JsonUtility.ToJson(value, pretty);
            json = Regex.Replace(json, "\"transformation\"\\s*:\\s*\\{\\s*\"type\"\\s*:\\s*\"\"[^}]*\\}", "\"transformation\":null");
            json = Regex.Replace(json, "\"result\"\\s*:\\s*\\{\\s*\"winner\"\\s*:\\s*\"\"\\s*,\\s*\"reason\"\\s*:\\s*\"\"\\s*\\}", "\"result\":null");
            return Regex.Replace(json, ",?\\s*\"aiLevels\"\\s*:\\s*\\{\\s*\"south\"\\s*:\\s*0\\s*,\\s*\"north\"\\s*:\\s*0\\s*\\}", "");
        }
    }
}
