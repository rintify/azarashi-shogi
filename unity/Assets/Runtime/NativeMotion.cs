using System;
using System.Linq;
using UnityEngine;

namespace Azarashi.UnityView
{
    public struct NativePose
    {
        public Vector3 position;
        public float yaw, scale, morph;
        public bool promoted;
    }
    public struct BodyDynamics
    {
        public float pitch, roll, thrust;
        public Vector3 stretch;
    }

    /// <summary>
    /// Seconds-based port of presentation/motion.ts, movement.ts and captureTransfers.ts.
    /// NativeValidation compares these samples with fixtures produced by those original functions.
    /// Coordinates remain in the source right-handed world until SceneRenderer's single conversion.
    /// </summary>
    public sealed class NativeMotion
    {
        public Preview Action;
        public readonly PieceState Before;
        public readonly Position BeforeState;
        public float Started, Duration;
        public string Stage;
        private NativePose resolveFrom, previewFrom;
        private Preview previewTarget;
        private float previewStarted;
        private readonly NativeGameData data;
        public bool Transformed => Action.action.type == "move" && Action.action.transformation != null;
        public bool Waiting => Stage == "choice" || Stage == "choice-preview";
        public bool Aerial => Waiting || Stage == "resolve" || Transformed;
        public float Progress => Mathf.Clamp01((Time.unscaledTime - Started) / Duration);
        public float TravelEnd => Waiting ? 1 : Transformed ? .34f : .56f;
        public float LandingMoment => Waiting ? float.PositiveInfinity : Stage == "resolve" || Transformed ? .84f : Before != null ? .56f : .66f;
        public float Landing => Started + Duration * LandingMoment;
        public float PlaybackDuration
        {
            get
            {
                var end = Duration;
                var victims = Action.captured.Where(p => p.kind != "walrus").ToArray();
                for (var i = 0; i < victims.Length; i++)
                    end = Mathf.Max(end, TransferArrival(victims[i], i) - Started + .12f);
                return end;
            }
        }
        public bool Done => !Waiting && Time.unscaledTime - Started >= (Stage == "return" ? Duration : PlaybackDuration);

