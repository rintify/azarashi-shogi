using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    /// <summary>Retained native views. A state update patches existing controls instead of clearing the HUD.</summary>
    public sealed class NativeViewTree
    {
        private readonly Dictionary<string, VisualElement> views = new Dictionary<string, VisualElement>();
        private readonly Dictionary<VisualElement, string> paths = new Dictionary<VisualElement, string>();
        private readonly Dictionary<string, int> cursors = new Dictionary<string, int>();
        private readonly HashSet<string> seen = new HashSet<string>();
        private readonly Dictionary<string, float> exiting = new Dictionary<string, float>();
        private bool building;
        public void Begin(VisualElement root)
        {
            building = true;
            cursors.Clear();
            seen.Clear();
            paths[root] = "root";
        }
        public T Get<T>(VisualElement parent, string role, Func<T> create) where T : VisualElement
        {
            if (!building || !paths.TryGetValue(parent, out var path))
            {
                var fresh = create();
                parent.Add(fresh);
                return fresh;
            }
            var prefix = path + "/" + role;
            var count = cursors.TryGetValue(prefix, out var n) ? n : 0;
            cursors[prefix] = count + 1;
            var key = prefix + ":" + count;
            if (!views.TryGetValue(key, out var v))
            {
                v = create();
                views[key] = v;
                paths[v] = key;
                parent.Add(v);
            }
            else if (exiting.Remove(key))
            {
                v.SetEnabled(true);
                NativeUi.Enter(v);
            }
            seen.Add(key);
            return (T)v;
        }
        public void TrackContainer(VisualElement owner, string role, VisualElement container)
        {
            // ScrollView owns its internal contentContainer. Its children still belong
            // to this retained tree, although that container was not created by Get.
            if (!building || !paths.TryGetValue(owner, out var ownerPath))
                throw new InvalidOperationException("Track layout containers while building their owner.");
            var key = ownerPath + "/" + role;
            paths[container] = key;
            seen.Add(key);
        }
        public void End()
        {
            building = false;
            foreach (var item in views)
            {
                if (seen.Contains(item.Key) || exiting.ContainsKey(item.Key))
                    continue;
                var parent = item.Value.parent;
                if (parent != null && paths.TryGetValue(parent, out var key) && key != "root" && !seen.Contains(key))
                    continue;
                exiting[item.Key] = Time.unscaledTime;
                item.Value.SetEnabled(false);
                NativeUi.Exit(item.Value);
            }
        }
        public void Tick()
        {
            var remove = new List<string>();
            foreach (var item in exiting)
                if (Time.unscaledTime - item.Value >= .18f)
                    remove.Add(item.Key);
            foreach (var key in remove)
            {
                if (!views.TryGetValue(key, out var v))
                    continue;
                NativeUi.Forget(v);
                v.RemoveFromHierarchy();
                var children = new List<string>();
                foreach (var item in views)
                    if (item.Key == key || item.Key.StartsWith(key + "/"))
                        children.Add(item.Key);
                foreach (var child in children)
                {
                    paths.Remove(views[child]);
                    views.Remove(child);
                    exiting.Remove(child);
                }
                var containers = new List<VisualElement>();
                foreach (var item in paths)
                    if (item.Value.StartsWith(key + "/"))
                        containers.Add(item.Key);
                foreach (var container in containers)
                    paths.Remove(container);
            }
        }
    }

    /// <summary>Shared presentation mechanics: source CSS easings, presence, swaps, hover and shadow skins.</summary>
    public static class NativeUi
    {
        private sealed class Tween
        {
            public VisualElement element; public float start, duration, delay, fromOpacity, toOpacity, fromScale, toScale, fromY, toY; public bool spring;
        }
        private sealed class Control
        {
            public Action action; public Color normal, hover; public bool down, over; public float offset, start, fromScale = 1, toScale = 1, fromY, toY; public bool animating;
        }
        private static readonly List<Tween> tweens = new List<Tween>();
        private static readonly Dictionary<Button, Control> controls = new Dictionary<Button, Control>();
        private static readonly Dictionary<string, Texture2D> symbols = new Dictionary<string, Texture2D>();
        public static float Ease(float t, bool spring = false)
        {
            var x1 = spring ? .22f : .2f;
            var y1 = spring ? 1.3f : .8f;
            var x2 = spring ? .35f : .2f;
            var y2 = 1f;
            var lo = 0f;
            var hi = 1f;
            for (var i = 0; i < 16; i++)
            {
                var u = (lo + hi) * .5f;
                var v = 1 - u;
                var x = 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u;
                if (x < t)
                    lo = u;
                else
                    hi = u;
            }
            var s = (lo + hi) * .5f;
            var r = 1 - s;
            return 3 * r * r * s * y1 + 3 * r * s * s * y2 + s * s * s;
        }
        private static void Animate(VisualElement element, float duration, float delay, float opacity0, float opacity1, float y0, float y1, float scale0, float scale1, bool spring)
        {
            tweens.RemoveAll(t => t.element == element);
            tweens.Add(new Tween { element = element, start = Time.unscaledTime, duration = duration, delay = delay, fromOpacity = opacity0, toOpacity = opacity1, fromY = y0, toY = y1, fromScale = scale0, toScale = scale1, spring = spring });
            element.style.opacity = opacity0;
            element.style.translate = new Translate(0, y0);
            element.style.scale = new Scale(Vector3.one * scale0);
        }
        public static void Enter(VisualElement element, float delay = 0, bool control = false) => Animate(element, control ? .3f : .26f, delay, 0, 1, control ? 8 : 12, 0, control ? .86f : .96f, 1, true);
        public static void Header(VisualElement element, float delay = 0) => Animate(element, .42f, delay, 0, 1, -8, 0, 1, 1, true);
        public static void Exit(VisualElement element) => Animate(element, .18f, 0, element.resolvedStyle.opacity, 0, 0, 9, 1, .96f, false);
        public static void Swap(TextElement label, string value)
        {
            if (label.text == value)
                return;
            if (!string.IsNullOrEmpty(label.text) && label.parent != null)
            {
                var old = new Label(label.text) { pickingMode = PickingMode.Ignore };
                old.style.position = UnityEngine.UIElements.Position.Absolute;
                old.style.left = label.layout.x;
                old.style.top = label.layout.y;
                old.style.width = label.layout.width;
                old.style.height = label.layout.height;
                old.style.fontSize = label.resolvedStyle.fontSize;
                old.style.color = label.resolvedStyle.color;
                old.style.unityTextAlign = label.resolvedStyle.unityTextAlign;
                old.style.unityFontStyleAndWeight = label.resolvedStyle.unityFontStyleAndWeight;
                label.parent.Add(old);
                Animate(old, .18f, 0, 1, 0, 0, -6, 1, 1, false);
                old.schedule.Execute(() => old.RemoveFromHierarchy()).StartingIn(180);
            }
            label.text = value;
            Animate(label, .22f, 0, 0, 1, 6, 0, 1, 1, false);
        }
        public static void Bind(Button button, Action action, Color normal, Color hover, float hoverOffset = 0)
        {
            if (!controls.TryGetValue(button, out var c))
            {
                c = new Control();
                controls[button] = c;
                button.clicked += () => c.action?.Invoke();
                button.RegisterCallback<PointerEnterEvent>(_ => { c.over = true; button.style.backgroundColor = c.hover; if (!c.down) Move(button, c, 1, c.offset); });
                button.RegisterCallback<PointerLeaveEvent>(_ => { c.over = false; c.down = false; button.style.backgroundColor = c.normal; Move(button, c, 1, 0); });
                button.RegisterCallback<PointerDownEvent>(_ => { c.down = true; Move(button, c, .94f, c.offset < 0 ? 3 : 0); });
                button.RegisterCallback<PointerUpEvent>(_ => { c.down = false; Move(button, c, 1, c.over ? c.offset : 0); });
                button.style.transitionProperty = new List<StylePropertyName> { new StylePropertyName("background-color"), new StylePropertyName("color"), new StylePropertyName("border-color") };
                button.style.transitionDuration = new List<TimeValue> { new TimeValue(.18f) };
            }
            c.action = action;
            c.normal = normal;
            c.hover = hover;
            c.offset = hoverOffset;
            button.style.backgroundColor = c.over ? hover : normal;
        }
        private static void Move(Button button, Control c, float scale, float y)
        {
            c.fromScale = button.resolvedStyle.scale.value.x;
            c.fromY = button.resolvedStyle.translate.y;
            c.toScale = scale;
            c.toY = y;
            c.start = Time.unscaledTime;
            c.animating = true;
        }
        public static void Forget(VisualElement element)
        {
            tweens.RemoveAll(t => t.element == element);
            if (element is Button button)
                controls.Remove(button);
            foreach (var child in element.Children())
                Forget(child);
        }
        public static void EnterOnce(VisualElement element, bool header = false, float delay = 0)
        {
            if (element.ClassListContains("native-arrived"))
                return;
            element.AddToClassList("native-arrived");
            if (header)
                Header(element, delay);
            else
                Enter(element, delay);
        }
        public static void Symbol(VisualElement element, string name, Color tint)
        {
            if (!symbols.TryGetValue(name, out var texture))
                symbols[name] = texture = Resources.Load<Texture2D>("Native/Symbols/" + name);
            element.style.backgroundImage = new StyleBackground(texture);
            element.style.unityBackgroundImageTintColor = tint;
            element.style.unityBackgroundScaleMode = ScaleMode.ScaleToFit;
        }
        public static void Skin(VisualElement element, string name, float radius)
        {
            VisualElement shadow = null;
            foreach (var child in element.Children())
                if (child.name == "css-shadow")
                {
                    shadow = child;
                    break;
                }
            if (shadow == null)
            {
                shadow = new VisualElement { name = "css-shadow", pickingMode = PickingMode.Ignore };
                shadow.style.position = UnityEngine.UIElements.Position.Absolute;
                shadow.style.left = -80;
                shadow.style.right = -80;
                shadow.style.top = -80;
                shadow.style.bottom = -80;
                element.Insert(0, shadow);
            }
            shadow.style.backgroundImage = new StyleBackground(Resources.Load<Texture2D>("Native/Shadows/" + name));
            var slice = Mathf.RoundToInt((80 + Mathf.Min(radius, 48)) * 2);
            shadow.style.unitySliceTop = slice;
            shadow.style.unitySliceBottom = slice;
            shadow.style.unitySliceLeft = slice;
            shadow.style.unitySliceRight = slice;
            shadow.style.unitySliceScale = .5f;

        }
        public static void Tick()
        {
            foreach (var item in controls)
            {
                var c = item.Value;
                if (!c.animating || item.Key.panel == null || tweens.Exists(t => t.element == item.Key))
                    continue;
                var p = Mathf.Clamp01((Time.unscaledTime - c.start) / .18f);
                var ease = Ease(p, true);
                item.Key.style.scale = new Scale(Vector3.one * Mathf.LerpUnclamped(c.fromScale, c.toScale, ease));
                item.Key.style.translate = new Translate(0, Mathf.LerpUnclamped(c.fromY, c.toY, ease));
                if (p >= 1)
                    c.animating = false;
            }
            for (var i = tweens.Count - 1; i >= 0; i--)
            {
                var t = tweens[i];
                if (t.element.panel == null)
                {
                    tweens.RemoveAt(i);
                    continue;
                }
                var p = Mathf.Clamp01((Time.unscaledTime - t.start - t.delay) / t.duration);
                var ease = Ease(p, t.spring);
                t.element.style.opacity = Mathf.LerpUnclamped(t.fromOpacity, t.toOpacity, ease);
                t.element.style.translate = new Translate(0, Mathf.LerpUnclamped(t.fromY, t.toY, ease));
                t.element.style.scale = new Scale(Vector3.one * Mathf.LerpUnclamped(t.fromScale, t.toScale, ease));
                if (p >= 1)
                    tweens.RemoveAt(i);
            }
        }
    }
}
