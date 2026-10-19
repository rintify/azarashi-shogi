using UnityEngine;

namespace Azarashi.UnityView
{
    /// <summary>Source TravelEffects, ActionEffects and SnowImpact, with the same pools and clocks.</summary>
    public static class NativeEffects
    {
        private static Quaternion Rotation(float x, float y, float z) => (Quaternion.AngleAxis(x * Mathf.Rad2Deg, Vector3.right) * Quaternion.AngleAxis(y * Mathf.Rad2Deg, Vector3.up) * Quaternion.AngleAxis(z * Mathf.Rad2Deg, Vector3.forward));
        public static void Draw(NativeBoard board, NativeMotion motion, NativeGameData data)
        {
            if (motion == null || motion.Stage == "return")
                return;
            var t = motion.Progress;
            var pose = motion.Sample();
            var before = motion.Before;
            if (before != null && motion.Stage != "resolve" && t > 0 && t < motion.TravelEnd + .12f)
            {
                var jet = before.kind == "penguin" && before.promoted;
                var orca = before.kind == "orca";
                var end = motion.TravelEnd;
                var origin = data.Center(before);
                var destination = data.Center(new PieceState { kind = before.kind, promoted = before.promoted, at = motion.Action.action.to });
                var heading = Mathf.Atan2(destination.x - origin.x, destination.z - origin.z);
                var strength = Mathf.Sin(Mathf.Clamp01(t / end) * Mathf.PI);
                if (jet)
                {
                    var thrust = motion.Dynamics(t).thrust;
                    if (thrust > .01f)
                    {
                        var flamePosition = pose.position + Vector3.up * .56f;
                        var flameRotation = Rotation(0, NativeGameData.Facing(before) * Mathf.Deg2Rad, 0);
                        var flameScale = new Vector3(.8f + thrust * .2f, .8f + thrust * .2f, (.45f + thrust * .9f) * (1 + Mathf.Sin(t * 110) * .09f));
                        board.Effect("flame", "flame", flamePosition + flameRotation * Vector3.Scale(new Vector3(0, 0, -1), flameScale), flameScale, "#21c7ff", .65f, flameRotation * Rotation(-Mathf.PI / 2, 0, 0), true);
                        board.Effect("flame-core", "flame-core", flamePosition + flameRotation * Vector3.Scale(new Vector3(0, 0, -.78f), flameScale), Vector3.Scale(flameScale, new Vector3(.09f, .09f, .45f)), "#f3feff", 1, flameRotation, true);
                        for (var side = -1; side <= 1; side += 2)
                            board.Effect("speed-line" + side, "speed-line", flamePosition + flameRotation * Vector3.Scale(new Vector3(side * .4f, .02f, -.4f), flameScale), flameScale, "#b4f7ff", .8f, flameRotation);
                    }
                }
                if (jet || orca)
                    for (var i = 0; i < 24; i++)
                    {
                        var age = (t * 5 + i / 24f) % 1;
                        var sampleAt = t - age * (jet ? .2f : .22f);
                        var old = motion.Sample(Mathf.Clamp01(sampleAt));
                        var side = i % 2 == 1 ? 1 : -1;
                        var yaw = orca ? heading : NativeGameData.Facing(before) * Mathf.Deg2Rad;
                        var lateral = orca ? side * (.35f + age * .45f) : Mathf.Sin(i * 7) * age * .22f;
                        var p = old.position + new Vector3(Mathf.Cos(yaw) * lateral, (jet ? .52f : .2f) + age * .08f, -Mathf.Sin(yaw) * lateral);
                        var scale = (jet ? .09f : .06f) * (1 - age) * (.5f + strength);
                        board.Effect("trail" + i, "trail", p, Vector3.one * scale, jet ? (i % 3 != 0 ? "#6ce8ff" : "#ffffff") : "#f4feff", sampleAt > 0 && sampleAt < end ? (1 - age) * (jet ? .8f : .7f) : 0, additive: jet);
                    }
                if (orca)
                    for (var i = 0; i < 6; i++)
                    {
                        var age = (t * 2.6f + i / 6f) % 1;
                        var sampleAt = t - age * .22f;
                        var old = motion.Sample(Mathf.Clamp01(sampleAt));
                        board.Effect("wave" + i, "wave", new Vector3(old.position.x, .195f, old.position.z), new Vector3(.6f + age * 1.1f, .7f + age * 1.2f, 1), i % 2 == 1 ? "#e8fdff" : "#53cfed", sampleAt > 0 && sampleAt < end ? (1 - age) * .65f : 0, Rotation(-Mathf.PI / 2, 0, -heading + Mathf.PI * .15f));
                    }
            }
            var change = motion.Change(t);
            if (change > 0 && change < 1)
                for (var i = 0; i < 14; i++)
                {
                    var angle = i * Mathf.PI * 2 / 14 + change * .8f;
                    var radius = .55f + change * .6f;
                    var p = pose.position + Vector3.up * .8f + new Vector3(Mathf.Cos(angle) * radius, Mathf.Sin(angle * 2) * radius * .65f, Mathf.Sin(angle) * radius);
                    board.Effect("glint" + i, "snow-fleck", p, new Vector3(.08f, (i % 2 == 1 ? .2f : .3f) * Mathf.Sin(change * Mathf.PI), .08f), i % 3 != 0 ? "#d3faff" : "#ffec9e", Mathf.Sin(change * Mathf.PI), Rotation(0, change * 3, Mathf.PI / 4));
                }
            if (motion.Waiting || t < motion.LandingMoment)
                return;
            var at = motion.LandingMoment;
            var progress = Mathf.Clamp01((t - at) / (1 - at));
            var center = data.Center(motion.Action.piece) + Vector3.up * .16f;
            board.Effect("impact", "impact", center, Vector3.one * (.3f + progress * 2.2f), motion.Action.captured.Length > 0 ? "#ffbb74" : "#a4f0ff", (1 - progress) * .7f, Rotation(-Mathf.PI / 2, 0, 0), toneMapped: true);
            for (var i = 0; i < 12; i++)
            {
                var a = i * Mathf.PI * 2 / 12;
                var p = center + new Vector3(Mathf.Cos(a) * progress * 1.5f, Mathf.Sin(progress * Mathf.PI) * (.35f + (i % 3) * .16f), Mathf.Sin(a) * progress * 1.5f);
                board.Effect("shard" + i, "snow-fleck", p, Vector3.one * ((1 - progress) * .08f), i % 3 != 0 ? "#d4faff" : "#ffffff", 1, Rotation(progress * 4, i, progress * 2), toneMapped: true, depthWrite: true);
            }
            if (motion.Action.piece.kind != "walrus" || progress >= 1)
                return;
            center.y = .19f;
            board.Effect("snow-ring", "snow-ring", center, Vector3.one * (.5f + progress * 2.6f), "#ffffff", (1 - progress) * .55f, Rotation(-Mathf.PI / 2, 0, 0));
            for (var i = 0; i < 16; i++)
            {
                var a = i * 2.39996f;
                var distance = .6f + Mathf.Sqrt(progress) * (.8f + (i % 3) * .18f);
                var p = center + new Vector3(Mathf.Cos(a) * distance, .04f + Mathf.Sin(progress * Mathf.PI) * (.15f + (i % 4) * .07f), Mathf.Sin(a) * distance);
                var scale = (.16f + Mathf.Sin(progress * Mathf.PI) * .24f) * (1 + (i % 3) * .15f);
                board.Effect("snow-cloud" + i, "snow-cloud", p, Vector3.one * scale, i % 2 == 1 ? "#ffffff" : "#d7edf7", Mathf.Pow(1 - progress, 1.4f) * .58f);
            }
            for (var i = 0; i < 20; i++)
            {
                var a = i * 2.39996f;
                var p = center + new Vector3(Mathf.Cos(a) * progress * 2.3f, Mathf.Sin(progress * Mathf.PI) * (.4f + (i % 5) * .12f), Mathf.Sin(a) * progress * 2.3f);
                board.Effect("snow-fleck" + i, "snow-fleck", p, Vector3.one * ((1 - progress) * .07f), "#ffffff", 1 - progress, Rotation(progress * 5, i, progress * 4));
            }
        }
    }
}
