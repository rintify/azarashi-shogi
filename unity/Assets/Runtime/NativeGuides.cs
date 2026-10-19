using UnityEngine;

namespace Azarashi.UnityView
{
    public struct GuideState
    {
        public bool stationary, stationaryAnchor, inspectingEnemy, active, additional, reachable, last, legal, unsafeCell, previewUnsafe, kingDanger, previewKingDanger, transformationSafe, kingCaptureTrap, previewKingCaptureTrap;
    }
    public struct GuideStyle
    {
        public string fill, dot, outline;
        public float fillOpacity, dotOpacity, outlineOpacity;
    }
    /// <summary>Direct port of presentation/guideStyle.ts. Drawing has no independent safety rules.</summary>
    public static class NativeGuides
    {
        public static GuideStyle Style(GuideState s, GuidePalette p)
        {
            if (s.inspectingEnemy)
                return new GuideStyle { fill = p.enemy, dot = p.enemy, outline = p.enemy, fillOpacity = s.reachable ? .32f : 0 };
            var preview = s.active || s.additional;
            var guided = s.legal || s.stationary;
            var transform = s.transformationSafe && s.legal;
            var king = !transform && (preview ? s.previewKingDanger : guided && s.kingDanger);
            var trap = !transform && !king && (preview ? s.previewKingCaptureTrap : guided && s.kingCaptureTrap);
            var danger = !transform && (king || (preview ? s.previewUnsafe : guided && s.unsafeCell));
            var red = king ? p.kingDanger : p.danger;
            return new GuideStyle
            {
                fill = transform ? p.transformation : trap ? p.kingCaptureTrap : danger ? red : s.last && !s.reachable ? p.last : p.fill,
                fillOpacity = preview ? (danger ? .32f : .36f) : guided && (s.unsafeCell || trap) && !transform ? .24f : s.reachable ? .2f : s.last ? .1f : 0,
                dot = transform ? p.transformation : trap ? p.kingCaptureTrap : s.kingDanger ? p.kingDanger : s.unsafeCell ? p.danger : p.safe,
                dotOpacity = s.legal || s.stationaryAnchor ? 1 : 0,
                outline = trap ? p.kingCaptureTrap : danger ? red : p.active,
                outlineOpacity = preview ? .9f : 0
            };
        }
    }
}
