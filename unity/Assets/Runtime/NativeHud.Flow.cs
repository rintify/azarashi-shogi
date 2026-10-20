using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    public sealed partial class NativeHud
    {
        private Action measureFlowDialog;
        private bool flowMeasureDirty;
        private VisualElement FlowBox(VisualElement parent, string name, string fill = null, float radius = 0)
        {
            var box = Box(parent, name, 0, 0, 0, 0, fill, radius);
            Inline(box, true);
            box.style.height = StyleKeyword.Auto;
            box.style.flexShrink = 0;
            return box;
        }
        private Label FlowText(VisualElement parent, string text, int size = 12, string color = "#537184", bool bold = false, float lineHeight = 0)
        {
            var markup = lineHeight > 0 ? "<line-height=" + lineHeight.ToString(System.Globalization.CultureInfo.InvariantCulture) + "px>" + text : text;
            var label = Text(parent, markup, 0, 0, 0, 0, size, color, bold);
            Inline(label, true);
            label.style.height = StyleKeyword.Auto;
            label.style.whiteSpace = WhiteSpace.Normal;
            label.enableRichText = lineHeight > 0;
            label.style.minHeight = lineHeight > 0 ? lineHeight : 0;
            label.style.flexShrink = 0;
            return label;
        }
        private void Row(VisualElement box, bool center = false)
        {
            box.style.flexDirection = FlexDirection.Row;
            box.style.alignItems = Align.Center;
            if (center)
                box.style.justifyContent = Justify.Center;
        }
        private Button FlowAction(VisualElement parent, string copy, string symbol, Action action, string fill, string color, string skin = null, bool symbolFirst = false, int iconSize = 17, float gap = 8)
        {
            var button = Button(parent, "", 0, 0, 0, 46, action, fill, 12);
            Inline(button, true);
            button.style.flexShrink = 0;
            button.style.flexDirection = FlexDirection.Row;
            button.style.alignItems = Align.Center;
            button.style.justifyContent = Justify.Center;
            button.style.paddingLeft = button.style.paddingRight = 16;
            NoSkin(button);
            if (skin != null)
                NativeUi.Skin(button, skin, 24);
            var label = FlowText(button, copy, 12, color, true);
            label.style.whiteSpace = WhiteSpace.NoWrap;
            if (symbol != null)
            {
                var icon = Symbol(button, symbol, 0, 0, iconSize, color);
                Inline(icon);
                if (symbolFirst)
                {
                    icon.SendToBack();
                    icon.style.marginRight = gap;
                }
                else
                    icon.style.marginLeft = gap;
            }
            NativeUi.Bind(button, action, C(fill), C(skin == "primary" || skin == "resultPrimary" ? "#65c0d3" : fill));
            return button;
        }
        private VisualElement FlowDialog(string title)
        {
            var card = Modal(title, height - 24, 540, true, true);
            var w = DialogWidth();
            var padding = match.Dialog == "replays" && width <= 760 ? 16 : 24;
            var scroll = ScrollRegion(card, "dialog-scroll", 0, 0, w, height - 32);
            scroll.style.width = StyleKeyword.Auto;
            scroll.style.height = StyleKeyword.Auto;
            scroll.style.right = scroll.style.bottom = 0;
            var content = scroll.contentContainer;
            content.style.height = StyleKeyword.Auto;
            content.style.flexGrow = 0;
            content.style.minHeight = 0;
            content.style.paddingLeft = content.style.paddingRight = padding;
            content.style.paddingTop = content.style.paddingBottom = padding;
            var headerHeight = match.Dialog == "settings" ? 60 : 56;
            var spacer = FlowBox(content, "header-space");
            spacer.style.height = headerHeight;
            // Keep the sticky overlay outside the measured scroll content. Moving
            // an absolute child inside it changes ScrollView's content bounds,
            // which changes the scroll range and feeds back into the thumb.
            activeViews.TrackContainer(scroll, "viewport", scroll.contentViewport);
            var header = Box(scroll.contentViewport, "sticky-header", padding, Mathf.Max(0, padding - scroll.scrollOffset.y), 0, headerHeight, "#fffcf3");
            header.style.width = StyleKeyword.Auto;
            header.style.right = padding;
            header.style.flexDirection = FlexDirection.Row;
            header.style.alignItems = Align.Center;
            header.style.paddingTop = header.style.paddingBottom = 8;
            var titleRow = FlowBox(header, "dialog-title");
            Row(titleRow);
            titleRow.style.flexGrow = 1;
            if (match.Dialog == "settings")
            {
                var icon = Icon(titleRow, "seal", false, 0, 0, 44);
                Inline(icon);
                icon.style.marginRight = 10;
            }
            else if (match.Dialog == "replays")
            {
                var icon = Symbol(titleRow, "replay", 0, 0, 24, "#18394c");
                Inline(icon);
                icon.style.marginRight = 10;
            }
            var heading = FlowText(titleRow, title, 19, "#18394c", true);
            heading.style.marginTop = 6;
            var close = FlatButton(header, "x", 0, 0, 40, 40, match.Close, match.Dialog == "replays" ? 24 : 20);
            Inline(close);
            close.style.flexShrink = 0;
            // The spacer reserves the original flow slot; the overlay pins to
            // the inside border as the dialog padding scrolls out of view.
            if (!scroll.ClassListContains("sticky-bound"))
            {
                scroll.AddToClassList("sticky-bound");
                scroll.verticalScroller.valueChanged += value => header.style.top = Mathf.Max(0, (match.Dialog == "replays" && width <= 760 ? 16 : 24) - value);
                content.RegisterCallback<GeometryChangedEvent>(_ => flowMeasureDirty = true);
            }
            // Measure after content geometry changes or a retained state update,
            // independently of the ScrollView viewport's minimum extent.
            measureFlowDialog = () =>
            {
                var bottom = 0f;
                foreach (var child in content.Children())
                    if (child.resolvedStyle.position == UnityEngine.UIElements.Position.Relative && child.resolvedStyle.display != DisplayStyle.None)
                        bottom = Mathf.Max(bottom, child.layout.yMax + child.resolvedStyle.marginBottom);
                var measured = bottom + content.resolvedStyle.paddingBottom + 8;
                if (float.IsNaN(measured) || measured < 80) return;
                var cardHeight = Mathf.Min(measured, height - 24);
                var top = (height - cardHeight) / 2;
                if (!card.ClassListContains("arrived"))
                {
                    card.style.height = cardHeight;
                    card.style.top = top;
                    // Commit the measured geometry before beginning the source
                    // entrance animation; don't animate from a full-screen card.
                    card.AddToClassList("arrived");
                    card.schedule.Execute(() => { if (card.panel != null && card.enabledInHierarchy && match.Dialog != null) ArriveDialog(card); });
                }
                else
                    NativeUi.ResizeTo(card, cardHeight, top, .28f);
            };
            // The header is already a viewport overlay, outside content order.
            return content;
        }
        private void SettingLabel(VisualElement parent, string title, string value = null)
        {
            var row = FlowBox(parent, "setting-label");
            Row(row);
            row.style.marginTop = 22;
            var label = FlowText(row, title, 13, "#18394c", true);
            label.style.flexGrow = 1;
            if (value != null)
                FlowText(row, value, 11, "#597d8f");
        }
        private Button FlowOption(VisualElement row, bool selected, Action action, int padding = 13)
        {
            var button = OptionButton(row, 0, 0, 0, 0, selected, action);
            Inline(button);
            button.style.width = 0;
            button.style.flexBasis = 0;
            button.style.flexGrow = 1;
            button.style.flexShrink = 1;
            button.style.minWidth = 0;
            button.style.height = StyleKeyword.Auto;
            button.style.flexDirection = FlexDirection.Column;
            button.style.alignItems = Align.Stretch;
            button.style.justifyContent = Justify.Center;
            button.style.paddingTop = button.style.paddingBottom = 13;
            button.style.paddingLeft = button.style.paddingRight = padding;
            return button;
        }
        private void LevelSlider(VisualElement parent, string title, int level, Action<float> changed)
        {
            SettingLabel(parent, title, "Lv." + level + " · " + match.Data.Level(level).name);
            var slider = activeViews.Get(parent, "level-slider", () => new NativeSlider());
            slider.Bind(level, 1, match.Data.Config.levels.Length, 0, 0, DialogWidth() - 56, changed, false, true);
            Inline(slider, true);
            slider.style.height = 36;
            slider.style.marginTop = 14;
            slider.SetTrackHeight(36);
        }
        private void SettingsDialog()
        {
            if (draft == null)
                draft = JsonUtility.FromJson<Settings>(JsonUtility.ToJson(match.Settings));
            var current = draft;
            var watching = current.mode == "ai-vs-ai";
            var local = current.mode == "local-pvp";
            var content = FlowDialog("新しい対局");
            FlowText(content, "遊び方を選んではじめよう。今の対局はリプレイに残ります。", lineHeight: 21.6f).style.marginTop = 14;
            SettingLabel(content, "対戦モード");
            var modes = FlowBox(content, "mode-options");
            modes.style.flexDirection = FlexDirection.Row;
            modes.style.marginTop = 10;
            var values = new[] { "human-vs-ai", "ai-vs-ai", "local-pvp" };
            var names = new[] { "あなた vs AI", "AI vs AI", "ローカルPvP" };
            var notes = new[] { "自分で対局する", "対局を観戦する", "同じ端末でふたり対戦" };
            for (var i = 0; i < 3; i++)
            {
                var mode = values[i];
                var button = FlowOption(modes, current.mode == mode, () => { current.mode = mode; RebuildDialog(); }, width <= 400 ? 4 : 7);
                button.style.marginRight = i == 2 ? 0 : 10;
                var portraits = FlowBox(button, "mode-portraits");
                Row(portraits, true);
                portraits.style.marginBottom = 10;
                var iconSize = width <= 400 ? 20 : 40;
                var gap = width <= 400 ? 4 : 8;
                var left = Icon(portraits, i == 1 ? "penguin" : "seal", false, 0, 0, iconSize);
                Inline(left);
                var versus = FlowText(portraits, "VS", 11, "#a295b2", true);
                versus.style.unityFontStyleAndWeight = FontStyle.BoldAndItalic;
                versus.style.marginLeft = versus.style.marginRight = gap;
                var right = Icon(portraits, i == 0 ? "penguin" : i == 1 ? "orca" : "seal", i == 2, 0, 0, iconSize);
                Inline(right);
                var name = FlowText(button, names[i], width <= 400 ? 11 : 14, current.mode == mode ? "#196783" : "#18394c", true);
                name.style.unityTextAlign = TextAnchor.MiddleCenter;
                var note = FlowText(button, notes[i], width <= 400 ? 9 : 11, "#597d8f");
                note.style.marginTop = 6;
                note.style.unityTextAlign = TextAnchor.MiddleCenter;
            }
            if (!watching && !local)
            {
                SettingLabel(content, "あなたの手番");
                var sides = FlowBox(content, "side-options");
                sides.style.flexDirection = FlexDirection.Row;
                sides.style.marginTop = 10;
                for (var i = 0; i < 2; i++)
                {
                    var side = i == 0 ? "south" : "north";
                    var option = FlowOption(sides, current.human == side, () => { current.human = side; RebuildDialog(); });
                    option.style.marginRight = i == 0 ? 10 : 0;
                    FlowText(option, i == 0 ? "先手" : "後手", 14, current.human == side ? "#196783" : "#18394c", true).style.unityTextAlign = TextAnchor.MiddleCenter;
                    var detail = FlowText(option, i == 0 ? "あなたから開始" : "NPCから開始", 11, "#597d8f");
                    detail.style.marginTop = 6;
                    detail.style.unityTextAlign = TextAnchor.MiddleCenter;
                }
            }
            if (watching)
                LevelSlider(content, "先手AIの強さ", current.southLevel, v => { current.southLevel = Mathf.RoundToInt(v); RebuildDialog(); });
            if (local)
            {
                var note = FlowBox(content, "local-play-note", "#e6f3f2", 18);
                note.style.marginTop = note.style.marginBottom = 18;
                note.style.paddingLeft = note.style.paddingRight = note.style.paddingTop = note.style.paddingBottom = 14;
                FlowText(note, "先手（青）から開始。1手ごとに視点と持ち駒が切り替わります。端末を交代しながら遊んでね。", 12, "#426d78", lineHeight: 21.6f);
            }
            else
            {
                LevelSlider(content, watching ? "後手AIの強さ" : "相手の強さ", current.difficulty, v => { current.difficulty = Mathf.RoundToInt(v); RebuildDialog(); });
                var range = FlowBox(content, "range-labels");
                Row(range);
                range.style.marginTop = 6;
                FlowText(range, "気軽に", 11, "#597d8f").style.flexGrow = 1;
                FlowText(range, "じっくり勝負", 11, "#597d8f");
                var note = FlowBox(content, "difficulty-note", "#e3eff5", 8);
                note.style.marginTop = note.style.marginBottom = 18;
                note.style.paddingLeft = note.style.paddingRight = note.style.paddingTop = note.style.paddingBottom = 12;
                var copy = watching ? "先手は最大" + match.Data.Level(current.southLevel).thinkingMs / 1000 + "秒、後手は最大" + match.Data.Level(current.difficulty).thinkingMs / 1000 + "秒。同じルールで対局します。" : current.difficulty == 6 ? "最大30秒、捕食の連鎖や王の救出まで深く読む「覇王」。同じルールで挑みます。" : current.difficulty == 5 ? "最長10秒じっくり考える「極」。同じルールで、全力の一手を指します。" : "NPCの思考時間は最大" + match.Data.Level(current.difficulty).thinkingMs / 1000 + "秒。" + match.Data.Level(current.difficulty).name + "レベルで対戦します。";
                FlowText(note, copy, lineHeight: 21.6f);
            }
            var start = FlowAction(content, "この設定ではじめる", "arrow-right", () => { expanded = false; match.NewGame(new Settings { mode = current.mode, human = watching || local ? "south" : current.human, difficulty = current.difficulty, southLevel = current.southLevel }); }, "#49afc7", "#ffffff", "primary");
            NativeUi.Bind(start, () => { expanded = false; match.NewGame(new Settings { mode = current.mode, human = watching || local ? "south" : current.human, difficulty = current.difficulty, southLevel = current.southLevel }); }, C("#49afc7"), C("#65c0d3"));
            var cancel = FlowAction(content, "いまの対局に戻る", "chevron-down", match.Close, "#ffffff00", "#4e7689", iconSize: 14, gap: 6);
            cancel.style.height = 44;
            cancel.style.marginTop = 8;
            cancel.style.alignSelf = Align.Center;
            cancel.style.paddingLeft = cancel.style.paddingRight = 6;
            foreach (var label in cancel.Children().OfType<Label>())
                label.style.unityFontStyleAndWeight = FontStyle.Normal;
            Border(cancel, 0, "#ffffff00");
            NativeUi.Bind(cancel, match.Close, Color.clear, Color.clear);
        }
        private void ReplayDialog()
        {
            var parent = FlowDialog("対局のリプレイ");
            FlowText(parent, "対局はこの端末に自動保存。途中の棋譜も、あとから見返せます。", lineHeight: 21.6f).style.marginTop = 14;
            if (replayWarning != null)
            {
                var warning = FlowText(parent, replayWarning, 12, "#b04458", lineHeight: 19.2f);
                warning.style.marginTop = 12;
            }
            var list = FlowBox(parent, "replay-list");
            list.style.marginTop = list.style.marginBottom = 18;
            if (match.Replays.Count == 0)
            {
                var empty = FlowBox(list, "replay-empty");
                empty.style.paddingTop = empty.style.paddingBottom = 30;
                empty.style.alignItems = Align.Center;
                var icon = Icon(empty, "seal", false, 0, 0, 65);
                Inline(icon);
                icon.style.marginBottom = 12;
                FlowText(empty, "一手指すと、ここに保存されます", 12, "#6a899b");
            }
            foreach (var record in match.Replays)
            {
                var card = FlowBox(list, "replay-" + record.id, "#e6f3f7", 22);
                Border(card, 2, "#ffffff");
                NativeUi.Skin(card, "replayCard", 22);
                card.style.paddingTop = card.style.paddingBottom = width <= 760 ? 12 : 14;
                card.style.paddingLeft = card.style.paddingRight = width <= 760 ? 8 : 10;
                card.style.marginBottom = record == match.Replays.Last() ? 0 : 12;
                var row = FlowBox(card, "replay-row");
                Row(row);
                var icon = Icon(row, record.settings.mode == "ai-vs-ai" ? "penguin" : "seal", false, 0, 0, 32);
                Inline(icon);
                icon.style.marginRight = width <= 760 ? 6 : 10;
                icon.style.flexShrink = 0;
                var text = FlowBox(row, "replay-copy");
                text.style.flexGrow = 1;
                text.style.flexShrink = 1;
                text.style.minWidth = 0;
                FlowText(text, record.settings.mode == "ai-vs-ai" ? "AI vs AI" : record.settings.mode == "local-pvp" ? "ローカルPvP · ふたり対戦" : "あなた vs AI · Lv." + record.settings.difficulty, 12, "#18394c", true);
                FlowText(text, (DateTime.TryParse(record.createdAt, out var date) ? date.ToLocalTime().ToString("M/d HH:mm") : "") + " · " + record.actions.Count + "手", 10, "#668294").style.marginTop = 4;
                FlowText(text, match.ReplayCaption(record), 10, "#668294").style.marginTop = 4;
                var actions = FlowBox(width < 600 ? card : row, "replay-actions");
                Row(actions);
                actions.style.justifyContent = Justify.FlexEnd;
                actions.style.marginTop = width < 600 ? width <= 760 ? 6 : 10 : 0;
                actions.style.flexShrink = 0;
                var play = FlowAction(actions, "再生", "play-filled", () => match.Watch(record), "#64bad1", "#ffffff", "replayWatch", true, 18, 6);
                play.style.paddingLeft = play.style.paddingRight = 12;
                play.style.height = 44;
                Round(play, 17);
                play.style.marginRight = 8;
                var download = FlatButton(actions, "download", 0, 0, 32, 44, () => match.Export(record, false), 19);
                Inline(download);
                download.style.marginRight = 8;
                var explanation = FlatButton(actions, "", 0, 0, 44, 44, () => match.Export(record, true));
                Inline(explanation);
                explanation.style.flexDirection = FlexDirection.Column;
                explanation.style.alignItems = Align.Center;
                explanation.style.justifyContent = Justify.Center;
                var symbol = Symbol(explanation, "text", 0, 0, 19, "#5d8799");
                Inline(symbol);
                FlowText(explanation, "解説用", 9, "#5d8799").style.marginTop = 3;
            }
            var import = FlowAction(parent, "棋譜ファイルを読み込む", "upload", NativeEngine.AzarashiChooseReplay, "#f9e7ac", "#82663e", "replayImport", true, 18, 6);
            Round(import, 17);
            import.style.height = 44;
        }
    }
}
