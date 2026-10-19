using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Azarashi.UnityView
{
    /// <summary>Instances meshes exported from the existing TSX models; Unity owns their playback.</summary>
    public sealed class NativeBoard
    {
        private readonly SceneRenderer renderer;
        private readonly NativeGameData data;
        private readonly Dictionary<string, ModelAsset> models;
        private readonly HashSet<string> active = new HashSet<string>();
        private readonly HashSet<string> next = new HashSet<string>();
        private readonly HashSet<string> guideMaterials = new HashSet<string>();
        private readonly Dictionary<string, ActorCache> actorCache = new Dictionary<string, ActorCache>();
        private sealed class ActorCache
        {
            public string model; public Vector3 position; public float yaw, scale, morph, pitch, roll; public Vector3 stretch; public bool before; public string[] ids;
        }
        private readonly string fillMesh = "native-cell", dotMesh = "native-dot";
        private readonly string sphereMesh;
        public Camera Camera => renderer.Camera;
        public NativeBoard(SceneRenderer renderer, NativeGameData data)
        {
            this.renderer = renderer;
            this.data = data;
            models = data.Assets.models.ToDictionary(m => m.key);
            sphereMesh = data.Assets.models[0].frame.nodes[0].mesh;
            renderer.ConfigureLighting(data.Assets.lighting, data.Assets.catalogLighting);
            renderer.LoadAssets(data.Assets.world);
            renderer.LoadAssets(data.Assets.catalog);
            foreach (var model in data.Assets.models)
                renderer.LoadAssets(model.frame);
            renderer.LoadAssets(data.Assets.effects);
            foreach (var node in data.Assets.world.nodes)
                if (node.visible)
                    renderer.PutNode(node);
            var quad = new MeshResource { id = fillMesh, positions = new[] { -.49f, 0f, -.49f, .49f, 0f, -.49f, .49f, 0f, .49f, -.49f, 0f, .49f }, normals = new[] { 0f, 1f, 0f, 0f, 1f, 0f, 0f, 1f, 0f, 0f, 1f, 0f }, uv = new float[8], indices = new[] { 0, 2, 1, 0, 3, 2 }, groups = Array.Empty<MeshGroup>() };
            var vertices = new List<float> { 0, 0, 0 };
            var indices = new List<int>();
            for (var i = 0; i <= 32; i++)
            {
                var a = i * Mathf.PI * 2 / 32;
                vertices.Add(Mathf.Cos(a) * .105f);
                vertices.Add(0);
                vertices.Add(Mathf.Sin(a) * .105f);
                if (i > 0)
                {
                    indices.Add(0);
                    indices.Add(i + 1);
                    indices.Add(i);
                }
            }
            var dot = new MeshResource { id = dotMesh, positions = vertices.ToArray(), normals = Array.Empty<float>(), uv = Array.Empty<float>(), indices = indices.ToArray(), groups = Array.Empty<MeshGroup>() };
            renderer.LoadAssets(new RenderFrame { meshes = new[] { quad, dot }, materials = Array.Empty<MaterialResource>() });
            var ringVertices = new List<float>();
            var ringIndices = new List<int>();
            for (var i = 0; i <= 64; i++)
            {
                var angle = i * Mathf.PI * 2 / 64;
                foreach (var radius in new[] { 1f, .95f })
                {
                    ringVertices.Add(Mathf.Cos(angle) * radius);
                    ringVertices.Add(0);
                    ringVertices.Add(Mathf.Sin(angle) * radius);
                }
                if (i > 0)
                {
                    var a = (i - 1) * 2;
                    ringIndices.AddRange(new[] { a, a + 2, a + 1, a + 1, a + 2, a + 3 });
                }
            }
            renderer.LoadAssets(new RenderFrame { meshes = new[] { new MeshResource { id = "native-ring", positions = ringVertices.ToArray(), normals = Array.Empty<float>(), uv = Array.Empty<float>(), indices = ringIndices.ToArray(), groups = Array.Empty<MeshGroup>() } }, materials = Array.Empty<MaterialResource>() });
            var edges = new List<float>();
            var edgeIndices = new List<int>();
            var corners = new[] { new Vector2(-.49f, -.49f), new Vector2(.49f, -.49f), new Vector2(.49f, .49f), new Vector2(-.49f, .49f) };
            for (var i = 0; i < 4; i++)
            {
                var a = corners[i];
                var b = corners[(i + 1) % 4];
                var n = (b - a).normalized;
                var perpendicular = new Vector2(-n.y, n.x) * .022f;
                var start = edges.Count / 3;
                foreach (var v in new[] { a, b, b + perpendicular, a + perpendicular })
                    edges.AddRange(new[] { v.x, 0, v.y });
                edgeIndices.AddRange(new[] { start, start + 2, start + 1, start, start + 3, start + 2 });
            }
            renderer.LoadAssets(new RenderFrame { meshes = new[] { new MeshResource { id = "native-outline", positions = edges.ToArray(), normals = Array.Empty<float>(), uv = Array.Empty<float>(), indices = edgeIndices.ToArray(), groups = Array.Empty<MeshGroup>() } }, materials = Array.Empty<MaterialResource>() });
        }
        private static Matrix4x4 Matrix(float[] values) => SceneRenderer.Matrix(values);
        private static float[] ArrayOf(Matrix4x4 matrix)
        {
            var values = new float[16];
            for (var i = 0; i < 16; i++)
                values[i] = matrix[i];
            return values;
        }
        public void Begin()
        {
            next.Clear();
        }
        public void End()
        {
            foreach (var id in active)
                if (!next.Contains(id))
                    renderer.RemoveNode(id);
            active.Clear();
            foreach (var id in next)
                active.Add(id);
            foreach (var id in actorCache.Keys.Where(id => actorCache[id].ids.Length == 0 || !active.Contains(actorCache[id].ids[0])).ToArray())
                actorCache.Remove(id);
        }
        public void Piece(PieceState piece, Vector3 position, float yaw, float scale = 1, float morph = -1, bool beforePromoted = false, float pitch = 0, float roll = 0, Vector3? stretch = null)
        {
            var bodyScale = stretch ?? Vector3.one;
            var key = data.ModelKey(piece);
            if (actorCache.TryGetValue(piece.id, out var cached) && cached.ids.Length > 0 && active.Contains(cached.ids[0]) && cached.model == key && cached.position == position && cached.yaw == yaw && cached.scale == scale && cached.morph == morph && cached.before == beforePromoted && cached.pitch == pitch && cached.roll == roll && cached.stretch == bodyScale)
            {
                foreach (var id in cached.ids)
                    next.Add(id);
                return;
            }
            var shown = new PieceState { id = piece.id, at = piece.at, kind = piece.kind, owner = piece.owner, promoted = morph >= 0 ? beforePromoted : piece.promoted };
            var model = models[data.ModelKey(shown)];
            ModelAsset target = null;
            if (morph >= 0 && piece.kind == "penguin")
                target = models[piece.kind + ":" + piece.owner + ":" + (beforePromoted ? 0 : 1)];
            var rotation = Quaternion.AngleAxis(pitch, Vector3.right) * Quaternion.AngleAxis(yaw, Vector3.up) * Quaternion.AngleAxis(roll, Vector3.forward);
            var root = Matrix4x4.TRS(position + Vector3.up * (piece.id == "catalog" ? 0 : .16f), rotation, bodyScale * scale);
            var ids = new string[model.frame.nodes.Length];
            for (var i = 0; i < model.frame.nodes.Length; i++)
            {
                var source = model.frame.nodes[i];
                var local = Matrix(source.matrix);
                var visible = source.visible;
                if (target != null)
                {
                    var frames = System.Array.Find(data.Assets.penguinPoses, p => p.owner == piece.owner).frames;
                    var blend = (beforePromoted ? 1 - morph : morph) * (frames.Length - 1);
                    var lower = Mathf.FloorToInt(blend);
                    var upper = Mathf.Min(frames.Length - 1, lower + 1);
                    var a = frames[lower].nodes[i];
                    var b = frames[upper].nodes[i];
                    var from = Matrix(a.matrix);
                    var to = Matrix(b.matrix);
                    local = Matrix4x4.TRS(Vector3.Lerp(from.GetColumn(3), to.GetColumn(3), blend - lower), Quaternion.Slerp(from.rotation, to.rotation, blend - lower), Vector3.Lerp(from.lossyScale, to.lossyScale, blend - lower));
                    visible = a.visible || b.visible;
                }
                var id = "piece:" + piece.id + ":" + i;
                next.Add(id);
                ids[i] = id;
                renderer.PutNode(new RenderNode { id = id, mesh = source.mesh, materials = source.materials, matrix = ArrayOf(root * local), visible = visible && scale > .005f, castShadow = source.castShadow, receiveShadow = source.receiveShadow, order = source.order });
            }
            actorCache[piece.id] = new ActorCache { model = key, position = position, yaw = yaw, scale = scale, morph = morph, before = beforePromoted, pitch = pitch, roll = roll, stretch = bodyScale, ids = ids };
        }
        private string GuideMaterial(string color, float opacity)
        {
            var materialId = "guide:" + color + ":" + opacity.ToString("F3", System.Globalization.CultureInfo.InvariantCulture);
            ColorUtility.TryParseHtmlString(color, out var c);
            c = c.linear;
            if (guideMaterials.Add(materialId))
                renderer.LoadAssets(new RenderFrame { meshes = Array.Empty<MeshResource>(), materials = new[] { new MaterialResource { id = materialId, shader = "unlit", color = new[] { c.r, c.g, c.b }, emissive = new[] { 0f, 0f, 0f }, opacity = opacity, transparent = true, side = 2, depthTest = true, depthWrite = false, roughness = 1, texture = "" } } });
            return materialId;
        }
        public void Guide(Cell cell, string color, float opacity, bool dot = false, int layer = 0)
        {
            var materialId = GuideMaterial(color, opacity);
            var id = "guide:" + cell.x + ":" + cell.y + ":" + (dot ? "dot" : "fill") + ":" + layer;
            next.Add(id);
            renderer.PutNode(new RenderNode { id = id, mesh = dot ? dotMesh : fillMesh, materials = new[] { materialId }, matrix = ArrayOf(Matrix4x4.Translate(new Vector3(cell.x - 4.5f, .17f + layer * .002f + (dot ? .004f : 0), cell.y - 4.5f))), visible = true, castShadow = false, receiveShadow = false });
        }
        public void Outline(Cell cell, string color)
        {
            var id = "outline:" + cell.x + ":" + cell.y;
            next.Add(id);
            var materialId = GuideMaterial(color, .8f);
            renderer.PutNode(new RenderNode { id = id, mesh = "native-outline", materials = new[] { materialId }, matrix = ArrayOf(Matrix4x4.Translate(new Vector3(cell.x - 4.5f, .183f, cell.y - 4.5f))), visible = true, castShadow = false, receiveShadow = false });
        }
        public bool CellAt(Vector2 screen, out Cell cell)
        {
            var ray = Camera.ScreenPointToRay(screen);
            var plane = new Plane(Vector3.up, new Vector3(0, .17f, 0));
            if (plane.Raycast(ray, out var distance))
            {
                var p = ray.GetPoint(distance);
                cell = new Cell(Mathf.FloorToInt(p.x + 5), Mathf.FloorToInt(-p.z + 5));
                return cell.x >= 0 && cell.x < 10 && cell.y >= 0 && cell.y < 10;
            }
            cell = null;
            return false;
        }
        public bool PieceAt(Vector2 screen, out string id, out Vector3 point) => renderer.Pick(Camera.ScreenPointToRay(screen), out id, out point);
        public Vector2 Marker(string id) => renderer.SurfaceAnchor("piece:" + id + ":");
        public void OceanTime(float time) => renderer.OceanTime(time);
        public void CatalogFloor()
        {
            foreach (var source in data.Assets.catalog.nodes)
            {
                var id = "piece:catalog:floor:" + source.id;
                next.Add(id);
                renderer.PutNode(new RenderNode { id = id, mesh = source.mesh, materials = source.materials, matrix = ArrayOf(Matrix4x4.Translate(new Vector3(50, 0, 0)) * Matrix(source.matrix)), visible = source.visible, castShadow = source.castShadow, receiveShadow = source.receiveShadow });
            }
        }
        private sealed class GuideVisual
        {
            public Color fill = Linear("#42b9d8"), dot = Linear("#087b9f"), outline = Linear("#098bba");
            public float fillAlpha, dotAlpha, outlineAlpha;
        }
        private static Color Linear(string hex)
        {
            ColorUtility.TryParseHtmlString(hex, out var color);
            return color.linear;
        }
        private readonly GuideVisual[] guides = new GuideVisual[100];
        private readonly HashSet<string> dynamicMaterials = new HashSet<string>();
        private string DynamicMaterial(string id, Color color, float opacity, bool additive = false, bool toneMapped = false, bool depthWrite = false)
        {
            if (dynamicMaterials.Add(id))
            {
                renderer.LoadAssets(new RenderFrame { meshes = Array.Empty<MeshResource>(), materials = new[] { new MaterialResource { id = id, shader = "unlit", color = new[] { 1f, 1f, 1f }, emissive = new[] { 0f, 0f, 0f }, opacity = 0, transparent = true, additive = additive, side = 2, depthTest = true, depthWrite = depthWrite, toneMapped = toneMapped, roughness = 1, texture = "" } } });
            }
            color.a = opacity;
            renderer.MaterialColor(id, color);
            return id;
        }
        public void CellGuide(Cell cell, GuideStyle style, bool enemy)
        {
            var index = cell.y * 10 + cell.x;
            var v = guides[index] ?? (guides[index] = new GuideVisual());
            var blend = 1 - Mathf.Exp(-Time.unscaledDeltaTime * 18);
            ColorUtility.TryParseHtmlString(style.fill, out var fill);
            ColorUtility.TryParseHtmlString(style.dot, out var dot);
            ColorUtility.TryParseHtmlString(style.outline, out var outline);
            v.fill = Color.Lerp(v.fill, fill.linear, blend);
            v.dot = Color.Lerp(v.dot, dot.linear, blend);
            v.outline = Color.Lerp(v.outline, outline.linear, blend);
            var pulse = enemy ? .75f + .25f * Mathf.Sin(Time.unscaledTime * Mathf.PI * 2 / 2.8f) : 1;
            v.fillAlpha = Mathf.Lerp(v.fillAlpha, style.fillOpacity * pulse, blend);
            v.dotAlpha = Mathf.Lerp(v.dotAlpha, style.dotOpacity, blend);
            v.outlineAlpha = Mathf.Lerp(v.outlineAlpha, style.outlineOpacity, blend);
            var position = new Vector3(cell.x - 4.5f, .165f, cell.y - 4.5f);
            Primitive("cell:" + index + ":fill", fillMesh, position, Vector3.one, v.fill, v.fillAlpha);
            Primitive("cell:" + index + ":dot", dotMesh, position + Vector3.up * .003f, Vector3.one * (.7f + .3f * v.dotAlpha), v.dot, v.dotAlpha);
            Primitive("cell:" + index + ":outline", EffectMesh("guide-outline"), position + Vector3.up * .004f, Vector3.one, v.outline, v.outlineAlpha, Quaternion.Euler(-90, 0, 0));
        }
        public string EffectMesh(string name) => Array.Find(data.Assets.effectMeshes, m => m.name == name).mesh;
        public void Primitive(string id, string mesh, Vector3 position, Vector3 scale, Color color, float opacity, Quaternion? rotation = null, bool additive = false, bool toneMapped = false, bool depthWrite = false)
        {
            if (opacity <= .002f)
                return;
            var key = "fx:" + id;
            next.Add(key);
            var material = DynamicMaterial(key, color, opacity, additive, toneMapped, depthWrite);
            renderer.PutNode(new RenderNode { id = key, mesh = mesh, materials = new[] { material }, matrix = ArrayOf(Matrix4x4.TRS(position, rotation ?? Quaternion.identity, scale)), visible = true, castShadow = false, receiveShadow = false });
        }
        public void Effect(string id, string mesh, Vector3 position, Vector3 scale, string color, float opacity, Quaternion? rotation = null, bool additive = false, bool toneMapped = false, bool depthWrite = false)
            => Primitive(id, EffectMesh(mesh), position, scale, Linear(color), opacity, rotation, additive, toneMapped, depthWrite);
    }
}
