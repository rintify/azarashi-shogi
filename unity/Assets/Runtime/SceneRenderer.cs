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
        private readonly Dictionary<string,Vector3[]> vertices=new Dictionary<string,Vector3[]>();
        private readonly Dictionary<string,int[]> triangles=new Dictionary<string,int[]>();
        private readonly List<Material> oceans=new List<Material>();
        private readonly Dictionary<string, MeshGroup[]> groups = new Dictionary<string, MeshGroup[]>();
        private readonly Dictionary<string, Material> materials = new Dictionary<string, Material>();
        private readonly Dictionary<string, int> queues = new Dictionary<string, int>();
        private readonly Dictionary<string, Texture2D> textures = new Dictionary<string, Texture2D>();
        private readonly Dictionary<string, RenderNode> nodes = new Dictionary<string, RenderNode>();
        private Camera view;
        private static readonly Matrix4x4 Mirror = Matrix4x4.Scale(new Vector3(1, 1, -1));
        private bool valid;
        private readonly Dictionary<string,Vector2> anchors=new Dictionary<string,Vector2>();
        private Matrix4x4 anchorCamera;
        public Camera Camera => view;
        public void LoadAssets(RenderFrame frame){foreach(var mesh in frame.meshes)SetMesh(mesh);foreach(var material in frame.materials)SetMaterial(material);}
        public void PutNode(RenderNode node){nodes[node.id]=node;valid=true;if(node.id.StartsWith("piece:"))anchors.Clear();}
        public void RemoveNode(string id)=>nodes.Remove(id);
        public void OceanTime(float time){foreach(var material in oceans)material.SetFloat("_OceanTime",time);}
        public Vector2 SurfaceAnchor(string prefix)
        {
            var vp=view.projectionMatrix*view.worldToCameraMatrix;if(vp!=anchorCamera){anchors.Clear();anchorCamera=vp;}if(anchors.TryGetValue(prefix,out var cached))return cached;
            var score=float.NegativeInfinity;var anchor=Vector2.zero;
            foreach(var node in nodes.Values)
            {
                if(!node.visible||!node.id.StartsWith(prefix)||!vertices.TryGetValue(node.mesh,out var points))continue;var world=Mirror*Matrix(node.matrix)*Mirror;var matrix=vp*world;
                foreach(var point in points){var screen=matrix.MultiplyPoint(point);var x=(screen.x+1)*Screen.width*.5f;var y=(screen.y+1)*Screen.height*.5f;if(x+y>score){score=x+y;anchor=new Vector2(x+8,y+8);}}
            }
            anchors[prefix]=anchor;return anchor;
        }
        public bool Pick(Ray ray,out string pieceId,out Vector3 point)
        {
            var nearest=float.PositiveInfinity;pieceId=null;point=Vector3.zero;
            foreach(var node in nodes.Values)
            {
                if(!node.visible||!node.id.StartsWith("piece:")||!meshes.TryGetValue(node.mesh,out var mesh))continue;
                var world=Mirror*Matrix(node.matrix)*Mirror;var inverse=world.inverse;var origin=inverse.MultiplyPoint3x4(ray.origin);var direction=inverse.MultiplyVector(ray.direction);var localRay=new Ray(origin,direction);if(!mesh.bounds.IntersectRay(localRay))continue;
                var points=vertices[node.mesh];var indices=triangles[node.mesh];
                for(var i=0;i<indices.Length;i+=3)
                {
                    var a=points[indices[i]];var b=points[indices[i+1]];var c=points[indices[i+2]];var e1=b-a;var e2=c-a;var h=Vector3.Cross(direction,e2);var det=Vector3.Dot(e1,h);if(Mathf.Abs(det)<.0000001f)continue;var f=1/det;var s=origin-a;var u=f*Vector3.Dot(s,h);if(u<0||u>1)continue;var q=Vector3.Cross(s,e1);var v=f*Vector3.Dot(direction,q);if(v<0||u+v>1)continue;var t=f*Vector3.Dot(e2,q);if(t<0)continue;var hit=world.MultiplyPoint3x4(origin+direction*t);var distance=Vector3.Distance(ray.origin,hit);if(distance>=nearest)continue;nearest=distance;point=hit;pieceId=node.id.Substring(6,node.id.LastIndexOf(':')-6);
                }
            }
            return pieceId!=null;
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
            view.cullingMask=~(1<<1);
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

        }

        public void ConfigureLighting(LightingSettings settings)
        {
            ColorUtility.TryParseHtmlString(settings.hemisphere.sky,out var sky);ColorUtility.TryParseHtmlString(settings.hemisphere.ground,out var ground);
            RenderSettings.ambientSkyColor=sky*settings.hemisphere.intensity;
            RenderSettings.ambientGroundColor=ground*settings.hemisphere.intensity;
            RenderSettings.ambientEquatorColor=Color.Lerp(sky,ground,.5f)*settings.hemisphere.intensity;
            foreach(var light in settings.directional){ColorUtility.TryParseHtmlString(light.color,out var color);Sun("Original scene light",new Vector3(light.position[0],light.position[1],-light.position[2]),color,light.intensity,light.shadows);}
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
            light.shadowNormalBias = 0.12f;
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
                queues.Remove(id);
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
            this.vertices[resource.id]=vertices;
            triangles[resource.id]=Reversed(resource.indices,0,resource.indices.Length);
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
            // The asset contract already contains linear values; pass them without another color conversion.
            var color=ColorOf(resource.color, resource.opacity);var emission=ColorOf(resource.emissive,1);
            material.SetVector("_Color",new Vector4(color.r,color.g,color.b,color.a));
            material.SetVector("_Emission",new Vector4(emission.r,emission.g,emission.b,emission.a));
            material.SetFloat("_Smoothness", 1 - resource.roughness);
            material.SetFloat("_Metallic", resource.metalness);
            material.SetFloat("_Cull", resource.side == 2 ? (float)CullMode.Off : resource.side == 1 ? (float)CullMode.Front : (float)CullMode.Back);
            material.SetFloat("_ZWrite", resource.depthWrite ? 1 : 0);
            material.SetFloat("_ZTest", resource.depthTest ? (float)CompareFunction.LessEqual : (float)CompareFunction.Always);
            material.SetFloat("_SrcBlend", resource.transparent ? (float)BlendMode.SrcAlpha : (float)BlendMode.One);
            material.SetFloat("_DstBlend", resource.additive ? (float)BlendMode.One : resource.transparent ? (float)BlendMode.OneMinusSrcAlpha : (float)BlendMode.Zero);
            material.renderQueue = resource.transparent ? 3000 : 2000;
            queues[resource.id] = material.renderQueue;
            if (resource.shader == "ocean") material.SetFloat("_OceanTime", resource.time);
            if(resource.shader=="ocean"&&!oceans.Contains(material))oceans.Add(material);
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
            var queue = queues[materialId] + Mathf.Clamp(node.order, -1000, 1000);
            if (material.renderQueue != queue) material.renderQueue = queue;
            Graphics.DrawMesh(mesh, world, material, node.id.StartsWith("piece:catalog:")?1:0, null, submesh, null,
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
