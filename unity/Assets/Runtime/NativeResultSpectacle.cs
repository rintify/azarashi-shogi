using UnityEngine;
using UnityEngine.UIElements;
namespace Azarashi.UnityView
{
    /// <summary>Non-blocking native counterpart of MatchResult's rays and two shockwaves.</summary>
    public sealed class NativeResultSpectacle : VisualElement
    {
        public bool Defeat; public Color Light, Glow; public float Started;
        private readonly SourceRays rays = new SourceRays();
        private readonly SourceShockwave[] waves = { new SourceShockwave(), new SourceShockwave() };
        private sealed class SourceShockwave : VisualElement
        {
            private float radius;
            private Color light, glow;
            private Color32[] colors;
            private const int Bands = 160, Segments = 128;
            public SourceShockwave()
            {
                pickingMode = PickingMode.Ignore;
                style.position = UnityEngine.UIElements.Position.Absolute;
                generateVisualContent += Paint;
            }
            public void Configure(float value, Color border, Color shadow)
            {
                if (radius == value && light == border && glow == shadow && colors != null) return;
                radius = value; light = border; glow = shadow;
                colors = new Color32[Bands + 1];
                for (var band = 0; band <= Bands; band++)
                {
                    var r = Extent * band / Bands;
                    var color = r >= radius ? glow : r > radius - 2 ? light : glow;
                    color.a *= r >= radius ? DiskBlur(radius, r, 17.5f) : r > radius - 2 ? 1 : 1 - DiskBlur(radius - 2, r, 12.5f);
                    colors[band] = color;
                }
                style.width = style.height = Extent * 2;
                MarkDirtyRepaint();
            }
            private float Extent => radius + 70;
            // Gaussian convolution of the CSS disk. The outer shadow is clipped
            // outside the border box; the inset shadow is its blurred complement.
            private static float DiskBlur(float radius, float distance, float sigma)
            {
                var lo = Mathf.Max(-radius, distance - 5 * sigma);
                var hi = Mathf.Min(radius, distance + 5 * sigma);
                if (hi <= lo) return 0;
                const int samples = 192;
                var sum = 0f;
                var step = (hi - lo) / samples;
                for (var i = 0; i < samples; i++)
                {
                    var x = lo + (i + .5f) * step;
                    var y = Mathf.Sqrt(Mathf.Max(0, radius * radius - x * x));
                    var dx = (x - distance) / sigma;
                    sum += Mathf.Exp(-.5f * dx * dx) * Erf(y / (sigma * Mathf.Sqrt(2)));
                }
                return Mathf.Clamp01(sum * step / (sigma * Mathf.Sqrt(2 * Mathf.PI)));
            }
            private static float Erf(float x)
            {
                var t = 1 / (1 + .3275911f * x);
                return 1 - (((((1.061405429f * t - 1.453152027f) * t) + 1.421413741f) * t - .284496736f) * t + .254829592f) * t * Mathf.Exp(-x * x);
            }
            private void Paint(MeshGenerationContext context)
            {
                if (colors == null) return;
                var mesh = context.Allocate((Bands + 1) * (Segments + 1), Bands * Segments * 6);
                for (var band = 0; band <= Bands; band++)
                    for (var segment = 0; segment <= Segments; segment++)
                    {
                        var angle = segment * Mathf.PI * 2 / Segments;
                        var r = Extent * band / Bands;
                        mesh.SetNextVertex(new Vertex { position = new Vector3(Extent + Mathf.Cos(angle) * r, Extent + Mathf.Sin(angle) * r, Vertex.nearZ), tint = colors[band] });
                    }
                for (var band = 0; band < Bands; band++)
                    for (var segment = 0; segment < Segments; segment++)
                    {
                        var a = (ushort)(band * (Segments + 1) + segment);
                        var b = (ushort)(a + Segments + 1);
                        mesh.SetNextIndex(a); mesh.SetNextIndex((ushort)(a + 1)); mesh.SetNextIndex(b);
                        mesh.SetNextIndex((ushort)(a + 1)); mesh.SetNextIndex((ushort)(b + 1)); mesh.SetNextIndex(b);
                    }
            }
        }
        private sealed class SourceRays : VisualElement
        {
            public bool Defeat;
            public Color Tint;
            public SourceRays()
            {
                pickingMode = PickingMode.Ignore;
                style.overflow = Overflow.Hidden;
                generateVisualContent += PaintRays;
            }
            private void PaintRays(MeshGenerationContext context)
            {
                var center = contentRect.center;
                var radius = contentRect.size.magnitude * .5f * .57f;
                var sectors = Defeat ? 6 : 10;
                var steps = Defeat ? 3 : 10;
                const int bands = 16;
                var mesh = context.Allocate(sectors * steps * bands * 6, sectors * steps * bands * 6);
                ushort index = 0;
                for (var sector = 0; sector < sectors; sector++)
                    for (var step = 0; step < steps; step++)
                        for (var band = 0; band < bands; band++)
                        {
                            var a = (sector * (Defeat ? 60 : 36) + (Defeat ? 48 : 13) + step) * Mathf.Deg2Rad;
                            var b = a + Mathf.Deg2Rad;
                            var r0 = radius * band / bands;
                            var r1 = radius * (band + 1) / bands;
                            var alphaA = Defeat && step == 0 ? 0 : 1;
                            var alphaB = Defeat && step == 2 ? 0 : 1;
                            var v0 = RayVertex(center, a, r0, radius, alphaA);
                            var v1 = RayVertex(center, b, r0, radius, alphaB);
                            var v2 = RayVertex(center, a, r1, radius, alphaA);
                            var v3 = RayVertex(center, b, r1, radius, alphaB);
                            mesh.SetNextVertex(v0); mesh.SetNextVertex(v1); mesh.SetNextVertex(v2);
                            mesh.SetNextVertex(v2); mesh.SetNextVertex(v1); mesh.SetNextVertex(v3);
                            for (var i = 0; i < 6; i++) mesh.SetNextIndex(index++);
                        }
            }
            private Vertex RayVertex(Vector2 center, float angle, float radius, float maskRadius, float alpha)
            {
                var color = Tint;
                color.a = (Defeat ? 37f / 255 : .17f) * (1 - radius / maskRadius) * alpha;
                var point = center + new Vector2(Mathf.Sin(angle), -Mathf.Cos(angle)) * radius;
                return new Vertex { position = new Vector3(point.x, point.y, Vertex.nearZ), tint = color };
            }
        }
        public NativeResultSpectacle()
        {
            pickingMode = PickingMode.Ignore;
            rays.style.position = UnityEngine.UIElements.Position.Absolute;
            rays.style.opacity = .25f;
            Add(rays);
            foreach (var wave in waves) Add(wave);
        }
        public void Tick()
        {
            var time = Time.unscaledTime - Started;
            var size = contentRect.size;
            rays.Tint = Defeat ? new Color(138f / 255, 185f / 255, 250f / 255) : Glow;
            rays.Defeat = Defeat;
            rays.style.left = -size.x;
            rays.style.top = -size.y;
            rays.style.width = size.x * 3;
            rays.style.height = size.y * 3;
            rays.style.rotate = new Rotate(time * 8);
            var center = new Vector2(contentRect.width * .5f, contentRect.height * .43f);
            for (var n = 0; n < 2; n++)
            {
                var t = Mathf.Clamp01((time - n * .22f) / 1.8f);
                var wave = waves[n];
                wave.style.display = time < n * .22f || t >= 1 ? DisplayStyle.None : DisplayStyle.Flex;
                if (time < n * .22f || t >= 1) continue;
                var ease = NativeUi.Cubic(t, 0, 0, .58f, 1);
                var radius = Mathf.Min(contentRect.width, contentRect.height) * .17f;
                wave.Configure(radius, Light, Glow);
                wave.style.left = center.x - radius - 70;
                wave.style.top = center.y - radius - 70;
                wave.style.scale = new Scale(Vector3.one * Mathf.Lerp(.2f, 5, ease));
                wave.style.opacity = .8f * (1 - ease);
            }
        }
    }
}
