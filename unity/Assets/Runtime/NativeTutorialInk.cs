using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    // All shapes use one unstretched coordinate system. In particular, circles
    // are arcs with one radius, never rounded rectangular buttons.
    public sealed class NativeTutorialInk : VisualElement
    {
        public string Shape;
        public Color Tint, Fill;
        public Vector2 Start, End;
        public NativeTutorialInk()
        {
            pickingMode = PickingMode.Ignore;
            generateVisualContent += Paint;
        }
        private void Paint(MeshGenerationContext context)
        {
            var p = context.painter2D;
            var w = contentRect.width; var h = contentRect.height;
            p.strokeColor = p.fillColor = Tint; p.lineWidth = 2;
            p.BeginPath();
            if (Shape == "dot" || Shape == "ring")
            {
                p.Arc(new Vector2(w / 2, h / 2), Mathf.Max(1, Mathf.Min(w, h) / 2 - 1), 0, 360);
                if (Shape == "dot") p.Fill(); else p.Stroke();
            }
            else if (Shape == "arrow")
            {
                p.MoveTo(new Vector2(1, h / 2)); p.LineTo(new Vector2(w - 2, h / 2));
                p.MoveTo(new Vector2(w - h / 2, 2)); p.LineTo(new Vector2(w - 2, h / 2)); p.LineTo(new Vector2(w - h / 2, h - 2)); p.Stroke();
            }
            else if (Shape == "travel")
            {
                var d = (End - Start).normalized;
                var normal = new Vector2(-d.y, d.x);
                p.MoveTo(Start); p.LineTo(End);
                p.MoveTo(End - d * 9 + normal * 5); p.LineTo(End); p.LineTo(End - d * 9 - normal * 5); p.Stroke();
            }
            else
            {
                p.MoveTo(new Vector2(3, 3)); p.LineTo(new Vector2(w - 3, 3));
                p.LineTo(new Vector2(w - 3, h - 3)); p.LineTo(new Vector2(3, h - 3)); p.ClosePath();
                p.fillColor = Fill; p.Fill(); p.Stroke();
            }
        }
    }
}
