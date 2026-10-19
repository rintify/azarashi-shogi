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
                for (var edge = 0; edge < 4; edge++)
                    for (var n = 0; n < 3; n++)
                    {
                        var a = edge == 0 ? new Vector2(x + 3 + n * 4, y) : edge == 1 ? new Vector2(x + 13, y + 3 + n * 4) : edge == 2 ? new Vector2(x + 10 - n * 4, y + 13) : new Vector2(x, y + 10 - n * 4);
                        var b = a + (edge == 0 ? Vector2.right : edge == 1 ? Vector2.up : edge == 2 ? Vector2.left : Vector2.down) * 2;
                        painter.BeginPath();
                        painter.MoveTo(point(a));
                        painter.LineTo(point(b));
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
    }
}
