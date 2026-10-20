using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    public sealed partial class NativeHud
    {
        private const int TutorialCount = 20;
        private int tutorialPage;
        private float tutorialPosition, tutorialFrom, tutorialStarted = -10, tutorialWidth;
        private VisualElement tutorialStrip, tutorialViewport;
        private Button tutorialBack, tutorialNext;
        private Label tutorialCounter;
        private readonly List<NativeTutorialInk> tutorialDots = new List<NativeTutorialInk>();
        private readonly List<VisualElement> tutorialPages = new List<VisualElement>();
        private readonly List<Action<float>> tutorialMotion = new List<Action<float>>();
        private readonly List<Action<Vector2>> tutorialTap = new List<Action<Vector2>>();
        private readonly Dictionary<string, Cell[]> tutorialMoves = new Dictionary<string, Cell[]>();
        private int tutorialPointer = -1;
        private bool tutorialDragging;
        private Vector2 tutorialDown;
        private float tutorialDownAt, tutorialDragFrom;
        private static readonly string[] TutorialTitles = {
            "セイウチを つかまえよう", "じぶんの ばんに すること", "もちごまを えらぼう", "なかまの となりに おこう",
            "あおい マスへ うごこう", "かさなったら ぱくっ！", "あいだは とびこせる", "たべたら へんしん！",
            "しろい アザラシ", "くろい アザラシ", "ペンギン", "ジェットペンギン", "シロクマ",
            "まえに ながい シャチ", "よこに ながい シャチ", "シャチの むきを かえる", "おおきな セイウチ",
            "あぶない あいず", "なかまも たべちゃう！", "さあ、あそぼう！"
        };
        private static readonly string[] TutorialCopy = {
            "あいての セイウチを たべたら かち！\nじぶんの セイウチは まもろう。",
            "おく？ それとも、うごかす？\nどちらかを 1かい やったら、\nつぎは あいての ばんだよ。",
            "「持ち駒」の わくを タップ。\nこれは「もちごま」と よむよ。\nひらいたら、おきたい こを えらぼう。",
            "えらんだ こを、あおい マスへ。\nなかまの となりなら、ななめも OK！\nからだが はいる あきマスに おこう。",
            "ばんの どうぶつを タップしよう。\nつぎに あおい マスを タップすると、\nそこへ うごくよ。",
            "ついた ばしょで、からだが すこしでも\nかさなった こは、みんな たべるよ。\nたべた こは もちごまに なるよ。",
            "とおりみちの こまは とびこすよ。\nたべるのは、ついた ばしょの こだけ。\nジェットだけは とびこせないよ。",
            "たべた あとに、すがたを えらべるよ。\nアザラシ・ペンギン・シャチだけ。\nそのままの すがたでも OK。",
            "あいての ほうへ 1マス すすむよ。\nたべると、くろく へんしんできるよ。\nしろには もどれないよ。",
            "まわりの 8マスへ うごけるよ。\nうしろも、ななめも OK！",
            "まわりの 8マスへ うごけるよ。\nたべると ジェットに なれるよ。",
            "まっすぐ まえの、さいしょの こまで！\nこまが なければ、ばんの はしまで。\nとちゅうでは とまれないよ。",
            "2マス はなれた ところへ ジャンプ！\nあおい 16マスへ うごけるよ。\nすぐ となりには いけないよ。",
            "からだが 2マスぶん ながいよ。\nまえ・うしろへ 2、よこへ 1マスまで。\nよこと まえを あわせて うごけるよ。",
            "からだの むきで、うごきも かわるよ。\nよこへ 2、まえ・うしろへ 1マスまで。\nよこと まえを あわせても OK！",
            "たべた マスを ひとつ ふんだまま\nからだの むきを かえられるよ。\nまわった さきの こも、ぱくっ！",
            "4マスの からだが はいる ばしょへ。\nまえ・うしろ・よこへ 2マスまで。\nよこと まえを あわせても うごけるよ。",
            "「！」は たべられるかも、の あいず。\nあぶなくても うごけるけれど、\nセイウチは まもって あげよう！",
            "じぶんの セイウチを たべると まけ。\n1かいで ふたりの セイウチを\nたべたら、ひきわけだよ。",
            "たべた こは、もとの すがたに もどるよ。\nつづきは じどうで のこるよ。\nこの ほんから、また よめるよ。"
        };
        public void ResetTutorial()
        {
            tutorialPage = 0; tutorialPosition = tutorialFrom = 0;
            tutorialStarted = Time.unscaledTime - 1;
            tutorialPointer = -1; tutorialDragging = false; dialogSignature = null;
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
            tutorialNext.text = tutorialPage == TutorialCount - 1 ? "あそぶ！" : "つぎへ";
            tutorialCounter.text = (tutorialPage + 1) + " / " + TutorialCount;
            for (var i = 0; i < tutorialDots.Count; i++)
            {
                tutorialDots[i].Tint = C(i == tutorialPage ? "#207f9c" : "#cadde1");
                tutorialDots[i].MarkDirtyRepaint();
            }
        }
        private void RulesDialog()
        {
            var w = DialogWidth(720);
            var h = Mathf.Min(728, height - 20);
            var card = Modal("", h, 720, true);
            card.style.height = h; card.style.top = (height - h) / 2;
            Text(card, "あそびかた", 18, 9, w - 150, 34, 18, "#18394c", true);
            tutorialCounter = Text(card, "", w - 127, 10, 60, 32, 13, "#658493", false, TextAnchor.MiddleCenter);
            FlatButton(card, "x", w - 58, 7, 40, 40, match.Close, 18).tooltip = "とじる";
            tutorialWidth = w - 32;
            var bodyHeight = h - 153;
            tutorialViewport = Box(card, "howto-viewport", 12, 48, tutorialWidth, bodyHeight, null, 0, true);
            tutorialViewport.style.overflow = Overflow.Hidden;
            tutorialStrip = activeViews.Get(tutorialViewport, "howto-strip", () => new VisualElement { usageHints = UsageHints.GroupTransform });
            tutorialStrip.style.position = UnityEngine.UIElements.Position.Absolute;
            tutorialStrip.style.width = tutorialWidth * TutorialCount;
            tutorialStrip.style.height = bodyHeight;
            tutorialStrip.style.left = tutorialStrip.style.top = 0;
            tutorialPages.Clear(); tutorialMotion.Clear(); tutorialTap.Clear(); tutorialDots.Clear();
            for (var i = 0; i < TutorialCount; i++)
            {
                var page = Box(tutorialStrip, "howto-page-" + i, i * tutorialWidth, 0, tutorialWidth, bodyHeight);
                page.SetEnabled(true);
                tutorialPages.Add(page); BuildTutorialPage(page, i, tutorialWidth, bodyHeight);
            }
            BindTutorialSwipe(tutorialViewport);
            // Square vector canvases draw true circles; no button padding or min-width.
            var spacing = Mathf.Min(14, (w - 48) / TutorialCount);
            for (var i = 0; i < TutorialCount; i++)
                tutorialDots.Add(TutorialInk(card, "dot", (w - spacing * TutorialCount) / 2 + i * spacing, h - 96, 6, 6));
            Text(card, "よこに スワイプでも めくれるよ", 12, h - 85, w - 32, 21, 11, "#698995", false, TextAnchor.MiddleCenter);
            var bw = (w - 56) / 2;
            tutorialBack = Button(card, "まえへ", 18, h - 59, bw, 42, () => TutorialGo(tutorialPage - 1), "#e8f2f4", 14);
            tutorialNext = Button(card, "つぎへ", 30 + bw, h - 59, bw, 42, () => { if (tutorialPage == TutorialCount - 1) match.Close(); else TutorialGo(tutorialPage + 1); }, "#48afc8", 14);
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
                if (!tutorialDragging && delta.magnitude < 8) tutorialTap[tutorialPage]?.Invoke(evt.position);
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
            var t = Mathf.Repeat(Time.unscaledTime - tutorialStarted, 5.2f);
            tutorialMotion[tutorialPage](t);
        }

        private void BuildTutorialPage(VisualElement page, int index, float w, float h)
        {
            var landscape = w > 400 && h < 360;
            var side = Mathf.Min(300, landscape ? h - 8 : Mathf.Min(w - 12, h - 156));
            var gx = landscape ? 4 : (w - side) / 2;
            var gy = landscape ? (h - side) / 2 : 43;
            var tx = landscape ? side + 24 : 4;
            var tw = landscape ? w - tx - 6 : w - 8;
            var title = Text(page, TutorialTitles[index], tx, landscape ? 0 : 1, tw, 36, w < 320 ? 16 : 18, "#254e61", true, TextAnchor.MiddleCenter);
            title.style.whiteSpace = WhiteSpace.Normal;
            var copy = Text(page, TutorialCopy[index], tx, landscape ? 40 : gy + side + 32, tw, landscape ? h - 68 : 78, landscape ? 14 : w < 330 ? 13 : 15, "#34576b", false, TextAnchor.MiddleCenter);
            copy.style.whiteSpace = WhiteSpace.Normal;
            var illustration = Box(page, "howto-picture", gx, gy, side, side, "#eaf3f5", 12);
            Action<float> animate = _ => { };
            Action<Vector2> tap = null;
            var note = "";
            if (index == 8 || index == 9 || index == 10 || index == 12 || index == 13 || index == 14 || index == 16)
            {
                var kind = index <= 9 ? "seal" : index == 10 ? "penguin" : index == 12 ? "bear" : index == 16 ? "walrus" : "orca";
                var promoted = index == 9 || index == 14;
                tap = TutorialRange(illustration, kind, promoted, side);
                note = "あおい まるを タップして ためそう";
            }
            else if (index == 2)
            {
                const float stockSide = 240;
                var stockPicture = Box(illustration, "stock-scale", 0, 0, stockSide, stockSide);
                stockPicture.style.transformOrigin = new TransformOrigin(0, 0);
                stockPicture.style.scale = new Scale(Vector3.one * (side / stockSide));
                var row = Box(stockPicture, "stock-example", 8, stockSide * .7f, stockSide - 16, 40, "#f8fcff", 12);
                Text(row, "持ち駒", 8, 3, 50, 32, 12, "#375775", true);
                var kinds = new[] { "seal", "penguin", "bear", "orca" };
                var step = (stockSide - 90) / 4;
                for (var i = 0; i < 4; i++) Icon(row, kinds[i], false, 61 + i * step, 7, 25);
                var tray = Box(stockPicture, "open-stock", 8, stockSide * .15f, stockSide - 16, stockSide * .49f, "#f8fcff", 12);
                Text(tray, "おく こを えらぼう", 8, 4, stockSide - 32, 26, 13, "#375775", true, TextAnchor.MiddleCenter);
                var unit = (stockSide - 24) / 4;
                for (var i = 0; i < 4; i++) TutorialAnimal(tray, kinds[i], false, 4 + i * unit, 35, unit - 4, unit - 4);
                var ring = TutorialInk(stockPicture, "ring", stockSide * .42f, stockSide * .71f, 34, 34);
                animate = t => { tray.style.opacity = Mathf.SmoothStep(0, 1, Mathf.Clamp01((t - 1) / .35f)); ring.style.opacity = 1 - tray.style.opacity.value; };
            }
            else if (index == 1 || index == 7 || index == 19)
            {
                var unit = side / 3;
                if (index == 1)
                {
                    Text(illustration, "おく", 0, side * .14f, side / 2, 30, 16, "#34576b", true, TextAnchor.MiddleCenter);
                    Text(illustration, "うごかす", side / 2, side * .14f, side / 2, 30, 16, "#34576b", true, TextAnchor.MiddleCenter);
                    TutorialAnimal(illustration, "seal", false, side * .1f, side * .4f, unit, unit);
                    var moving = TutorialAnimal(illustration, "penguin", false, side * .58f, side * .5f, unit, unit);
                    animate = t => moving.style.translate = new Translate(0, -side * .17f * TutorialPhase(t));
                }
                else if (index == 7)
                {
                    TutorialAnimal(illustration, "seal", false, side * .07f, side * .3f, unit, unit);
                    TutorialInk(illustration, "arrow", side * .44f, side * .42f, side * .12f, side * .08f);
                    TutorialAnimal(illustration, "seal", true, side * .60f, side * .3f, unit, unit);
                    Text(illustration, "すがたを えらぼう", 0, side * .76f, side, 28, 14, "#34576b", true, TextAnchor.MiddleCenter);
                }
                else
                {
                    var book = Symbol(illustration, "book", side * .32f, side * .2f, side * .36f, "#287e99");
                    Text(illustration, "あそびかたの ボタン", 0, side * .7f, side, 26, 13, "#34576b", true, TextAnchor.MiddleCenter);
                }
            }
            else
            {
                var n = index == 0 || index == 3 || index == 5 || index == 15 || index == 18 ? 6 : 5;
                var cell = side / n;
                var places = index == 3 ? NativeHowTo.Placements(match.Engine, match.Data.Config.initial.rulesVersion) : Array.Empty<Cell>();
                TutorialBoard(illustration, n, side, (x, y) => index == 4 ? x == 2 && y == 2 : index == 3 && places.Any(c => c.x - 2 == x && c.y - 2 == y));
                if (index == 0)
                {
                    var victim = TutorialAnimal(illustration, "walrus", false, 3 * cell, 0, 2 * cell, 2 * cell, true);
                    var hero = TutorialAnimal(illustration, "walrus", false, cell, 3 * cell, 2 * cell, 2 * cell);
                    animate = t => { var p = TutorialPhase(t); hero.style.translate = new Translate(cell * p, -2 * cell * p); victim.style.opacity = 1 - p; };
                    note = "あかい わくは あいての こま";
                }
                else if (index == 3)
                {
                    TutorialAnimal(illustration, "walrus", false, 2 * cell, 2 * cell, 2 * cell, 2 * cell);
                    var placed = TutorialAnimal(illustration, "seal", false, cell, cell, cell, cell);
                    animate = t => placed.style.opacity = TutorialPhase(t);
                    note = "あおは アザラシを おける ばしょ";
                }
                else if (index == 4)
                {
                    var hero = TutorialAnimal(illustration, "seal", false, 2 * cell, 3 * cell, cell, cell);
                    animate = t => hero.style.translate = new Translate(0, -cell * TutorialPhase(t));
                    note = "れい：アザラシを 1マス まえへ";
                }
                else if (index == 5 || index == 18)
                {
                    var king = index == 18;
                    NativeHowTo.Capture(match.Engine, match.Data.Config.initial.rulesVersion, king);
                    var one = TutorialAnimal(illustration, king ? "walrus" : "seal", false, 2 * cell, (king ? 0 : 1) * cell, (king ? 2 : 1) * cell, (king ? 2 : 1) * cell, !king);
                    var two = king ? null : TutorialAnimal(illustration, "penguin", false, 2 * cell, 2 * cell, cell, cell, true);
                    var hero = TutorialAnimal(illustration, "orca", false, 2 * cell, 3 * cell, cell, 2 * cell);
                    animate = t => { var p = TutorialPhase(t); hero.style.translate = new Translate(0, -2 * cell * p); one.style.opacity = p > .98f ? .1f : 1; if (two != null) two.style.opacity = p > .98f ? .1f : 1; };
                    note = king ? "あおい わくは じぶんの なかま" : "からだの 2マスで、2ひき まとめて！";
                }
                else if (index == 6)
                {
                    TutorialAnimal(illustration, "seal", false, 2 * cell, 2 * cell, cell, cell, true);
                    var hero = TutorialAnimal(illustration, "bear", false, 2 * cell, 3 * cell, cell, cell);
                    animate = t => { var p = TutorialPhase(t); hero.style.translate = new Translate(0, -2 * cell * p); hero.style.scale = new Scale(Vector3.one * (1 + .2f * Mathf.Sin(p * Mathf.PI))); };
                    note = "とびこした アザラシは のこるよ";
                }
                else if (index == 11)
                {
                    var victim = TutorialAnimal(illustration, "bear", false, 2 * cell, cell, cell, cell, true);
                    var hero = TutorialAnimal(illustration, "penguin", true, 2 * cell, 4 * cell, cell, cell);
                    var goal = TutorialInk(illustration, "ring", 2 * cell + 3, cell + 3, cell - 6, cell - 6);
                    animate = t => { var p = TutorialPhase(t); hero.style.translate = new Translate(0, -3 * cell * p); victim.style.opacity = 1 - p; };
                    note = "また たべたら、もとの すがたにも！";
                }
                else if (index == 15)
                {
                    // Rust validates the initial capture, pivot, final footprint and L-shaped capture union.
                    var example = NativeHowTo.Rotation(match.Engine, match.Data.Config.initial.rulesVersion);
                    var victim = TutorialAnimal(illustration, "seal", false, 2 * cell, cell, cell, cell, true);
                    var extra = TutorialAnimal(illustration, "penguin", false, 3 * cell, cell, cell, cell, true);
                    var hero = TutorialAnimal(illustration, "orca", false, 2 * cell, 3 * cell, cell, 2 * cell);
                    hero.style.transformOrigin = new TransformOrigin(cell * .5f, cell * .5f);
                    var final = TutorialAnimal(illustration, "orca", true, (example.piece.at.x - 2) * cell, (example.piece.at.y - 2) * cell, 2 * cell, cell);
                    var pivot = TutorialInk(illustration, "ring", 2 * cell + 3, cell + 3, cell - 6, cell - 6); pivot.Tint = C("#d49a26");
                    animate = t => {
                        var p = TutorialPhase(t);
                        var r = Mathf.SmoothStep(0, 1, Mathf.Clamp01((t - 2.8f) / .65f));
                        var blend = Mathf.SmoothStep(0, 1, Mathf.Clamp01((t - 3.45f) / .25f));
                        hero.style.translate = new Translate(0, -2 * cell * p);
                        hero.style.rotate = new Rotate(-90 * r);
                        hero.style.opacity = 1 - blend; final.style.opacity = blend;
                        victim.style.opacity = 1 - Mathf.Clamp01((p - .85f) / .15f);
                        extra.style.opacity = 1 - Mathf.Clamp01((r - .6f) / .4f);
                    };
                    note = "きいろの マスを はなさずに まわる";
                }
                else
                {
                    TutorialAnimal(illustration, "bear", false, cell, 0, cell, cell, true);
                    TutorialAnimal(illustration, "walrus", false, cell, 2 * cell, 2 * cell, 2 * cell);
                    var badge = Box(illustration, "danger-badge", 3 * cell, 2 * cell, cell * .7f, cell * .7f, "#d56b37", cell);
                    Text(badge, "!", 0, 0, cell * .7f, cell * .7f, 22, "#ffffff", true, TextAnchor.MiddleCenter);
                    note = "あいての シロクマが とどく ばしょだよ";
                }
            }
            if (note.Length > 0)
            {
                var caption = Text(page, note, landscape ? tx : 0, landscape ? h - 24 : gy + side + 4, landscape ? tw : w, 24, 11, "#517588", false, TextAnchor.MiddleCenter);

            }
            tutorialMotion.Add(animate); tutorialTap.Add(tap);
        }
        private static float TutorialPhase(float t) => Mathf.SmoothStep(0, 1, Mathf.Clamp01((t - 1.1f) / 1.2f));
        private NativeTutorialInk TutorialInk(VisualElement parent, string shape, float x, float y, float w, float h)
        {
            var ink = activeViews.Get(parent, "ink-" + shape, () => new NativeTutorialInk());
            ink.Shape = shape; ink.Tint = C("#2485a0");
            ink.style.position = UnityEngine.UIElements.Position.Absolute;
            ink.style.left = x; ink.style.top = y; ink.style.width = w; ink.style.height = h;
            ink.MarkDirtyRepaint(); return ink;
        }
        private void TutorialBoard(VisualElement parent, int count, float size, Func<int, int, bool> highlighted)
        {
            var cell = size / count;
            for (var y = 0; y < count; y++) for (var x = 0; x < count; x++)
            {
                Box(parent, "tile", x * cell + .5f, y * cell + .5f, cell - 1, cell - 1, highlighted(x, y) ? "#99d9e5" : (x + y) % 2 == 0 ? "#e6f2f5" : "#d7e9ee");
                if (highlighted(x, y)) TutorialInk(parent, "dot", (x + .5f) * cell - 3, (y + .5f) * cell - 3, 6, 6);
            }
        }
        private VisualElement TutorialAnimal(VisualElement parent, string kind, bool promoted, float x, float y, float w, float h, bool enemy = false)
        {
            // The body has no CSS border: its local origin is the footprint origin.
            // Stroke and icon share this coordinate system, avoiding border/padding offsets.
            var animal = Box(parent, "piece", x, y, w, h);
            animal.style.opacity = 1; animal.style.translate = new Translate(0, 0); animal.style.rotate = new Rotate(0); animal.style.scale = new Scale(Vector3.one);
            var frame = TutorialInk(animal, "body", 0, 0, w, h);
            frame.Tint = C(enemy ? "#ca726b" : "#4399b2"); frame.Fill = C(enemy ? "#fbe3df" : "#fff9e9");
            var size = Mathf.Min(w, h) * .80f;
            Icon(animal, kind, promoted, (w - size) / 2, (h - size) / 2, size);
            return animal;
        }
        private Action<Vector2> TutorialRange(VisualElement parent, string kind, bool promoted, float side)
        {
            var key = kind + promoted;
            if (!tutorialMoves.TryGetValue(key, out var destinations))
            {
                destinations = NativeHowTo.Destinations(match.Engine, match.Data.Config.initial.rulesVersion, kind, promoted);
                tutorialMoves[key] = destinations;
            }
            var across = kind == "walrus" || kind == "orca" && promoted ? 2 : 1;
            var down = kind == "walrus" || kind == "orca" && !promoted ? 2 : 1;
            var count = across > 1 || down > 1 ? 6 : 5;
            var cell = side / count;
            TutorialBoard(parent, count, side, (x, y) => across == 1 && down == 1 && destinations.Any(p => p.x - 2 == x && p.y - 2 == y));
            var origin = TutorialAnimal(parent, kind, promoted, 2 * cell, 2 * cell, across * cell, down * cell);
            var arrow = TutorialInk(parent, "travel", 0, 0, side, side);
            arrow.style.opacity = 0;
            var preview = TutorialAnimal(parent, kind, promoted, 0, 0, across * cell, down * cell);
            preview.style.opacity = 0;
            foreach (var dest in destinations)
            {
                var point = NativeHowTo.Center(dest, across, down, 2);
                TutorialInk(parent, "dot", point.x * cell - 3.5f, point.y * cell - 3.5f, 7, 7);
            }
            return world => {
                var p = parent.WorldToLocal(world);
                Cell nearest = null; var distance = cell * .48f;
                foreach (var dest in destinations)
                {
                    var center = NativeHowTo.Center(dest, across, down, 2) * cell;
                    var d = Vector2.Distance(p, center);
                    if (d < distance) { distance = d; nearest = dest; }
                }
                if (nearest == null) return;
                preview.style.left = (nearest.x - 2) * cell; preview.style.top = (nearest.y - 2) * cell;
                origin.style.opacity = .3f;
                preview.style.opacity = 1;
                arrow.Start = new Vector2((2 + across * .5f) * cell, (2 + down * .5f) * cell);
                arrow.End = NativeHowTo.Center(nearest, across, down, 2) * cell;
                arrow.style.opacity = 1; arrow.MarkDirtyRepaint();
            };
        }
    }
}