        public NativeMotion(NativeGameData data, Position before, Preview action, bool choice = false)
        {
            this.data = data;
            BeforeState = before;
            Action = action;
            Before = action.action.type == "move" ? Array.Find(before.pieces, p => p.id == action.piece.id) : null;
            Stage = choice ? "choice" : "travel";
            Started = Time.unscaledTime;
            Duration = choice ? .620f : Before == null ? .640f : Transformed ? 1.850f : action.captured.Length > 0 ? 1.100f : Before.kind == "walrus" ? 1.050f : .760f;
        }
        public static float Smooth(float t)
        {
            t = Mathf.Clamp01(t);
            return t * t * (3 - 2 * t);
        }
        public float Change(float t)
        {
            if (Waiting || !Transformed)
                return 0;
            return Smooth((t - (Stage == "resolve" ? .08f : .4f)) / (Stage == "resolve" ? .54f : .34f));
        }
        public void Preview(Preview candidate)
        {
            // Preview changes never restart or truncate the initial flight.
            previewStarted = Mathf.Max(Time.unscaledTime, Started + Duration);
            previewFrom = Sample(Mathf.Max(Progress, 1), previewStarted);
            if (Time.unscaledTime >= Started + Duration)
                previewFrom = Sample();
            previewTarget = candidate;
            Stage = "choice-preview";
        }
        public void Resolve(Preview candidate)
        {
            resolveFrom = Sample();
            Action = candidate;
            Stage = "resolve";
            Started = Time.unscaledTime;
            Duration = Transformed ? 1.150f : .620f;
            previewTarget = null;
        }
        public void Return()
        {
            resolveFrom = Sample();
            Stage = "return";
            Started = Time.unscaledTime;
            Duration = .500f;
            previewTarget = null;
        }
        private static NativePose Blend(NativePose from, NativePose to, float t) => new NativePose
        {
            position = Vector3.LerpUnclamped(from.position, to.position, t),
            yaw = Mathf.LerpUnclamped(from.yaw, to.yaw, t),
            scale = Mathf.LerpUnclamped(from.scale, to.scale, t),
            promoted = t > .5f ? to.promoted : from.promoted,
            morph = Mathf.LerpUnclamped(from.morph, to.morph, t)
        };
        public NativePose Sample(float sampleAt = -1, float now = -1)
        {
            var t = sampleAt < 0 ? Progress : Mathf.Clamp01(sampleAt);
            if (now < 0)
                now = sampleAt < 0 ? Time.unscaledTime : Started + t * Duration;
            var after = Action.piece;
            var final = data.Center(after);
            if (Stage == "return" && Before != null)
            {
                var returned = Blend(resolveFrom, new NativePose { position = data.Center(Before), yaw = NativeGameData.Facing(Before), scale = 1, promoted = Before.promoted, morph = Before.promoted ? 1 : 0 }, Smooth(t));
                returned.position.y += Mathf.Sin(Mathf.PI * t) * .18f;
                return returned;
            }
            NativePose pose;
            if (Before == null)
                pose = new NativePose { position = final + Vector3.up * ((1 - Smooth(t / .7f)) * 1.8f), scale = .5f + .5f * Smooth(t / .45f), yaw = NativeGameData.Facing(after), promoted = after.promoted, morph = after.promoted ? 1 : 0 };
            else
            {
                var landingPiece = new PieceState { kind = Before.kind, promoted = Before.promoted, at = Action.action.to };
                var landing = data.Center(landingPiece);
                var move = Stage == "resolve" ? 1 : Smooth(t / (Waiting ? 1 : Aerial ? .34f : .56f));
                var change = Change(t);
                var position = Vector3.Lerp(data.Center(Before), landing, move);
                var yaw = NativeGameData.Facing(Before);
                if (Action.action.transformation?.type == "rotate" && change > 0)
                {
                    var pivot = data.Body(landingPiece).ElementAt(Action.action.transformation.pivot);
                    var center = new Vector3(pivot.x - 4.5f, 0, pivot.y - 4.5f);
                    var a = Action.action.transformation.direction * Mathf.PI * .5f * change;
                    var d = landing - center;
                    position = center + new Vector3(d.x * Mathf.Cos(a) - d.z * Mathf.Sin(a), 0, d.x * Mathf.Sin(a) + d.z * Mathf.Cos(a));
                    yaw += (NativeGameData.Facing(after) - yaw) * change;
                }
                if (Aerial)
                {
                    var start = Stage == "resolve" ? Transformed ? .68f : .1f : .78f;
                    position.y = 1.45f * move * (1 - (Waiting ? 0 : Smooth((t - start) / (1 - start))));
                }
                else
                    position.y = Mathf.Sin(move * Mathf.PI) * (Before.kind == "bear" ? 1.65f : Before.kind == "orca" ? .12f : Before.kind == "walrus" ? .55f : Before.kind == "penguin" && Before.promoted ? .15f : .28f);
                pose = new NativePose { position = position, yaw = yaw, scale = Transformed ? 1 + Mathf.Sin(change * Mathf.PI) * .12f : 1, promoted = change > .5f ? after.promoted : Before.promoted, morph = (Before.promoted ? 1 : 0) + ((after.promoted ? 1 : 0) - (Before.promoted ? 1 : 0)) * change };
            }
            if (Waiting && previewTarget != null && now >= previewStarted)
                return Blend(previewFrom, new NativePose { position = data.Center(previewTarget.piece) + Vector3.up * 1.45f, yaw = NativeGameData.Facing(previewTarget.piece), scale = 1, promoted = previewTarget.piece.promoted, morph = previewFrom.morph }, Smooth((now - previewStarted) / .280f));
            if (Stage == "resolve")
            {
                var target = pose;
                target.position.x = final.x;
                target.position.z = final.z;
                target.yaw = NativeGameData.Facing(after);
                var blend = Smooth(t / .62f);
                var result = Blend(resolveFrom, target, blend);
                result.position.y = pose.position.y;
                result.scale = pose.scale;
                result.morph = pose.morph;
                result.promoted = (Transformed ? Change(t) : blend) > .5f ? after.promoted : resolveFrom.promoted;
                return result;
            }
            return pose;
        }
        public BodyDynamics Dynamics(float t)
        {
            var u = Mathf.Clamp01(t / TravelEnd);
            var traveling = Before != null && Stage != "resolve" && Stage != "return";
            var envelope = traveling ? Mathf.Sin(u * Mathf.PI) : 0;
            var impact = t >= LandingMoment ? Mathf.Sin(Mathf.Clamp01((t - LandingMoment) / .18f) * Mathf.PI) : 0;
            var kind = Before?.kind ?? Action.piece.kind;
            var jet = kind == "penguin" && Before?.promoted == true;
            return new BodyDynamics
            {
                pitch = (kind == "orca" ? Mathf.Sin(u * Mathf.PI * 2) * .18f * envelope : jet ? -.12f * envelope : kind == "walrus" ? .1f * envelope : 0) * Mathf.Rad2Deg,
                roll = (jet ? Mathf.Sin(u * Mathf.PI * 3) * .13f * envelope : kind == "orca" ? Mathf.Sin(u * Mathf.PI * 2) * .08f * envelope : 0) * Mathf.Rad2Deg,
                stretch = kind == "walrus" ? new Vector3(1 + impact * .13f, 1 - impact * .2f, 1 + impact * .1f) : jet ? new Vector3(1 - envelope * .07f, 1 - envelope * .09f, 1 + envelope * .12f) : Vector3.one,
                thrust = jet && traveling ? Smooth(u / .12f) * (1 - Smooth((u - .8f) / .2f)) : 0
            };
        }
        public float CaptureMoment(PieceState victim)
        {
            if (Waiting || Stage == "return")
                return float.PositiveInfinity;
            var at = LandingMoment;
            if (Before != null)
            {
                var landing = new PieceState { kind = Before.kind, promoted = Before.promoted, at = Action.action.to };
                if (!data.Body(victim).Any(c => data.Body(landing).Any(l => l.Same(c))))
                    at = Transformed || Stage == "resolve" ? .86f : .83f;
            }
            return at;
        }
        public float CaptureProgress(PieceState victim) => Smooth((Progress - CaptureMoment(victim)) / (Transformed || Stage == "resolve" ? .12f : .16f));
        public float TransferLaunch(PieceState victim, int index) => Started + CaptureMoment(victim) * Duration + Mathf.Min(.09f, Duration * .06f) + Mathf.Min(index * .035f, .210f);
        public float TransferArrival(PieceState victim, int index) => TransferLaunch(victim, index) + Mathf.Min(.650f, Duration * .55f);
    }
}
