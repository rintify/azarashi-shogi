using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    public sealed partial class NativeHud
    {
        private const int TutorialCount = 11;
        private int tutorialPage;
        private float tutorialPosition, tutorialFrom, tutorialStarted = -10, tutorialWidth;
        private VisualElement tutorialStrip, tutorialViewport;
        private Button tutorialBack, tutorialNext;
        private Label tutorialCounter;
        private readonly List<Button> tutorialDots = new List<Button>();
        private readonly List<VisualElement> tutorialPages = new List<VisualElement>();
        private readonly List<Action<float>> tutorialMotion = new List<Action<float>>();
        private readonly Dictionary<string, Cell[]> tutorialMoves = new Dictionary<string, Cell[]>();
        private int tutorialPointer = -1;
        private bool tutorialDragging;
        private Vector2 tutorialDown;
        private float tutorialDownAt, tutorialDragFrom;
        private static readonly string[] TutorialTitles = {
            "セイウチを つかまえよう", "タップして、すすもう", "なかまを ならべよう",
            "かさなったら、ぱくっ！", "アザラシは へんしん！", "ペンギンは ジェットに！",
            "シロクマは ジャンプ！", "シャチは くるっと！", "セイウチは 2 × 2 マス",
            "「！」に きをつけて！", "さあ、あそんでみよう！"
        };
        private static readonly string[] TutorialCopy = {
            "あいての セイウチを\nたべたら かち！\nじぶんの セイウチは\nまもってね。",
            "どうぶつを タップ！\nあおいマスを えらぶと\nそこへ うごくよ。\nつぎは あいての ばん。",
            "したの「もちごま」を\nタップして えらぼう。\nなかまの となりの\nあいたマスへ おけるよ。\nななめの となりも OK！",
            "あいだは とびこえて、\nついたら まとめて ぱくっ！\nたべた こは もとの すがたで\nもちごまに なるよ。\nなかまも たべるから\nきをつけてね。",
            "しろは まえへ 1マス。\nたべて くろに なると、\nまわりへ 1マス！\nへんしんするかは えらべるよ。",
            "ふだんは まわりへ 1マス。\nたべると ジェットにも！\nまえの こまか はしまで とぶ！\nまた たべたら\nもとの すがたにも なれるよ。",
            "2マス はなれた マスへ\nジャンプ！\nあいだの こまは とびこすよ。\nすがたは かわらないよ。",
            "たてなら よこ1・たて2マス。\nよこなら よこ2・たて1マス。\nたべた マスを ふんだまま\nくるっと むきを かえよう！",
            "たて・よこ・ななめに\n2マスまで うごけるよ。\nからだが ぜんぶ はいる\nばしょへ うごかそう。",
            "「！」は あぶない あいず。\nつぎに たべられるかも！\nあぶなくても うごけるよ。\nじぶんの セイウチを\nたべると まけ！",
            "セイウチを ふたりとも\nたべると ひきわけ。\nつづきは じどうで のこるよ。\nこまったら みぎうえの\nほんを タップしてね！"
        };
        public void ResetTutorial()
        {
            tutorialPage = 0;
            tutorialPosition = tutorialFrom = 0;
            tutorialStarted = Time.unscaledTime - 1;
            tutorialPointer = -1;
            tutorialDragging = false;
            dialogSignature = null;
        }
        private void TutorialGo(int page)
        {
            tutorialFrom = tutorialPosition;
            tutorialPage = Mathf.Clamp(page, 0, TutorialCount - 1);
            tutorialStarted = Time.unscaledTime;
            UpdateTutorialControls();
        }
        private void UpdateTutorialControls()
        {
            if (tutorialBack == null) return;
            tutorialBack.SetEnabled(tutorialPage > 0);
            tutorialNext.text = tutorialPage == TutorialCount - 1 ? "あそぶ！" : "つぎ →";
            tutorialCounter.text = (tutorialPage + 1) + " / " + TutorialCount;
            for (var i = 0; i < tutorialDots.Count; i++)
            {
                NativeUi.Colors(tutorialDots[i], C(i == tutorialPage ? "#298aa4" : "#c7dee4"), C("#80c5d1"));
                tutorialDots[i].tooltip = (i + 1) + ". " + TutorialTitles[i];
            }
            for (var i = 0; i < tutorialPages.Count; i++) tutorialPages[i].SetEnabled(i == tutorialPage);
        }
        private void RulesDialog()
        {
            var w = DialogWidth(660);
            var h = Mathf.Min(660, height - 24);
            var card = Modal("", h, 660, true);
            // Unlike measured scrolling dialogs this deck has a fixed viewport.
            // Reapply its bounds on rotation instead of retaining the old height.
            card.style.height = h;
            card.style.top = (height - h) / 2;
            Text(card, "あそびかた", 20, 15, w - 150, 36, 19, "#18394c", true);
            tutorialCounter = Text(card, "", w - 126, 17, 58, 32, 12, "#658493", false, TextAnchor.MiddleCenter);
            FlatButton(card, "x", w - 60, 14, 40, 40, match.Close, 18).tooltip = "あとで あそびかたを みる";
            tutorialWidth = w - 32;
            var bodyHeight = h - 166;
            tutorialViewport = Box(card, "howto-viewport", 12, 60, tutorialWidth, bodyHeight, null, 16, true);
            tutorialViewport.style.overflow = Overflow.Hidden;
            tutorialStrip = activeViews.Get(tutorialViewport, "howto-strip", () => new VisualElement { usageHints = UsageHints.GroupTransform });
            tutorialStrip.style.position = UnityEngine.UIElements.Position.Absolute;
            tutorialStrip.style.width = tutorialWidth * TutorialCount;
            tutorialStrip.style.height = bodyHeight;
            tutorialStrip.style.left = tutorialStrip.style.top = 0;
            tutorialPages.Clear(); tutorialMotion.Clear(); tutorialDots.Clear();
            for (var i = 0; i < TutorialCount; i++)
            {
                var page = Box(tutorialStrip, "howto-page-" + i, i * tutorialWidth, 0, tutorialWidth, bodyHeight);
                tutorialPages.Add(page);
                BuildTutorialPage(page, i, tutorialWidth, bodyHeight);
            }
            BindTutorialSwipe(tutorialViewport);
            Text(card, "← よこに スワイプ →", 20, h - 104, w - 48, 21, 11, "#698995", false, TextAnchor.MiddleCenter);
            var dotSpacing = Mathf.Min(23, (w - 70) / TutorialCount);
            var dotsX = (w - dotSpacing * TutorialCount) / 2 - 4;
            for (var i = 0; i < TutorialCount; i++)
            {
                var index = i;
                var dot = Button(card, "", dotsX + i * dotSpacing, h - 83, 18, 10, () => TutorialGo(index), "#c7dee4");
                NoSkin(dot); Border(dot, 0, "#ffffff00"); Round(dot, 9);
                tutorialDots.Add(dot);
            }
            var buttonWidth = (w - 56) / 2;
            tutorialBack = Button(card, "← まえ", 18, h - 62, buttonWidth, 44, () => TutorialGo(tutorialPage - 1), "#e8f2f4", 13);
            tutorialNext = Button(card, "つぎ →", 30 + buttonWidth, h - 62, buttonWidth, 44, () => { if (tutorialPage == TutorialCount - 1) match.Close(); else TutorialGo(tutorialPage + 1); }, "#48afc8", 14);
            tutorialNext.style.color = Color.white;
            NativeUi.Bind(tutorialNext, () => { if (tutorialPage == TutorialCount - 1) match.Close(); else TutorialGo(tutorialPage + 1); }, C("#48afc8"), C("#65c0d3"));
            UpdateTutorialControls();
        }
        private void BindTutorialSwipe(VisualElement viewport)
        {
            if (viewport.ClassListContains("howto-swipe")) return;
            viewport.AddToClassList("howto-swipe");
            viewport.RegisterCallback<PointerDownEvent>(evt =>
            {
                if (match.Dialog != "rules" || evt.button != 0) return;
                if (tutorialPointer >= 0) return;
                tutorialPointer = evt.pointerId; tutorialDown = evt.position;
                tutorialDownAt = Time.unscaledTime; tutorialDragFrom = tutorialPosition;
                tutorialDragging = false;
                viewport.CapturePointer(evt.pointerId);
                evt.StopPropagation();
            });
            viewport.RegisterCallback<PointerMoveEvent>(evt =>
            {
                if (tutorialPointer != evt.pointerId || match.Dialog != "rules") return;
                var delta = (Vector2)evt.position - tutorialDown;
                if (!tutorialDragging && Mathf.Abs(delta.x) > 8 && Mathf.Abs(delta.x) > Mathf.Abs(delta.y)) tutorialDragging = true;
                if (tutorialDragging)
                {
                    var target = tutorialDragFrom - delta.x / tutorialWidth;
                    tutorialPosition = target < 0 ? target * .2f : target > TutorialCount - 1 ? TutorialCount - 1 + (target - TutorialCount + 1) * .2f : target;
                    evt.StopPropagation();
                }
            });
            viewport.RegisterCallback<PointerUpEvent>(evt =>
            {
                if (tutorialPointer != evt.pointerId) return;
                var delta = (Vector2)evt.position - tutorialDown;
                var next = NativeHowTo.SwipePage(tutorialPage, TutorialCount, delta.x, delta.y, Time.unscaledTime - tutorialDownAt, tutorialWidth);
                tutorialPointer = -1; tutorialDragging = false;
                viewport.ReleasePointer(evt.pointerId);
                TutorialGo(next); evt.StopPropagation();
            });
            viewport.RegisterCallback<PointerCancelEvent>(evt =>
            {
                if (tutorialPointer != evt.pointerId) return;
                tutorialPointer = -1; tutorialDragging = false;
                viewport.ReleasePointer(evt.pointerId); TutorialGo(tutorialPage);
            });
            viewport.RegisterCallback<PointerCaptureOutEvent>(evt =>
            {
                if (tutorialPointer != evt.pointerId) return;
                tutorialPointer = -1; tutorialDragging = false; TutorialGo(tutorialPage);
            });
        }
        private void TickTutorial()
        {
            if (match.Dialog != "rules" || tutorialStrip == null || tutorialStrip.panel == null) return;
            if (!tutorialDragging) tutorialPosition = Mathf.Lerp(tutorialFrom, tutorialPage, NativeUi.Ease(Mathf.Clamp01((Time.unscaledTime - tutorialStarted) / .28f)));
            tutorialStrip.style.translate = new Translate(-tutorialPosition * tutorialWidth, 0);
            var t = Mathf.Repeat(Time.unscaledTime - tutorialStarted, 3.4f);
            tutorialMotion[tutorialPage](t);
        }
        private void BuildTutorialPage(VisualElement page, int index, float w, float h)
        {
            var landscape = w > 450 && h < 340;
            var side = Mathf.Min(268, landscape ? h - 16 : Mathf.Min(w - 28, h - (w < 330 ? 220 : 190)));
            var gx = landscape ? 8 : (w - side) / 2;
            var gy = landscape ? (h - side) / 2 : 70;
            var tx = landscape ? side + 28 : 14;
            var tw = landscape ? w - tx - 14 : w - 28;
            var title = Text(page, TutorialTitles[index], tx, landscape ? 12 : 0, tw, 60, landscape ? 18 : w < 300 ? 17 : 19, "#254e61", true, TextAnchor.MiddleCenter);
            title.style.whiteSpace = WhiteSpace.Normal;
            var copy = Text(page, TutorialCopy[index], tx, landscape ? 76 : gy + side + 13, tw, landscape ? h - 82 : h - gy - side - 14, landscape ? 13 : w < 330 ? 15 : 16, "#466979", false, TextAnchor.MiddleCenter);
            copy.style.whiteSpace = WhiteSpace.Normal;
            var illustration = Box(page, "howto-picture", gx, gy, side, side, "#e9f4f6", 18);
            Action<float> animate = _ => { };
            if (index == 4 || index == 5)
            {
                var mini = (side - 12) / 2;
                var left = Box(illustration, "before", 0, side * .2f, mini, mini);
                var right = Box(illustration, "after", mini + 12, side * .2f, mini, mini);
                var kind = index == 4 ? "seal" : "penguin";
                TutorialRange(left, kind, false, mini, 5);
                if (index == 4) TutorialRange(right, kind, true, mini, 5);
                else
                {
                    TutorialBoard(right, 5, mini, (x, y) => x == 2 && y >= 1 && y < 4);
                    TutorialAnimal(right, "bear", false, 2, 1, 1, 1, mini / 5, true);
                    var jet = TutorialAnimal(right, "penguin", true, 2, 4, 1, 1, mini / 5);
                    animate = t => jet.style.translate = new Translate(0, -3 * mini / 5 * TutorialPhase(t));
                }
                Text(illustration, index == 4 ? "しろ" : "ふだん", 0, side * .2f - 28, mini, 24, 12, "#466979", true, TextAnchor.MiddleCenter);
                Text(illustration, index == 4 ? "くろ" : "ジェット", mini + 12, side * .2f - 28, mini, 24, 12, "#466979", true, TextAnchor.MiddleCenter);
                Text(illustration, "たべると →", 0, side * .82f, side, 25, 13, "#508995", true, TextAnchor.MiddleCenter);
            }
            else if (index == 6 || index == 8)
            {
                var kind = index == 6 ? "bear" : "walrus";
                TutorialRange(illustration, kind, false, side, index == 6 ? 5 : 6);
            }
            else if (index == 7)
            {
                var cell = side / 6;
                TutorialBoard(illustration, 6, side, (x, y) => x >= 1 && x <= 3 && y >= 1 && y <= 4 && !(x == 2 && y == 3));
                var before = Box(illustration, "orca-before", 2 * cell + 2, cell + 2, cell - 4, 2 * cell - 4, "#59afc360", 8);
                var after = Box(illustration, "orca-after", 2 * cell + 2, cell + 2, 2 * cell - 4, cell - 4, "#a28be58c", 8);
                var orca = TutorialAnimal(illustration, "orca", false, 2, 3, 1, 2, cell);
                orca.style.transformOrigin = new TransformOrigin((cell - 4) / 2, (cell - 4) / 2);
                var food = TutorialAnimal(illustration, "seal", false, 2, 1, 1, 1, cell, true);
                animate = t => {
                    var p = TutorialPhase(t);
                    orca.style.translate = new Translate(0, -2 * cell * p);
                    orca.style.rotate = new Rotate(-90 * Mathf.SmoothStep(0, 1, Mathf.Clamp01((t - 1.6f) / .45f)));
                    food.style.opacity = p > .95f ? 0 : 1;
                    after.style.opacity = p > .95f ? 1 : 0;
                };
            }
            else if (index == 10)
            {
                var cell = side / 5;
                TutorialBoard(illustration, 5, side, (x, y) => false);
                TutorialAnimal(illustration, "walrus", false, 1.5f, .5f, 2, 2, cell);
                var kinds = new[] { "seal", "penguin", "bear", "orca" };
                for (var n = 0; n < kinds.Length; n++) TutorialAnimal(illustration, kinds[n], false, .1f + n * 1.2f, 3.3f, 1, 1, cell);
            }
            else
            {
                var n = index == 0 || index == 2 ? 6 : 5;
                var cell = side / n;
                TutorialBoard(illustration, n, side, (x, y) => index == 1 ? x == 2 && y == 2 : index == 2 ? x >= 1 && x <= 4 && y >= 2 && !(x >= 2 && x <= 3 && y >= 3 && y <= 4) : false);
                if (index == 0)
                {
                    var enemy = TutorialAnimal(illustration, "walrus", false, 3, 0, 2, 2, cell, true);
                    var hero = TutorialAnimal(illustration, "walrus", false, 1, 3, 2, 2, cell);
                    animate = t => { var p = TutorialPhase(t); hero.style.translate = new Translate(cell * p, -2 * cell * p); enemy.style.opacity = p > .96f ? .15f : 1; };
                }
                else if (index == 1)
                {
                    var hero = TutorialAnimal(illustration, "seal", false, 2, 3, 1, 1, cell);
                    animate = t => hero.style.translate = new Translate(0, -cell * TutorialPhase(t));
                    Text(illustration, "↑ すすむほう", 0, 4, side, 23, 11, "#557f8e", true, TextAnchor.MiddleCenter);
                }
                else if (index == 2)
                {
                    TutorialAnimal(illustration, "walrus", false, 2, 3, 2, 2, cell);
                    var placed = TutorialAnimal(illustration, "seal", false, 2, 2, 1, 1, cell);
                    animate = t => placed.style.opacity = Mathf.SmoothStep(0, 1, Mathf.Clamp01((t - .7f) * 2));
                    Text(illustration, "もちごま →", 8, 4, side - 16, 24, 12, "#557f8e", true);
                    Icon(illustration, "seal", false, side - cell - 8, 4, cell);
                }
                else if (index == 3)
                {
                    var one = TutorialAnimal(illustration, "seal", false, 2, 1, 1, 1, cell, true);
                    var two = TutorialAnimal(illustration, "penguin", false, 2, 2, 1, 1, cell, true);
                    var hero = TutorialAnimal(illustration, "orca", false, 2, 3, 1, 2, cell);
                    animate = t => { var p = TutorialPhase(t); hero.style.translate = new Translate(0, -2 * cell * p); one.style.opacity = two.style.opacity = p > .96f ? .1f : 1; };
                }
                else
                {
                    TutorialAnimal(illustration, "bear", false, 1, 0, 1, 1, cell, true);
                    TutorialAnimal(illustration, "walrus", false, 1, 2, 2, 2, cell);
                    var danger = Box(illustration, "warning", cell + 2, 2 * cell + 2, 2 * cell - 4, 2 * cell - 4, "#e9786f55", 10);
                    Text(illustration, "！", 3 * cell, 2 * cell, cell, cell, 32, "#d6575d", true, TextAnchor.MiddleCenter);
                    animate = t => danger.style.opacity = .5f + .5f * Mathf.Sin(t * 3) * Mathf.Sin(t * 3);
                }
            }
            tutorialMotion.Add(animate);
        }
        private static float TutorialPhase(float t) => Mathf.SmoothStep(0, 1, Mathf.Clamp01((t - .65f) / .85f));
        private void TutorialBoard(VisualElement parent, int count, float size, Func<int, int, bool> highlighted)
        {
            var cell = size / count;
            for (var y = 0; y < count; y++) for (var x = 0; x < count; x++)
            {
                var fill = highlighted(x, y) ? "#93d5e1" : (x + y) % 2 == 0 ? "#e8f4f5" : "#dbecef";
                var square = Box(parent, "tile", x * cell, y * cell, cell, cell, fill, 0);
                Border(square, .5f, "#b6d0d8");
                if (highlighted(x, y)) Box(square, "dot", cell * .41f, cell * .41f, cell * .18f, cell * .18f, "#2589a4", cell);
            }
        }
        private VisualElement TutorialAnimal(VisualElement parent, string kind, bool promoted, float x, float y, int across, int down, float cell, bool enemy = false)
        {
            var animal = Box(parent, "piece", x * cell + 2, y * cell + 2, across * cell - 4, down * cell - 4, enemy ? "#f9ded8e8" : "#fdf8e9eb", 10);
            Border(animal, 2, enemy ? "#d47770" : "#4b9fb7");
            var size = Mathf.Min(across, down) * cell * .84f;
            Icon(animal, kind, promoted, (across * cell - 4 - size) / 2, (down * cell - 4 - size) / 2, size);
            return animal;
        }
        private void TutorialRange(VisualElement parent, string kind, bool promoted, float side, int count)
        {
            var key = kind + promoted;
            if (!tutorialMoves.TryGetValue(key, out var destinations))
            {
                destinations = NativeHowTo.Destinations(match.Engine, match.Data.Config.initial.rulesVersion, kind, promoted);
                tutorialMoves[key] = destinations;
            }
            TutorialBoard(parent, count, side, (x, y) => Array.Exists(destinations, p => p.x - 2 == x && p.y - 2 == y));
            var across = kind == "walrus" ? 2 : 1;
            TutorialAnimal(parent, kind, promoted, 2, 2, across, across, side / count);
        }
    }
}
