using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Scripting;

namespace Azarashi.UnityView
{
    /// <summary>Unity renderer for exported TSX assets. Receives no gameplay authority.</summary>
    [Preserve]
    public sealed class SceneRenderer : MonoBehaviour
    {
        private const int Protocol = 1;
        private readonly Dictionary<string, Mesh> meshes = new Dictionary<string, Mesh>();
        private readonly Dictionary<string, Vector3[]> vertices = new Dictionary<string, Vector3[]>();
        private readonly Dictionary<string, int[]> triangles = new Dictionary<string, int[]>();
        private readonly List<Material> oceans = new List<Material>();
        private readonly Dictionary<string, MeshGroup[]> groups = new Dictionary<string, MeshGroup[]>();
        private readonly Dictionary<string, Material> materials = new Dictionary<string, Material>();
        private readonly Dictionary<string, int> queues = new Dictionary<string, int>();
        private readonly Dictionary<string, Texture2D> textures = new Dictionary<string, Texture2D>();
        private readonly Dictionary<string, RenderNode> nodes = new Dictionary<string, RenderNode>();
        private Camera view;
        private static readonly Matrix4x4 Mirror = Matrix4x4.Scale(new Vector3(1, 1, -1));
        private bool valid;
        private float environmentIntensity;
        private readonly MaterialPropertyBlock drawProperties = new MaterialPropertyBlock();
        private readonly SourceShadow[] sourceShadows = new SourceShadow[2];
        private readonly Material[] shadowCasters = new Material[3];
        private sealed class SourceShadow
        {
            public Camera camera;
            public RenderTexture texture;
            public Matrix4x4 matrix;
        }
        private readonly Dictionary<string, Vector2> anchors = new Dictionary<string, Vector2>();
        private Matrix4x4 anchorCamera;
        public Camera Camera => view;
        public void LoadAssets(RenderFrame frame)
        {
            foreach (var mesh in frame.meshes)
                SetMesh(mesh);
            foreach (var material in frame.materials)
                SetMaterial(material);
        }
        public void MaterialColor(string id, Color color)
        {
            if (materials.TryGetValue(id, out var m))
                m.SetVector("_Color", new Vector4(color.r, color.g, color.b, color.a));
        }
        public void PutNode(RenderNode node)
        {
            nodes[node.id] = node;
            valid = true;
            if (node.id.StartsWith("piece:"))
                anchors.Clear();
        }
        public void RemoveNode(string id) => nodes.Remove(id);
        public void OceanTime(float time)
        {
            foreach (var material in oceans)
                material.SetFloat("_OceanTime", time);
        }
        public Vector2 SurfaceAnchor(string prefix)
        {
            var vp = view.projectionMatrix * view.worldToCameraMatrix;
            if (vp != anchorCamera)
            {
                anchors.Clear();
                anchorCamera = vp;
            }
            if (anchors.TryGetValue(prefix, out var cached))
                return cached;
            var score = float.NegativeInfinity;
            var anchor = Vector2.zero;
            foreach (var node in nodes.Values)
            {
                if (!node.visible || !node.id.StartsWith(prefix) || !vertices.TryGetValue(node.mesh, out var points))
                    continue;
                var world = Mirror * Matrix(node.matrix) * Mirror;
                var matrix = vp * world;
                foreach (var point in points)
                {
                    var screen = matrix.MultiplyPoint(point);
                    var x = (screen.x + 1) * Screen.width * .5f;
                    var y = (screen.y + 1) * Screen.height * .5f;
                    if (x + y > score)
                    {
                        score = x + y;
                        anchor = new Vector2(x, y);
                    }
                }
            }
            anchors[prefix] = anchor;
            return anchor;
        }
        public bool Pick(Ray ray, out string pieceId, out Vector3 point)
        {
            var nearest = float.PositiveInfinity;
            pieceId = null;
            point = Vector3.zero;
            foreach (var node in nodes.Values)
            {
                if (!node.visible || !node.id.StartsWith("piece:") || !meshes.TryGetValue(node.mesh, out var mesh))
                    continue;
                var world = Mirror * Matrix(node.matrix) * Mirror;
                var inverse = world.inverse;
                var origin = inverse.MultiplyPoint3x4(ray.origin);
                var direction = inverse.MultiplyVector(ray.direction);
                var localRay = new Ray(origin, direction);
                if (!mesh.bounds.IntersectRay(localRay))
                    continue;
                var points = vertices[node.mesh];
                var indices = triangles[node.mesh];
                for (var i = 0; i < indices.Length; i += 3)
                {
                    var a = points[indices[i]];
                    var b = points[indices[i + 1]];
                    var c = points[indices[i + 2]];
                    var e1 = b - a;
                    var e2 = c - a;
                    var h = Vector3.Cross(direction, e2);
                    var det = Vector3.Dot(e1, h);
                    if (Mathf.Abs(det) < .0000001f)
                        continue;
                    var f = 1 / det;
                    var s = origin - a;
                    var u = f * Vector3.Dot(s, h);
                    if (u < 0 || u > 1)
                        continue;
                    var q = Vector3.Cross(s, e1);
                    var v = f * Vector3.Dot(direction, q);
                    if (v < 0 || u + v > 1)
                        continue;
                    var t = f * Vector3.Dot(e2, q);
                    if (t < 0)
                        continue;
                    var hit = world.MultiplyPoint3x4(origin + direction * t);
                    var distance = Vector3.Distance(ray.origin, hit);
                    if (distance >= nearest)
                        continue;
                    nearest = distance;
                    point = hit;
                    pieceId = node.id.Substring(6, node.id.LastIndexOf(':') - 6);
                }
            }
            return pieceId != null;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (FindAnyObjectByType<NativeMatch>() == null)
                new GameObject("NativeMatch").AddComponent<NativeMatch>();
        }

