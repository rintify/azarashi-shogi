using System;
using UnityEngine;
using UnityEngine.UIElements;
namespace Azarashi.UnityView
{
    /// <summary>A retained slider keeps its pointer capture and event binding across state updates.</summary>
    public sealed class NativeSlider : VisualElement
    {
        private readonly VisualElement track, fill, thumb;
        private const float ThumbSize = 16;
        private Action<float> changed; private float minimum, maximum, width, value;
        public NativeSlider()
        {
            userData = "native-ui";
            focusable = true;
            NativeUi.Focusable(this);
            tabIndex = 0;
            style.position = UnityEngine.UIElements.Position.Absolute;
            style.height = 18;
            // The source uses native range inputs: 18px in the replay dock, with a
            // 16px thumb and the CSS accent color. Keep its observed Chromium track.
            track = Part(new Color(59f / 255, 59f / 255, 59f / 255), 5, 8);
            fill = Part(new Color(.149f, .498f, .620f), 5, 8);
            thumb = Part(new Color(.149f, .498f, .620f), 1, ThumbSize);
            thumb.style.width = ThumbSize;
            RegisterCallback<PointerDownEvent>(e => { Focus(); this.CapturePointer(e.pointerId); Set(e.position, true); e.StopPropagation(); });
            RegisterCallback<PointerMoveEvent>(e => { if (this.HasPointerCapture(e.pointerId)) Set(e.position, true); });
            RegisterCallback<PointerUpEvent>(e => { if (!this.HasPointerCapture(e.pointerId)) return; Set(e.position, true); this.ReleasePointer(e.pointerId); });
            RegisterCallback<KeyDownEvent>(e =>
            {
                var next = value;
                if (e.keyCode == KeyCode.RightArrow || e.keyCode == KeyCode.UpArrow)
                    next++;
                else if (e.keyCode == KeyCode.LeftArrow || e.keyCode == KeyCode.DownArrow)
                    next--;
                else if (e.keyCode == KeyCode.Home)
                    next = minimum;
                else if (e.keyCode == KeyCode.End)
                    next = maximum;
                else
                    return;
                Change(next, true);
                e.StopPropagation();
            });
            RegisterCallback<GeometryChangedEvent>(e =>
            {
                width = e.newRect.width;
                track.style.width = width;
                Change(value, false);
            });
        }
        public void SetTrackHeight(float height)
        {
            track.style.top = fill.style.top = (height - 8) / 2;
            thumb.style.top = (height - ThumbSize) / 2;
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
            var t = Mathf.Clamp01((point.x - worldBound.x - ThumbSize * .5f) / Mathf.Max(1, width - ThumbSize));
            Change(Mathf.Lerp(minimum, maximum, t), notify);
        }
        private void Change(float next, bool notify)
        {
            // Both source range inputs (AI levels and replay ply) use step=1.
            var rounded = Mathf.Clamp(Mathf.Round(next), minimum, maximum);
            var hasChanged = rounded != value;
            value = rounded;
            var t = (value - minimum) / Mathf.Max(1, maximum - minimum);
            fill.style.width = ThumbSize * .5f + (width - ThumbSize) * t;
            thumb.style.left = (width - ThumbSize) * t;
            if (notify && hasChanged)
                changed?.Invoke(value);
        }
        public void Bind(float value, float min, float max, float x, float y, float w, Action<float> callback, bool replay, bool flow = false)
        {
            minimum = min;
            maximum = max;
            // A flow slider may be narrower because of the auto scrollbar.
            // Keep its measured width when rebinding; unchanged geometry won't
            // send another event to correct a fixed-width fallback afterward.
            width = flow && layout.width > 0 && !float.IsNaN(layout.width) ? layout.width : w;
            this.value = value;
            changed = callback;
            var accent = replay ? new Color(44f / 255, 159f / 255, 197f / 255) : new Color(38f / 255, 127f / 255, 158f / 255);
            track.style.backgroundColor = replay ? new Color(59f / 255, 59f / 255, 59f / 255) : new Color(239f / 255, 239f / 255, 239f / 255);
            track.style.borderLeftWidth = track.style.borderRightWidth = track.style.borderTopWidth = track.style.borderBottomWidth = replay ? 0 : 1;
            track.style.borderLeftColor = track.style.borderRightColor = track.style.borderTopColor = track.style.borderBottomColor = new Color(178f / 255, 178f / 255, 178f / 255);
            fill.style.backgroundColor = accent;
            thumb.style.backgroundColor = accent;
            style.left = x;
            style.top = y;
            style.width = flow ? new StyleLength(StyleKeyword.Auto) : new StyleLength(w);
            track.style.width = width;
            var t = (value - min) / Mathf.Max(1, max - min);
            fill.style.width = ThumbSize * .5f + (width - ThumbSize) * t;
            thumb.style.left = (width - ThumbSize) * t;
        }
    }
}
