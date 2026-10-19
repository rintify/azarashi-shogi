using UnityEngine;
using UnityEngine.UIElements;
namespace Azarashi.UnityView
{
    /// <summary>Non-blocking native counterpart of MatchResult's rays and two shockwaves.</summary>
    public sealed class NativeResultSpectacle : VisualElement
    {
        public bool Defeat; public Color Light, Glow; public float Started;
        public NativeResultSpectacle()
        {
            pickingMode = PickingMode.Ignore;
            generateVisualContent += Paint;
        }
        private void Paint(MeshGenerationContext context)
        {
            var p = context.painter2D;
            var center = new Vector2(contentRect.width * .5f, contentRect.height * .43f);
            var radius = Mathf.Max(contentRect.width, contentRect.height) * 1.5f;
            var time = Time.unscaledTime - Started;
            // Same conic sectors and radial fade as .result-rays; rings keep the board visible.
            for (var band = 0; band < 20; band++)
            {
                var inner = band / 20f * radius * .57f;
                var outer = (band + 1) / 20f * radius * .57f;
                var opacity = (1 - band / 20f) * .25f * (Defeat ? .145f : .17f);
                p.fillColor = new Color(Glow.r, Glow.g, Glow.b, opacity);
                var count = Defeat ? 6 : 10;
                for (var sector = 0; sector < count; sector++)
                {
                    var a = (sector * (Defeat ? 60 : 36) + (Defeat ? 29 : 13) + time * 8) * Mathf.Deg2Rad;
                    var b = a + (Defeat ? 1 : 10) * Mathf.Deg2Rad;
                    p.BeginPath();
                    p.MoveTo(center + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * inner);
                    p.LineTo(center + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * outer);
                    p.LineTo(center + new Vector2(Mathf.Cos(b), Mathf.Sin(b)) * outer);
                    p.LineTo(center + new Vector2(Mathf.Cos(b), Mathf.Sin(b)) * inner);
                    p.ClosePath();
                    p.Fill();
                }
            }
            for (var n = 0; n < 2; n++)
            {
                var t = Mathf.Clamp01((time - n * .22f) / 1.8f);
                if (time < n * .22f || t >= 1)
                    continue;
                var ease = 1 - Mathf.Pow(1 - t, 3);
                var r = Mathf.Min(contentRect.width, contentRect.height) * .17f * Mathf.Lerp(.2f, 5, ease);
                for (var blur = 6; blur >= 0; blur--)
                {
                    p.lineWidth = blur == 0 ? 2 : blur * 5;
                    p.strokeColor = new Color(blur == 0 ? Light.r : Glow.r, blur == 0 ? Light.g : Glow.g, blur == 0 ? Light.b : Glow.b, (1 - ease) * (blur == 0 ? .8f : .025f));
                    p.BeginPath();
                    p.Arc(center, r, 0, 360);
                    p.Stroke();
                }
            }
        }
    }
}
