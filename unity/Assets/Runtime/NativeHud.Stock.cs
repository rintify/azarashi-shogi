using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    public sealed partial class NativeHud
    {
        private readonly Dictionary<Button, Cell> gridCells = new Dictionary<Button, Cell>();
        private readonly Dictionary<Button, float> gridPulses = new Dictionary<Button, float>();
        private int gridFocused;
        private string GridColor(GuideState state)
        {
            var palette = match.Data.Config.colors;
            var ink = C("#e3f0f5");
            var mix = state.transformationSafe ? Color.Lerp(ink, C(palette.transformation), .30f) : state.kingDanger ? Color.Lerp(ink, C(palette.kingDanger), .48f) : state.kingCaptureTrap ? Color.Lerp(ink, C(palette.kingCaptureTrap), .35f) : C(state.unsafeCell ? "#ffd5dc" : state.legal && !state.inspectingEnemy ? "#a4dce7" : state.reachable || state.stationary ? "#d1eaf1" : "#e0f0f7");
            return "#" + ColorUtility.ToHtmlStringRGBA(mix);
        }
        private void UpdateGridPulse()
        {
            foreach (var button in gridCells.Keys.Where(button => button.panel == null).ToArray())
            {
                gridCells.Remove(button);
                gridPulses.Remove(button);
            }
            foreach (var pulse in gridPulses)
            {
                var phase = Mathf.Repeat((Time.unscaledTime - pulse.Value) / 2.8f, 1);
                var t = NativeUi.Cubic(phase <= .5f ? phase * 2 : (1 - phase) * 2, .42f, 0, .58f, 1);
                pulse.Key.style.backgroundColor = Color.Lerp(C("#e3f0f5"), C(match.Data.Config.colors.enemy), .2f + .2f * t);
            }
        }
        private void BuildGrid()
        {
            var size = Mathf.Min(playArea.width, playArea.height);
            var cellSize = (size - 19) / 10;
            var panel = Box(root, "native-coordinate-board", playArea.x + (playArea.width - size) * .5f, playArea.y + (playArea.height - size) * .5f, size, size, "#b1d0df", 6, true);
            NativeUi.Skin(panel, "coordinate", 6);
            var buttons = new List<Button>();
            var pulsing = new HashSet<Button>();
            for (var index = 0; index < 100; index++)
            {
                var display = index;
                var n = match.Viewer == "south" ? index : 99 - index;
                var cell = new Cell(n % 10, n / 10);
                var piece = match.State.pieces.FirstOrDefault(p => match.Data.Body(p).Any(c => c.Same(cell)));
                var state = match.Pending == null ? match.GuideAt(cell) : new GuideState();
                var color = GridColor(state);
                var button = Button(panel, "", 5 + index % 10 * (cellSize + 1), 5 + index / 10 * (cellSize + 1), cellSize, cellSize, () => match.Click(cell), color, 9);
                Round(button, 0);
                Border(button, 0, "#ffffff");
                NoSkin(button);
                NativeUi.Bind(button, () => match.Click(cell), C(color), C(color));
                gridCells[button] = cell;
                button.tabIndex = display == gridFocused ? 0 : -1;
                if (state.inspectingEnemy && (state.reachable || state.stationary))
                {
                    pulsing.Add(button);
                    if (!gridPulses.ContainsKey(button))
                        gridPulses[button] = Time.unscaledTime;
                }
                buttons.Add(button);
                if (piece != null)
                {
                    var iconSize = Mathf.Min(40, cellSize - 4);
                    Icon(button, piece.kind, piece.promoted, (cellSize - iconSize) * .5f, (cellSize - iconSize) * .5f, iconSize);
                    Box(button, "owner-stripe", 0, cellSize - 3, cellSize, 3, state.unsafeCell || state.kingDanger || state.kingCaptureTrap || state.transformationSafe ? "#ffffff00" : piece.owner == match.Viewer ? "#248cb6" : "#d89252");
                    var v = match.Data.Variant(piece);
                    var markCell = match.Viewer == "south" ? new Cell(piece.at.x + v.width - 1, piece.at.y) : new Cell(piece.at.x, piece.at.y + v.height - 1);
                    if (match.State.turn == match.Viewer && match.Marks.TryGetValue(piece.id, out var mark) && markCell.Same(cell))
                    {
                        var badge = Box(button, "coordinate-mark", cellSize - 17, 0, 17, 17, mark == "king" ? "#f7cc61" : mark == "helper" ? "#bce7ce" : mark == "trapped" ? "#8f2038" : "#d56b37", 9);
                        Border(badge, 1, mark == "king" ? "#fff9df" : mark == "helper" ? "#edfff2" : mark == "trapped" ? "#ffe1e7" : "#fff3e7");
                        if (mark == "danger")
                            Text(badge, "!", 0, -1, 15, 15, 12, "#ffffff", true, TextAnchor.MiddleCenter);
                        else
                            CenteredSymbol(badge, mark == "king" ? "crown" : mark == "helper" ? "helper" : "x-mark", 13, mark == "king" ? "#785122" : mark == "helper" ? "#206c53" : "#ffffff");
                    }
                }
                if (!button.ClassListContains("grid-input-bound"))
                {
                    button.AddToClassList("grid-input-bound");
                    button.RegisterCallback<PointerEnterEvent>(_ => match.HoverCell(gridCells[button]));
                    button.RegisterCallback<FocusInEvent>(_ => { gridFocused = display; foreach (var b in buttons) b.tabIndex = b == button ? 0 : -1; match.HoverCell(gridCells[button]); });
                    button.RegisterCallback<KeyDownEvent>(evt => { var offset = evt.keyCode == KeyCode.LeftArrow ? -1 : evt.keyCode == KeyCode.RightArrow ? 1 : evt.keyCode == KeyCode.UpArrow ? -10 : evt.keyCode == KeyCode.DownArrow ? 10 : 0; if (offset != 0) { buttons[Mathf.Clamp(display + offset, 0, 99)].Focus(); evt.StopPropagation(); } });
                }
            }
            foreach (var button in gridPulses.Keys.Where(b => !pulsing.Contains(b)).ToArray())
                gridPulses.Remove(button);
        }
        private float DockWidth => height <= 520 && width >= 500 ? 240 : width <= 760 ? width - 20 : Mathf.Min(420, width - 24);
        private float DockLeft => (height <= 520 && width >= 500) ? width - 14 - DockWidth : (width - DockWidth) * .5f;
        private float DockBottom => (height <= 670 && width <= 760) || (height <= 520 && width >= 500) ? 22 : 20;
        private static void Inline(VisualElement element, bool autoWidth = false)
        {
            element.style.position = UnityEngine.UIElements.Position.Relative;
            element.style.left = 0;
            element.style.top = 0;
            if (autoWidth)
                element.style.width = StyleKeyword.Auto;
        }
        private void StockTokens(VisualElement p, string owner, float left, float top, float iconSize, float step, bool alignRight = false)
        {
            var kinds = new[] { "seal", "penguin", "bear", "orca" };
            var landscape = height <= 520 && width >= 500;
            var mobile = width <= 760;
            var gap = landscape ? 3 : width <= 360 ? 6 : mobile ? 10 : 14;
            if (alignRight)
            {
                var row = Box(p, "opponent-stock-flow", 0, top, 0, 24);
                row.style.left = StyleKeyword.Auto;
                row.style.right = landscape ? 10 : mobile ? 12 : 14;
                row.style.width = StyleKeyword.Auto;
                row.style.flexDirection = FlexDirection.Row;
                row.style.alignItems = Align.Center;
                p = row;
            }
            for (var i = 0; i < 4; i++)
            {
                var kind = kinds[i];
                var target = Box(p, "stock-token", alignRight ? 0 : left + i * step, alignRight ? 0 : top, iconSize + 12, 24);
                if (alignRight)
                {
                    Inline(target, true);
                    target.style.flexDirection = FlexDirection.Row;
                    target.style.alignItems = Align.Center;
                    target.style.marginRight = i == 3 ? 0 : gap;
                }
                stockTargets[owner + ":" + kind] = target;
                var icon = Icon(target, kind, false, 0, (24 - iconSize) * .5f, iconSize);
                var number = Text(target, StockCount(owner, kind).ToString(), iconSize + 3, 0, 15, 24, alignRight && landscape ? 9 : 11, "#587088");
                if (alignRight)
                {
                    if (icon != null)
                        Inline(icon);
                    Inline(number, true);
                    number.style.marginLeft = landscape ? 1 : 3;
                }
                counts[owner + ":" + kind] = number;
            }
        }
        private VisualElement StockRow(VisualElement parent, string owner, float iconSize, float gap, float digitGap = 2, int fontSize = 11)
        {
            var row = Box(parent, "stock-flow", 0, 0, 0, 24);
            Inline(row, true);
            row.style.flexDirection = FlexDirection.Row;
            row.style.alignItems = Align.Center;
            var kinds = new[] { "seal", "penguin", "bear", "orca" };
            for (var i = 0; i < kinds.Length; i++)
            {
                var kind = kinds[i];
                var token = Box(row, "stock-token", 0, 0, 0, 24);
                Inline(token, true);
                token.style.flexDirection = FlexDirection.Row;
                token.style.alignItems = Align.Center;
                token.style.marginRight = i == 3 ? 0 : gap;
                var icon = Icon(token, kind, false, 0, 0, iconSize);
                Inline(icon);
                var count = Text(token, StockCount(owner, kind).ToString(), 0, 0, 0, 24, fontSize, "#587088");
                if (owner == match.Viewer && match.SelectedStock == kind && !match.Replaying)
                    count.style.color = C("#1b89a4");
                Inline(count, true);
                count.style.marginLeft = digitGap;
                counts[owner + ":" + kind] = count;
                stockTargets[owner + ":" + kind] = token;
            }
            return row;
        }
        private VisualElement StockBar(VisualElement parent, string owner, float y, float w, bool own)
        {
            var mobile = width <= 760;
            var landscape = height <= 520 && width >= 500;
            var compact = mobile && height <= 670;
            var h = own ? 44 : landscape || compact ? 34 : mobile ? 38 : 42;
            var x = own ? DockLeft : landscape ? width - 14 - w : (width - w) * .5f;
            var p = Box(parent, own ? "reserve-dock" : "opponent-bar", x, y, w, h, own ? "#f4fcff" : "#fff7ef", 24, true);
            Border(p, 2, "#ffffff");
            NativeUi.Skin(p, own ? "reserve" : "opponent", 24);
            NativeUi.EnterOnce(p, !own, own ? 0 : .07f);
            if (own)
                return p;
            var nameRow = Box(p, "opponent-name-flow", landscape ? 10 : mobile ? 12 : 14, 0, 0, h - 4);
            nameRow.style.width = StyleKeyword.Auto;
            nameRow.style.flexDirection = FlexDirection.Row;
            nameRow.style.alignItems = Align.Center;
            var dot = Box(nameRow, "presence", 0, 0, 6, 6, match.Thinking ? "#edb460" : "#9db7c3", 3);
            Inline(dot);
            dot.style.marginRight = 7;
            var actor = match.Actor(owner);
            opponentLabel = Text(nameRow, actor, 0, 0, 0, h - 4, 12, "#375775", true);
            Inline(opponentLabel, true);
            opponentLabel.style.letterSpacing = .36f;
            if (match.Settings.mode != "local-pvp")
            {
                var level = Text(nameRow, "Lv." + (owner == "south" ? match.Settings.southLevel : match.Settings.difficulty), 0, 0, 0, h - 4, 10, "#918591");
                Inline(level, true);
                level.style.marginLeft = 3;
            }
            var icon = landscape ? 16 : width <= 360 ? 19 : mobile ? 21 : 22;
            var step = landscape ? 29 : width <= 360 ? 36 : mobile ? 40 : 45;
            StockTokens(p, owner, 0, (h - 4 - 24) * .5f, icon, step, true);
            return p;
        }
        private Button FlatButton(VisualElement parent, string symbol, float x, float y, float w, float h, Action action, int size = 18)
        {
            var b = Button(parent, "", x, y, w, h, action, "#ffffff00");
            Border(b, 0, "#ffffff");
            NoSkin(b);
            NativeUi.Bind(b, action, Color.clear, C("#dcedf7"));
            if (!string.IsNullOrEmpty(symbol))
                CenteredSymbol(b, symbol, size, "#7395ac");
            return b;
        }
        public void BoardPointerDown()
        {
            if (expanded)
            {
                expanded = false;
                Rebuild();
            }
        }
        public void NewMatch()
        {
            gridOpen = expanded = false;
            announcedTurn = null;
            gainStarts.Clear();
            gainCounts.Clear();
            foreach (var label in gainLabels.Values) label.style.display = DisplayStyle.None;
            foreach (var ring in gainRings.Values) ring.style.display = DisplayStyle.None;
            Rebuild();
        }
        public bool EscapeUi()
        {
            var tray = expanded;
            expanded = false;
            gridOpen = false;
            Rebuild();
            return tray;
        }
        private void BuildStockDock()
        {
            if (match.Pending != null)
                return;
            var w = DockWidth;
            var x = DockLeft;
            var y = height - DockBottom - 44;
            var p = StockBar(hud, match.Viewer, y, w, true);
            var hasSelection = (match.SelectedId != null || match.SelectedStock != null) && !match.Busy;
            var landscapeDock = height <= 520 && width >= 500;
            var smallDock = width <= 360;
            var clearWidth = landscapeDock ? 28 : 34;
            var toggleWidth = w - 4 - (hasSelection ? clearWidth + 2 : 0);
            var toggle = FlatButton(p, "", 0, 0, toggleWidth, 40, () => { expanded = !expanded; Rebuild(); });
            var togglePadding = landscapeDock || smallDock ? 8 : 10;
            var content = Box(toggle, "reserve-content", togglePadding, 0, toggleWidth - togglePadding * 2, 40);
            content.style.flexDirection = FlexDirection.Row;
            content.style.alignItems = Align.Center;
            content.style.justifyContent = Justify.SpaceBetween;
            var label = Text(content, match.Settings.mode == "local-pvp" ? match.Actor(match.Viewer) + "の持ち駒" : "持ち駒", 0, 0, 0, 24, 11, "#375775", true);
            Inline(label, true);
            var toggleGap = landscapeDock || smallDock ? 5 : 8;
            var tokens = StockRow(content, match.Viewer, landscapeDock ? 18 : smallDock ? 20 : width <= 760 ? 21 : 22, landscapeDock ? 4 : smallDock ? 5 : 10, landscapeDock ? 1 : 2, landscapeDock ? 9 : smallDock ? 10 : 11);
            tokens.style.marginLeft = toggleGap;
            var chevron = Symbol(content, "chevron-up", 0, 0, 15, "#658da6");
            Inline(chevron);
            chevron.style.marginLeft = toggleGap;
            chevron.style.rotate = new Rotate(expanded ? 180 : 0);
            NativeUi.Bind(toggle, () => { expanded = !expanded; Rebuild(); }, Color.clear, Color.clear);
            toggle.SetEnabled(!match.Busy);
            toggle.style.opacity = match.Busy ? .8f : 1;
            if (hasSelection)
            {
                var clear = FlatButton(p, "x", w - 4 - clearWidth, 0, clearWidth, 40, match.ClearSelection, 17);
                clear.style.borderLeftWidth = 1;
                clear.style.borderLeftColor = C("#81b0c233");
            }
            if (expanded)
            {
                var mobile = width <= 760;
                var compact = height <= 670 && mobile;
                var landscape = height <= 520 && width >= 500;
                var padding = compact && !landscape ? 10 : landscape || mobile ? 12 : 16;
                var paddingY = compact && !landscape ? 8 : landscape || mobile ? 10 : 12;
                var buttonHeight = compact || landscape ? 58 : 66;
                var trayHeight = 6 + paddingY * 2 + 28 + 8 + buttonHeight;
                var tray = Box(hud, "placement-tray", x, y - 8 - trayHeight, w, trayHeight, "#f5fbff", 24, true);
                Border(tray, 3, "#ffffff");
                NativeUi.Skin(tray, "tray", 24);
                NativeUi.EnterOnce(tray);
                Text(tray, "配置する駒を選択", padding, paddingY, w - 100, 28, mobile ? 12 : 13, "#375775", true);
                FlatButton(tray, "info", w - 6 - padding - 72, paddingY - 4, 36, 36, () => { expanded = false; match.Open("rules"); });
                FlatButton(tray, "x", w - 6 - padding - 36, paddingY - 4, 36, 36, () => { expanded = false; Rebuild(); });
                var kinds = new[] { "seal", "penguin", "bear", "orca" };
                var colors = new[] { "#e9f5fc", "#eeebfc", "#fff1d9", "#e4effb" };
                var gap = landscape ? 4 : mobile ? 6 : 8;
                var bw = (w - 6 - 2 * padding - 3 * gap) / 4;
                for (var i = 0; i < 4; i++)
                {
                    var kind = kinds[i];
                    var active = match.SelectedStock == kind;
                    var b = Button(tray, "", padding + i * (bw + gap), paddingY + 36, bw, buttonHeight, () => { if (match.SelectedStock != kind) match.SelectStock(kind); expanded = false; Rebuild(); }, active ? "#d2f4ef" : colors[i]);
                    Round(b, 17);
                    Border(b, 2, active ? "#70c8d6" : "#d5e6f0");
                    NoSkin(b);
                    NativeUi.Bind(b, () => { if (match.SelectedStock != kind) match.SelectStock(kind); expanded = false; Rebuild(); }, C(active ? "#d2f4ef" : colors[i]), C(active ? "#d2f4ef" : "#d7f0fb"));
                    b.style.flexDirection = FlexDirection.Column;
                    b.style.alignItems = Align.Center;
                    b.style.justifyContent = Justify.Center;
                    b.style.paddingLeft = b.style.paddingRight = b.style.paddingTop = b.style.paddingBottom = 4;
                    var portrait = Icon(b, kind, false, 0, 0, landscape ? 30 : compact ? 29 : 33);
                    Inline(portrait);
                    var caption = FlowText(b, match.Data.Config.pieces.First(p => p.kind == kind).shortName, mobile ? 9 : 10, active ? "#286b83" : "#52728e");
                    caption.style.marginTop = 3;
                    var counter = Text(b, match.State.stocks.Of(match.State.turn).Count(kind).ToString(), 0, 5, 0, 17, 11, "#4d6a86", true);
                    counter.style.left = StyleKeyword.Auto;
                    counter.style.right = 7;
                    counter.style.width = StyleKeyword.Auto;
                    b.SetEnabled(match.HumanTurn && match.State.stocks.Of(match.State.turn).Count(kind) > 0);
                    if (active)
                        NativeUi.Skin(b, "stockSelected", 17);
                    b.style.opacity = b.enabledSelf ? 1 : active ? .9f : .3f;
                    if (!b.ClassListContains("source-control-arrived"))
                    {
                        b.AddToClassList("source-control-arrived");
                        NativeUi.Enter(b, i * .035f, true);
                    }
                }
            }
        }
        private void BuildSpectatorDock()
        {
            var landscape = height <= 520 && width >= 500;
            var p = Box(hud, "spectator-dock", DockLeft, height - DockBottom - 44, DockWidth, 44, "#f4fcff", 24, true);
            Border(p, 2, "#ffffff");
            NativeUi.Skin(p, "reserve", 24);
            Row(p);
            p.style.justifyContent = Justify.SpaceBetween;
            p.style.paddingLeft = landscape ? 5 : 10;
            p.style.paddingRight = landscape ? 5 : 6;
            var name = FlowBox(p, "spectator-name");
            FlowText(name, match.Actor(match.Viewer), 10, "#375775", true);
            FlowText(name, "Lv." + (match.Viewer == "south" ? match.Settings.southLevel : match.Settings.difficulty), 9, "#7f93a9");
            StockRow(p, match.Viewer, landscape ? 15 : 18, landscape ? 2 : 4, 1, 10);
            var controls = FlowBox(p, "spectator-controls");
            Row(controls);
            var play = FlatButton(controls, match.Paused ? "play" : "pause", 0, 0, landscape ? 26 : 30, 36, match.TogglePause, 16);
            Inline(play);
            NativeUi.Bind(play, match.TogglePause, Color.clear, C("#ffffff12"));
            play.style.marginRight = 2;
            var step = FlatButton(controls, "step", 0, 0, landscape ? 26 : 30, 36, match.StepAi, 16);
            Inline(step);
            NativeUi.Bind(step, match.StepAi, Color.clear, C("#ffffff12"));
            step.SetEnabled(match.Paused && !match.Busy && !match.Thinking);
            step.style.opacity = step.enabledSelf ? 1 : .35f;
        }
        private void BuildReplayDock()
        {
            var w = DockWidth;
            var p = Box(hud, "replay-dock", DockLeft, height - DockBottom - 93, w, 93, "#f3fcfff5", 26, true);
            Border(p, 2, "#ffffff");
            NativeUi.Skin(p, "replayDock", 26);
            var stock = StockRow(p, match.Viewer, 20, 10);
            stock.style.position = UnityEngine.UIElements.Position.Absolute;
            stock.style.left = Length.Percent(50);
            stock.style.top = 3;
            stock.style.translate = new Translate(Length.Percent(-50), 0);
            Slider(p, match.ReplayCursor, 0, Mathf.Max(1, match.ReplayTotal), 12, 28, w - 24, v => match.SeekReplay(Mathf.RoundToInt(v)), true);
            var buttonWidth = Mathf.Min(40, (w - 24) / 7);
            var gap = (w - 24 - buttonWidth * 7) / 6;
            var names = new[] { "first", "left", match.ReplayPlaying ? "pause-filled" : "play-filled", "right", "last", "", "x" };
            Action[] actions = { () => match.SeekReplay(0), () => match.SeekReplay(match.ReplayCursor - 1), match.ToggleReplay, () => { match.ReplayPlaying = false; match.StepReplay(1); }, () => match.SeekReplay(match.ReplayTotal), () => { match.ReplaySpeed = match.ReplaySpeed == .5f ? 1 : match.ReplaySpeed == 1 ? 2 : .5f; Rebuild(); }, match.EndReplay };
            for (var i = 0; i < 7; i++)
            {
                var x = 12 + i * (buttonWidth + gap);
                var b = FlatButton(p, names[i].Length > 0 ? names[i] : "spin", x, 49, buttonWidth, 38, actions[i], i == 6 ? 19 : 24);
                NativeUi.Bind(b, actions[i], Color.clear, C("#d5f1fa"));
                if (i == 2)
                {
                    b.style.backgroundColor = C("#ffe39b");
                    Border(b, 2, "#ffffff");
                    Round(b, 19);
                    NativeUi.Skin(b, "replayPlay", 19);
                    NativeUi.Bind(b, actions[i], C("#ffe39b"), C("#d5f1fa"));
                }
                if (i == 5)
                {
                    foreach (var child in b.Children())
                        child.style.display = DisplayStyle.None;
                    Text(b, match.ReplaySpeed + "×", 0, 0, buttonWidth, 38, 12, "#375775", true, TextAnchor.MiddleCenter);
                }
                if (i < 2)
                    b.SetEnabled(match.ReplayCursor > 0 || match.Busy);
                else if (i == 3)
                    b.SetEnabled(!match.Busy && match.ReplayCursor < match.ReplayTotal);
                else if (i == 4)
                    b.SetEnabled(match.ReplayCursor < match.ReplayTotal || match.Busy);
                else if (i == 5)
                    b.SetEnabled(!match.Busy);
                b.style.opacity = b.enabledSelf ? 1 : .3f;
            }
        }
        private void Slider(VisualElement parent, float value, float min, float max, float x, float y, float w, Action<float> changed, bool replay = false)
        {
            var slider = activeViews.Get(parent, "slider", () => new NativeSlider());
            slider.Bind(value, min, max, x, y, w, changed, replay);
        }
    }
}
