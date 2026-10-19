using System;
using UnityEngine;
using UnityEngine.UIElements;
namespace Azarashi.UnityView
{
    /// <summary>Same 64×52 coordinate system, 15px cells and shared bounds as CaptureChoice.RotationShape.</summary>
    public sealed class NativeRotationShape : VisualElement
    {
        private readonly Preview candidate; private readonly Preview[] options; private readonly bool north;
        public Color Tint;
        public NativeRotationShape(Preview candidate, Preview[] options, bool north)
        {
            this.candidate = candidate;
            this.options = options;
            this.north = north;
            pickingMode = PickingMode.Ignore;
            generateVisualContent += Paint;
        }
        private void Paint(MeshGenerationContext context)
        {
            var minX = 10;
            var maxX = -1;
            var minY = 10;
            var maxY = -1;
            foreach (var option in options)
                foreach (var cell in option.captureCells)
                {
                    minX = Math.Min(minX, cell.x);
                    maxX = Math.Max(maxX, cell.x);
                    minY = Math.Min(minY, cell.y);
                    maxY = Math.Max(maxY, cell.y);
                }
            var scale = Mathf.Min(contentRect.width / 64, contentRect.height / 52);
            var offset = new Vector2((contentRect.width - 64 * scale) * .5f, (contentRect.height - 52 * scale) * .5f);
            Func<Vector2, Vector2> point = q => { var p = new Vector2(32 + (q.x - (maxX - minX + 1) * 15 * .5f) * (north ? -1 : 1), 26 + (q.y - (maxY - minY + 1) * 15 * .5f) * (north ? -1 : 1)); return offset + p * scale; };
            var painter = context.painter2D;
            foreach (var cell in options[0].footprint)
            {
                var x = (cell.x - minX) * 15 + 1;
                var y = (cell.y - minY) * 15 + 1;
                painter.strokeColor = new Color(Tint.r, Tint.g, Tint.b, .4f);
                painter.lineWidth = scale;
                // SVG rect rx=4, stroke-dasharray="2 2": carry the dash
                // phase continuously around its rounded corners.
                var perimeter = 20 + 8 * Mathf.PI;
                for (var dash = 0f; dash < perimeter; dash += 4)
                {
                    var end = Mathf.Min(perimeter, dash + 2);
                    painter.BeginPath();
                    painter.MoveTo(point(new Vector2(x, y) + OutlinePoint(dash)));
                    for (var distance = dash + .125f; distance < end; distance += .125f)
                        painter.LineTo(point(new Vector2(x, y) + OutlinePoint(distance)));
                    painter.LineTo(point(new Vector2(x, y) + OutlinePoint(end)));
                    painter.Stroke();
                }
            }
            foreach (var cell in candidate.footprint)
            {
                var x = (cell.x - minX) * 15 + 1;
                var y = (cell.y - minY) * 15 + 1;
                var r = 4f;
                var k = .55228475f;
                painter.fillColor = Tint;
                painter.BeginPath();
                painter.MoveTo(point(new Vector2(x + r, y)));
                painter.LineTo(point(new Vector2(x + 13 - r, y)));
                painter.BezierCurveTo(point(new Vector2(x + 13 - r + k * r, y)), point(new Vector2(x + 13, y + r - k * r)), point(new Vector2(x + 13, y + r)));
                painter.LineTo(point(new Vector2(x + 13, y + 13 - r)));
                painter.BezierCurveTo(point(new Vector2(x + 13, y + 13 - r + k * r)), point(new Vector2(x + 13 - r + k * r, y + 13)), point(new Vector2(x + 13 - r, y + 13)));
                painter.LineTo(point(new Vector2(x + r, y + 13)));
                painter.BezierCurveTo(point(new Vector2(x + r - k * r, y + 13)), point(new Vector2(x, y + 13 - r + k * r)), point(new Vector2(x, y + 13 - r)));
                painter.LineTo(point(new Vector2(x, y + r)));
                painter.BezierCurveTo(point(new Vector2(x, y + r - k * r)), point(new Vector2(x + r - k * r, y)), point(new Vector2(x + r, y)));
                painter.ClosePath();
                painter.Fill();
            }
            var pivot = options[0].footprint[candidate.action.transformation.pivot];
            if (Array.Exists(candidate.footprint, c => c.Same(pivot)))
            {
                painter.fillColor = new Color(1, .94118f, .65098f);
                painter.BeginPath();
                painter.Arc(point(new Vector2((pivot.x - minX) * 15 + 7.5f, (pivot.y - minY) * 15 + 7.5f)), 3 * scale, 0, 360);
                painter.Fill();
            }
        }
        private static Vector2 OutlinePoint(float distance)
        {
            var corner = 2 * Mathf.PI;
            var side = 5 + corner;
            var edge = Mathf.Min(3, Mathf.FloorToInt(distance / side));
            var local = distance - edge * side;
            Vector2 p;
            if (local <= 5) p = new Vector2(4 + local, 0);
            else
            {
                var angle = (local - 5) / 4 - Mathf.PI * .5f;
                p = new Vector2(9 + 4 * Mathf.Cos(angle), 4 + 4 * Mathf.Sin(angle));
            }
            return edge == 0 ? p : edge == 1 ? new Vector2(13 - p.y, p.x) : edge == 2 ? new Vector2(13 - p.x, 13 - p.y) : new Vector2(p.y, 13 - p.x);
        }
    }
}
