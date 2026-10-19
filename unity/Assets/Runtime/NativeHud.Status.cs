using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    public sealed partial class NativeHud
    {
        private VisualElement statusPulse, statusReplay, statusDanger, statusBanner;
        private Label statusDetail, lastCopy;
        private void BuildStatus(float top, bool landscape)
        {
            var banner = Box(hud, "turn-banner", landscape ? width - 254 : 0, top, landscape ? 240 : 0, 20);
            statusBanner = banner;
            banner.style.transitionProperty = new System.Collections.Generic.List<StylePropertyName> { new StylePropertyName("opacity") };
            banner.style.transitionDuration = new System.Collections.Generic.List<TimeValue> { new TimeValue(.25f) };
            if (!landscape)
            {
                // Center the complete live row. Absolute auto-width is constrained
                // by its left inset in Yoga and can leave longer warnings offset.
                banner.style.left = 0;
                banner.style.width = Length.Percent(100);
                banner.style.translate = new Translate(0, 0);
            }
            else
                banner.style.translate = new Translate(0, 0);
            Row(banner, true);
            statusPulse = Box(banner, "status-pulse", 0, 0, 6, 6, "#75e5f4", 3);
            Inline(statusPulse);
            statusPulse.style.marginRight = 8;
            statusReplay = Symbol(banner, "replay", 0, 0, 14, "#ffffff");
            Inline(statusReplay);
            statusReplay.style.marginRight = 8;
            statusDanger = Box(banner, "king-danger", 0, 0, 19, 19, "#bd5e36", 10);
            Inline(statusDanger);
            statusDanger.style.marginRight = 8;
            Text(statusDanger, "!", 0, 0, 19, 19, 12, "#ffffff", true, TextAnchor.MiddleCenter);
            status = Text(banner, "", 0, 0, 0, 20, width <= 760 ? 11 : 12, "#ffffff", true);
            Inline(status, true);
            status.style.whiteSpace = WhiteSpace.NoWrap;
            statusDetail = Text(banner, "", 0, 0, 0, 20, width <= 760 ? 9 : 10, "#ffffff");
            Inline(statusDetail, true);
            statusDetail.style.marginLeft = 11;
            statusDetail.style.opacity = .65f;
            foreach (var label in new[] { status, statusDetail })
                NativeUi.TextShadows(label, "textStatus");
            lastCopy = Text(hud, "", 12, height - 20, width - 24, 13, width <= 760 ? 8 : 9, "#cae7f3", false, TextAnchor.MiddleCenter);
            NativeUi.TextShadows(lastCopy, "textMessage");
            lastCopy.style.transitionProperty = new System.Collections.Generic.List<StylePropertyName> { new StylePropertyName("opacity") };
            lastCopy.style.transitionDuration = new System.Collections.Generic.List<TimeValue> { new TimeValue(.25f) };
            lastCopy.style.whiteSpace = WhiteSpace.NoWrap;
            lastCopy.style.overflow = Overflow.Hidden;
            lastCopy.style.textOverflow = TextOverflow.Ellipsis;
        }
        private void UpdateStatus()
        {
            var replay = match.Replaying;
            var motion = match.Motion;
            var busy = match.Busy;
            var ended = match.State.phase == "finished" && motion == null && !replay;
            var local = match.Settings.mode == "local-pvp";
            var watching = match.Settings.mode == "ai-vs-ai";
            var danger = !watching && !replay && !busy && match.KingThreatened;
            var copy = "";
            var small = "";
            var pulse = false;
            if (replay)
            {
                copy = "リプレイ";
                small = match.ReplayCursor + " / " + match.ReplayTotal + "手";
            }
            else if (!match.Engine.Ready)
                copy = "氷原を準備しています";
            else if (motion != null)
            {
                pulse = true;
                copy = match.Actor(motion.Action.piece.owner) + "：" + (motion.Waiting ? "好きな姿をえらぼう！" : motion.Stage == "return" ? "もとの場所へ戻ります" : match.Data.Name(motion.Action.piece) + "を" + (motion.Action.from == null ? "配置" : "移動"));
            }
            else if (ended)
                copy = match.State.result?.winner == null ? "引き分けです" : local || watching ? match.Actor(match.State.result.winner) + "の勝ちです" : match.State.result.winner == match.Settings.human ? "あなたの勝ち！" : "NPCの勝ちです";
            else if (danger)
            {
                copy = "王が狙われています";
                small = "捕食されると敗北";
            }
            else
            {
                pulse = true;
                var selected = match.State.pieces.FirstOrDefault(p => p.id == match.SelectedId);
                var portrait = selected != null ? match.Data.Name(selected) : match.SelectedStock != null ? match.Data.Config.variants.First(p => p.kind == match.SelectedStock && !p.promoted).name + "を配置" : null;
                if (match.InspectingEnemy && selected != null)
                    portrait = "敵の" + portrait + " · 移動範囲";
                copy = local ? portrait != null && !busy ? match.Actor(match.State.turn) + " · " + portrait : match.Actor(match.State.turn) + (busy ? "へ交代" : "の番") : watching ? match.Actor(match.State.turn) + (match.Paused && !busy ? " · 一時停止" : "の手番") : match.HumanTurn ? portrait ?? "あなたの手番" : "NPCの手番";
                small = (match.State.revision + 1) + "手目";
            }
            statusPulse.style.display = pulse ? DisplayStyle.Flex : DisplayStyle.None;
            statusPulse.style.backgroundColor = C(!busy && match.HumanTurn ? "#75e5f4" : "#f7be68");
            NativeUi.Skin(statusPulse, !busy && match.HumanTurn ? "pulseHuman" : "pulse", 3);
            statusReplay.style.display = replay ? DisplayStyle.Flex : DisplayStyle.None;
            statusDanger.style.display = danger ? DisplayStyle.Flex : DisplayStyle.None;
            status.style.color = statusDetail.style.color = C(danger ? "#ffdbb1" : "#ffffff");
            NativeUi.Swap(status, copy);
            NativeUi.Swap(statusDetail, small);
            statusDetail.style.display = small.Length > 0 ? DisplayStyle.Flex : DisplayStyle.None;
            var last = match.LastAction;
            var lastText = motion?.Waiting == true ? "" : last != null && !busy ? match.Actor(last.piece.owner) + " · " + match.Data.Name(last.piece) + " " + (last.from == null ? "" : Coordinate(last.from) + " → ") + Coordinate(last.piece.at) + (last.captured.Length == 0 ? "" : " · " + string.Join("・", last.captured.Select(match.Data.Name)) + "を捕食") : busy ? "一手を再生中" : local ? "ローカルPvP · 先手は青 / 後手は橙" : watching ? "先手AI・青 / 後手AI・橙" : "あなたは" + (match.Settings.human == "south" ? "先手・青" : "後手・橙");
            if (message != null && Time.unscaledTime < messageUntil)
                lastText = message;
            NativeUi.Swap(lastCopy, lastText);
            var cinematic = ended && !match.ResultDismissed;
            statusBanner.style.opacity = cinematic ? 0 : 1;
            lastCopy.style.opacity = cinematic ? 0 : 1;
        }
        private static string Coordinate(Cell cell) => ((char)('A' + cell.x)).ToString() + (10 - cell.y);
    }
}
