using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Scripting;

namespace Azarashi.UnityView
{
    /// <summary>Unity GPU backend for the existing React scene graph. Receives no gameplay authority.</summary>
    [Preserve]
    public sealed class SceneRenderer : MonoBehaviour
    {
        private const int Protocol = 1;
        private readonly Dictionary<string, Mesh> meshes = new Dictionary<string, Mesh>();
        private readonly Dictionary<string, MeshGroup[]> groups = new Dictionary<string, MeshGroup[]>();
        private readonly Dictionary<string, Material> materials = new Dictionary<string, Material>();
        private readonly Dictionary<string, Texture2D> textures = new Dictionary<string, Texture2D>();
        private readonly Dictionary<string, RenderNode> nodes = new Dictionary<string, RenderNode>();
        private Camera view;
        private static readonly Matrix4x4 Mirror = Matrix4x4.Scale(new Vector3(1, 1, -1));
        private bool valid;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (FindAnyObjectByType<SceneRenderer>() == null)
                new GameObject("AzarashiRenderer").AddComponent<SceneRenderer>();
        }

        private void Awake()
        {
            #if UNITY_WEBGL && !UNITY_EDITOR
            WebGLInput.captureAllKeyboardInput = false;
            #endif
            Application.targetFrameRate = 60;
            Application.runInBackground = true;
            view = new GameObject("React scene camera").AddComponent<Camera>();
            view.clearFlags = CameraClearFlags.SolidColor;
            view.backgroundColor = new Color(0.45f, 0.74f, 0.88f);
            view.allowHDR = false;
            view.allowMSAA = true;
            view.nearClipPlane = 0.1f;
            view.farClipPlane = 160;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.68f, 0.77f, 0.81f);
            RenderSettings.ambientEquatorColor = new Color(0.38f, 0.45f, 0.49f);
            RenderSettings.ambientGroundColor = new Color(0.18f, 0.23f, 0.27f);
            QualitySettings.shadows = ShadowQuality.All;
            QualitySettings.shadowResolution = ShadowResolution.High;
            QualitySettings.shadowDistance = 60;
            QualitySettings.antiAliasing = 2;
            Sun("Warm sunlight", new Vector3(-7, 17, 5), new Color(1, 0.89f, 0.71f), 1.35f, true);
            Sun("Ice fill", new Vector3(8, 6, -6), new Color(0.29f, 0.72f, 1), 0.5f, false);
        }

        private static void Sun(string name, Vector3 position, Color color, float intensity, bool shadows)
        {
            var light = new GameObject(name).AddComponent<Light>();
            light.type = LightType.Directional;
            light.transform.position = position;
            light.transform.LookAt(Vector3.zero);
            light.color = color;
            light.intensity = intensity;
            light.shadows = shadows ? LightShadows.Soft : LightShadows.None;
            light.shadowBias = 0.02f;
            light.shadowNormalBias = 0.025f;
        }

        [Preserve]
        public void ApplyFrame(string json)
        {
            var frame = JsonUtility.FromJson<RenderFrame>(json);
            if (frame == null || frame.protocol != Protocol)
            {
                Debug.LogError("Unsupported React/Unity rendering protocol");
                return;
            }
            foreach (var id in frame.removedNodes) nodes.Remove(id);
            foreach (var id in frame.removedMeshes)
            {
                if (meshes.TryGetValue(id, out var mesh)) Destroy(mesh);
                meshes.Remove(id);
                groups.Remove(id);
            }
            foreach (var id in frame.removedMaterials)
            {
                if (materials.TryGetValue(id, out var material)) Destroy(material);
                materials.Remove(id);
                if (textures.TryGetValue(id, out var texture)) Destroy(texture);
                textures.Remove(id);
            }
            foreach (var resource in frame.meshes) SetMesh(resource);
            foreach (var resource in frame.materials) SetMaterial(resource);
            foreach (var node in frame.nodes) nodes[node.id] = node;
            var world = Mirror * Matrix(frame.camera.world) * Mirror;
            view.transform.SetPositionAndRotation(world.GetColumn(3), world.rotation);
            view.nearClipPlane = frame.camera.near;
            view.farClipPlane = frame.camera.far;
            view.worldToCameraMatrix = Matrix(frame.camera.world).inverse * Mirror;
            view.projectionMatrix = Matrix(frame.camera.projection);
            view.cullingMatrix = view.projectionMatrix * view.worldToCameraMatrix;
            view.backgroundColor = ColorOf(frame.background, 1).gamma;
            if (!valid) Debug.Log("React/Unity connected: " + nodes.Count + " nodes, " + meshes.Count + " meshes, camera=" + view.transform.position + ", firstShader=" + Shader.Find("Azarashi/Surface"));
            valid = true;
        }

        public static Matrix4x4 Matrix(float[] values)
        {
            var matrix = new Matrix4x4();
            for (var i = 0; i < 16; i++) matrix[i] = values[i];
            return matrix;
        }
        private static Color ColorOf(float[] values, float alpha) => new Color(values[0], values[1], values[2], alpha);

        private void SetMesh(MeshResource resource)
        {
            if (meshes.TryGetValue(resource.id, out var old)) Destroy(old);
            var mesh = new Mesh { name = resource.id, indexFormat = IndexFormat.UInt32 };
            var vertices = new Vector3[resource.positions.Length / 3];
            var normals = new Vector3[vertices.Length];
            var uv = new Vector2[vertices.Length];
            for (var i = 0; i < vertices.Length; i++)
            {
                vertices[i] = new Vector3(resource.positions[i * 3], resource.positions[i * 3 + 1], -resource.positions[i * 3 + 2]);
                if (resource.normals.Length == resource.positions.Length)
                    normals[i] = new Vector3(resource.normals[i * 3], resource.normals[i * 3 + 1], -resource.normals[i * 3 + 2]);
                if (resource.uv.Length == vertices.Length * 2) uv[i] = new Vector2(resource.uv[i * 2], resource.uv[i * 2 + 1]);
            }
            mesh.vertices = vertices;
            mesh.uv = uv;
            mesh.subMeshCount = resource.groups.Length + 1;
            mesh.SetTriangles(Reversed(resource.indices, 0, resource.indices.Length), 0);
            for (var i = 0; i < resource.groups.Length; i++)
                mesh.SetTriangles(Reversed(resource.indices, resource.groups[i].start, resource.groups[i].count), i + 1);
            if (resource.normals.Length == resource.positions.Length) mesh.normals = normals;
            else mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            meshes[resource.id] = mesh;
            groups[resource.id] = resource.groups;
        }

        private static int[] Reversed(int[] indices, int start, int count)
        {
            var output = new int[count];
            for (var i = 0; i < count; i += 3)
            { output[i] = indices[start + i]; output[i + 1] = indices[start + i + 2]; output[i + 2] = indices[start + i + 1]; }
            return output;
        }

        private void SetMaterial(MaterialResource resource)
        {
            var shader = Shader.Find(resource.shader == "ocean" ? "Azarashi/Ocean" : resource.shader == "lit" ? "Azarashi/Surface" : "Azarashi/Unlit");
            if (!materials.TryGetValue(resource.id, out var material))
                materials[resource.id] = material = new Material(shader) { name = resource.id, enableInstancing = true };
            material.shader = shader;
            // Shader Color properties are converted from sRGB by Unity. The wire already carries
            // Three's linear values, so convert back before handing them to the material system.
            material.SetColor("_Color", ColorOf(resource.color, resource.opacity).gamma);
            material.SetColor("_Emission", ColorOf(resource.emissive, 1).gamma);
            material.SetFloat("_Smoothness", 1 - resource.roughness);
            material.SetFloat("_Metallic", resource.metalness);
            material.SetFloat("_Cull", resource.side == 2 ? (float)CullMode.Off : resource.side == 1 ? (float)CullMode.Front : (float)CullMode.Back);
            material.SetFloat("_ZWrite", resource.depthWrite ? 1 : 0);
            material.SetFloat("_ZTest", resource.depthTest ? (float)CompareFunction.LessEqual : (float)CompareFunction.Always);
            material.SetFloat("_SrcBlend", resource.transparent ? (float)BlendMode.SrcAlpha : (float)BlendMode.One);
            material.SetFloat("_DstBlend", resource.additive ? (float)BlendMode.One : resource.transparent ? (float)BlendMode.OneMinusSrcAlpha : (float)BlendMode.Zero);
            material.renderQueue = resource.transparent ? 3000 : 2000;
            if (!string.IsNullOrEmpty(resource.texture) && !textures.ContainsKey(resource.id))
            {
                var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
                texture.LoadImage(Convert.FromBase64String(resource.texture));
                textures[resource.id] = texture;
                material.SetTexture("_MainTex", texture);
            }
        }

        private void Draw(RenderNode node, int submesh, string materialId, Matrix4x4 world)
        {
            if (!materials.TryGetValue(materialId, out var material) || !meshes.TryGetValue(node.mesh, out var mesh)) return;
            Graphics.DrawMesh(mesh, world, material, 0, null, submesh, null,
                node.castShadow ? ShadowCastingMode.On : ShadowCastingMode.Off,
                node.receiveShadow, null, LightProbeUsage.Off);
        }

        private void LateUpdate()
        {
            if (!valid) return;
            foreach (var node in nodes.Values)
            {
                if (!node.visible) continue;
                var world = Mirror * Matrix(node.matrix) * Mirror;
                if (node.materials.Length == 1) Draw(node, 0, node.materials[0], world);
                else if (groups.TryGetValue(node.mesh, out var submeshes))
                    for (var i = 0; i < submeshes.Length; i++)
                        if (submeshes[i].materialIndex < node.materials.Length)
                            Draw(node, i + 1, node.materials[submeshes[i].materialIndex], world);
            }
        }

        private void OnDestroy()
        {
            foreach (var mesh in meshes.Values) Destroy(mesh);
            foreach (var material in materials.Values) Destroy(material);
            foreach (var texture in textures.Values) Destroy(texture);
        }
    }
}
