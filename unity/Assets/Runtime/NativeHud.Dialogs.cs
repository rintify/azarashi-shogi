using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    public sealed partial class NativeHud
    {
        private VisualElement Modal(string title, float desiredHeight, float maxWidth = 540)
        {
            var shade = Box(root, "dialog-shade", 0, 0, width, height, "#347ba466", 0, true);
            dialogLayer = shade;
            var w = Mathf.Min(maxWidth, width * .92f);
            var h = Mathf.Min(desiredHeight, height - 24);
            var card = Box(shade, "native-dialog", (width - w) * .5f, (height - h) * .5f, w, h, "#fffcf3", 28, true);
            Border(card, 4, "#ffffff");
            NativeUi.Skin(card, "dialog", 28);
            card.style.transitionProperty = new List<StylePropertyName> { new StylePropertyName("height"), new StylePropertyName("top") };
            card.style.transitionDuration = new List<TimeValue> { new TimeValue(.28f) };
            if (match.Dialog == "settings")
                Icon(card, "seal", false, 24, 18, 44);
            else
                Symbol(card, match.Dialog == "catalog" ? "book" : match.Dialog == "replays" ? "replay" : "book", 24, 26, 24, "#18394c");
            Text(card, title, match.Dialog == "settings" ? 78 : 58, 16, w - 140, 48, 19, "#18394c", true);
            FlatButton(card, "x", w - 64, 20, 40, 40, match.Close, 20);
            if (!card.ClassListContains("arrived"))
            {
                card.AddToClassList("arrived");
                Enter(card);
            }
            return card;
        }
        private void BuildDialog(string dialog)
        {
            if (dialog == "settings")
                SettingsDialog();
            else if (dialog == "replays")
                ReplayDialog();
            else if (dialog == "catalog")
                CatalogDialog();
            else
                RulesDialog();
        }
        private Button OptionButton(VisualElement parent, float x, float y, float w, float h, bool active, Action action)
        {
            var fill = active ? "#d6f0ec" : "#e7f0f4";
            var button = Button(parent, "", x, y, w, h, action, fill);
            Round(button, 20);
            Border(button, 2, active ? "#7cbdc2" : "#c7dce6");
            NoSkin(button);
            NativeUi.Bind(button, action, C(fill), C(fill));
            if (active)
                NativeUi.Skin(button, "optionSelected", 20);
            return button;
        }
        private ScrollView ScrollRegion(VisualElement card, string name, float x, float y, float w, float h)
        {
            var scroll = activeViews.Get(card, name, () => new ScrollView(ScrollViewMode.Vertical));
            scroll.verticalScrollerVisibility = ScrollerVisibility.Hidden;
            scroll.horizontalScrollerVisibility = ScrollerVisibility.Hidden;
            scroll.style.position = UnityEngine.UIElements.Position.Absolute;
            scroll.style.left = x;
            scroll.style.top = y;
            scroll.style.width = w;
            scroll.style.height = h;
            scroll.style.backgroundColor = Color.clear;
            return scroll;
        }
        private void SettingsDialog()
        {
            if (draft == null)
                draft = JsonUtility.FromJson<Settings>(JsonUtility.ToJson(match.Settings));
            var current = draft;
            var watching = current.mode == "ai-vs-ai";
            var local = current.mode == "local-pvp";
            var contentHeight = local ? 380 : watching ? 538 : 570;
            var desired = contentHeight + 92;
            var card = Modal("新しい対局", desired);
            var w = Mathf.Min(540, width * .92f);
            var h = Mathf.Min(desired, height - 24);
            var scroll = ScrollRegion(card, "settings-scroll", 24, 76, w - 48, h - 100);
            var panel = Box(scroll.contentContainer, "settings-content", 0, 0, w - 52, contentHeight);
            scroll.contentContainer.style.height = contentHeight;
            var available = w - 52;
            var intro = Text(panel, "遊び方を選んではじめよう。今の対局はリプレイに残ります。", 0, 0, available, 42, 12, "#537184");
            intro.style.whiteSpace = WhiteSpace.Normal;
            Text(panel, "対戦モード", 0, 58, available, 20, 13, "#18394c", true);
            var modes = new[] { "human-vs-ai", "ai-vs-ai", "local-pvp" };
            var names = new[] { "あなた vs AI", "AI vs AI", "ローカルPvP" };
            var notes = new[] { "自分で対局する", "対局を観戦する", "同じ端末でふたり対戦" };
            var bw = (available - 20) / 3;
            for (var i = 0; i < 3; i++)
            {
                var mode = modes[i];
                var button = OptionButton(panel, i * (bw + 10), 88, bw, 112, current.mode == mode, () => { current.mode = mode; Rebuild(); });
                var icon = width <= 400 ? 20 : 40;
                var center = bw * .5f;
                var gap = width <= 400 ? 4 : 8;
                Icon(button, i == 1 ? "penguin" : "seal", false, center - icon - gap - 9, 13, icon);
                Text(button, "VS", center - 7, 13, 14, icon, 11, "#a295b2", true, TextAnchor.MiddleCenter);
                Icon(button, i == 0 ? "penguin" : i == 1 ? "orca" : "seal", i == 2, center + gap + 9, 13, icon);
                Text(button, names[i], 2, 68, bw - 8, 18, width <= 400 ? 11 : 14, current.mode == mode ? "#196783" : "#18394c", true, TextAnchor.MiddleCenter);
                Text(button, notes[i], 2, 90, bw - 8, 15, width <= 400 ? 9 : 11, "#597d8f", false, TextAnchor.MiddleCenter);
            }
            var y = 222f;
            if (!watching && !local)
            {
                Text(panel, "あなたの手番", 0, y, available, 20, 13, "#18394c", true);
                y += 30;
                var first = OptionButton(panel, 0, y, (available - 10) / 2, 73, current.human == "south", () => { current.human = "south"; Rebuild(); });
                Text(first, "先手", 0, 10, (available - 14) / 2, 22, 14, "#18394c", true, TextAnchor.MiddleCenter);
                Text(first, "あなたから開始", 0, 39, (available - 14) / 2, 18, 11, "#597d8f", false, TextAnchor.MiddleCenter);
                var second = OptionButton(panel, (available + 10) / 2, y, (available - 10) / 2, 73, current.human == "north", () => { current.human = "north"; Rebuild(); });
                Text(second, "後手", 0, 10, (available - 14) / 2, 22, 14, "#18394c", true, TextAnchor.MiddleCenter);
                Text(second, "NPCから開始", 0, 39, (available - 14) / 2, 18, 11, "#597d8f", false, TextAnchor.MiddleCenter);
                y += 95;
            }
            if (watching)
            {
                Text(panel, "先手AIの強さ", 0, y, available, 20, 13, "#18394c", true);
                var label = Text(panel, "Lv." + current.southLevel + " · " + match.Data.Level(current.southLevel).name, available - 130, y, 130, 20, 11, "#597d8f", false, TextAnchor.MiddleRight);
                Slider(panel, current.southLevel, 1, match.Data.Config.levels.Length, 0, y + 34, available, v => { var level = Mathf.RoundToInt(v); if (current.southLevel != level) { current.southLevel = level; Rebuild(); } NativeUi.Swap(label, "Lv." + current.southLevel + " · " + match.Data.Level(current.southLevel).name); });
                y += 82;
            }
            if (local)
            {
                var note = Box(panel, "local-note", 0, y, available, 76, "#e6f3f2", 18);
                var label = Text(note, "先手（青）から開始。1手ごとに視点と持ち駒が切り替わります。端末を交代しながら遊んでね。", 14, 10, available - 28, 58, 12, "#426d78");
                label.style.whiteSpace = WhiteSpace.Normal;
                y += 96;
            }
            else
            {
                Text(panel, watching ? "後手AIの強さ" : "相手の強さ", 0, y, available, 20, 13, "#18394c", true);
                var levelText = Text(panel, "Lv." + current.difficulty + " · " + match.Data.Level(current.difficulty).name, available - 130, y, 130, 20, 11, "#597d8f", false, TextAnchor.MiddleRight);
                Slider(panel, current.difficulty, 1, match.Data.Config.levels.Length, 0, y + 34, available, v => { var level = Mathf.RoundToInt(v); if (current.difficulty != level) { current.difficulty = level; Rebuild(); } NativeUi.Swap(levelText, "Lv." + current.difficulty + " · " + match.Data.Level(current.difficulty).name); });
                Text(panel, "気軽に", 0, y + 58, 90, 18, 11, "#597d8f");
                Text(panel, "じっくり勝負", available - 100, y + 58, 100, 18, 11, "#597d8f", false, TextAnchor.MiddleRight);
                y += 94;
                var note = Box(panel, "difficulty-note", 0, y, available, 62, "#e3eff5", 8);
                var message = watching ? "先手は最大" + match.Data.Level(current.southLevel).thinkingMs / 1000 + "秒、後手は最大" + match.Data.Level(current.difficulty).thinkingMs / 1000 + "秒。同じルールで対局します。" : current.difficulty == 6 ? "最大30秒、捕食の連鎖や王の救出まで深く読む「覇王」。同じルールで挑みます。" : current.difficulty == 5 ? "最長10秒じっくり考える「極」。同じルールで、全力の一手を指します。" : "NPCの思考時間は最大" + match.Data.Level(current.difficulty).thinkingMs / 1000 + "秒。" + match.Data.Level(current.difficulty).name + "レベルで対戦します。";
                Text(note, message, 12, 8, available - 24, 46, 12, "#537184").style.whiteSpace = WhiteSpace.Normal;
                y += 80;
            }
            var start = Button(panel, "この設定ではじめる", 0, y, available, 46, () => { expanded = false; match.NewGame(new Settings { mode = current.mode, human = watching || local ? "south" : current.human, difficulty = current.difficulty, southLevel = current.southLevel }); }, "#49afc7", 12);
            start.style.color = Color.white;
            NativeUi.Skin(start, "primary", 24);
            y += 54;
            var cancel = Button(panel, "いまの対局に戻る", 0, y, available, 44, match.Close, "#ffffff00", 12);
            NoSkin(cancel);
            Border(cancel, 0, "#ffffff");
            NativeUi.Bind(cancel, match.Close, Color.clear, Color.clear);
            cancel.style.color = C("#4e7689");
            panel.style.height = y + 44;
            scroll.contentContainer.style.height = y + 44;
        }
        private void ReplayDialog()
        {
            var desired = Mathf.Min(650, height - 24);
            var card = Modal("対局のリプレイ", desired);
            var w = Mathf.Min(540, width * .92f);
            var h = Mathf.Min(desired, height - 24);
            Text(card, "対局はこの端末に自動保存されます。", 24, 76, w - 48, 26, 12, "#537184");
            var scroll = ScrollRegion(card, "replay-scroll", 24, 114, w - 48, h - 204);
            var y = 0f;
            if (match.Replays.Count == 0)
            {
                var empty = Box(scroll.contentContainer, "replay-empty", 0, 0, w - 52, 150);
                Icon(empty, "seal", false, (w - 52 - 65) * .5f, 18, 65);
                Text(empty, "まだ棋譜がありません", 0, 95, w - 52, 24, 12, "#6a899b", false, TextAnchor.MiddleCenter);
                y = 150;
            }
            foreach (var record in match.Replays)
            {
                var row = Box(scroll.contentContainer, "replay-" + record.id, 0, y, w - 52, width < 600 ? 136 : 106, "#e6f3f7", 22, true);
                Border(row, 2, "#ffffff");
                NativeUi.Skin(row, "replayCard", 22);
                Icon(row, record.settings.mode == "ai-vs-ai" ? "penguin" : "seal", false, 10, 15, 32);
                var name = record.settings.mode == "ai-vs-ai" ? "AI vs AI" : record.settings.mode == "local-pvp" ? "ローカルPvP · ふたり対戦" : "あなた vs AI · Lv." + record.settings.difficulty;
                Text(row, name, 52, 12, w - 110, 22, 12, "#18394c", true);
                Text(row, (DateTime.TryParse(record.createdAt, out var date) ? date.ToLocalTime().ToString("M/d HH:mm") : "") + " · " + record.actions.Count + "手", 52, 39, w - 110, 18, 10, "#668294");
                Text(row, match.Record?.id == record.id ? "いまの対局" : "保存した対局", 52, 62, w - 110, 17, 10, "#668294");
                var actionY = width < 600 ? 86 : 61;
                var play = Button(row, "再生", w - 254, actionY, 72, 44, () => match.Watch(record), "#64bad1", 12);
                Round(play, 17);
                play.style.color = Color.white;
                NoSkin(play);
                Symbol(play, "play", 8, 11, 18, "#ffffff");
                play.style.paddingLeft = 20;
                FlatButton(row, "download", w - 174, actionY, 32, 44, () => match.Export(record, false), 19);
                var text = FlatButton(row, "text", w - 134, actionY, 44, 44, () => match.Export(record, true), 19);
                Text(text, "解説用", 0, 27, 44, 14, 9, "#5d8799", false, TextAnchor.MiddleCenter);
                y += width < 600 ? 148 : 118;
            }
            scroll.contentContainer.style.height = y;
            var import = Button(card, "棋譜ファイルを読み込む", 24, h - 70, w - 48, 44, NativeEngine.AzarashiChooseReplay, "#f9e7ac", 12);
            Round(import, 17);
            import.style.color = C("#82663e");
            NoSkin(import);
            Symbol(import, "upload", 20, 10, 20, "#82663e");
        }
        [Serializable]
        private sealed class RulesContent
        {
            public string intro, note; public RuleStep[] steps;
        }
        [Serializable]
        private sealed class RuleStep
        {
            public string title, body;
        }
        private void RulesDialog()
        {
            var desired = Mathf.Min(760, height - 24);
            var card = Modal("あそびかた", desired);
            var w = Mathf.Min(540, width * .92f);
            var h = Mathf.Min(desired, height - 24);
            var content = JsonUtility.FromJson<RulesContent>(Resources.Load<TextAsset>("Native/Rules").text);
            var scroll = ScrollRegion(card, "rules-scroll", 24, 78, w - 48, h - 104);
            var available = w - 52;
            var y = 0f;
            var introHeight = ParagraphHeight(content.intro, available, 12);
            Text(scroll.contentContainer, content.intro, 0, y, available, introHeight, 12, "#537184").style.whiteSpace = WhiteSpace.Normal;
            y += introHeight + 20;
            foreach (var piece in match.Data.Config.pieces)
            {
                var descriptionHeight = ParagraphHeight(piece.description, available - 66, 12);
                var rowHeight = Mathf.Max(56, descriptionHeight + 44);
                var row = Box(scroll.contentContainer, "rule-" + piece.kind, 0, y, available, rowHeight, "#e9f5f8", 10);
                Icon(row, piece.kind, false, 12, (rowHeight - 30) * .5f, 30);
                Text(row, piece.name + " ×" + piece.count, 54, 10, available - 66, 22, 13, "#18394c", true);
                Text(row, piece.description, 54, 33, available - 66, descriptionHeight, 12, "#537184").style.whiteSpace = WhiteSpace.Normal;
                y += rowHeight + 10;
            }
            y += 10;
            for (var i = 0; i < content.steps.Length; i++)
            {
                var step = content.steps[i];
                Text(scroll.contentContainer, (i + 1) + ".", 0, y, 20, 22, 13, "#18394c");
                Text(scroll.contentContainer, step.title, 22, y, available - 22, 24, 13, "#18394c", true);
                var paragraphHeight = ParagraphHeight(step.body, available - 22, 12);
                Text(scroll.contentContainer, step.body, 22, y + 25, available - 22, paragraphHeight, 12, "#537184").style.whiteSpace = WhiteSpace.Normal;
                y += paragraphHeight + 39;
            }
            var noteHeight = ParagraphHeight(content.note, available - 24, 12) + 24;
            var note = Box(scroll.contentContainer, "rule-note", 0, y, available, noteHeight, "#fff0d4", 8);
            Text(note, content.note, 12, 10, available - 24, noteHeight - 20, 12, "#537184").style.whiteSpace = WhiteSpace.Normal;
            y += noteHeight + 20;
            var close = Button(scroll.contentContainer, "盤面に戻る", 0, y, available, 46, match.Close, "#49afc7", 12);
            close.style.color = Color.white;
            NativeUi.Skin(close, "primary", 24);
            scroll.contentContainer.style.height = y + 60;
        }
        private static float ParagraphHeight(string text, float width, int size) => Mathf.Max(1, Mathf.Ceil(text.Length * size / Mathf.Max(1, width))) * size * 1.8f;
        private void CatalogDialog()
        {
            var desired = Mathf.Min(680, height - 28);
            var card = Modal("氷のなかま図鑑", desired, 720);
            var w = Mathf.Min(720, width - 24);
            var h = desired;
            var padding = width <= 600 ? 14 : 22;
            card.style.width = w;
            card.style.height = h;
            card.style.left = (width - w) * .5f;
            card.style.top = (height - h) * .5f;
            card.style.backgroundColor = C("#fffaf0");
            var variant = match.Data.Config.variants[CatalogIndex];
            if (shownCatalog != CatalogIndex)
            {
                shownCatalog = CatalogIndex;
                CatalogBirth = Time.unscaledTime;
            }
            var stageWidth = w - padding * 2;
            var stageHeight = h - padding * 2 - 52 - 30 - 110;
            var landscape = height <= 500 && width >= 600;
            if (landscape)
            {
                stageWidth = w - padding * 2 - 232;
                stageHeight = h - padding * 2 - 60;
            }
            var stage = Box(card, "native-catalog-stage", padding, padding + 52, stageWidth, stageHeight, "#d9edf3", 25, true);
            Border(stage, 3, "#ffffff");
            NativeUi.Skin(stage, "catalog", 25);
            stage.style.overflow = Overflow.Hidden;
            var renderWidth = Mathf.Clamp(Mathf.RoundToInt(stageWidth * uiScale), 128, 1600);
            var renderHeight = Mathf.Clamp(Mathf.RoundToInt(stageHeight * uiScale), 128, 1600);
            if (catalogTexture.width != renderWidth || catalogTexture.height != renderHeight)
            {
                catalogTexture.Release();
                catalogTexture.width = renderWidth;
                catalogTexture.height = renderHeight;
                catalogTexture.Create();
            }
            catalogCamera.aspect = stageWidth / stageHeight;
            var portrait = Mathf.Max(1, stageHeight / stageWidth);
            catalogCamera.transform.position = new Vector3(50 + 1.8f * portrait, .56f + 1.2f * portrait, -2.75f * portrait);
            catalogCamera.transform.LookAt(new Vector3(50, .56f, 0));
            stage.style.backgroundImage = new StyleBackground(Background.FromRenderTexture(catalogTexture));
            stage.style.unityBackgroundScaleMode = ScaleMode.StretchToFill;
            if (!stage.ClassListContains("drag-bound"))
            {
                stage.AddToClassList("drag-bound");
                var drag = false;
                var previous = Vector2.zero;
                stage.RegisterCallback<PointerDownEvent>(e => { drag = true; previous = e.position; stage.CapturePointer(e.pointerId); });
                stage.RegisterCallback<PointerMoveEvent>(e => { if (drag) { CatalogAngle += (e.position.x - previous.x) * .5f; previous = e.position; } });
                stage.RegisterCallback<PointerUpEvent>(e => { drag = false; stage.ReleasePointer(e.pointerId); });
            }
            var arrowWidth = width <= 600 ? 36 : 44;
            var arrowHeight = width <= 600 ? 44 : 48;
            for (var i = 0; i < 2; i++)
            {
                var delta = i == 0 ? -1 : 1;
                var b = Button(stage, "", i == 0 ? 6 : stageWidth - arrowWidth - 6, (stageHeight - arrowHeight) * .5f, arrowWidth, arrowHeight, () => { CatalogIndex = (CatalogIndex + delta + match.Data.Config.variants.Length) % match.Data.Config.variants.Length; Rebuild(); }, "#ffffffe0");
                Round(b, 16);
                Border(b, 0, "#ffffff");
                NativeUi.Skin(b, "catalogArrow", 16);
                var symbol = Symbol(b, "triangle", (arrowWidth - 22) * .5f, (arrowHeight - 22) * .5f, 22, "#4a95b1");
                symbol.style.rotate = new Rotate(i == 0 ? -90 : 90);
            }
            var spin = Button(stage, "", 12, stageHeight - 48, 104, 36, () => { CatalogSpins = !CatalogSpins; Rebuild(); }, "#ffffffcc", 11);
            Round(spin, 16);
            Border(spin, 0, "#ffffff");
            NoSkin(spin);
            Symbol(spin, CatalogSpins ? "pause" : "play", 9, 10, 15, "#567d91");
            Text(spin, CatalogSpins ? "回転中" : "回転する", 29, 0, 70, 36, 11, "#567d91");
            Text(stage, (CatalogIndex + 1) + " / " + match.Data.Config.variants.Length, stageWidth - 76, stageHeight - 44, 60, 25, 12, "#648799", false, TextAnchor.MiddleRight);
            var descriptionX = landscape ? padding + stageWidth + 12 : padding;
            var descriptionY = landscape ? 90 : padding + 52 + stageHeight + 10;
            var descriptionWidth = landscape ? 220 : w - padding * 2;
            Text(card, variant.name, descriptionX, descriptionY, descriptionWidth, 30, width <= 600 ? 18 : 21, "#3b6f88", true, TextAnchor.MiddleCenter);
            Text(card, variant.width + " × " + variant.height + " マス", descriptionX, descriptionY + 34, descriptionWidth, 18, 11, "#7794a0", false, TextAnchor.MiddleCenter);
            Text(card, match.Data.Config.pieces.First(p => p.kind == variant.kind).description, descriptionX, descriptionY + 59, descriptionWidth, 52, width <= 600 ? 11 : 12, "#5a7a8c", false, TextAnchor.UpperCenter).style.whiteSpace = WhiteSpace.Normal;
            Text(card, "ドラッグで好きな角度から眺められます", padding, h - padding - 17, w - padding * 2, 17, 10, "#8ba4ad", false, TextAnchor.MiddleCenter);
        }
    }
}
