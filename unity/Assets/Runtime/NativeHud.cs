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
        private VisualElement turnNoticeSpark;
        private float clockStarted, clockFrom, clockTo;
        private bool clockVisible;
        private Rect playArea;

        private UIDocument document;
        private VisualElement root, hud, markers, choice, clock, result;
        private VisualElement presentation;
        private RenderTexture sceneTexture;
        private bool backdropBlurred;
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
        private string replayWarning;
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
            root.RegisterCallback<KeyDownEvent>(evt =>
            {
                NativeUi.KeyboardFocus = true;
                var modal = resultKey != null ? result : choiceModal ? promotionPopup : null;
                if (match.Dialog == null && modal != null && evt.keyCode == KeyCode.Tab)
                {
                    CycleFocus(modal, evt.shiftKey);
                    evt.StopImmediatePropagation();
                    root.focusController.IgnoreEvent(evt);
                }
            }, TrickleDown.TrickleDown);
            root.RegisterCallback<PointerDownEvent>(_ => NativeUi.KeyboardFocus = false, TrickleDown.TrickleDown);
            presentation = new VisualElement { name = "native-presentation", pickingMode = PickingMode.Ignore };
            presentation.style.position = UnityEngine.UIElements.Position.Absolute;
            presentation.style.left = presentation.style.right = presentation.style.top = presentation.style.bottom = 0;
            root.Add(presentation);
            ResizeSceneTexture();
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
            if (match.Dialog == "replays")
            {
                replayWarning = text;
                dialogSignature = null;
                Rebuild();
                return;
            }
            message = text;
            messageUntil = Time.unscaledTime + 6;
            dirty = true;
        }
        public void ClearReplayWarning()
        {
            replayWarning = null;
            dialogSignature = null;
        }
        public void Rebuild()
        {
            dirty = true;
        }
        private VisualElement Box(VisualElement parent, string name, float x, float y, float w, float h, string fill = null, float radius = 0, bool block = false)
        {
            parent = PresentationParent(parent);
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
            parent = PresentationParent(parent);
            var v = activeViews.Get(parent, "label", () => new Label(text) { pickingMode = PickingMode.Ignore });
            v.style.display = DisplayStyle.Flex;
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
            v.style.marginLeft = 0;
            v.style.marginRight = 0;
            v.style.marginTop = 0;
            v.style.marginBottom = 0;
            return v;
        }
        private VisualElement Icon(VisualElement parent, string kind, bool promoted, float x, float y, float size)
        {
            if (!icons.TryGetValue(kind + "-" + (promoted ? 1 : 0), out var texture) || texture == null)
                return null;
            var v = Box(parent, "animal-icon", x, y, size, size);
            v.style.flexShrink = 0;
            v.style.backgroundImage = new StyleBackground(texture);
            v.style.unityBackgroundScaleMode = ScaleMode.ScaleToFit;
            return v;
        }
        private Button Button(VisualElement parent, string label, float x, float y, float w, float h, Action action, string fill = "#fff8e9", int size = 14)
        {
            parent = PresentationParent(parent);
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
            b.style.paddingLeft = b.style.paddingRight = b.style.paddingTop = b.style.paddingBottom = 0;
            b.style.unityTextAlign = TextAnchor.MiddleCenter;
            b.style.fontSize = size;
            b.style.opacity = 1;
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
            var v = Box(parent, "symbol", x, y, size, size);
            v.style.flexShrink = 0;
            NativeUi.Symbol(v, name, C(color));
            return v;
        }
        private static void NoSkin(VisualElement element)
        {
            NativeUi.RemoveSkin(element);
        }
        private VisualElement CenteredSymbol(VisualElement parent, string name, float size, string color = "#507497")
        {
            var symbol = Symbol(parent, name, 0, 0, size, color);
            NativeUi.Center(symbol);
            return symbol;
        }

        private void Build()
        {
            dirty = false;
            if (match.Pending?.Length > 1)
                gridOpen = false;
            views.Begin(presentation);
            counts.Clear();
            stockTargets.Clear();
            var vignette = Box(root, "screen-vignette", 0, 0, width, height);
            vignette.style.backgroundImage = new StyleBackground(Resources.Load<Texture2D>("Native/Effects/vignette"));
            hud = Box(root, "native-hud", 0, 0, width, height);
            hud.style.transitionProperty = new List<StylePropertyName> { new StylePropertyName("opacity") };
            hud.style.transitionDuration = new List<TimeValue> { new TimeValue(.25f) };
            hud.style.opacity = 1;
            hud.SetEnabled(true);
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
                // The later max-width:760px CSS rule also applies in landscape.
                size = mobile ? 34 : 36;
                buttonHeight = mobile ? 38 : 36;
            }
            var mascotWidth = mobile ? width <= 360 ? 20 : 26 : 44;
            var mascotHeight = mobile ? width <= 360 ? 26 : 30 : 44;
            // .brand-catalog is a grid: mascot + 1px gap + the 15px caption line.
            // The source header centers its title and nav against that complete grid.
            var brandHeight = mascotHeight + 16;
            var brand = Box(hud, "brand", margin, headerTop, mobile ? 90 : 250, brandHeight, null, 0, true);
            NativeUi.EnterOnce(brand, true);
            var brandButton = Button(brand, "", 0, 0, mascotWidth, mascotHeight, () => match.Open("catalog"));
            brandButton.style.backgroundColor = Color.clear;
            NativeUi.Bind(brandButton, () => match.Open("catalog"), Color.clear, Color.clear);
            Border(brandButton, 0, "#ffffff");
            NoSkin(brandButton);
            Icon(brandButton, "seal", false, 0, (mascotHeight - mascotWidth) * .5f, mascotWidth);
            var catalogCaption = Text(brand, "図鑑", 0, mascotHeight + 1, mascotWidth, 15, 9, "#ffffff", true, TextAnchor.MiddleCenter);
            NativeUi.TextShadows(catalogCaption, "textCatalogCaption");
            var titleHeight = mobile ? 30 : 44;
            var title = Text(brand, "アザラシ将棋", mascotWidth + (mobile ? 3 : 10), (brandHeight - titleHeight) * .5f, mobile ? 102 : 200, titleHeight, landscape ? 14 : mobile ? width <= 360 ? 12 : 13 : 18, "#ffffff", true);
            title.style.display = width <= 350 ? DisplayStyle.None : DisplayStyle.Flex;
            title.style.letterSpacing = (mobile ? -.02f : .03f) * (landscape ? 14 : mobile ? width <= 360 ? 12 : 13 : 18);
            NativeUi.TextShadows(title, "textBrand");
            var labels = new[] { match.Muted ? "mute" : "sound", "book", "replay", "reset", match.TopView ? "cube" : "view", gridOpen ? "x" : "grid" };
            Action[] actions = { () => { match.Muted = !match.Muted; Rebuild(); }, () => match.Open("rules"), () => match.Open("replays"), () => match.Open("settings"), () => { match.TopView = !match.TopView; Rebuild(); }, () => { gridOpen = !gridOpen; Rebuild(); } };
            for (var i = 0; i < labels.Length; i++)
            {
                var pressed = i == 0 && !match.Muted || i == 4 && match.TopView || i == 5 && gridOpen;
                var color = pressed ? "#795e49" : i == 1 ? "#7a6ea1" : i == 2 ? "#a36471" : "#507497";
                var fill = pressed ? "#ffe08d" : i == 1 ? "#e6e4ff" : i == 2 ? "#ffdedc" : "#fff9e9";
                var b = Button(hud, "", width - margin - (labels.Length - i) * (size + gap) + gap, headerTop + (brandHeight - buttonHeight) * .5f, size, buttonHeight, actions[i], fill);
                Border(b, 2, pressed ? "#fff8dc" : "#ffffff");
                NativeUi.Bind(b, actions[i], C(fill), C(pressed || i == 1 || i == 2 ? fill : "#fff1bd"));
                NativeUi.EnterOnce(b, true);
                CenteredSymbol(b, labels[i], 18, color);
            }
            var opponent = NativeGameData.Other(match.Viewer);
            var stockWidth = landscape ? 240 : mobile ? width - 28 : Mathf.Min(420, width - 32);
            var opponentTop = landscape || compact ? 54 : mobile ? 64 : 78;
            StockBar(hud, opponent, opponentTop, stockWidth, false);
            var bannerTop = landscape ? 100 : compact ? 98 : mobile ? 115 : 132;
            BuildStatus(bannerTop, landscape);
            var bottom = compact || landscape ? 22 : 20;
            var playTop = landscape ? 52 : compact ? 116 : mobile ? 132 : 144;
            playArea = new Rect(landscape ? 14 : mobile ? 0 : 8, playTop, width - (landscape ? width >= 840 ? 128 : 274 : mobile ? 0 : 16), Mathf.Max(80, height - playTop - (landscape ? 20 : 74)));
            if (match.Replaying)
                BuildReplayDock();
            else if (match.State.phase == "finished" && match.Motion == null)
            {
                if (match.ResultDismissed)
                {
                    var actionsRow = Box(hud, "result-actions", DockLeft, height - DockBottom - 44, DockWidth, 44);
                    Row(actionsRow, true);
                    var reopen = FlowAction(actionsRow, "結果を見る", null, () => { match.ResultDismissed = false; Rebuild(); }, "#48afc8", "#ffffff", "primary");
                    reopen.style.height = 44;
                    reopen.style.marginRight = 10;
                    FlowAction(actionsRow, "新しい対局", null, () => match.Open("settings"), "#48afc8", "#ffffff", "primary").style.height = 44;
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
            turnNotice = Box(root, "turn-notice", 0, 164, 0, 0, "#ffffffb8", 20);
            turnNotice.style.left = StyleKeyword.Auto;
            turnNotice.style.right = 16;
            turnNotice.style.width = turnNotice.style.height = StyleKeyword.Auto;
            turnNotice.style.paddingTop = turnNotice.style.paddingBottom = 7;
            turnNotice.style.paddingLeft = turnNotice.style.paddingRight = 11;
            Row(turnNotice);
            NativeUi.Skin(turnNotice, "turnNotice", 20);
            var turnColor = match.State.turn == "south" ? "#3badd0" : "#e9a05c";
            turnNoticeSpark = Symbol(turnNotice, "snowflake", 0, 0, 14, turnColor);
            Inline(turnNoticeSpark);
            turnNoticeSpark.style.marginRight = 6;
            turnNoticeCopy = FlowText(turnNotice, "", 13, turnColor, true);
            turnNoticeCopy.style.letterSpacing = .26f;
            var suffix = FlowText(turnNotice, "の番", 13, turnColor, true);
            suffix.style.marginLeft = 1.56f;
            if (gridOpen)
                BuildGrid();
            else
            {
                gridCells.Clear();
                gridPulses.Clear();
            }
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
        }
        public bool Blocks(Vector2 screen)
        {
            if (match.Dialog != null || resultKey != null || choiceModal)
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
            ResizeSceneTexture();
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
            RestoreModalFocus();
            views.Tick();
            dialogViews.Tick();
            var blur = match.Dialog != null || dialogLayer?.parent != null;
            if (blur != backdropBlurred)
            {
                backdropBlurred = blur;
                NativeUi.Blur(presentation, blur ? 7 : 0);
            }
            NativeUi.Tick();
            UpdateGridPulse();
            if (match.State == null)
                return;
            foreach (var item in counts)
            {
                var parts = item.Key.Split(':');
                NativeUi.Swap(item.Value, StockCount(parts[0], parts[1]).ToString());
            }
            UpdateStatus();
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
            if (!match.Replaying && !match.Busy && match.State.phase == "playing" && announcedTurn != match.State.turn)
            {
                announcedTurn = match.State.turn;
                announcementAt = Time.unscaledTime;
                turnNoticeCopy.text = match.Settings.mode == "human-vs-ai" && !match.HumanTurn ? "相手" : match.Actor(match.State.turn);
            }
            var notice = (Time.unscaledTime - announcementAt) / 1.05f;
            var noticeOpacity = notice < .2f ? NativeUi.Ease(notice / .2f) : notice < .72f ? 1 : 1 - NativeUi.Ease((notice - .72f) / .28f);
            turnNotice.style.opacity = !match.Replaying && match.State.phase == "playing" ? Mathf.Clamp01(noticeOpacity) : 0;
            turnNotice.style.translate = new Translate(0, notice < .2f ? (1 - noticeOpacity) * 5 : notice < .72f ? 0 : (1 - noticeOpacity) * -4);
            var spark = notice < .3f ? NativeUi.Ease(Mathf.Clamp01(notice / .3f)) : notice <= .75f ? 1 : 1 - NativeUi.Ease(Mathf.Clamp01((notice - .75f) / .25f));
            turnNoticeSpark.style.scale = new Scale(Vector3.one * Mathf.Lerp(.9f, 1, spark));
            turnNoticeSpark.style.rotate = new Rotate(notice < .3f ? -15 * (1 - spark) : 15 * (1 - spark));
            UpdateChoices();
            UpdateMarkers();
            UpdateOrbs();
            UpdateResult();
            if (resultKey != null)
            {
                var time = Time.unscaledTime - resultStarted;
                spectacle?.MarkDirtyRepaint();
                if (resultSection != null)
                {
                    var arrival = SlideEase(Mathf.Clamp01(time / .85f));
                    resultSection.style.opacity = arrival;
                    resultSection.style.translate = new Translate(0, 35 * (1 - arrival));
                    resultSection.style.scale = new Scale(Vector3.one * Mathf.Lerp(.92f, 1, arrival));
                }
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
                    NativeUi.Blur(resultKicker, 8 * (1 - ease));
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
            if (catalogCamera.enabled && catalogStage != null)
                UpdateCatalogCamera();
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
            if (sceneTexture != null)
            {
                match.Board.Camera.targetTexture = null;
                sceneTexture.Release();
                Destroy(sceneTexture);
            }
            if (catalogTexture != null)
            {
                catalogTexture.Release();
                Destroy(catalogTexture);
            }
            if (catalogCamera != null)
                Destroy(catalogCamera.gameObject);
        }
        private VisualElement PresentationParent(VisualElement parent) => parent == root && activeViews == views ? presentation : parent;
        private void ResizeSceneTexture()
        {
            var w = Mathf.Max(1, Screen.width);
            var h = Mathf.Max(1, Screen.height);
            if (sceneTexture != null && sceneTexture.width == w && sceneTexture.height == h)
                return;
            if (sceneTexture != null)
            {
                sceneTexture.Release();
                Destroy(sceneTexture);
            }
            // Composite the live native scene and its HUD into one layer so the
            // original backdrop blur covers both, while dialog text stays sharp.
            sceneTexture = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32) { antiAliasing = Mathf.Max(1, QualitySettings.antiAliasing) };
            sceneTexture.Create();
            match.Board.Camera.targetTexture = sceneTexture;
            presentation.style.backgroundImage = new StyleBackground(Background.FromRenderTexture(sceneTexture));
            presentation.style.unityBackgroundScaleMode = ScaleMode.StretchToFill;
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