        private void Awake()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            WebGLInput.captureAllKeyboardInput = true;
#endif
            Application.targetFrameRate = 60;
            Application.runInBackground = true;
            view = new GameObject("Native game camera").AddComponent<Camera>();
            view.gameObject.AddComponent<AudioListener>();
            view.clearFlags = CameraClearFlags.SolidColor;
            view.backgroundColor = new Color(0.45f, 0.74f, 0.88f);
            view.allowHDR = false;
            view.cullingMask = 1;
            view.allowMSAA = true;
            view.nearClipPlane = 0.1f;
            view.farClipPlane = 160;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.68f, 0.77f, 0.81f);
            RenderSettings.ambientEquatorColor = new Color(0.38f, 0.45f, 0.49f);
            RenderSettings.ambientGroundColor = new Color(0.18f, 0.23f, 0.27f);
            QualitySettings.shadows = ShadowQuality.Disable;
            QualitySettings.shadowResolution = ShadowResolution.High;
            QualitySettings.shadowDistance = 60;
            QualitySettings.antiAliasing = 2;
            Debug.Log("Native renderer: activeColorSpace=" + QualitySettings.activeColorSpace + ", graphics=" + SystemInfo.graphicsDeviceType + ", sRGBWrite=" + GL.sRGBWrite);

        }

        public void ConfigureLighting(LightingSettings settings, LightingSettings catalog)
        {
            environmentIntensity = settings.environmentIntensity;
            ColorUtility.TryParseHtmlString(settings.hemisphere.sky, out var sky);
            ColorUtility.TryParseHtmlString(settings.hemisphere.ground, out var ground);
            RenderSettings.ambientSkyColor = sky * settings.hemisphere.intensity;
            RenderSettings.ambientGroundColor = ground * settings.hemisphere.intensity;
            RenderSettings.ambientEquatorColor = Color.Lerp(sky, ground, .5f) * settings.hemisphere.intensity;
            Shader.SetGlobalVector("_OriginalSky", (Vector4)(sky.linear * settings.hemisphere.intensity));
            Shader.SetGlobalVector("_OriginalGround", (Vector4)(ground.linear * settings.hemisphere.intensity));
            var directions = new Vector4[2];
            var colors = new Vector4[2];
            for (var i = 0; i < settings.directional.Length; i++)
            {
                var light = settings.directional[i];
                directions[i] = new Vector3(light.position[0], light.position[1], -light.position[2]).normalized;
                ColorUtility.TryParseHtmlString(light.color, out var c);
                colors[i] = (Vector4)(c.linear * light.intensity);
            }
            ColorUtility.TryParseHtmlString(catalog.hemisphere.sky, out var catalogSky);
            ColorUtility.TryParseHtmlString(catalog.hemisphere.ground, out var catalogGround);
            Shader.SetGlobalVector("_CatalogSky", (Vector4)(catalogSky.linear * catalog.hemisphere.intensity));
            Shader.SetGlobalVector("_CatalogGround", (Vector4)(catalogGround.linear * catalog.hemisphere.intensity));
            var catalogLight = catalog.directional[0];
            Shader.SetGlobalVector("_CatalogLightDirection", new Vector3(catalogLight.position[0], catalogLight.position[1], -catalogLight.position[2]).normalized);
            ColorUtility.TryParseHtmlString(catalogLight.color, out var catalogColor);
            Shader.SetGlobalVector("_CatalogLightColor", (Vector4)(catalogColor.linear * catalogLight.intensity));
            Shader.SetGlobalVectorArray("_OriginalLightDirection", directions);
            Shader.SetGlobalVectorArray("_OriginalLightColor", colors);
            var bytes = Resources.Load<TextAsset>("Native/Lighting/Environment").bytes;
            var width = BitConverter.ToInt32(bytes, 0);
            var height = BitConverter.ToInt32(bytes, 4);
            var pixels = new byte[bytes.Length - 8];
            Buffer.BlockCopy(bytes, 8, pixels, 0, pixels.Length);
            var environment = new Texture2D(width, height, TextureFormat.RGBAHalf, false, true) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp };
            environment.LoadRawTextureData(pixels);
            environment.Apply(false, true);
            textures["original-environment"] = environment;
            Shader.SetGlobalTexture("_OriginalEnvironment", environment);
            Shader.SetGlobalVector("_OriginalEnvironmentSize", new Vector4(width, height, Mathf.Log(height / 4f, 2), 0));
            CreateShadow(settings.directional[0].shadow, 0, Vector3.zero);
            CreateShadow(catalogLight.shadow, 1, new Vector3(50, 0, 0));
            for (var i = 0; i < shadowCasters.Length; i++)
            {
                shadowCasters[i] = new Material(Shader.Find("Azarashi/SourceDepth"));
                shadowCasters[i].SetFloat("_Cull", i);
            }
        }
        private void CreateShadow(ShadowSettings settings, int index, Vector3 offset)
        {
            var camera = new GameObject("Original shadow camera " + index).AddComponent<Camera>();
            var texture = new RenderTexture((int)settings.mapSize[0], (int)settings.mapSize[1], 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Linear)
            { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp, antiAliasing = 1 };
            texture.Create();
            camera.depth = -10 + index;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = Color.white;
            camera.allowHDR = camera.allowMSAA = false;
            camera.cullingMask = 1 << (2 + index);
            camera.targetTexture = texture;
            camera.orthographic = true;
            camera.worldToCameraMatrix = Matrix(settings.view) * Mirror * Matrix4x4.Translate(-offset);
            camera.projectionMatrix = Matrix(settings.projection);
            camera.transform.position = camera.worldToCameraMatrix.inverse.GetColumn(3);
            var matrix = Matrix(settings.matrix) * Mirror * Matrix4x4.Translate(-offset);
            sourceShadows[index] = new SourceShadow { camera = camera, texture = texture, matrix = matrix };
            var prefix = index == 0 ? "_SourceShadow" : "_CatalogShadow";
            Shader.SetGlobalMatrix(prefix + "Matrix", matrix);
            Shader.SetGlobalTexture(prefix + "Map", texture);
            Shader.SetGlobalVector(prefix + "Settings", new Vector4(settings.mapSize[0], settings.mapSize[1], settings.bias, settings.normalBias));
            Shader.SetGlobalFloat(prefix + "Intensity", settings.intensity);
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
            foreach (var id in frame.removedNodes)
                nodes.Remove(id);
            foreach (var id in frame.removedMeshes)
            {
                if (meshes.TryGetValue(id, out var mesh))
                    Destroy(mesh);
                meshes.Remove(id);
                groups.Remove(id);
            }
            foreach (var id in frame.removedMaterials)
            {
                if (materials.TryGetValue(id, out var material))
                    Destroy(material);
                materials.Remove(id);
                queues.Remove(id);
                if (textures.TryGetValue(id, out var texture))
                    Destroy(texture);
                textures.Remove(id);
            }
            foreach (var resource in frame.meshes)
                SetMesh(resource);
            foreach (var resource in frame.materials)
                SetMaterial(resource);
            foreach (var node in frame.nodes)
                nodes[node.id] = node;
            var world = Mirror * Matrix(frame.camera.world) * Mirror;
            view.transform.SetPositionAndRotation(world.GetColumn(3), world.rotation);
            view.nearClipPlane = frame.camera.near;
            view.farClipPlane = frame.camera.far;
            view.worldToCameraMatrix = Matrix(frame.camera.world).inverse * Mirror;
            view.projectionMatrix = Matrix(frame.camera.projection);
            view.cullingMatrix = view.projectionMatrix * view.worldToCameraMatrix;
            view.backgroundColor = ColorOf(frame.background, 1).gamma;
            if (!valid)
                Debug.Log("React/Unity connected: " + nodes.Count + " nodes, " + meshes.Count + " meshes, camera=" + view.transform.position + ", firstShader=" + Shader.Find("Azarashi/Surface"));
            valid = true;
        }

        public static Matrix4x4 Matrix(float[] values)
        {
            var matrix = new Matrix4x4();
            for (var i = 0; i < 16; i++)
                matrix[i] = values[i];
            return matrix;
        }
        private static Color ColorOf(float[] values, float alpha) => new Color(values[0], values[1], values[2], alpha);

        private void SetMesh(MeshResource resource)
        {
            if (meshes.TryGetValue(resource.id, out var old))
                Destroy(old);
            var mesh = new Mesh { name = resource.id, indexFormat = IndexFormat.UInt32 };
            var vertices = new Vector3[resource.positions.Length / 3];
            var normals = new Vector3[vertices.Length];
            var uv = new Vector2[vertices.Length];
            for (var i = 0; i < vertices.Length; i++)
            {
                vertices[i] = new Vector3(resource.positions[i * 3], resource.positions[i * 3 + 1], -resource.positions[i * 3 + 2]);
                if (resource.normals.Length == resource.positions.Length)
                    normals[i] = new Vector3(resource.normals[i * 3], resource.normals[i * 3 + 1], -resource.normals[i * 3 + 2]);
                if (resource.uv.Length == vertices.Length * 2)
                    uv[i] = new Vector2(resource.uv[i * 2], resource.uv[i * 2 + 1]);
            }
            mesh.vertices = vertices;
            this.vertices[resource.id] = vertices;
            triangles[resource.id] = Reversed(resource.indices, 0, resource.indices.Length);
            mesh.uv = uv;
            mesh.subMeshCount = resource.groups.Length + 1;
            mesh.SetTriangles(Reversed(resource.indices, 0, resource.indices.Length), 0);
            for (var i = 0; i < resource.groups.Length; i++)
                mesh.SetTriangles(Reversed(resource.indices, resource.groups[i].start, resource.groups[i].count), i + 1);
            if (resource.normals.Length == resource.positions.Length)
                mesh.normals = normals;
            else
                mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            meshes[resource.id] = mesh;
            groups[resource.id] = resource.groups;
        }

        private static int[] Reversed(int[] indices, int start, int count)
        {
            var output = new int[count];
            for (var i = 0; i < count; i += 3)
            {
                output[i] = indices[start + i];
                output[i + 1] = indices[start + i + 2];
                output[i + 2] = indices[start + i + 1];
            }
            return output;
        }

        private void SetMaterial(MaterialResource resource)
        {
            var shader = Shader.Find(resource.shader == "ocean" ? "Azarashi/Ocean" : resource.shader == "lit" ? "Azarashi/Surface" : "Azarashi/Unlit");
            if (!materials.TryGetValue(resource.id, out var material))
                materials[resource.id] = material = new Material(shader) { name = resource.id, enableInstancing = true };
            material.shader = shader;
            // The asset contract already contains linear values; pass them without another color conversion.
            var color = ColorOf(resource.color, resource.opacity);
            var emission = ColorOf(resource.emissive, 1);
            material.SetVector("_Color", new Vector4(color.r, color.g, color.b, color.a));
            material.SetVector("_Emission", new Vector4(emission.r, emission.g, emission.b, emission.a));
            material.SetFloat("_Smoothness", 1 - resource.roughness);
            material.SetFloat("_Metallic", resource.metalness);
            material.SetFloat("_Clearcoat", resource.clearcoat);
            material.SetFloat("_ClearcoatRoughness", resource.clearcoatRoughness);
            // Three r180 uses the scene intensity when no explicit material envMap is set.
            material.SetFloat("_EnvIntensity", resource.useSceneEnvironment ? environmentIntensity : resource.envMapIntensity);
            material.SetFloat("_ToneMapped", resource.toneMapped ? 1 : 0);
            material.SetFloat("_FlatShading", resource.flatShading ? 1 : 0);
            material.SetFloat("_Cull", resource.side == 2 ? (float)CullMode.Off : resource.side == 1 ? (float)CullMode.Front : (float)CullMode.Back);
            material.SetFloat("_ZWrite", resource.depthWrite ? 1 : 0);
            material.SetFloat("_ZTest", resource.depthTest ? (float)CompareFunction.LessEqual : (float)CompareFunction.Always);
            material.SetFloat("_SrcBlend", resource.transparent ? (float)BlendMode.SrcAlpha : (float)BlendMode.One);
            material.SetFloat("_DstBlend", resource.additive ? (float)BlendMode.One : resource.transparent ? (float)BlendMode.OneMinusSrcAlpha : (float)BlendMode.Zero);
            material.renderQueue = resource.transparent ? 3000 : 2000;
            queues[resource.id] = material.renderQueue;
            if (resource.shader == "ocean")
                material.SetFloat("_OceanTime", resource.time);
            if (resource.shader == "ocean" && !oceans.Contains(material))
                oceans.Add(material);
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
            if (!materials.TryGetValue(materialId, out var material) || !meshes.TryGetValue(node.mesh, out var mesh))
                return;
            var queue = queues[materialId] + Mathf.Clamp(node.order, -1000, 1000);
            if (material.renderQueue != queue)
                material.renderQueue = queue;
            drawProperties.Clear();
            var catalog = node.id.StartsWith("piece:catalog:");
            drawProperties.SetFloat("_Catalog", catalog ? 1 : 0);
            drawProperties.SetFloat("_ReceiveSourceShadow", node.receiveShadow ? 1 : 0);
            Graphics.DrawMesh(mesh, world, material, catalog ? 1 : 0, null, submesh, drawProperties,
                ShadowCastingMode.Off, false, null, LightProbeUsage.Off);
            if (node.castShadow)
            {
                var shadow = sourceShadows[catalog ? 1 : 0];
                // Three's depth pass reverses FrontSide and BackSide for PCF shadows.
                var cull = (int)material.GetFloat("_Cull");
                var caster = shadowCasters[cull == 0 ? 0 : cull == 1 ? 2 : 1];
                drawProperties.Clear();
                drawProperties.SetMatrix("_CasterShadowMatrix", shadow.matrix);
                Graphics.DrawMesh(mesh, world, caster, catalog ? 3 : 2, shadow.camera, submesh, drawProperties,
                    ShadowCastingMode.Off, false, null, LightProbeUsage.Off);
            }
        }

        private void LateUpdate()
        {
            if (!valid)
                return;
            foreach (var node in nodes.Values)
            {
                if (!node.visible)
                    continue;
                var world = Mirror * Matrix(node.matrix) * Mirror;
                if (node.materials.Length == 1)
                    Draw(node, 0, node.materials[0], world);
                else if (groups.TryGetValue(node.mesh, out var submeshes))
                    for (var i = 0; i < submeshes.Length; i++)
                        if (submeshes[i].materialIndex < node.materials.Length)
                            Draw(node, i + 1, node.materials[submeshes[i].materialIndex], world);
            }
        }

        private void OnDestroy()
        {
            foreach (var shadow in sourceShadows)
                if (shadow != null)
                {
                    shadow.texture.Release();
                    Destroy(shadow.texture);
                    Destroy(shadow.camera.gameObject);
                }
            foreach (var caster in shadowCasters)
                if (caster != null) Destroy(caster);
            foreach (var mesh in meshes.Values)
                Destroy(mesh);
            foreach (var material in materials.Values)
                Destroy(material);
            foreach (var texture in textures.Values)
                Destroy(texture);
        }
    }
}
