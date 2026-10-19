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
            // Retention preserves identity, not the previous DOM order. Conditional
            // fields can be inserted before existing buttons in the source layout.
            v.BringToFront();
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
                if (item.Value.resolvedStyle.position == UnityEngine.UIElements.Position.Relative)
                {
                    // Retired flow content must not reserve space in the new form.
                    // Retain its last pixels while the source-sized container changes.
                    var rect = item.Value.layout;
                    item.Value.style.position = UnityEngine.UIElements.Position.Absolute;
                    item.Value.style.left = rect.x - (parent?.resolvedStyle.borderLeftWidth ?? 0);
                    item.Value.style.top = rect.y - (parent?.resolvedStyle.borderTopWidth ?? 0);
                    item.Value.style.width = rect.width;
                    item.Value.style.height = rect.height;
                    item.Value.style.marginLeft = item.Value.style.marginRight = item.Value.style.marginTop = item.Value.style.marginBottom = 0;
                }
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
            public Action action; public Color normal, hover; public bool down, over; public float offset, restingY, start, fromScale = 1, toScale = 1, fromY, toY; public bool animating;
        }
        private static readonly List<Tween> tweens = new List<Tween>();
        private static readonly Dictionary<Button, Control> controls = new Dictionary<Button, Control>();
        private static readonly Dictionary<string, Texture2D> symbols = new Dictionary<string, Texture2D>();
        public static bool KeyboardFocus;
        private sealed class FocusState { public bool focused; public VisualElement ring; }
        private static readonly Dictionary<VisualElement, FocusState> focusStates = new Dictionary<VisualElement, FocusState>();
        public static void Focusable(VisualElement element)
        {
            if (focusStates.ContainsKey(element))
                return;
            var state = new FocusState();
            focusStates[element] = state;
            element.RegisterCallback<FocusInEvent>(_ => state.focused = true);
            element.RegisterCallback<FocusOutEvent>(_ => state.focused = false);
        }
        public static float Ease(float t, bool spring = false)
        {
            var x1 = spring ? .22f : .2f;
            var y1 = spring ? 1.3f : .8f;
            var x2 = spring ? .35f : .2f;
            return Cubic(t, x1, y1, x2, 1);
        }
        public static float Cubic(float t, float x1, float y1, float x2, float y2)
        {
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
        public static void StopAnimation(VisualElement element) => tweens.RemoveAll(t => t.element == element);
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
                old.style.marginLeft = old.style.marginRight = old.style.marginTop = old.style.marginBottom = 0;
                old.style.paddingLeft = label.resolvedStyle.paddingLeft;
                old.style.paddingRight = label.resolvedStyle.paddingRight;
                old.style.paddingTop = label.resolvedStyle.paddingTop;
                old.style.paddingBottom = label.resolvedStyle.paddingBottom;
                old.style.letterSpacing = label.resolvedStyle.letterSpacing;
                old.style.whiteSpace = label.resolvedStyle.whiteSpace;
                label.parent.Insert(label.parent.IndexOf(label), old);
                Animate(old, .18f, 0, 1, 0, 0, -6, 1, 1, false);
                if (shadows.TryGetValue(label, out var sourceShadow) && sourceShadow.text)
                    TextShadows(old, sourceShadow.name, sourceShadow.dangerColor);
                old.schedule.Execute(() => { Forget(old); old.RemoveFromHierarchy(); }).StartingIn(180);
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
                Focusable(button);
                button.clicked += () => c.action?.Invoke();
                button.RegisterCallback<PointerEnterEvent>(_ => { c.over = true; button.style.backgroundColor = c.hover; if (!c.down) Move(button, c, 1, c.restingY + c.offset); });
                button.RegisterCallback<PointerLeaveEvent>(_ => { c.over = false; c.down = false; button.style.backgroundColor = c.normal; Move(button, c, 1, c.restingY); });
                button.RegisterCallback<PointerDownEvent>(_ => { c.down = true; Move(button, c, .94f, c.restingY + (c.offset < 0 ? 3 : 0)); });
                button.RegisterCallback<PointerUpEvent>(_ => { c.down = false; Move(button, c, 1, c.restingY + (c.over ? c.offset : 0)); });
                button.style.transitionProperty = new List<StylePropertyName> { new StylePropertyName("background-color"), new StylePropertyName("color"), new StylePropertyName("border-color") };
                button.style.transitionDuration = new List<TimeValue> { new TimeValue(.18f) };
            }
            c.action = action;
            c.normal = normal;
            c.hover = hover;
            c.offset = hoverOffset;
            button.style.backgroundColor = c.over ? hover : normal;
        }
        public static void RestingY(Button button, float y)
        {
            if (controls.TryGetValue(button, out var control))
                control.restingY = y;
            button.style.translate = new Translate(0, y);
        }
        public static void Colors(Button button, Color normal, Color hover)
        {
            if (controls.TryGetValue(button, out var control))
            {
                control.normal = normal;
                control.hover = hover;
                button.style.backgroundColor = control.over ? hover : normal;
            }
            else button.style.backgroundColor = normal;
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
            RemoveSkin(element);
            if (focusStates.TryGetValue(element, out var focus))
            {
                focus.ring?.RemoveFromHierarchy();
                focusStates.Remove(element);
            }
            foreach (var child in new List<VisualElement>(element.Children()))
                Forget(child);
        }
        public static void ClearChildren(VisualElement element)
        {
            foreach (var child in new List<VisualElement>(element.Children()))
                Forget(child);
            element.Clear();
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
            var current = element.Q<VisualElement>("source-symbol-current");
            if (current == null)
            {
                current = new VisualElement { name = "source-symbol-current", pickingMode = PickingMode.Ignore };
                current.style.position = UnityEngine.UIElements.Position.Absolute;
                current.style.left = current.style.right = current.style.top = current.style.bottom = 0;
                element.Add(current);
            }
            var previous = current.style.backgroundImage.value.texture;
            if (previous != null && previous != texture)
            {
                var old = new VisualElement { pickingMode = PickingMode.Ignore };
                old.style.position = UnityEngine.UIElements.Position.Absolute;
                old.style.left = old.style.right = old.style.top = old.style.bottom = 0;
                old.style.backgroundImage = new StyleBackground(previous);
                old.style.unityBackgroundImageTintColor = current.style.unityBackgroundImageTintColor;
                old.style.unityBackgroundScaleMode = ScaleMode.ScaleToFit;
                element.Insert(0, old);
                Animate(old, .18f, 0, 1, 0, 0, -6, 1, 1, false);
                Animate(current, .22f, 0, 0, 1, 6, 0, 1, 1, false);
                old.schedule.Execute(() => { Forget(old); old.RemoveFromHierarchy(); }).StartingIn(180);
            }
            current.style.backgroundImage = new StyleBackground(texture);
            current.style.unityBackgroundImageTintColor = tint;
            current.style.unityBackgroundScaleMode = ScaleMode.ScaleToFit;
        }
        public static void Center(VisualElement element)
        {
            // Percentages use the parent's inner box. This remains centered when a
            // control gains a border or changes size at a responsive breakpoint.
            element.style.left = Length.Percent(50);
            element.style.top = Length.Percent(50);
            element.style.translate = new Translate(Length.Percent(-50), Length.Percent(-50));
        }
        [Serializable] private sealed class CssPresentation { public CssSurface[] surfaces; }
        [Serializable] private sealed class CssSurface { public string name; public CssShadow[] layers; }
        [Serializable] private sealed class CssShadow { public float x, y, blur, spread, opacity = 1; public string color; }
        private sealed class Shadow
        {
            public VisualElement host;
            public string name, dangerColor;
            public float radius;
            public bool text;
        }
        private static readonly Dictionary<VisualElement, Shadow> shadows = new Dictionary<VisualElement, Shadow>();
        private static Dictionary<string, CssShadow[]> shadowStyles;
        public static void Blur(VisualElement element, float sigma)
        {
            var previous = element.style.filter.value;
            if (previous != null && (sigma <= 0 && previous.Count == 0 || previous.Count == 1 && previous[0].type == FilterFunctionType.Blur && Mathf.Approximately(previous[0].GetParameter(0).floatValue, sigma)))
                return;
            var filters = new List<FilterFunction>();
            if (sigma > 0)
            {
                var blur = new FilterFunction(FilterFunctionType.Blur);
                blur.AddParameter(new FilterParameter(sigma));
                filters.Add(blur);
            }
            element.style.filter = filters;
        }
        public static void Skin(VisualElement element, string name, float radius, string dangerColor = null) => ShadowLayers(element, name, radius, dangerColor, false);
        public static void TextShadows(TextElement element, string name, string tint = null)
        {
            element.style.textShadow = default(TextShadow);
            ShadowLayers(element, name, 0, tint, true);
        }
        private static void ShadowLayers(VisualElement element, string name, float radius, string dangerColor, bool text)
        {
            if (shadowStyles == null)
            {
                shadowStyles = new Dictionary<string, CssShadow[]>();
                var presentation = JsonUtility.FromJson<CssPresentation>(Resources.Load<TextAsset>("Native/Presentation").text);
                foreach (var surface in presentation.surfaces)
                    shadowStyles[surface.name] = surface.layers;
            }
            if (!shadows.TryGetValue(element, out var shadow))
            {
                shadow = new Shadow { host = new VisualElement { name = "css-shadow", pickingMode = PickingMode.Ignore } };
                shadow.host.style.position = UnityEngine.UIElements.Position.Absolute;
                shadow.text = text;
                shadows[element] = shadow;
            }
            shadow.radius = radius;
            if (shadow.name != name || shadow.dangerColor != dangerColor)
            {
                shadow.name = name;
                shadow.dangerColor = dangerColor;
                shadow.host.Clear();
                if (!shadowStyles.TryGetValue(name, out var layers) || layers == null)
                    throw new InvalidOperationException("Missing source CSS shadow: " + name);
                foreach (var layer in layers)
                {
                    VisualElement shape = text ? new Label() : new VisualElement();
                    shape.pickingMode = PickingMode.Ignore;
                    shape.userData = layer;
                    shape.style.position = UnityEngine.UIElements.Position.Absolute;
                    var color = layer.color.StartsWith("var(") ? dangerColor : layer.color;
                    ColorUtility.TryParseHtmlString(color ?? "#b52b4b", out var tint);
                    tint.a *= layer.opacity;
                    if (text)
                    {
                        shape.style.color = tint;
                        shape.style.marginLeft = shape.style.marginRight = shape.style.marginTop = shape.style.marginBottom = 0;
                    }
                    else
                        shape.style.backgroundColor = tint;
                    Blur(shape, layer.blur / 2);
                    shadow.host.Add(shape);
                }
            }
            LayoutShadow(element, shadow);
        }
        private static void LayoutShadow(VisualElement element, Shadow shadow)
        {
            var parent = element.parent;
            if (parent == null)
                return;
            if (shadow.host.parent != parent || parent.IndexOf(shadow.host) != parent.IndexOf(element) - 1)
            {
                shadow.host.RemoveFromHierarchy();
                parent.Insert(parent.IndexOf(element), shadow.host);
            }
            var box = element.layout;
            if (float.IsNaN(box.width) || float.IsNaN(box.height) || box.width <= 0 || box.height <= 0)
                return;
            var style = element.resolvedStyle;
            shadow.host.style.left = box.x - parent.resolvedStyle.borderLeftWidth;
            shadow.host.style.top = box.y - parent.resolvedStyle.borderTopWidth;
            shadow.host.style.width = box.width;
            shadow.host.style.height = box.height;
            shadow.host.style.translate = style.translate;
            shadow.host.style.scale = style.scale;
            shadow.host.style.rotate = style.rotate;
            shadow.host.style.transformOrigin = new TransformOrigin(style.transformOrigin.x, style.transformOrigin.y, style.transformOrigin.z);
            shadow.host.style.opacity = style.opacity;
            shadow.host.style.display = style.display;
            var radius = Mathf.Min(shadow.radius, box.width / 2, box.height / 2);
            foreach (var shape in shadow.host.Children())
            {
                var layer = (CssShadow)shape.userData;
                shape.style.left = layer.x - layer.spread;
                shape.style.top = layer.y - layer.spread;
                shape.style.width = box.width + 2 * layer.spread;
                shape.style.height = box.height + 2 * layer.spread;
                var r = Mathf.Max(0, radius + layer.spread);
                if (shadow.text)
                {
                    var source = (TextElement)element;
                    var copy = (Label)shape;
                    copy.text = source.text;
                    copy.enableRichText = source.enableRichText;
                    shape.style.fontSize = style.fontSize;
                    shape.style.unityFontDefinition = style.unityFontDefinition;
                    shape.style.unityFontStyleAndWeight = style.unityFontStyleAndWeight;
                    shape.style.unityTextAlign = style.unityTextAlign;
                    shape.style.letterSpacing = style.letterSpacing;
                    shape.style.wordSpacing = style.wordSpacing;
                    shape.style.whiteSpace = style.whiteSpace;
                    shape.style.paddingLeft = style.paddingLeft;
                    shape.style.paddingRight = style.paddingRight;
                    shape.style.paddingTop = style.paddingTop;
                    shape.style.paddingBottom = style.paddingBottom;
                }
                else
                {
                    shape.style.borderTopLeftRadius = shape.style.borderTopRightRadius = r;
                    shape.style.borderBottomLeftRadius = shape.style.borderBottomRightRadius = r;
                }
            }
        }
        public static void RemoveSkin(VisualElement element)
        {
            if (!shadows.TryGetValue(element, out var shadow))
                return;
            shadow.host.RemoveFromHierarchy();
            shadows.Remove(element);
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
            foreach (var item in shadows)
                LayoutShadow(item.Key, item.Value);
            foreach (var item in focusStates)
            {
                var element = item.Key;
                var focus = item.Value;
                var visible = focus.focused && KeyboardFocus && element.enabledInHierarchy;
                if (focus.ring == null && visible && element.parent != null)
                {
                    focus.ring = new VisualElement { name = "source-focus-outline", pickingMode = PickingMode.Ignore };
                    focus.ring.style.position = UnityEngine.UIElements.Position.Absolute;
                    focus.ring.style.borderLeftWidth = focus.ring.style.borderRightWidth = focus.ring.style.borderTopWidth = focus.ring.style.borderBottomWidth = 2;
                    var color = new Color(116f / 255, 220f / 255, 1);
                    focus.ring.style.borderLeftColor = focus.ring.style.borderRightColor = focus.ring.style.borderTopColor = focus.ring.style.borderBottomColor = color;
                    element.parent.Add(focus.ring);
                }
                if (focus.ring == null)
                    continue;
                focus.ring.style.display = visible ? DisplayStyle.Flex : DisplayStyle.None;
                if (!visible || element.parent == null)
                    continue;
                var rect = element.layout;
                var style = element.resolvedStyle;
                focus.ring.style.left = rect.x - element.parent.resolvedStyle.borderLeftWidth - 4;
                focus.ring.style.top = rect.y - element.parent.resolvedStyle.borderTopWidth - 4;
                focus.ring.style.width = rect.width + 8;
                focus.ring.style.height = rect.height + 8;
                focus.ring.style.borderTopLeftRadius = style.borderTopLeftRadius + 4;
                focus.ring.style.borderTopRightRadius = style.borderTopRightRadius + 4;
                focus.ring.style.borderBottomLeftRadius = style.borderBottomLeftRadius + 4;
                focus.ring.style.borderBottomRightRadius = style.borderBottomRightRadius + 4;
                focus.ring.style.translate = style.translate;
                focus.ring.style.scale = style.scale;
                focus.ring.style.opacity = style.opacity;
            }
        }
    }
}
