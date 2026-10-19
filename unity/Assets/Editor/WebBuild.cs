using System;
using System.IO;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

namespace Azarashi.UnityView.Editor
{
    public static class WebBuild
    {
        public static void Build()
        {
            var output = Environment.GetEnvironmentVariable("AZARASHI_UNITY_OUTPUT");
            if (string.IsNullOrWhiteSpace(output)) throw new InvalidOperationException("AZARASHI_UNITY_OUTPUT must be set");
            Directory.CreateDirectory("Assets/Scenes");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            EditorSceneManager.SaveScene(scene, "Assets/Scenes/Game.unity");
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene("Assets/Scenes/Game.unity", true) };
            PlayerSettings.companyName = "Azarashi Shogi";
            PlayerSettings.productName = "アザラシ将棋";
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.runInBackground = true;
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.initialMemorySize = 64;
            PlayerSettings.WebGL.maximumMemorySize = 512;
            PlayerSettings.WebGL.decompressionFallback = false;
            PlayerSettings.WebGL.dataCaching = true;
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;
            // The React page owns keyboard focus and DOM input. Unity only renders.
            var graphics = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/GraphicsSettings.asset");
            if (graphics.Length > 0)
            {
                var settings = new SerializedObject(graphics[0]);
                var shaders = settings.FindProperty("m_AlwaysIncludedShaders");
                var included = new HashSet<UnityEngine.Object>();
                for (var i = 0; i < shaders.arraySize; i++)
                    if (shaders.GetArrayElementAtIndex(i).objectReferenceValue != null)
                        included.Add(shaders.GetArrayElementAtIndex(i).objectReferenceValue);
                var instancing = settings.FindProperty("m_InstancingStripping");
                instancing.enumValueIndex = Array.FindIndex(instancing.enumNames, name => name == "KeepAll");
                foreach (var shaderName in new[] { "Azarashi/Surface", "Azarashi/Unlit", "Azarashi/Ocean" })
                {
                    var shader = Shader.Find(shaderName);
                    if (shader == null) throw new Exception("Missing renderer shader: " + shaderName);
                    included.Add(shader);
                }
                shaders.arraySize = included.Count;
                var index = 0;
                foreach (var shader in included) shaders.GetArrayElementAtIndex(index++).objectReferenceValue = shader;
                settings.ApplyModifiedPropertiesWithoutUndo();
            }
            AssetDatabase.SaveAssets();
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = new[] { "Assets/Scenes/Game.unity" }, locationPathName = output,
                target = BuildTarget.WebGL, options = BuildOptions.None
            });
            if (report.summary.result != BuildResult.Succeeded) throw new Exception("Unity Web build failed: " + report.summary.result);
        }
    }
}
