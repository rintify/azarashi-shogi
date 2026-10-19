using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    public sealed partial class NativeHud
    {
        private readonly HashSet<string> visibleMarks = new HashSet<string>();
        private readonly Dictionary<string, float> exitingMarks = new Dictionary<string, float>();
        private void UpdateMarkers()
        {
            var show = !gridOpen && !match.Busy && !match.Thinking && match.Dialog == null && match.HumanTurn;
            var desired = new HashSet<string>();
            if (show)
                foreach (var entry in match.Marks)
                {
                    var piece = match.State.pieces.FirstOrDefault(p => p.id == entry.Key);
                    if (piece == null)
                        continue;
                    desired.Add(piece.id);
                    if (!markNodes.TryGetValue(piece.id, out var mark))
                    {
                        mark = Box(markers, "native-piece-mark", 0, 0, 25, 25, null, 13);
                        markNodes[piece.id] = mark;
                    }
                    if (mark.userData as string != entry.Value)
                    {
                        mark.userData = entry.Value;
                        NativeUi.ClearChildren(mark);
                        mark.style.backgroundColor = C(entry.Value == "king" ? "#f7cc61" : entry.Value == "helper" ? "#bce7ce" : entry.Value == "trapped" ? "#8f2038" : "#d56b37");
                        Border(mark, 2, entry.Value == "king" ? "#fff9df" : entry.Value == "helper" ? "#edfff2" : entry.Value == "trapped" ? "#ffe1e7" : "#fff3e7");
                        if (entry.Value == "danger")
                        {
                            var copy = Text(mark, "!", 0, 0, 21, 21, 16, "#ffffff", true, TextAnchor.MiddleCenter);
                            NativeUi.Center(copy);
                        }
                        else
                            CenteredSymbol(mark, entry.Value == "king" ? "crown" : entry.Value == "trapped" ? "x-mark" : "helper", 18, entry.Value == "king" ? "#785122" : entry.Value == "helper" ? "#206c53" : "#ffffff");
                        NativeUi.Skin(mark, entry.Value, 12.5f);
                    }
                    if (!visibleMarks.Contains(piece.id))
                        NativeUi.Enter(mark);
                    exitingMarks.Remove(piece.id);
                    mark.style.display = DisplayStyle.Flex;
                    var anchor = match.Board.Marker(piece.id);
                    mark.style.left = anchor.x / uiScale + 8 - 12.5f;
                    mark.style.top = (Screen.height - anchor.y) / uiScale - 8 - 12.5f;
                }
            foreach (var id in visibleMarks)
                if (!desired.Contains(id) && markNodes.TryGetValue(id, out var mark))
                {
                    exitingMarks[id] = Time.unscaledTime;
                    NativeUi.Exit(mark);
                }
            visibleMarks.Clear();
            visibleMarks.UnionWith(desired);
            foreach (var id in exitingMarks.Keys.ToArray())
            {
                if (Time.unscaledTime - exitingMarks[id] < .18f)
                    continue;
                exitingMarks.Remove(id);
                if (!markNodes.TryGetValue(id, out var mark))
                    continue;
                mark.style.display = DisplayStyle.None;
                if (!match.State.pieces.Any(p => p.id == id))
                {
                    NativeUi.Forget(mark);
                    mark.RemoveFromHierarchy();
                    markNodes.Remove(id);
                }
            }
        }
        private readonly Dictionary<string, float> gainStarts = new Dictionary<string, float>();
        private readonly Dictionary<string, int> gainCounts = new Dictionary<string, int>();
        private readonly Dictionary<string, Label> gainLabels = new Dictionary<string, Label>();
        private readonly Dictionary<string, VisualElement> gainRings = new Dictionary<string, VisualElement>();
        private NativeResultSpectacle spectacle;
        private TextElement resultKicker;
        private VisualElement resultSection;
        private float resultWidth, resultHeight;
        private VisualElement resultEmblem;
        private bool defeatResult;
        private void UpdateOrbs()
        {
            foreach (var orb in orbs)
                orb.style.display = DisplayStyle.None;
            var motion = match.Motion;
            if (motion != null && !motion.Waiting && motion.Stage != "return")
            {
                var victims = motion.Action.captured.Where(p => p.kind != "walrus").ToArray();
                var needed = victims.Length * 6;
                while (orbs.Count < needed)
                {
                    var orb = Box(root, "capture-orb", 0, 0, 26, 26);
                    orb.style.backgroundImage = new StyleBackground(Resources.Load<Texture2D>("Native/Effects/orb"));
                    orbs.Add(orb);
                }
                for (var i = 0; i < victims.Length; i++)
                {
                    var victim = victims[i];
                    var launch = motion.TransferLaunch(victim, i);
                    var arrival = motion.TransferArrival(victim, i);
                    var t = (Time.unscaledTime - launch) / (arrival - launch);
                    if (t < 0 || t >= 1 || !stockTargets.TryGetValue(motion.Action.piece.owner + ":" + victim.kind, out var target))
                        continue;
                    var from = match.Data.Center(victim);
                    from.z = -from.z;
                    from.y = .6f;
                    var projected = match.Board.Camera.WorldToScreenPoint(from);
                    var a = new Vector2(projected.x / uiScale, (Screen.height - projected.y) / uiScale);
                    var b = target.worldBound.center;
                    var arc = Mathf.Min(100, Vector2.Distance(a, b) * .23f);
                    for (var n = 0; n < 6; n++)
                    {
                        var sample = Mathf.Max(0, t - Mathf.Max(0, n - 1) * .035f);
                        var ease = NativeMotion.Smooth(sample);
                        var point = Vector2.Lerp(a, b, ease) + new Vector2(.3f, -1) * Mathf.Sin(sample * Mathf.PI) * arc;
                        var size = 26 * (n == 0 ? .3f : n == 1 ? 1 : .8f - n * .07f);
                        var orb = orbs[i * 6 + n];
                        orb.style.display = DisplayStyle.Flex;
                        orb.style.left = point.x - size * .5f;
                        orb.style.top = point.y - size * .5f;
                        orb.style.width = size;
                        orb.style.height = size;
                        orb.style.unityBackgroundImageTintColor = C(n == 0 ? "#ffffff" : motion.Action.piece.owner == "south" ? "#46dbf2" : "#ffc967");
                        orb.style.opacity = Mathf.Min(1, t * 9) * (1 - Mathf.Max(0, (t - .88f) / .12f)) * (n < 2 ? 1 : (1 - n / 8f) * .5f);
                    }
                }
            }
            foreach (var item in counts)
            {
                var parts = item.Key.Split(':');
                var count = StockCount(parts[0], parts[1]);
                if (gainCounts.TryGetValue(item.Key, out var old) && count > old && motion != null && motion.Action.captured.Any(p => p.kind == parts[1]))
                {
                    gainStarts[item.Key] = Time.unscaledTime;
                    if (!gainLabels.TryGetValue(item.Key, out var label))
                    {
                        label = Text(root, "", 0, 0, 48, 26, 17, "#107ca3", true, TextAnchor.MiddleCenter);
                        NativeUi.TextShadows(label, "textGain");
                        gainLabels[item.Key] = label;
                        var ring = Box(root, "stock-arrival", 0, 0, 0, 0);
                        Border(ring, 2, parts[0] == "south" ? "#6fe9fa" : "#ffd282");
                        NativeUi.Skin(ring, "stockArrival", 100);
                        gainRings[item.Key] = ring;
                    }
                    gainLabels[item.Key].text = "+" + (count - old);
                }
                gainCounts[item.Key] = count;
                if (!gainLabels.TryGetValue(item.Key, out var gain) || !gainStarts.TryGetValue(item.Key, out var started) || !stockTargets.TryGetValue(item.Key, out var target))
                    continue;
                var p = (Time.unscaledTime - started) / .9f;
                gain.style.display = p < 1 ? DisplayStyle.Flex : DisplayStyle.None;
                var ringElement = gainRings[item.Key];
                var ringP = (Time.unscaledTime - started) / .65f;
                ringElement.style.display = ringP < 1 ? DisplayStyle.Flex : DisplayStyle.None;
                var rect = target.worldBound;
                ringElement.style.left = rect.xMin - 5;
                ringElement.style.top = rect.yMin - 5;
                ringElement.style.width = rect.width + 10;
                ringElement.style.height = rect.height + 10;
                Round(ringElement, 100);
                var ringEase = NativeUi.Cubic(Mathf.Clamp01(ringP), 0, 0, .58f, 1);
                ringElement.style.opacity = 1 - ringEase;
                ringElement.style.scale = new Scale(Vector3.one * Mathf.Lerp(.55f, 1.75f, ringEase));
                if (p >= 1)
                    continue;
                var down = !match.Replaying && parts[0] != match.Viewer;
                var point = target.worldBound.center;
                gain.style.left = point.x - 24;
                var first = NativeUi.Cubic(Mathf.Clamp01(p / .2f), .2f, .7f, .3f, 1);
                var travel = NativeUi.Cubic(Mathf.Clamp01((p - .2f) / .8f), .2f, .7f, .3f, 1);
                var distance = p < .2f ? Mathf.Lerp(0, 12, first) : Mathf.Lerp(12, 30, travel);
                gain.style.top = (down ? rect.yMax + 8 - 26 : rect.yMin - 8) + (down ? 1 : -1) * distance;
                gain.style.opacity = p < .2f ? first : p < .7f ? 1 : 1 - NativeUi.Cubic((p - .7f) / .3f, .2f, .7f, .3f, 1);
                gain.style.scale = new Scale(Vector3.one * (p < .2f ? Mathf.Lerp(.6f, 1.15f, first) : Mathf.Lerp(1.15f, 1, travel)));
            }
        }
        private void UpdateResult()
        {
            var key = match.State.phase == "finished" && match.Motion == null && !match.Replaying && !match.ResultDismissed ? match.State.result?.winner ?? "draw" : null;
            var changed = key != resultKey;
            if (!changed && (key == null || resultWidth == width && resultHeight == height))
                return;
            resultKey = key;
            resultWidth = width;
            resultHeight = height;
            if (key == null)
            {
                NativeUi.Exit(result);
                result.SetEnabled(false);
                result.schedule.Execute(() => { if (resultKey == null) result.style.display = DisplayStyle.None; }).StartingIn(180);
                return;
            }
            result.SetEnabled(true);
            result.pickingMode = PickingMode.Position;
            result.userData = "native-ui";
            result.style.display = DisplayStyle.Flex;
            NativeUi.ClearChildren(result);
            NativeUi.StopAnimation(result);
            result.style.opacity = 1;
            result.style.translate = new Translate(0, 0);
            result.style.scale = new Scale(Vector3.one);
            celebration.Clear();
            if (changed)
                resultStarted = Time.unscaledTime;
            var draw = key == "draw";
            defeatResult = !draw && match.Settings.mode == "human-vs-ai" && key != match.Settings.human;
            var light = draw ? "#c2fff3" : defeatResult ? "#cadfff" : "#ffe19a";
            var glow = draw ? "#64cabc" : defeatResult ? "#7b9fe8" : "#f5bb4f";
            spectacle = new NativeResultSpectacle { Defeat = defeatResult, Light = C(light), Glow = C(glow), Started = resultStarted };
            spectacle.style.position = UnityEngine.UIElements.Position.Absolute;
            spectacle.style.left = 0;
            spectacle.style.top = 0;
            spectacle.style.width = width;
            spectacle.style.height = height;
            result.Add(spectacle);
            for (var i = 0; i < 32; i++)
            {
                var bit = Box(result, "result-particle", 0, 0, defeatResult ? 2 : (i + 1) % 3 == 0 ? 5 : 7, defeatResult ? 35 : (i + 1) % 3 == 0 ? 8 : 14, defeatResult ? "#a5caff" : (i + 1) % 3 == 0 ? "#84e4ed" : light);
                NativeUi.Skin(bit, "resultParticle", 0, glow);
                celebration.Add(bit);
            }
            var compact = height <= 530;
            var sectionWidth = width - 40;
            resultSection = Box(result, "result-content", 20, 20, sectionWidth, height - 40);
            var heading = Box(resultSection, "result-heading", 0, compact ? 8 : 12, compact ? sectionWidth * .4f : sectionWidth, 0);
            heading.style.height = StyleKeyword.Auto;
            var emblem = FlowBox(heading, "result-emblem");
            emblem.style.width = compact ? 50 : 52;
            emblem.style.height = compact ? 50 : 52;
            emblem.style.alignSelf = Align.Center;
            resultEmblem = emblem;
            var emblemName = defeatResult || draw ? "snowflake" : "crown-result";
            var glowIcon = CenteredSymbol(emblem, emblemName, compact ? 36 : 54, glow);
            NativeUi.Blur(glowIcon, 22);
            CenteredSymbol(emblem, emblemName, compact ? 36 : 54, light);
            var kickerSize = compact ? 38 : Mathf.RoundToInt(Mathf.Clamp(width * .09f, 32, 56));
            resultKicker = FlowText(heading, draw ? "DRAW" : defeatResult ? "DEFEAT" : "VICTORY", kickerSize, light, true);
            resultKicker.style.unityFontStyleAndWeight = FontStyle.BoldAndItalic;
            resultKicker.style.unityTextAlign = TextAnchor.MiddleCenter;
            resultKicker.style.letterSpacing = kickerSize * .045f;
            resultKicker.style.marginTop = resultKicker.style.marginBottom = compact ? 8 : 6;
            NativeUi.TextShadows(resultKicker, "textResultKicker", glow);
            var title = draw ? "引き分けです" : match.Settings.mode == "human-vs-ai" ? (defeatResult ? "NPCの勝ちです" : "あなたの勝ち！") : match.Actor(key) + "の勝ちです";
            var titleCopy = FlowText(heading, title, Mathf.RoundToInt(Mathf.Clamp(width * .05f, 20, 28)), "#ffffff", true);
            titleCopy.style.unityTextAlign = TextAnchor.MiddleCenter;
            NativeUi.TextShadows(titleCopy, "textResultHeading");
            var footerWidth = compact ? sectionWidth * .34f : Mathf.Min(360, sectionWidth * .95f);
            var footer = Box(resultSection, "result-footer", compact ? sectionWidth - footerWidth : (sectionWidth - footerWidth) / 2, 0, footerWidth, 0);
            footer.style.top = StyleKeyword.Auto;
            footer.style.bottom = 6;
            footer.style.height = StyleKeyword.Auto;
            var last = match.LastAction;
            var detail = draw ? "両方の王が同じ一手で捕食されました。" : (last != null ? match.Data.Name(last.piece) : "駒") + "が" + match.Actor(last?.captured.FirstOrDefault(p => p.kind == "walrus")?.owner ?? match.State.turn) + "の王を捕食しました。";
            var detailCopy = FlowText(footer, detail, 12, "#23465c", lineHeight: 21.6f);
            detailCopy.style.unityTextAlign = TextAnchor.MiddleCenter;
            detailCopy.style.marginTop = 10;
            detailCopy.style.marginBottom = 14;
            NativeUi.TextShadows(detailCopy, "textResultFooter");
            var next = FlowAction(footer, "新しい対局", null, () => match.Open("settings"), "#48afc8", "#ffffff", "resultPrimary");
            next.style.height = 44;
            NativeUi.Bind(next, () => match.Open("settings"), C("#48afc8"), C("#65c0d3"));
            var inspect = FlowAction(footer, "盤面を見る", null, () => { match.ResultDismissed = true; Rebuild(); }, "#ffffff00", "#23465c");
            inspect.style.height = 44;
            inspect.style.marginTop = compact ? 8 : 10;
            inspect.style.alignSelf = Align.Center;
            Border(inspect, 0, "#ffffff00");
            NativeUi.Bind(inspect, () => { match.ResultDismissed = true; Rebuild(); }, Color.clear, Color.clear);
            // TextShadows inserts a sibling, so snapshot the labels before adding it.
            foreach (var label in inspect.Children().OfType<Label>().ToArray())
            {
                label.style.unityFontStyleAndWeight = FontStyle.Normal;
                NativeUi.TextShadows(label, "textResultFooter");
            }

        }
    }
}
