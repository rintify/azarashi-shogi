using System;
using UnityEngine;
using UnityEngine.UIElements;
namespace Azarashi.UnityView
{
    /// <summary>A retained slider keeps its pointer capture and event binding across state updates.</summary>
    public sealed class NativeSlider : VisualElement
    {
        private readonly VisualElement track, fill, thumb;
        private Action<float> changed; private float minimum, maximum, width; private bool onRelease;
        public NativeSlider()
        {
            userData = "native-ui";
            style.position = UnityEngine.UIElements.Position.Absolute;
            style.height = 20;
            track = Part(new Color(.733f, .855f, .906f), 8, 5);
            fill = Part(new Color(.149f, .498f, .620f), 8, 5);
            thumb = Part(new Color(.149f, .498f, .620f), 3, 14);
            thumb.style.width = 14;
            RegisterCallback<PointerDownEvent>(e => { this.CapturePointer(e.pointerId); Set(e.position, !onRelease); e.StopPropagation(); });
            RegisterCallback<PointerMoveEvent>(e => { if (this.HasPointerCapture(e.pointerId)) Set(e.position, !onRelease); });
            RegisterCallback<PointerUpEvent>(e => { if (!this.HasPointerCapture(e.pointerId)) return; Set(e.position, true); this.ReleasePointer(e.pointerId); });
        }
        private VisualElement Part(Color color, float top, float height)
        {
            var v = new VisualElement { pickingMode = PickingMode.Ignore };
            v.style.position = UnityEngine.UIElements.Position.Absolute;
            v.style.left = 0;
            v.style.top = top;
            v.style.height = height;
            v.style.backgroundColor = color;
            v.style.borderTopLeftRadius = 8;
            v.style.borderTopRightRadius = 8;
            v.style.borderBottomLeftRadius = 8;
            v.style.borderBottomRightRadius = 8;
            Add(v);
            return v;
        }
        private void Set(Vector2 point, bool notify)
        {
            var t = Mathf.Clamp01((point.x - worldBound.x) / Mathf.Max(1, width));
            fill.style.width = width * t;
            thumb.style.left = (width - 14) * t;
            if (notify)
                changed?.Invoke(Mathf.Lerp(minimum, maximum, t));
        }
        public void Bind(float value, float min, float max, float x, float y, float w, Action<float> callback, bool release)
        {
            minimum = min;
            maximum = max;
            width = w;
            changed = callback;
            onRelease = release;
            style.left = x;
            style.top = y;
            style.width = w;
            track.style.width = w;
            var t = (value - min) / Mathf.Max(1, max - min);
            fill.style.width = w * t;
            thumb.style.left = (w - 14) * t;
        }
    }
}
