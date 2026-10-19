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
        private float choiceWidth, choiceHeight, choiceExitUntil;
        private bool choiceModal;
        private VisualElement priorChoiceFocus;
        private void UpdateChoices()
        {
            var pending = match.Pending;
            var show = pending != null && (pending.Length == 1 || match.Motion != null && match.Motion.Progress >= 1);
            var count = show ? pending.Length : 0;
            var wasModal = choiceCount > 1;
            if (count == 0 && wasModal)
                choiceExitUntil = Time.unscaledTime + .18f;
            choiceModal = count > 1 || Time.unscaledTime < choiceExitUntil;
            if (count == choiceCount && choiceWidth == width && choiceHeight == height)
                return;
            choiceCount = count;
            choiceWidth = width;
            choiceHeight = height;
            choiceIndex = match.CurrentChoice;
            if (promotionPopup != null)
            {
                var old = promotionPopup;
                NativeUi.Exit(old);
                old.SetEnabled(false);
                old.schedule.Execute(() => { NativeUi.Forget(old); old.RemoveFromHierarchy(); }).StartingIn(180);
                promotionPopup = null;
            }
            if (count == 0)
            {
                priorChoiceFocus?.Focus();
                priorChoiceFocus = null;
                return;
            }
            promotionPopup = Box(choice, "promotion-popup", 0, 0, width, height, block: count > 1);
            var compact = height <= 670 && width <= 499;
            var landscape = height <= 520 && width >= 500;
            var bottom = count == 1 ? DockBottom : landscape ? 22 : compact ? 18 : 30;
            // min-height is not height: source padding + its 18/16px line box
            // remains 55/52px in the compact layout (measured in the source).
            var h = landscape ? 50 : compact ? width <= 360 ? 52 : 55 : 56;
            var verticalGap = landscape || compact ? 12 : 14;
            var y = height - bottom - h;
            var keepWidth = landscape ? 90 : width <= 360 ? 108 : 122;
            var evolveWidth = landscape ? 86 : width <= 360 ? 108 : 115;
            var cancelWidth = landscape ? 36 : 44;
            var gap = landscape ? 6 : 12;
            var confirmWidth = landscape ? 120 : width <= 360 ? 134 : 158;
            var total = (count > 1 ? keepWidth + evolveWidth + gap : confirmWidth) + cancelWidth + gap;
            var center = landscape ? width - 14 - 120 : width * .5f;
            var left = center - total * .5f;
            Button keepControl = null, evolveControl = null;
            Action refreshPromotion = () => { };
            var rotationButtons = new List<Button>();
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
                    var button = Button(promotionPopup, "", center - rotationTotal * .5f + (i - 1) * (rotationWidth + rotationGap), y - verticalGap - rotationHeight, rotationWidth, rotationHeight, () => { choiceIndex = index; match.PreviewChoice(index); refresh(); }, "#f5fcff");
                    Round(button, compact ? 17 : 19);
                    Border(button, 3, "#ffffff");
                    NativeUi.Skin(button, "rotation", compact ? 17 : 19);
                    buttons.Add(button);
                    rotationButtons.Add(button);
                    var shape = new NativeRotationShape(pending[i], pending, match.Viewer == "north") { Tint = C("#90acc1") };
                    shape.style.position = UnityEngine.UIElements.Position.Absolute;
                    shape.style.left = 0;
                    shape.style.top = 0;
                    shape.style.right = 0;
                    shape.style.bottom = 0;
                    button.Add(shape);
                    NativeUi.Enter(button, (i - 1) * .035f, true);
                }
                refresh = () =>
                {
                    for (var i = 0; i < buttons.Count; i++)
                    {
                        var active = choiceIndex == i + 1;
                        var danger = match.ChoiceColor(i + 1) != match.Data.Config.colors.safe;
                        var fill = danger ? (active ? "#ffc8d2" : "#ffe4e9") : active ? "#cefae9" : "#f5fcff";
                        NativeUi.Colors(buttons[i], C(fill), C(fill));
                        Border(buttons[i], 3, active && !danger ? "#fff9d9" : "#ffffff");
                        NativeUi.RestingY(buttons[i], active ? -5 : 0);
                        var shape = buttons[i].Q<NativeRotationShape>();
                        shape.Tint = C(danger ? match.Data.Config.colors.danger : active ? "#429a9b" : "#90acc1");
                        shape.MarkDirtyRepaint();
                        NativeUi.Skin(buttons[i], active && danger ? "rotationDanger" : active ? "rotationSelected" : "rotation", compact ? 17 : 19, match.Data.Config.colors.danger);
                    }
                    refreshPromotion();
                };
                refresh();
            }
            if (count > 1)
            {
                var keep = Button(promotionPopup, "そのまま", left, y, keepWidth, h, () => match.ResolveChoice(0), "#f0faff", landscape ? 15 : width <= 360 ? 16 : 18);
                keepControl = keep;
                keep.style.color = C("#55748f");
                Round(keep, 30);
                Border(keep, 3, "#ffffff");
                NativeUi.Skin(keep, "keep", 30);
                NativeUi.Bind(keep, () => match.ResolveChoice(0), C("#f0faff"), C("#f0faff"), -2);
                NativeUi.Enter(keep, 0, true);
                var evolve = Button(promotionPopup, "", left + keepWidth + gap, y, evolveWidth, h, () => match.ResolveChoice(choiceIndex > 0 ? choiceIndex : 1), "#ffcf70", 18);
                evolveControl = evolve;
                Round(evolve, 30);
                Border(evolve, 3, "#ffffff");
                NativeUi.Skin(evolve, "evolve", 30);
                NativeUi.Bind(evolve, () => match.ResolveChoice(choiceIndex > 0 ? choiceIndex : 1), C("#ffcf70"), C("#ffcf70"), -2);
                evolve.style.flexDirection = FlexDirection.Row;
                evolve.style.alignItems = Align.Center;
                evolve.style.justifyContent = Justify.Center;
                var sparkle = Symbol(evolve, "sparkles", 0, 0, 21, "#775549");
                Inline(sparkle);
                var copy = FlowText(evolve, "成る", landscape ? 15 : width <= 360 ? 16 : 18, "#775549", true);
                copy.style.marginLeft = landscape ? 4 : 8;
                NativeUi.Enter(evolve, .035f, true);
            }
            else
            {
                var confirm = Button(promotionPopup, "この手を指す", left, y, confirmWidth, h, () => match.ResolveChoice(0), "#ffcf70", landscape ? 15 : width <= 360 ? 16 : 18);
                Round(confirm, 30);
                Border(confirm, 3, "#ffffff");
                confirm.style.color = C("#775549");
                NativeUi.Skin(confirm, "evolve", 30);
                NativeUi.Bind(confirm, () => match.ResolveChoice(0), C("#ffcf70"), C("#ffcf70"), -2);
                NativeUi.Enter(confirm, 0, true);
            }
            var warning = Box(promotionPopup, "promotion-warning", center, 0, 0, 0, "#fff4e3", 20);
            warning.style.top = StyleKeyword.Auto;
            warning.style.bottom = height - y + verticalGap;
            warning.style.width = warning.style.height = StyleKeyword.Auto;
            warning.style.translate = new Translate(Length.Percent(-50), 0);
            warning.style.paddingLeft = warning.style.paddingRight = 14;
            warning.style.paddingTop = warning.style.paddingBottom = 8;
            Border(warning, 2, "#ffffff");
            NativeUi.Skin(warning, "warning", 20);
            var warningStrong = FlowText(warning, "自分の王を捕食します", 12, "#9a4c4e", true);
            warningStrong.style.unityTextAlign = TextAnchor.MiddleCenter;
            warningStrong.style.marginBottom = 4;
            warningStrong.style.minHeight = 20;
            warningStrong.style.whiteSpace = WhiteSpace.NoWrap;
            var warningCopy = FlowText(warning, "", 12, "#9a4c4e");
            warningCopy.style.unityTextAlign = TextAnchor.MiddleCenter;
            warningCopy.style.whiteSpace = WhiteSpace.NoWrap;
            warningCopy.style.minHeight = 20;
            refreshPromotion = () =>
            {
                var captured = pending[choiceIndex].captured;
                var ownKing = captured.Any(p => p.kind == "walrus" && p.owner == match.Viewer);
                warning.style.display = ownKing ? DisplayStyle.Flex : DisplayStyle.None;
                warningStrong.style.display = count == 1 ? DisplayStyle.Flex : DisplayStyle.None;
                warningCopy.text = captured.Any(p => p.kind == "walrus" && p.owner != match.Viewer) ? "両方の王を捕食 → 引き分け" : "自分の王を捕食 → 敗北";
                var warningHeight = warning.layout.height;
                if (!(warningHeight > 0))
                    warningHeight = count == 1 ? 64 : 40;
                foreach (var button in rotationButtons)
                    button.style.top = y - verticalGap - (compact ? 48 : landscape ? 52 : 58) - (ownKing ? warningHeight + verticalGap : 0);

                if (keepControl != null)
                    NativeUi.Skin(keepControl, match.ChoiceColor(0) == match.Data.Config.colors.safe ? "keep" : "promotionDanger", 30, match.Data.Config.colors.danger);
                if (evolveControl != null)
                {
                    var color = match.ChoiceColor(choiceIndex > 0 ? choiceIndex : 1);
                    NativeUi.Skin(evolveControl, color == match.Data.Config.colors.safe ? "evolve" : "promotionDanger", 30, match.Data.Config.colors.danger);
                }
            };
            warning.RegisterCallback<GeometryChangedEvent>(_ => refreshPromotion());
            refreshPromotion();
            var cancel = Button(promotionPopup, "", left + total - cancelWidth, y + (h - cancelWidth) * .5f, cancelWidth, cancelWidth, match.CancelChoice, "#eff8ff");
            Border(cancel, 2, "#ffffff");
            NativeUi.Skin(cancel, "cancel", 22);
            CenteredSymbol(cancel, "x", 20, "#6c8b9d");
            NativeUi.Enter(cancel, .07f, true);
            if (count > 1)
            {
                priorChoiceFocus = root.focusController.focusedElement as VisualElement;
                var current = promotionPopup;
                current.schedule.Execute(() =>
                {
                    if (promotionPopup != current)
                        return;
                    var controls = new List<VisualElement>();
                    FindFocusables(current, controls);
                    if (controls.Count > 0) controls[0].Focus();
                });
            }
        }
    }
}
