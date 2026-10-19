using UnityEngine;

namespace Azarashi.UnityView
{
    public sealed class NativeCamera
    {
        private readonly Camera camera;
        private Vector3 destination, target, look;
        private bool initialized, focused;
        private string side;
        private Vector3 orbitFrom;
        private float orbitStarted = -10;
        public bool Rotating => Time.unscaledTime - orbitStarted < .9f;
        public NativeCamera(Camera camera)
        {
            this.camera = camera;
            camera.ResetWorldToCameraMatrix();
            camera.ResetProjectionMatrix();
            camera.ResetCullingMatrix();
            camera.fieldOfView = 38;
        }
        public void Frame(Rect area, string human, bool top, PieceState focus, NativeGameData data, bool reduced, float ceiling = 1.7f)
        {
            // Like SceneCamera, wait for a measured HUD rectangle. The engine can become
            // ready before the first HUD layout; dividing by its zero width poisons the camera.
            if (!(area.width >= 1 && area.height >= 1))
                return;
            var direction = new Vector3(0, top ? 1 : 1.9f, (human == "south" ? -1 : 1) * (top ? .001f : 1)).normalized;
            var rotation = Quaternion.LookRotation(-direction, Vector3.up);
            var inverse = Quaternion.Inverse(rotation);
            var tangent = Mathf.Tan(38 * Mathf.Deg2Rad * .5f);
            var distance = 1f;
            var aspect = area.width / Mathf.Max(1, area.height);
            foreach (var x in new[] { -5.4f, 5.4f })
                foreach (var y in new[] { 0, ceiling })
                    foreach (var z in new[] { -5.4f, 5.4f })
                    {
                        var v = inverse * new Vector3(x, y, z);
                        distance = Mathf.Max(distance, Mathf.Abs(v.x) / (tangent * aspect) - v.z, Mathf.Abs(v.y) / tangent - v.z);
                    }
            destination = direction * distance * 1.015f;
            target = Vector3.zero;
            focused = focus != null;
            if (focus != null)
            {
                aspect = (float)Screen.width / Screen.height;
                var center = data.Center(focus);
                center.z = -center.z;
                target = center + Vector3.up * .65f;
                destination = target + new Vector3(.45f, 1.35f, focus.owner == "south" ? 1.8f : -1.8f).normalized * Mathf.Max(7.5f, 4.5f + Mathf.Max(data.Variant(focus).width, data.Variant(focus).height) * 2) * Mathf.Max(1, .85f / Mathf.Max(.25f, aspect));
            }
            if (side != null && side != human && !reduced)
            {
                orbitFrom = camera.transform.position;
                orbitStarted = Time.unscaledTime;
            }
            side = human;
            if (!initialized || reduced)
            {
                camera.transform.position = destination;
                look = target;
                initialized = true;
            }
            if (focus != null)
            {
                camera.projectionMatrix = Matrix4x4.Perspective(38, aspect, .1f, 160);
                return;
            }
            var near = .1f;
            var half = near * tangent;
            var width = half * 2 * aspect;
            var height = half * 2;
            var left = -width * .5f - area.x / area.width * width;
            var upper = half + area.y / area.height * height;
            camera.projectionMatrix = Matrix4x4.Frustum(left, left + Screen.width / area.width * width, upper - Screen.height / area.height * height, upper, near, 160);
        }
        public void Tick(bool reduced)
        {
            if (!initialized)
                return;
            var blend = reduced ? 1 : 1 - Mathf.Exp(-Time.unscaledDeltaTime * (focused ? 2.4f : 6));
            if (Rotating)
            {
                camera.transform.position = SampleOrbit(orbitFrom, destination, (Time.unscaledTime - orbitStarted) / .9f);
            }
            else
                camera.transform.position = Vector3.Lerp(camera.transform.position, destination, blend);
            look = Vector3.Lerp(look, target, blend);
            camera.transform.LookAt(look);
        }
        public static Vector3 SampleOrbit(Vector3 from, Vector3 to, float progress)
        {
            // Interpolate in the original right-handed coordinates, then mirror Z once.
            // Choosing +PI in Unity coordinates reverses the original half-turn path.
            from.z = -from.z;
            to.z = -to.z;
            var t = Mathf.Clamp01(progress);
            var ease = t * t * (3 - 2 * t);
            var fromAngle = Mathf.Atan2(from.x, from.z);
            var toAngle = Mathf.Atan2(to.x, to.z);
            var turn = Mathf.Atan2(Mathf.Sin(toAngle - fromAngle), Mathf.Cos(toAngle - fromAngle));
            if (Mathf.Abs(Mathf.Abs(turn) - Mathf.PI) < .00001f)
                turn = Mathf.PI;
            var angle = fromAngle + turn * ease;
            var radius = Mathf.Lerp(new Vector2(from.x, from.z).magnitude, new Vector2(to.x, to.z).magnitude, ease);
            return new Vector3(Mathf.Sin(angle) * radius, Mathf.Lerp(from.y, to.y, ease), -Mathf.Cos(angle) * radius);
        }
    }
}
