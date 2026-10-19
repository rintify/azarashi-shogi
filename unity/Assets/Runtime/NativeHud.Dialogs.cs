using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    public sealed partial class NativeHud
    {
        private VisualElement Modal(string title, float desiredHeight, float maxWidth = 540, bool flow = false)
        {
            var shade = Box(root, "dialog-shade", 0, 0, width, height, "#347ba466", 0, true);
            dialogLayer = shade;
            if (!shade.ClassListContains("dismiss-bound"))
            {
                shade.AddToClassList("dismiss-bound");
                var outside = false;
                shade.RegisterCallback<PointerDownEvent>(evt => outside = evt.target == shade);
                shade.RegisterCallback<PointerUpEvent>(evt =>
                {
                    if (outside && evt.target == shade)
                        match.Close();
                    outside = false;
                });
            }
            var w = DialogWidth(maxWidth);
            var h = Mathf.Min(desiredHeight, height - 24);
            var card = Box(shade, "native-dialog", (width - w) * .5f, (height - h) * .5f, w, h, "#fffcf3", 28, true);
            Border(card, 4, "#ffffff");
            card.style.paddingLeft = card.style.paddingRight = card.style.paddingTop = card.style.paddingBottom = 0;
            NativeUi.Skin(card, "dialog", 28);
            ModalFocus(shade, card);
            card.style.transitionProperty = new List<StylePropertyName> { new StylePropertyName("height"), new StylePropertyName("top") };
            card.style.transitionDuration = new List<TimeValue> { new TimeValue(.28f) };
            if (!flow)
            {
            if (match.Dialog == "settings")
                Icon(card, "seal", false, 24, 18, 44);
            else if (match.Dialog != "rules")
                Symbol(card, match.Dialog == "catalog" ? "book" : match.Dialog == "replays" ? "replay" : "book", 24, 26, 24, "#18394c");
            Text(card, title, match.Dialog == "settings" ? 78 : match.Dialog == "rules" ? 24 : 58, 16, w - 140, 48, 19, "#18394c", true);
            FlatButton(card, "x", w - 64, 20, 40, 40, match.Close, 20);
            }
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
            activeViews.TrackContainer(scroll, "content", scroll.contentContainer);
            scroll.verticalScrollerVisibility = ScrollerVisibility.Auto;
            scroll.horizontalScrollerVisibility = ScrollerVisibility.Hidden;
            scroll.style.position = UnityEngine.UIElements.Position.Absolute;
            scroll.style.left = x;
            scroll.style.top = y;
            // Modal dimensions include their two 4px borders, as CSS border-box does.
            scroll.style.width = w - 8;
            scroll.style.height = h;
            scroll.style.backgroundColor = Color.clear;
            scroll.contentContainer.style.width = Length.Percent(100);
            // Match the 15px Chromium scrollbar measured in the source on Windows.
            var bar = scroll.verticalScroller;
            bar.style.width = 15;
            bar.style.minWidth = 15;
            bar.style.backgroundColor = Color.clear;
            Border(bar, 0, "#ffffff00");
            foreach (var button in new[] { bar.lowButton, bar.highButton })
            {
                button.style.width = 15;
                button.style.height = 15;
                button.style.minHeight = 15;
                button.style.backgroundColor = Color.clear;
                button.style.unityBackgroundImageTintColor = C("#8b8b8b");
                Border(button, 0, "#ffffff00");
            }
            var tracker = bar.slider.Q<VisualElement>(className: "unity-base-slider__tracker");
            if (tracker != null)
            {
                tracker.style.backgroundColor = Color.clear;
                Border(tracker, 0, "#ffffff00");
            }
            var thumb = bar.slider.Q<VisualElement>(className: "unity-base-slider__dragger");
            if (thumb != null)
            {
                thumb.style.width = 9;
                thumb.style.left = 3;
                thumb.style.backgroundColor = C("#8b8b8b");
                Border(thumb, 0, "#ffffff00");
                Round(thumb, 4);
            }
            if (!scroll.ClassListContains("viewport-bound"))
            {
                scroll.AddToClassList("viewport-bound");
                scroll.contentViewport.RegisterCallback<GeometryChangedEvent>(evt =>
                {
                    if (Mathf.Abs(evt.oldRect.width - evt.newRect.width) <= .5f)
                        return;
                    dialogSignature = null;
                    Rebuild();
                });
            }
            return scroll;
        }
        private static float ScrollContentWidth(ScrollView scroll, float fallback)
        {
            var measured = scroll.contentViewport.contentRect.width;
            return measured >= 1 ? Mathf.Min(fallback, measured) : fallback;
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
        private float DialogWidth(float maximum = 540, bool catalog = false) => Mathf.Min(maximum, catalog ? width - 24 : width * .92f, width - 34);
    }
}
