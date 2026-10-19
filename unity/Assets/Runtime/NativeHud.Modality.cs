using System.Collections.Generic;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    public sealed partial class NativeHud
    {
        private string focusedDialog;
        private VisualElement priorModalFocus;
        private void ModalFocus(VisualElement shade, VisualElement card)
        {
            if (!shade.ClassListContains("modal-keys"))
            {
                shade.AddToClassList("modal-keys");
                shade.RegisterCallback<KeyDownEvent>(evt =>
                {
                    if (match.Dialog == "catalog" && (evt.keyCode == UnityEngine.KeyCode.LeftArrow || evt.keyCode == UnityEngine.KeyCode.RightArrow))
                        ChangeCatalog(evt.keyCode == UnityEngine.KeyCode.LeftArrow ? -1 : 1);
                    else if (evt.keyCode == UnityEngine.KeyCode.Tab)
                        CycleFocus(card, evt.shiftKey);
                    else
                        return;
                    evt.StopImmediatePropagation();
                    root.focusController.IgnoreEvent(evt);
                }, TrickleDown.TrickleDown);
            }
            if (focusedDialog == match.Dialog)
                return;
            if (focusedDialog == null)
                priorModalFocus = root.focusController?.focusedElement as VisualElement;
            focusedDialog = match.Dialog;
            var current = focusedDialog;
            card.schedule.Execute(() =>
            {
                if (match.Dialog != current)
                    return;
                var controls = new List<VisualElement>();
                FindFocusables(card, controls);
                if (controls.Count > 0)
                    controls[0].Focus();
            });
        }
        private void RestoreModalFocus()
        {
            if (match.Dialog != null || focusedDialog == null)
                return;
            if (focusedDialog == "replays")
                replayWarning = null;
            focusedDialog = null;
            priorModalFocus?.Focus();
            priorModalFocus = null;
        }
        private static void FindFocusables(VisualElement parent, List<VisualElement> result)
        {
            foreach (var child in parent.Children())
            {
                if (!child.enabledInHierarchy || child.resolvedStyle.display == DisplayStyle.None)
                    continue;
                if ((child is Button || child is NativeSlider) && child.focusable && child.tabIndex >= 0)
                    result.Add(child);
                if (!(child is Scroller))
                    FindFocusables(child, result);
            }
        }
        private void CycleFocus(VisualElement card, bool backwards)
        {
            var controls = new List<VisualElement>();
            FindFocusables(card, controls);
            if (controls.Count == 0)
                return;
            var current = controls.IndexOf(root.focusController.focusedElement as VisualElement);
            controls[(current + (backwards ? -1 : 1) + controls.Count) % controls.Count].Focus();
        }
    }
}
