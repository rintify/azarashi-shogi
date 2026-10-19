using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    public sealed partial class NativeHud
    {
        private VisualElement promotionPopup;
        private void UpdateChoices()
        {
            var pending = match.Pending;
            var show = pending != null && match.Motion != null && match.Motion.Progress >= 1;
            var count = show ? pending.Length : 0;
            if (count == choiceCount)
                return;
            choiceCount = count;
            choiceIndex = match.CurrentChoice;
            if (promotionPopup != null)
            {
                var old = promotionPopup;
                NativeUi.Exit(old);
                old.SetEnabled(false);
                old.schedule.Execute(() => old.RemoveFromHierarchy()).StartingIn(180);
                promotionPopup = null;
            }
            if (count == 0)
                return;
            promotionPopup = Box(choice, "promotion-popup", 0, 0, width, height);
            var compact = height <= 670 && width <= 499;
            var landscape = height <= 520 && width >= 500;
            var bottom = landscape ? 22 : compact ? 18 : 30;
            var h = landscape || compact ? 50 : 56;
            var y = height - bottom - h;
            var keepWidth = landscape ? 90 : width <= 360 ? 108 : 122;
            var evolveWidth = landscape ? 86 : width <= 360 ? 108 : 115;
            var cancelWidth = landscape ? 36 : 44;
            var gap = landscape ? 6 : 12;
            var total = (count > 1 ? keepWidth + evolveWidth + gap : 160) + cancelWidth + gap;
            var center = landscape ? width - 14 - 120 : width * .5f;
            var left = center - total * .5f;
            var rotations = pending.Skip(1).Any(p => p.action.transformation?.type == "rotate");
            if (rotations)
            {
                var rotationWidth = compact || landscape ? 54 : 62;
                var rotationHeight = compact ? 48 : landscape ? 52 : 58;
                var rotationGap = landscape ? 6 : 10;
                var rotationTotal = (count - 1) * (rotationWidth + rotationGap) - rotationGap;
                var buttons = new List<Button>();
                Action refresh = () => { };
                for (var i = 1; i < count; i++)
                {
                    var index = i;
                    var button = Button(promotionPopup, "", center - rotationTotal * .5f + (i - 1) * (rotationWidth + rotationGap), y - 14 - rotationHeight, rotationWidth, rotationHeight, () => { choiceIndex = index; match.PreviewChoice(index); refresh(); }, "#f5fcff");
                    Round(button, compact ? 17 : 19);
                    Border(button, 3, "#ffffff");
                    NativeUi.Skin(button, "rotation", compact ? 17 : 19);
                    buttons.Add(button);
                    var shape = new NativeRotationShape(pending[i], pending, match.Viewer == "north") { Tint = C("#90acc1") };
                    shape.style.position = UnityEngine.UIElements.Position.Absolute;
                    shape.style.left = 0;
                    shape.style.top = 0;
                    shape.style.right = 0;
                    shape.style.bottom = 0;
                    button.Add(shape);
                    NativeUi.Enter(button, (i - 1) * .035f, true);
                }
                refresh = () => { for (var i = 0; i < buttons.Count; i++) { var active = choiceIndex == i + 1; var danger = match.ChoiceColor(i + 1) != match.Data.Config.colors.safe; var fill = danger ? (active ? "#ffc8d2" : "#ffe4e9") : active ? "#cefae9" : "#f5fcff"; buttons[i].style.backgroundColor = C(fill); Border(buttons[i], 3, active && !danger ? "#fff9d9" : "#ffffff"); buttons[i].style.translate = new Translate(0, active ? -5 : 0); var shape = buttons[i].Q<NativeRotationShape>(); shape.Tint = C(danger ? match.ChoiceColor(i + 1) : active ? "#429a9b" : "#90acc1"); shape.MarkDirtyRepaint(); NativeUi.Skin(buttons[i], active ? "rotationSelected" : "rotation", compact ? 17 : 19); } };
                refresh();
            }
            if (count > 1)
            {
                var keep = Button(promotionPopup, "そのまま", left, y, keepWidth, h, () => match.ResolveChoice(0), "#f0faff", landscape ? 15 : width <= 360 ? 16 : 18);
                keep.style.color = C("#55748f");
                Round(keep, 30);
                Border(keep, 3, "#ffffff");
                NativeUi.Skin(keep, "keep", 30);
                NativeUi.Bind(keep, () => match.ResolveChoice(0), C("#f0faff"), C("#f0faff"), -2);
                NativeUi.Enter(keep, 0, true);
                var evolve = Button(promotionPopup, "", left + keepWidth + gap, y, evolveWidth, h, () => match.ResolveChoice(choiceIndex > 0 ? choiceIndex : 1), "#ffcf70", 18);
                Round(evolve, 30);
                Border(evolve, 3, "#ffffff");
                NativeUi.Skin(evolve, "evolve", 30);
                NativeUi.Bind(evolve, () => match.ResolveChoice(choiceIndex > 0 ? choiceIndex : 1), C("#ffcf70"), C("#ffcf70"), -2);
                Symbol(evolve, "sparkles", landscape ? 12 : 20, (h - 21) * .5f - 3, 21, "#775549");
                Text(evolve, "成る", landscape ? 37 : 49, 0, 42, h - 6, landscape ? 15 : width <= 360 ? 16 : 18, "#775549", true);
                NativeUi.Enter(evolve, .035f, true);
            }
            else
            {
                var confirm = Button(promotionPopup, "この手を指す", left, y, 160, h, () => match.ResolveChoice(0), "#ffcf70", 18);
                NativeUi.Skin(confirm, "evolve", 30);
                NativeUi.Enter(confirm, 0, true);
            }
            var cancel = Button(promotionPopup, "", left + total - cancelWidth, y + (h - cancelWidth) * .5f, cancelWidth, cancelWidth, match.CancelChoice, "#eff8ff");
            Border(cancel, 2, "#ffffff");
            NativeUi.Skin(cancel, "cancel", 22);
            Symbol(cancel, "x", (cancelWidth - 20) * .5f - 2, (cancelWidth - 20) * .5f - 2, 20, "#6c8b9d");
            NativeUi.Enter(cancel, .07f, true);
            var captured = pending[choiceIndex].captured;
            if (captured.Any(p => p.kind == "walrus" && p.owner == match.Viewer))
            {
                var warning = Box(promotionPopup, "promotion-warning", center - 150, y - (rotations ? 126 : 49), 300, 34, "#fff4e3", 20);
                Border(warning, 2, "#ffffff");
                Text(warning, captured.Any(p => p.kind == "walrus" && p.owner != match.Viewer) ? "両方の王を捕食 → 引き分け" : "自分の王を捕食 → 敗北", 8, 0, 280, 30, 12, "#9a4c4e", false, TextAnchor.MiddleCenter);
                NativeUi.Enter(warning);
            }
        }
    }
}
