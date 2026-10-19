using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    public sealed partial class NativeHud
    {
        private void BuildGrid()
        {
            var size = Mathf.Min(playArea.width, playArea.height);
            var cellSize = (size - 19) / 10;
            var panel = Box(root, "native-coordinate-board", playArea.x + (playArea.width - size) * .5f, playArea.y + (playArea.height - size) * .5f, size, size, "#b1d0df", 6, true);
            panel.SendToBack();
            var buttons = new List<Button>();
            for (var index = 0; index < 100; index++)
            {
                var display = index;
                var n = match.Viewer == "south" ? index : 99 - index;
                var cell = new Cell(n % 10, n / 10);
                var piece = match.State.pieces.FirstOrDefault(p => match.Data.Body(p).Any(c => c.Same(cell)));
                var state = match.GuideAt(cell);
                var color = state.transformationSafe ? "#e7d7f3" : state.kingDanger ? "#bd7a8a" : state.kingCaptureTrap ? "#f8e9ad" : state.unsafeCell ? "#ffd5dc" : state.legal && !state.inspectingEnemy ? "#a4dce7" : state.reachable ? "#d1eaf1" : "#e0f0f7";
                var button = Button(panel, "", 5 + index % 10 * (cellSize + 1), 5 + index / 10 * (cellSize + 1), cellSize, cellSize, () => match.Click(cell), color, 9);
                Round(button, 0);
                Border(button, 0, "#ffffff");
                NoSkin(button);
                NativeUi.Bind(button, () => match.Click(cell), C(color), C(color));
                buttons.Add(button);
                button.tooltip = (cell.x + 1) + "," + (cell.y + 1) + (piece == null ? "" : " " + match.Data.Name(piece));
                if (piece != null)
                {
                    var iconSize = Mathf.Min(40, cellSize - 4);
                    Icon(button, piece.kind, piece.promoted, (cellSize - iconSize) * .5f, (cellSize - iconSize) * .5f, iconSize);
                    Box(button, "owner-stripe", 0, cellSize - 3, cellSize, 3, piece.owner == match.Viewer ? "#248cb6" : "#d89252");
                    var v = match.Data.Variant(piece);
                    var markCell = match.Viewer == "south" ? new Cell(piece.at.x + v.width - 1, piece.at.y) : new Cell(piece.at.x, piece.at.y + v.height - 1);
                    if (match.Marks.TryGetValue(piece.id, out var mark) && markCell.Same(cell))
                    {
                        var badge = Box(button, "coordinate-mark", cellSize - 17, 0, 17, 17, mark == "king" ? "#f7cc61" : mark == "helper" ? "#bce7ce" : mark == "trapped" ? "#8f2038" : "#d56b37", 9);
                        Border(badge, 1, "#fff3e7");
                        if (mark == "danger")
                            Text(badge, "!", 0, -1, 15, 15, 12, "#ffffff", true, TextAnchor.MiddleCenter);
                        else
                            Symbol(badge, mark == "king" ? "crown" : mark == "helper" ? "helper" : "x", 1, 1, 13, mark == "king" ? "#785122" : mark == "helper" ? "#206c53" : "#ffffff");
                    }
                }
                if (!button.ClassListContains("grid-input-bound"))
                {
                    button.AddToClassList("grid-input-bound");
                    button.RegisterCallback<PointerEnterEvent>(_ => match.HoverCell(cell));
                    button.RegisterCallback<FocusInEvent>(_ => match.HoverCell(cell));
                    button.RegisterCallback<KeyDownEvent>(evt => { var offset = evt.keyCode == KeyCode.LeftArrow ? -1 : evt.keyCode == KeyCode.RightArrow ? 1 : evt.keyCode == KeyCode.UpArrow ? -10 : evt.keyCode == KeyCode.DownArrow ? 10 : 0; if (offset != 0) { buttons[Mathf.Clamp(display + offset, 0, 99)].Focus(); evt.StopPropagation(); } });
                }
            }
        }
        private float DockWidth => height <= 520 && width >= 500 ? 240 : width <= 760 ? width - 20 : Mathf.Min(420, width - 24);
        private float DockLeft => (height <= 520 && width >= 500) ? width - 14 - DockWidth : (width - DockWidth) * .5f;
        private float DockBottom => (height <= 670 && width <= 760) || (height <= 520 && width >= 500) ? 22 : 20;
        private void StockTokens(VisualElement p, string owner, float left, float top, float iconSize, float step)
        {
            var kinds = new[] { "seal", "penguin", "bear", "orca" };
            for (var i = 0; i < 4; i++)
            {
                var kind = kinds[i];
                var target = Box(p, "stock-token", left + i * step, top, iconSize + 12, 24);
                stockTargets[owner + ":" + kind] = target;
                Icon(target, kind, false, 0, (24 - iconSize) * .5f, iconSize);
                var number = Text(target, StockCount(owner, kind).ToString(), iconSize + 3, 0, 15, 24, 11, "#587088");
                counts[owner + ":" + kind] = number;
            }
        }
        private void StockBar(VisualElement parent, string owner, float y, float w, bool own)
        {
            var mobile = width <= 760;
            var landscape = height <= 520 && width >= 500;
            var compact = mobile && height <= 670;
            var h = own ? 44 : landscape || compact ? 34 : mobile ? 38 : 42;
            var x = own ? DockLeft : landscape ? width - 14 - w : (width - w) * .5f;
            var p = Box(parent, "stock-" + owner, x, y, w, h, own ? "#f4fcff" : "#fff7ef", 24, true);
            Border(p, 2, "#ffffff");
            NativeUi.Skin(p, own ? "reserve" : "opponent", 24);
            NativeUi.EnterOnce(p, !own, own ? 0 : .07f);
            if (own)
            {
                Text(p, match.Settings.mode == "local-pvp" ? match.Actor(owner) + "の持ち駒" : "持ち駒", 10, 0, w - 210, h, 11, "#375775", true);
                StockTokens(p, owner, w - (landscape ? 151 : 206), (h - 24) * .5f, landscape ? 18 : mobile ? 21 : 22, landscape ? 33 : 42);
                return;
            }
            var dot = Box(p, "presence", 12, (h - 6) * .5f, 6, 6, match.Thinking ? "#edb460" : "#9db7c3", 3);
            var actor = match.Actor(owner);
            opponentLabel = Text(p, actor, 25, 0, actor.Length * 12 + 4, h, 12, "#375775", true);
            if (match.Settings.mode != "local-pvp")
                Text(p, "Lv." + (owner == "south" ? match.Settings.southLevel : match.Settings.difficulty), 29 + actor.Length * 12, 0, 34, h, 10, "#918591");
            var icon = landscape ? 16 : width <= 360 ? 19 : mobile ? 21 : 22;
            var step = landscape ? 29 : width <= 360 ? 36 : mobile ? 40 : 45;
            StockTokens(p, owner, w - 12 - (step * 3 + icon + 24), (h - 24) * .5f, icon, step);
        }
        private Button FlatButton(VisualElement parent, string symbol, float x, float y, float w, float h, Action action, int size = 18)
        {
            var b = Button(parent, "", x, y, w, h, action, "#ffffff00");
            Border(b, 0, "#ffffff");
            NoSkin(b);
            NativeUi.Bind(b, action, Color.clear, C("#dcedf7"));
            Symbol(b, symbol, (w - size) * .5f, (h - size) * .5f, size, "#7395ac");
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
        private void BuildStockDock()
        {
            if (match.Pending != null)
                return;
            var w = DockWidth;
            var x = DockLeft;
            var y = height - DockBottom - 44;
            StockBar(hud, match.Viewer, y, w, true);
            var p = Box(hud, "reserve-controls", x, y, w, 44);
            var hasSelection = (match.SelectedId != null || match.SelectedStock != null) && !match.Busy;
            var toggle = FlatButton(p, "chevron-up", 0, 0, w - (hasSelection ? 34 : 0), 44, () => { expanded = !expanded; Rebuild(); }, 15);
            foreach (var child in toggle.Children())
                if (child.name.StartsWith("symbol"))
                {
                    child.style.left = w - (hasSelection ? 58 : 24);
                    child.style.rotate = new Rotate(expanded ? 180 : 0);
                }
            NativeUi.Bind(toggle, () => { expanded = !expanded; Rebuild(); }, Color.clear, Color.clear);
            toggle.SetEnabled(!match.Busy);
            if (hasSelection)
            {
                var clear = FlatButton(p, "x", w - 34, 0, 34, 40, match.ClearSelection, 17);
                clear.style.borderLeftWidth = 1;
                clear.style.borderLeftColor = C("#81b0c233");
            }
            if (expanded)
            {
                var mobile = width <= 760;
                var compact = height <= 670 && mobile;
                var landscape = height <= 520 && width >= 500;
                var padding = landscape || mobile ? 12 : 16;
                var buttonHeight = compact || landscape ? 58 : 66;
                var trayHeight = buttonHeight + 62;
                var tray = Box(hud, "placement-tray", x, y - 8 - trayHeight, w, trayHeight, "#f5fbff", 24, true);
                Border(tray, 3, "#ffffff");
                NativeUi.Skin(tray, "tray", 24);
                Enter(tray);
                Text(tray, "配置する駒を選択", padding, 10, w - 100, 28, mobile ? 12 : 13, "#375775", true);
                FlatButton(tray, "book", w - 84, 6, 36, 36, () => { expanded = false; match.Open("rules"); });
                FlatButton(tray, "x", w - 48, 6, 36, 36, () => { expanded = false; Rebuild(); });
                var kinds = new[] { "seal", "penguin", "bear", "orca" };
                var colors = new[] { "#e9f5fc", "#eeebfc", "#fff1d9", "#e4effb" };
                var gap = mobile ? 6 : 8;
                var bw = (w - 2 * padding - 3 * gap) / 4;
                for (var i = 0; i < 4; i++)
                {
                    var kind = kinds[i];
                    var active = match.SelectedStock == kind;
                    var b = Button(tray, "", padding + i * (bw + gap), 48, bw, buttonHeight, () => { if (match.SelectedStock != kind) match.SelectStock(kind); expanded = false; Rebuild(); }, active ? "#d2f4ef" : colors[i]);
                    Round(b, 17);
                    Border(b, 2, active ? "#70c8d6" : "#d5e6f0");
                    NoSkin(b);
                    NativeUi.Bind(b, () => { if (match.SelectedStock != kind) match.SelectStock(kind); expanded = false; Rebuild(); }, C(active ? "#d2f4ef" : colors[i]), C("#d7f0fb"));
                    var iconSize = compact ? 29 : 33;
                    Icon(b, kind, false, (bw - iconSize) * .5f, 7, iconSize);
                    var names = new[] { "アザラシ", "ペンギン", "シロクマ", "シャチ" };
                    Text(b, names[i], 0, buttonHeight - 23, bw, 18, mobile ? 9 : 10, "#52728e", false, TextAnchor.MiddleCenter);
                    Text(b, match.State.stocks.Of(match.State.turn).Count(kind).ToString(), bw - 24, 3, 18, 17, 11, "#4d6a86", true);
                    b.SetEnabled(match.HumanTurn && match.State.stocks.Of(match.State.turn).Count(kind) > 0);
                    b.style.opacity = b.enabledSelf ? 1 : .3f;
                    NativeUi.Enter(b, i * .035f, true);
                }
            }
        }
        private void BuildSpectatorDock()
        {
            var w = DockWidth;
            var y = height - DockBottom - 44;
            var x = DockLeft;
            var p = Box(hud, "spectator-dock", x, y, w, 44, "#f4fcff", 24, true);
            Border(p, 2, "#ffffff");
            NativeUi.Skin(p, "reserve", 24);
            Text(p, match.Actor(match.Viewer), 12, 4, 70, 19, 11, "#375775", true);
            Text(p, "Lv." + (match.Viewer == "south" ? match.Settings.southLevel : match.Settings.difficulty), 12, 22, 70, 12, 10, "#918591");
            StockTokens(p, match.Viewer, w - 252, 10, 20, 40);
            FlatButton(p, match.Paused ? "play" : "pause", w - 76, 3, 34, 36, match.TogglePause, 16);
            FlatButton(p, "step", w - 40, 3, 34, 36, match.StepAi, 16).SetEnabled(match.Paused && !match.Busy && !match.Thinking);
        }
        private void BuildReplayDock()
        {
            var w = DockWidth;
            var p = Box(hud, "replay-dock", DockLeft, height - DockBottom - 93, w, 93, "#f3fcfff5", 26, true);
            Border(p, 2, "#ffffff");
            NativeUi.Skin(p, "replayDock", 26);
            StockTokens(p, match.Viewer, (w - 176) * .5f, 3, 20, 42);
            Slider(p, match.ReplayCursor, 0, Mathf.Max(1, match.ReplayTotal), 12, 28, w - 24, v => match.SeekReplay(Mathf.RoundToInt(v)), true);
            var buttonWidth = Mathf.Min(40, (w - 24) / 7);
            var gap = (w - 24 - buttonWidth * 7) / 6;
            var names = new[] { "first", "left", match.ReplayPlaying ? "pause" : "play", "right", "last", "", "x" };
            Action[] actions = { () => match.SeekReplay(0), () => match.StepReplay(-1), () => { match.ReplayPlaying = !match.ReplayPlaying; Rebuild(); }, () => { match.ReplayPlaying = false; match.StepReplay(1); }, () => match.SeekReplay(match.ReplayTotal), () => { match.ReplaySpeed = match.ReplaySpeed == .5f ? 1 : match.ReplaySpeed == 1 ? 2 : .5f; Rebuild(); }, match.EndReplay };
            for (var i = 0; i < 7; i++)
            {
                var x = 12 + i * (buttonWidth + gap);
                var b = FlatButton(p, names[i].Length > 0 ? names[i] : "spin", x, 49, buttonWidth, 38, actions[i], i == 6 ? 19 : 20);
                if (i == 2)
                {
                    b.style.backgroundColor = C("#ffe39b");
                    Border(b, 2, "#ffffff");
                    Round(b, 19);
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
            }
        }
        private void Slider(VisualElement parent, float value, float min, float max, float x, float y, float w, Action<float> changed, bool onRelease = false)
        {
            var slider = activeViews.Get(parent, "slider", () => new NativeSlider());
            slider.Bind(value, min, max, x, y, w, changed, onRelease);
        }
    }
}
