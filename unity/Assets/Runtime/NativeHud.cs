using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    /// <summary>Native Unity UI Toolkit HUD. No React DOM, browser buttons or CSS are used at runtime.</summary>
    public sealed partial class NativeHud : MonoBehaviour
    {
        private NativeMatch match;
        private readonly NativeViewTree views = new NativeViewTree();
        private readonly NativeViewTree dialogViews = new NativeViewTree();
        private NativeViewTree activeViews;
        private VisualElement dialogLayer;
        private string dialogSignature;
        private int lastDockRevision = -1;
        private string announcedTurn;
        private float announcementAt = -2;
        private VisualElement turnNotice;
        private Label turnNoticeCopy;
        private float clockStarted, clockFrom, clockTo;
        private bool clockVisible;
        private Rect playArea;

        private UIDocument document;
        private VisualElement root, hud, markers, choice, clock, result;
        private Label status, opponentLabel;
        private NativeSymbol clockIcon;
        private readonly Dictionary<string, Label> counts = new Dictionary<string, Label>();
        private readonly Dictionary<string, VisualElement> stockTargets = new Dictionary<string, VisualElement>();
        private readonly Dictionary<string, VisualElement> markNodes = new Dictionary<string, VisualElement>();
        private readonly Dictionary<string, Texture2D> icons = new Dictionary<string, Texture2D>();
        private readonly List<VisualElement> orbs = new List<VisualElement>();
        private float uiScale = 1, width = 1280, height = 720, clockAmount;
        private bool expanded, gridOpen, dirty = true;
        private int choiceCount = -1, choiceIndex;
        private string resultKey, message;
        private Settings draft;
        private float messageUntil, resultStarted;
        private readonly List<VisualElement> celebration = new List<VisualElement>();
        public int CatalogIndex;
        public bool CatalogSpins = true;
        public float CatalogAngle;
        public float CatalogBirth;
        private int shownCatalog = -1;
        private Camera catalogCamera;
        private RenderTexture catalogTexture;
        public Rect PlayArea => new Rect(playArea.x * uiScale, playArea.y * uiScale, playArea.width * uiScale, playArea.height * uiScale);
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern float AzarashiPixelRatio();
#endif
        private static Color C(string hex)
        {
            ColorUtility.TryParseHtmlString(hex, out var c);
            return c;
        }
        public void Initialize(NativeMatch owner)
        {
            match = owner;
            activeViews = views;
            document = gameObject.AddComponent<UIDocument>();
            document.panelSettings = Resources.Load<PanelSettings>("Native/PanelSettings");
            root = document.rootVisualElement;
            root.pickingMode = PickingMode.Ignore;
            root.style.position = UnityEngine.UIElements.Position.Absolute;
            root.style.left = 0;
            root.style.top = 0;
            root.style.right = 0;
            root.style.bottom = 0;
            root.style.unityFontDefinition = FontDefinition.FromFont(Resources.Load<Font>("Native/NotoSansJP"));
            root.style.color = C("#375775");
            root.style.fontSize = 14;
            foreach (var variant in match.Data.Config.variants)
            {
                var key = variant.kind + "-" + (variant.promoted ? 1 : 0);
                icons[key] = Resources.Load<Texture2D>("Native/Icons/" + key);
            }
            catalogTexture = new RenderTexture(512, 640, 16, RenderTextureFormat.ARGB32);
            catalogTexture.Create();
            catalogCamera = new GameObject("Native catalog camera").AddComponent<Camera>();
            catalogCamera.targetTexture = catalogTexture;
            catalogCamera.cullingMask = 1 << 1;
            catalogCamera.fieldOfView = 32;
            catalogCamera.backgroundColor = C("#d9edf3");
            catalogCamera.clearFlags = CameraClearFlags.SolidColor;
            catalogCamera.transform.position = new Vector3(52, 1.95f, -3.2f);
            catalogCamera.transform.LookAt(new Vector3(50, .5f, 0));
            catalogCamera.enabled = false;
            catalogCamera.nearClipPlane = .1f;
            var catalogLight = new GameObject("Original catalog light").AddComponent<Light>();
            catalogLight.type = LightType.Directional;
            catalogLight.cullingMask = 1 << 1;
            catalogLight.transform.position = new Vector3(47, 6, -4);
            catalogLight.transform.LookAt(new Vector3(50, 0, 0));
            catalogLight.intensity = 2.5f;
            catalogLight.shadows = LightShadows.Soft;
            catalogLight.shadowCustomResolution = 1024;
            catalogLight.shadowNormalBias = .03f;
            Rebuild();
        }
        public void Notify(string text)
        {
            message = text;
            messageUntil = Time.unscaledTime + 6;
            dirty = true;
        }
        public void Rebuild()
        {
            dirty = true;
        }
        private VisualElement Box(VisualElement parent, string name, float x, float y, float w, float h, string fill = null, float radius = 0, bool block = false)
        {
            var v = activeViews.Get(parent, "box-" + name, () => new VisualElement { name = name, pickingMode = block ? PickingMode.Position : PickingMode.Ignore, userData = block ? "native-ui" : null });
            v.style.position = UnityEngine.UIElements.Position.Absolute;
            v.style.left = x;
            v.style.top = y;
            v.style.width = w;
            v.style.height = h;
            if (fill != null)
                v.style.backgroundColor = C(fill);
            Round(v, radius);
            return v;
        }
        private static void Round(VisualElement v, float radius)
        {
            v.style.borderTopLeftRadius = radius;
            v.style.borderTopRightRadius = radius;
            v.style.borderBottomLeftRadius = radius;
            v.style.borderBottomRightRadius = radius;
        }
        private static void Border(VisualElement v, float width, string color)
        {
            v.style.borderLeftWidth = width;
            v.style.borderRightWidth = width;
            v.style.borderTopWidth = width;
            v.style.borderBottomWidth = width;
            var c = C(color);
            v.style.borderLeftColor = c;
            v.style.borderRightColor = c;
            v.style.borderTopColor = c;
            v.style.borderBottomColor = c;
        }
        private Label Text(VisualElement parent, string text, float x, float y, float w, float h, int size = 14, string color = "#375775", bool bold = false, TextAnchor anchor = TextAnchor.MiddleLeft)
        {
            var v = activeViews.Get(parent, "label", () => new Label(text) { pickingMode = PickingMode.Ignore });
            if (text.Length > 0)
                NativeUi.Swap(v, text);
            v.enableRichText = false;
            v.style.position = UnityEngine.UIElements.Position.Absolute;
            v.style.left = x;
            v.style.top = y;
            v.style.width = w;
            v.style.height = h;
            v.style.fontSize = size;
            v.style.color = C(color);
            v.style.unityTextAlign = anchor;
            v.style.unityFontStyleAndWeight = bold ? FontStyle.Bold : FontStyle.Normal;
            v.style.paddingLeft = 0;
            v.style.paddingRight = 0;
            v.style.paddingTop = 0;
            v.style.paddingBottom = 0;
            return v;
        }
        private void Icon(VisualElement parent, string kind, bool promoted, float x, float y, float size)
        {
            if (!icons.TryGetValue(kind + "-" + (promoted ? 1 : 0), out var texture) || texture == null)
                return;
            var v = Box(parent, "animal-icon", x, y, size, size);
            v.style.backgroundImage = new StyleBackground(texture);
            v.style.unityBackgroundScaleMode = ScaleMode.ScaleToFit;
        }
        private Button Button(VisualElement parent, string label, float x, float y, float w, float h, Action action, string fill = "#fff8e9", int size = 14)
        {
            var b = activeViews.Get(parent, "button", () => new Button() { userData = "native-ui" });
            NativeUi.Swap(b, label);
            b.style.position = UnityEngine.UIElements.Position.Absolute;
            b.style.left = x;
            b.style.top = y;
            b.style.width = w;
            b.style.height = h;
            b.style.marginLeft = 0;
            b.style.marginRight = 0;
            b.style.marginTop = 0;
            b.style.marginBottom = 0;
            b.style.paddingLeft = 4;
            b.style.paddingRight = 4;
            b.style.fontSize = size;
            b.style.color = C("#375775");
            b.style.unityFontStyleAndWeight = FontStyle.Bold;
            Round(b, Mathf.Min(h * .5f, 22));
            Border(b, 2, "#ffffff");
            NativeUi.Bind(b, action, C(fill), C("#fff1bd"));
            NativeUi.Skin(b, "hud", Mathf.Min(h * .5f, 22));
            return b;
        }
        private void Enter(VisualElement v) => NativeUi.Enter(v);
        private VisualElement Symbol(VisualElement parent, string name, float x, float y, float size, string color = "#507497")
        {
            var v = Box(parent, "symbol-" + name, x, y, size, size);
            NativeUi.Symbol(v, name, C(color));
            return v;
        }
        private static void NoSkin(VisualElement element)
        {
            var shadow = element.Q<VisualElement>("css-shadow");
            shadow?.RemoveFromHierarchy();
        }

        private void Build()
        {
            dirty = false;
            views.Begin(root);
            counts.Clear();
            stockTargets.Clear();
            var vignette = Box(root, "screen-vignette", 0, 0, width, height);
            vignette.style.backgroundImage = new StyleBackground(Resources.Load<Texture2D>("Native/Effects/vignette"));
            hud = Box(root, "native-hud", 0, 0, width, height);
            hud.style.transitionProperty = new List<StylePropertyName> { new StylePropertyName("opacity") };
            hud.style.transitionDuration = new List<TimeValue> { new TimeValue(.25f) };
            hud.style.opacity = resultKey == null ? 1 : 0;
            markers = Box(root, "native-markers", 0, 0, width, height);
            var mobile = width <= 760;
            var compact = mobile && height <= 670;
            var landscape = height <= 520 && width >= 500;
            var margin = mobile ? width <= 360 ? 10 : 14 : 24;
            var size = mobile ? 34 : 44;
            var buttonHeight = mobile ? 38 : 44;
            var gap = mobile ? 3 : 6;
            var headerTop = landscape ? 10 : mobile ? 12 : 20;
            if (landscape)
            {
                margin = 16;
                size = 36;
                buttonHeight = 36;
            }
            var brand = Box(hud, "brand", margin, headerTop, mobile ? 90 : 250, 50, null, 0, true);
            NativeUi.EnterOnce(brand, true);
            var brandButton = Button(brand, "", 0, 0, mobile ? 26 : 44, mobile ? 30 : 44, () => match.Open("catalog"));
            brandButton.style.backgroundColor = Color.clear;
            Border(brandButton, 0, "#ffffff");
            NoSkin(brandButton);
            Icon(brandButton, "seal", false, 0, 0, mobile ? 26 : 44);
            Text(brand, "図鑑", 0, mobile ? 31 : 45, mobile ? 26 : 44, 13, 9, "#ffffff", true, TextAnchor.MiddleCenter);
            var title = Text(brand, "アザラシ将棋", mobile ? 29 : 54, 0, mobile ? 102 : 200, mobile ? 30 : 44, mobile ? 13 : 18, "#ffffff", true);
            title.style.display = width <= 350 ? DisplayStyle.None : DisplayStyle.Flex;
            title.style.textShadow = new TextShadow { offset = new Vector2(0, 3), color = C("#3985a5"), blurRadius = 0 };
            var labels = new[] { match.Muted ? "mute" : "sound", "book", "replay", "reset", match.TopView ? "cube" : "view", gridOpen ? "x" : "grid" };
            Action[] actions = { () => { match.Muted = !match.Muted; Rebuild(); }, () => match.Open("rules"), () => match.Open("replays"), () => match.Open("settings"), () => { match.TopView = !match.TopView; Rebuild(); }, () => { gridOpen = !gridOpen; Rebuild(); } };
            for (var i = 0; i < labels.Length; i++)
            {
                var pressed = i == 0 && !match.Muted || i == 4 && match.TopView || i == 5 && gridOpen;
                var color = pressed ? "#795e49" : i == 1 ? "#7a6ea1" : i == 2 ? "#a36471" : "#507497";
                var fill = pressed ? "#ffe08d" : i == 1 ? "#e6e4ff" : i == 2 ? "#ffdedc" : "#fff9e9";
                var b = Button(hud, "", width - margin - (labels.Length - i) * (size + gap) + gap, headerTop, size, buttonHeight, actions[i], fill);
                NativeUi.EnterOnce(b, true);
                Symbol(b, labels[i], (size - 18) * .5f, (buttonHeight - 18) * .5f, 18, color);
            }
            var opponent = NativeGameData.Other(match.Viewer);
            var stockWidth = landscape ? 240 : mobile ? width - 28 : Mathf.Min(420, width - 32);
            var opponentTop = landscape || compact ? 54 : mobile ? 64 : 78;
            StockBar(hud, opponent, opponentTop, stockWidth, false);
            var bannerTop = landscape ? 100 : compact ? 98 : mobile ? 115 : 132;
            status = Text(hud, "", landscape ? width - 254 : 14, bannerTop, landscape ? 240 : width - 28, 20, mobile ? 11 : 12, "#ffffff", true, TextAnchor.MiddleCenter);
            status.style.textShadow = new TextShadow { offset = new Vector2(0, 2), color = C("#3986a3"), blurRadius = 0 };
            var bottom = compact || landscape ? 22 : 20;
            var playTop = landscape ? 52 : compact ? 116 : mobile ? 132 : 144;
            playArea = new Rect(landscape ? 14 : mobile ? 0 : 8, playTop, width - (landscape ? 274 : mobile ? 0 : 16), Mathf.Max(80, height - playTop - (landscape ? 20 : 74)));
            if (match.Replaying)
                BuildReplayDock();
            else if (match.State.phase == "finished" && !match.Busy)
            {
                if (match.ResultDismissed)
                {
                    Button(hud, "結果を見る", DockLeft, height - DockBottom - 44, DockWidth * .48f, 44, () => { match.ResultDismissed = false; Rebuild(); }, "#48afc8", 12);
                    Button(hud, "新しい対局", DockLeft + DockWidth * .52f, height - DockBottom - 44, DockWidth * .48f, 44, () => match.Open("settings"), "#48afc8", 12);
                }
            }
            else if (match.Settings.mode == "ai-vs-ai")
                BuildSpectatorDock();
            else
                BuildStockDock();
            clock = Box(root, "native-thinking-clock", width + 80, landscape || compact ? 96 : mobile ? 110 : 128, 48, 45);
            clockIcon = activeViews.Get(clock, "clock", () => new NativeSymbol("clock") { pickingMode = PickingMode.Ignore });
            clockIcon.style.position = UnityEngine.UIElements.Position.Absolute;
            clockIcon.style.left = 12;
            clockIcon.style.top = 3;
            clockIcon.style.width = 24;
            clockIcon.style.height = 24;
            Text(clock, "AI 思考中", 0, 29, 48, 10, 8, "#ffffff99", false, TextAnchor.MiddleCenter);
            turnNotice = Box(root, "turn-notice", width - 148, landscape ? 136 : 164, 132, 32, "#ffffffb8", 20);
            Symbol(turnNotice, "snowflake", 10, 9, 14, match.State.turn == "south" ? "#3badd0" : "#e9a05c");
            turnNoticeCopy = Text(turnNotice, "", 30, 0, 94, 32, 13, match.State.turn == "south" ? "#3badd0" : "#e9a05c", true);
            if (gridOpen)
                BuildGrid();
            choice = Box(root, "native-promotion", 0, 0, width, height);
            result = Box(root, "native-result", 0, 0, width, height);
            views.End();
            var signature = match.Dialog + ":" + (draft == null ? "" : JsonUtility.ToJson(draft)) + ":" + width + ":" + height + ":" + CatalogIndex + ":" + CatalogSpins + ":" + match.Replays.Count;
            if (signature != dialogSignature)
            {
                dialogSignature = signature;
                activeViews = dialogViews;
                dialogViews.Begin(root);
                if (match.Dialog != null)
                    BuildDialog(match.Dialog);
                dialogViews.End();
                activeViews = views;
            }
            if (message != null && Time.unscaledTime < messageUntil)
            {
                var n = Box(root, "notice", 14, height - 142, width - 28, 48, "#fff6e9", 18);
                Text(n, message, 12, 4, width - 52, 40, 12);
            }
        }
        public bool Blocks(Vector2 screen)
        {
            if (match.Dialog != null)
                return true;
            if (root?.panel == null)
                return true;
            var point = RuntimePanelUtils.ScreenToPanel(root.panel, new Vector2(screen.x, Screen.height - screen.y));
            var element = root.panel.Pick(point);
            while (element != null)
            {
                if (element.userData as string == "native-ui")
                    return true;
                element = element.parent;
            }
            return false;
        }
        private int StockCount(string owner, string kind)
        {
            var count = match.State.stocks.Of(owner).Count(kind);
            var motion = match.Motion;
            if (motion == null || motion.Waiting || motion.Stage == "return")
                return count;
            var victims = motion.Action.captured.Where(p => p.kind != "walrus").ToArray();
            for (var i = 0; i < victims.Length; i++)
                if (motion.Action.piece.owner == owner && victims[i].kind == kind && Time.unscaledTime < motion.TransferArrival(victims[i], i))
                    count--;
            return count;
        }
        public void Tick()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            uiScale=Mathf.Max(1,AzarashiPixelRatio());
#else
            uiScale = 1;
#endif
            var w = Screen.width / uiScale;
            var h = Screen.height / uiScale;
            if (Mathf.Abs(w - width) > .5f || Mathf.Abs(h - height) > .5f)
            {
                width = w;
                height = h;
                dirty = true;
            }
            document.panelSettings.scale = uiScale;
            if (lastDockRevision != match.State.revision || match.Busy)
            {
                lastDockRevision = match.State.revision;
                if (expanded)
                {
                    expanded = false;
                    dirty = true;
                }
            }
            if (match.Dialog != "settings")
                draft = null;
            if (dirty)
                Build();
            views.Tick();
            dialogViews.Tick();
            NativeUi.Tick();
            if (match.State == null)
                return;
            foreach (var item in counts)
            {
                var parts = item.Key.Split(':');
                NativeUi.Swap(item.Value, StockCount(parts[0], parts[1]).ToString());
            }
            status.text = !match.Engine.Ready ? "氷原を準備しています" : match.Replaying ? "リプレイ  " + match.ReplayCursor + " / " + match.ReplayTotal + "手" : match.SelectedStock != null ? "置く場所を選んでね" : match.SelectedId != null ? match.Data.Name(match.State.pieces.First(p => p.id == match.SelectedId)) : match.Actor(match.State.turn) + "の手番  " + (match.State.revision + 1) + "手目";
            var showClock = match.Thinking && Time.unscaledTime - match.ThinkingStarted > 3.5f;
            if (showClock != clockVisible)
            {
                clockVisible = showClock;
                clockStarted = Time.unscaledTime;
                clockFrom = clockAmount;
                clockTo = showClock ? 1 : 0;
            }
            var clockT = Mathf.Clamp01((Time.unscaledTime - clockStarted) / (showClock ? .4f : .28f));
            clockAmount = Mathf.Lerp(clockFrom, clockTo, showClock ? SlideEase(clockT) : 1 - Mathf.Cos(clockT * Mathf.PI * .5f));
            clock.style.left = width - 52 + (1 - clockAmount) * 72;
            clock.style.opacity = clockAmount > .001f ? 1 : 0;
            clockIcon.Progress = match.Thinking ? Mathf.Clamp01((Time.unscaledTime - match.ThinkingStarted) / Mathf.Max(1, match.ThinkingBudget)) : clockIcon.Progress;
            clockIcon.MarkDirtyRepaint();
            if (!match.Busy && match.State.phase == "playing" && announcedTurn != match.State.turn)
            {
                announcedTurn = match.State.turn;
                announcementAt = Time.unscaledTime;
                turnNoticeCopy.text = (match.Settings.mode == "human-vs-ai" && !match.HumanTurn ? "相手" : match.Actor(match.State.turn)) + "の番";
            }
            var notice = (Time.unscaledTime - announcementAt) / 1.05f;
            var noticeOpacity = notice < .2f ? NativeUi.Ease(notice / .2f) : notice < .72f ? 1 : 1 - NativeUi.Ease((notice - .72f) / .28f);
            turnNotice.style.opacity = match.State.phase == "playing" ? Mathf.Clamp01(noticeOpacity) : 0;
            turnNotice.style.translate = new Translate(0, notice < .2f ? (1 - noticeOpacity) * 5 : notice < .72f ? 0 : (1 - noticeOpacity) * -4);
            UpdateChoices();
            UpdateMarkers();
            UpdateOrbs();
            UpdateResult();
            if (resultKey != null)
            {
                var time = Time.unscaledTime - resultStarted;
                spectacle?.MarkDirtyRepaint();
                if (resultEmblem != null)
                {
                    var ease = SlideEase(Mathf.Clamp01(time / 1.1f));
                    resultEmblem.style.opacity = ease;
                    resultEmblem.style.translate = new Translate(0, -75 * (1 - ease));
                    resultEmblem.style.rotate = new Rotate(-20 * (1 - ease));
                    resultEmblem.style.scale = new Scale(Vector3.one * Mathf.Lerp(.5f, 1, ease));
                }
                if (resultKicker != null)
                {
                    var ease = SlideEase(Mathf.Clamp01((time - .12f) / .7f));
                    resultKicker.style.opacity = ease;
                    resultKicker.style.scale = new Scale(Vector3.one * Mathf.Lerp(1.8f, 1, ease));
                }
                for (var i = 0; i < celebration.Count; i++)
                {
                    var duration = 2.5f + (i % 5) * .3f;
                    var elapsed = time - (i % 8) * .09f;
                    var p = elapsed < 0 ? 0 : (elapsed % duration) / duration;
                    var ease = p * p;
                    var node = celebration[i];
                    node.style.left = width * ((i * 37 + 11) % 100) / 100f + (((i * 29) % 180) - 90) * ease;
                    node.style.top = -height * .08f + height * 1.1f * ease;
                    node.style.rotate = new Rotate(i * 71 + 250 * ease);
                    node.style.opacity = elapsed < 0 ? 0 : p < .1f ? p * 9 : .9f * (1 - p) / .9f;
                }
            }

            catalogCamera.enabled = match.Dialog == "catalog";
            if (catalogCamera.enabled && CatalogSpins)
                CatalogAngle += Time.unscaledDeltaTime * 4.2f;
        }
        private static float SlideEase(float t)
        {
            var lo = 0f;
            var hi = 1f;
            for (var i = 0; i < 16; i++)
            {
                var u = (lo + hi) * .5f;
                var v = 1 - u;
                var x = 3 * v * v * u * .16f + 3 * v * u * u * .3f + u * u * u;
                if (x < t)
                    lo = u;
                else
                    hi = u;
            }
            var s = (lo + hi) * .5f;
            return 1 - Mathf.Pow(1 - s, 3);
        }
        private void OnDestroy()
        {
            if (catalogTexture != null)
            {
                catalogTexture.Release();
                Destroy(catalogTexture);
            }
            if (catalogCamera != null)
                Destroy(catalogCamera.gameObject);
        }
    }

    public sealed class NativeSymbol : VisualElement
    {
        private readonly string symbol;
        public float Progress;
        public NativeSymbol(string symbol)
        {
            this.symbol = symbol;
            if (symbol == "clock")
                generateVisualContent += Paint;
            else
                NativeUi.Symbol(this, symbol, new Color(.314f, .455f, .592f));
        }
        private void Paint(MeshGenerationContext context)
        {
            var p = context.painter2D;
            var s = contentRect.width / 40f;
            p.lineCap = LineCap.Round;
            p.lineWidth = 2 * s;
            p.strokeColor = new Color(1, 1, 1, 36f / 255);
            p.BeginPath();
            p.Arc(new Vector2(20 * s, 20 * s), 16 * s, 0, 360);
            p.Stroke();
            p.strokeColor = new Color(1, 1, 1, 168f / 255);
            p.BeginPath();
            p.Arc(new Vector2(20 * s, 20 * s), 16 * s, -90, -90 + 360 * Mathf.Clamp01(Progress));
            p.Stroke();
            p.lineWidth = 1.8f * s;
            p.strokeColor = new Color(1, 1, 1, 196f / 255);
            p.BeginPath();
            p.MoveTo(new Vector2(20 * s, 10 * s));
            p.LineTo(new Vector2(20 * s, 20 * s));
            p.LineTo(new Vector2(26 * s, 24 * s));
            p.Stroke();
        }
    }
}
