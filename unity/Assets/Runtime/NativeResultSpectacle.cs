using UnityEngine;
using UnityEngine.UIElements;
namespace Azarashi.UnityView
{
    /// <summary>Non-blocking native counterpart of MatchResult's rays and two shockwaves.</summary>
    public sealed class NativeResultSpectacle : VisualElement
    {
        public bool Defeat; public Color Light, Glow; public float Started;
        private readonly VisualElement rays = new VisualElement { pickingMode = PickingMode.Ignore };
        private Texture2D rayTexture;
        private Vector2 raySize;
        public NativeResultSpectacle()
        {
            pickingMode = PickingMode.Ignore;
            rays.style.position = UnityEngine.UIElements.Position.Absolute;
            Add(rays);
            generateVisualContent += Paint;
            RegisterCallback<DetachFromPanelEvent>(_ => { if (rayTexture != null) Object.Destroy(rayTexture); });
        }
        public void Tick()
        {
            var time = Time.unscaledTime - Started;
            var size = contentRect.size;
            if (size.x > 0 && size.y > 0 && size != raySize)
            {
                raySize = size;
                if (rayTexture != null) Object.Destroy(rayTexture);
                var w = Mathf.Clamp(Mathf.RoundToInt(size.x * 3), 1, 2048);
                var h = Mathf.Clamp(Mathf.RoundToInt(size.y * 3), 1, 2048);
                rayTexture = new Texture2D(w, h, TextureFormat.RGBA32, false);
                var pixels = new Color32[w * h];
                var farCorner = size.magnitude * 1.5f;
                var tint = Defeat ? new Color(138f / 255, 185f / 255, 250f / 255) : Glow;
                for (var y = 0; y < h; y++)
                    for (var x = 0; x < w; x++)
                {
                    var dx = ((x + .5f) / w - .5f) * size.x * 3;
                    var dy = ((y + .5f) / h - .5f) * size.y * 3;
                    var angle = Mathf.Repeat(Mathf.Atan2(dx, dy) * Mathf.Rad2Deg - (Defeat ? 20 : 0), Defeat ? 60 : 36);
                    var sector = Defeat ? Mathf.Clamp01(angle - 28) * Mathf.Clamp01(31 - angle) : angle >= 13 && angle < 23 ? 1 : 0;
                    var mask = Mathf.Clamp01(1 - Mathf.Sqrt(dx * dx + dy * dy) / (farCorner * .57f));
                    tint.a = .25f * (Defeat ? 37f / 255 : .17f) * sector * mask;
                    pixels[y * w + x] = tint;
                }
                rayTexture.SetPixels32(pixels);
                rayTexture.Apply(false, true);
                rays.style.backgroundImage = new StyleBackground(rayTexture);
                rays.style.left = -size.x;
                rays.style.top = -size.y;
                rays.style.width = size.x * 3;
                rays.style.height = size.y * 3;
            }
            rays.style.rotate = new Rotate(time * 8);
            MarkDirtyRepaint();
        }
        private void Paint(MeshGenerationContext context)
        {
            var p = context.painter2D;
            var center = new Vector2(contentRect.width * .5f, contentRect.height * .43f);
            var time = Time.unscaledTime - Started;
            for (var n = 0; n < 2; n++)
            {
                var t = Mathf.Clamp01((time - n * .22f) / 1.8f);
                if (time < n * .22f || t >= 1)
                    continue;
                var ease = NativeUi.Cubic(t, 0, 0, .58f, 1);
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
