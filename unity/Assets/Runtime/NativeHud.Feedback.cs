using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    public sealed partial class NativeHud
    {
        private void UpdateMarkers()
        {
            foreach (var node in markNodes.Values)
                node.style.display = DisplayStyle.None;
            if (gridOpen || match.Busy || match.Thinking || match.Dialog != null || !match.HumanTurn)
                return;
            foreach (var entry in match.Marks)
            {
                var piece = match.State.pieces.FirstOrDefault(p => p.id == entry.Key);
                if (piece == null)
                    continue;
                if (!markNodes.TryGetValue(piece.id, out var mark))
                {
                    mark = Box(markers, "native-piece-mark", 0, 0, 25, 25, null, 13);
                    Border(mark, 2, "#fff3e7");
                    markNodes[piece.id] = mark;
                }
                mark.style.display = DisplayStyle.Flex;
                if (mark.userData as string != entry.Value)
                {
                    mark.userData = entry.Value;
                    mark.Clear();
                    var color = entry.Value == "king" ? "#f7cc61" : entry.Value == "helper" ? "#bce7ce" : entry.Value == "trapped" ? "#8f2038" : "#d56b37";
                    mark.style.backgroundColor = C(color);
                    Border(mark, 2, entry.Value == "king" ? "#fff9df" : entry.Value == "helper" ? "#edfff2" : entry.Value == "trapped" ? "#ffe1e7" : "#fff3e7");
                    if (entry.Value == "danger")
                        Text(mark, "!", 0, -1, 21, 22, 16, "#ffffff", true, TextAnchor.MiddleCenter);
                    else
                        Symbol(mark, entry.Value == "king" ? "crown" : entry.Value == "trapped" ? "x" : "helper", 1.5f, 1.5f, 18, entry.Value == "king" ? "#785122" : entry.Value == "helper" ? "#206c53" : "#ffffff");
                    NativeUi.Skin(mark, entry.Value, 12.5f);
                    NativeUi.Enter(mark);
                }
                var anchor = match.Board.Marker(piece.id);
                mark.style.left = anchor.x / uiScale + 8 - 12.5f;
                mark.style.top = (Screen.height - anchor.y) / uiScale - 8 - 12.5f;
            }
        }
        private readonly Dictionary<string, float> gainStarts = new Dictionary<string, float>();
        private readonly Dictionary<string, int> gainCounts = new Dictionary<string, int>();
        private readonly Dictionary<string, Label> gainLabels = new Dictionary<string, Label>();
        private NativeResultSpectacle spectacle;
        private TextElement resultKicker;
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
                        label.style.textShadow = new TextShadow { color = C("#d3fbff"), blurRadius = 6, offset = Vector2.zero };
                        gainLabels[item.Key] = label;
                    }
                    gainLabels[item.Key].text = "+" + (count - old);
                }
                gainCounts[item.Key] = count;
                if (!gainLabels.TryGetValue(item.Key, out var gain) || !gainStarts.TryGetValue(item.Key, out var started) || !stockTargets.TryGetValue(item.Key, out var target))
                    continue;
                var p = (Time.unscaledTime - started) / .9f;
                gain.style.display = p < 1 ? DisplayStyle.Flex : DisplayStyle.None;
                if (p >= 1)
                    continue;
                var down = parts[0] != match.Viewer;
                var point = target.worldBound.center;
                gain.style.left = point.x - 24;
                gain.style.top = point.y + (down ? 16 : -26) + (down ? 1 : -1) * Mathf.Lerp(0, 30, NativeUi.Ease(p));
                gain.style.opacity = p < .2f ? p / .2f : p < .7f ? 1 : (1 - p) / .3f;
                gain.style.scale = new Scale(Vector3.one * (p < .2f ? Mathf.Lerp(.6f, 1.15f, p / .2f) : Mathf.Lerp(1.15f, 1, (p - .2f) / .8f)));
            }
        }
        private void UpdateResult()
        {
            var key = match.State.phase == "finished" && !match.Busy && !match.Replaying && !match.ResultDismissed ? match.State.result?.winner ?? "draw" : null;
            if (key == resultKey)
                return;
            resultKey = key;
            hud.style.opacity = key == null ? 1 : 0;
            if (key == null)
            {
                NativeUi.Exit(result);
                result.SetEnabled(false);
                return;
            }
            result.SetEnabled(true);
            result.Clear();
            result.style.opacity = 1;
            celebration.Clear();
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
                celebration.Add(bit);
            }
            var heading = Box(result, "result-heading", 20, 32, width - 40, 170);
            resultEmblem = Symbol(heading, defeatResult || draw ? "snowflake" : "crown", (width - 40 - 52) * .5f, 0, 52, light);
            resultKicker = Text(heading, draw ? "DRAW" : defeatResult ? "DEFEAT" : "VICTORY", 0, 58, width - 40, 68, Mathf.RoundToInt(Mathf.Clamp(width * .09f, 32, 56)), light, true, TextAnchor.MiddleCenter);
            resultKicker.style.unityFontStyleAndWeight = FontStyle.BoldAndItalic;
            resultKicker.style.textShadow = new TextShadow { offset = new Vector2(0, 4), color = C("#20304f"), blurRadius = 0 };
            var title = draw ? "引き分けです" : match.Settings.mode == "human-vs-ai" ? (defeatResult ? "あなたの負けです" : "あなたの勝ちです") : match.Actor(key) + "の勝ちです";
            Text(heading, title, 0, 130, width - 40, 38, Mathf.RoundToInt(Mathf.Clamp(width * .05f, 20, 28)), "#ffffff", true, TextAnchor.MiddleCenter);
            var footerWidth = Mathf.Min(360, (width - 40) * .95f);
            var footer = Box(result, "result-footer", (width - footerWidth) * .5f, height - 174, footerWidth, 148);
            Text(footer, draw ? "両方の王が同じ一手で捕食されました。" : "王を捕食して決着しました。", 0, 0, footerWidth, 34, 12, "#23465c", false, TextAnchor.MiddleCenter);
            var next = Button(footer, "新しい対局", 0, 48, footerWidth, 44, () => match.Open("settings"), "#48afc8", 12);
            next.style.color = Color.white;
            NativeUi.Skin(next, "primary", 24);
            var inspect = Button(footer, "盤面を見る", 0, 100, footerWidth, 36, () => { match.ResultDismissed = true; Rebuild(); }, "#ffffff00", 12);
            Border(inspect, 0, "#ffffff");
            NoSkin(inspect);
            NativeUi.Bind(inspect, () => { match.ResultDismissed = true; Rebuild(); }, Color.clear, Color.clear);
            inspect.style.color = C("#23465c");
            NativeUi.Enter(heading);
            NativeUi.Enter(footer);
        }
    }
}
