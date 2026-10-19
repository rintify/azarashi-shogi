using System.Linq;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    public sealed partial class NativeHud
    {
        private VisualElement catalogStage;
        private bool catalogDragging;
        private bool resetCatalogCamera;
        private float catalogYawDelta, catalogPolarDelta;
        private float catalogPolar = 1.2205f, catalogDistance = 3.499f;
        public static float CatalogWheelDistance(float distance, float delta) => delta == 0 ? distance : Mathf.Clamp(distance * Mathf.Pow(.95f, -Mathf.Sign(delta)), 2.4f, 8);
        public static float CatalogPinchDistance(float distance, float previous, float current) => Mathf.Clamp(distance * previous / current, 2.4f, 8);
        public static void StepCatalogOrbit(ref float angle, ref float polar, ref float yawDelta, ref float polarDelta, bool autoRotate)
        {
            // Drei enables damping; three-stdlib updates it on each frame and
            // each pointer movement: .05 damping, .7 autoRotateSpeed, .07 degrees.
            if (autoRotate) yawDelta += .07f;
            angle += yawDelta * .05f;
            polar = Mathf.Clamp(polar + polarDelta * .05f, .35f, Mathf.PI / 2 - .04f);
            yawDelta *= .95f;
            polarDelta *= .95f;
        }
        private void ApplyCatalogOrbit() => StepCatalogOrbit(ref CatalogAngle, ref catalogPolar, ref catalogYawDelta, ref catalogPolarDelta, CatalogSpins && !catalogDragging);
        public void ResetCatalog()
        {
            CatalogIndex = 0;
            CatalogSpins = true;
            shownCatalog = -1;
            catalogDragging = false;
            catalogYawDelta = catalogPolarDelta = 0;
            resetCatalogCamera = true;
        }
        private void CatalogDialog()
        {
            var w = DialogWidth(720, true);
            var h = Mathf.Min(680, height - 28);
            var padding = width <= 600 ? 14 : 22;
            var gap = width <= 600 ? 10 : 12;
            var landscape = height <= 500 && width >= 600;
            var card = Modal("氷のなかま図鑑", h, 720, true);
            card.style.width = w;
            card.style.height = h;
            card.style.left = (width - w) / 2;
            card.style.top = (height - h) / 2;
            card.style.backgroundColor = C("#fffaf0");
            card.style.paddingLeft = card.style.paddingRight = card.style.paddingTop = card.style.paddingBottom = padding;
            var header = FlowBox(card, "catalog-header", "#fffcf3");
            Row(header);
            header.style.height = 56;
            header.style.paddingTop = header.style.paddingBottom = 8;
            header.style.marginBottom = gap;
            var book = Symbol(header, "book", 0, 0, 24, "#18394c");
            Inline(book);
            book.style.marginRight = 10;
            var heading = FlowText(header, "氷のなかま図鑑", width <= 600 ? 17 : 19, "#18394c", true);
            heading.style.flexGrow = 1;
            heading.style.marginTop = 6;
            var close = FlatButton(header, "x", 0, 0, 40, 40, match.Close, 24);
            Inline(close);
            var region = FlowBox(card, "catalog-content");
            region.style.flexGrow = 1;
            region.style.flexShrink = 1;
            region.style.minHeight = 0;
            if (landscape)
                region.style.flexDirection = FlexDirection.Row;
            else
                region.style.flexDirection = FlexDirection.Column;
            catalogStage = FlowBox(region, "native-catalog-stage", "#d9edf3", 25);
            catalogStage.userData = "native-ui";
            catalogStage.pickingMode = PickingMode.Position;
            catalogStage.style.flexGrow = 1;
            catalogStage.style.flexShrink = 1;
            catalogStage.style.minWidth = catalogStage.style.minHeight = 0;
            catalogStage.style.height = landscape ? StyleKeyword.Auto : 0;
            catalogStage.style.width = landscape ? 0 : StyleKeyword.Auto;
            Border(catalogStage, 3, "#ffffff");
            NativeUi.Skin(catalogStage, "catalog", 25);
            catalogStage.style.overflow = Overflow.Hidden;
            catalogStage.style.backgroundImage = new StyleBackground(Background.FromRenderTexture(catalogTexture));
            catalogStage.style.unityBackgroundScaleMode = ScaleMode.StretchToFill;
            if (!catalogStage.ClassListContains("drag-bound"))
            {
                catalogStage.AddToClassList("drag-bound");
                var inputStage = catalogStage;
                var previous = Vector2.zero;
                var touches = new Dictionary<int, Vector2>();
                var mousePointer = -1;
                var mouseButton = -1;
                var pinchDistance = 0f;
                System.Func<float> touchDistance = () => touches.Count == 2 ? Vector2.Distance(touches.Values.First(), touches.Values.Last()) : 0;
                System.Action<Vector2> rotate = delta =>
                {
                    catalogYawDelta += delta.x * 360 / Mathf.Max(1, inputStage.contentRect.height);
                    catalogPolarDelta -= delta.y * Mathf.PI * 2 / Mathf.Max(1, inputStage.contentRect.height);
                };
                catalogStage.RegisterCallback<PointerDownEvent>(e =>
                {
                    if (e.target != inputStage || catalogStage != inputStage)
                        return;
                    if (e.pointerType == UnityEngine.UIElements.PointerType.touch)
                    {
                        touches[e.pointerId] = e.position;
                        pinchDistance = touchDistance();
                    }
                    else
                    {
                        // Source right-button / modified-left panning is disabled.
                        if (e.button != 0 && e.button != 2 || e.button == 0 && (e.ctrlKey || e.commandKey || e.shiftKey)) return;
                        mousePointer = e.pointerId;
                        mouseButton = e.button;
                    }
                    catalogDragging = touches.Count == 1 || touches.Count == 2 || mousePointer >= 0;
                    previous = e.position;
                    inputStage.CapturePointer(e.pointerId);
                    e.StopPropagation();
                });
                catalogStage.RegisterCallback<PointerMoveEvent>(e =>
                {
                    if (catalogStage != inputStage) return;
                    var delta = (Vector2)e.position - previous;
                    if (touches.TryGetValue(e.pointerId, out var old))
                    {
                        touches[e.pointerId] = e.position;
                        if (touches.Count == 1) rotate((Vector2)e.position - old);
                        else if (touches.Count == 2)
                        {
                            var distance = touchDistance();
                            if (pinchDistance > 0 && distance > 0) catalogDistance = CatalogPinchDistance(catalogDistance, pinchDistance, distance);
                            pinchDistance = distance;
                        }
                        if (touches.Count <= 2) ApplyCatalogOrbit();
                    }
                    else if (e.pointerId == mousePointer)
                    {
                        // OrbitControls uses canvas HEIGHT for both rotation axes,
                        // and one zoom step per middle-button movement event.
                        if (mouseButton == 0) rotate(delta);
                        else if (mouseButton == 2) catalogDistance = CatalogWheelDistance(catalogDistance, delta.y);
                        ApplyCatalogOrbit();
                    }
                    previous = e.position;
                });
                System.Action<int> release = pointer =>
                {
                    touches.Remove(pointer);
                    pinchDistance = touchDistance();
                    if (mousePointer == pointer) { mousePointer = -1; mouseButton = -1; }
                    if (catalogStage == inputStage) catalogDragging = touches.Count == 1 || touches.Count == 2 || mousePointer >= 0;
                };
                catalogStage.RegisterCallback<PointerUpEvent>(e => { release(e.pointerId); inputStage.ReleasePointer(e.pointerId); });
                catalogStage.RegisterCallback<PointerCancelEvent>(e => { release(e.pointerId); inputStage.ReleasePointer(e.pointerId); });
                catalogStage.RegisterCallback<PointerCaptureOutEvent>(e => release(e.pointerId));
                catalogStage.RegisterCallback<WheelEvent>(e =>
                {
                    if (catalogStage != inputStage) return;
                    // Source three-stdlib OrbitControls applies getZoomScale()
                    // once per wheel event, independently of its delta magnitude.
                    if (touches.Count == 0 && mouseButton != 2)
                    {
                        catalogDistance = CatalogWheelDistance(catalogDistance, e.delta.y);
                        ApplyCatalogOrbit();
                    }
                    e.StopPropagation();
                });
            }
            for (var i = 0; i < 2; i++)
            {
                var delta = i == 0 ? -1 : 1;
                var button = Button(catalogStage, "", 0, 0, width <= 600 ? 36 : 44, width <= 600 ? 44 : 48, () => ChangeCatalog(delta), "#ffffffe0");
                Round(button, 16);
                Border(button, 0, "#ffffff");
                NativeUi.Bind(button, () => ChangeCatalog(delta), C("#ffffffe0"), C("#ffffffe0"));
                NativeUi.Skin(button, "catalogArrow", 16);
                button.style.top = Length.Percent(50);
                button.style.marginTop = -24;
                if (i == 0)
                    button.style.left = width <= 600 ? 6 : 10;
                else
                {
                    button.style.left = StyleKeyword.Auto;
                    button.style.right = width <= 600 ? 6 : 10;
                }
                CenteredSymbol(button, "triangle", 22, "#4a95b1").style.rotate = new Rotate(i == 0 ? -90 : 90);
            }
            var spin = FlowAction(catalogStage, CatalogSpins ? "回転中" : "回転する", CatalogSpins ? "pause" : "play", () => { CatalogSpins = !CatalogSpins; Rebuild(); }, "#ffffffcc", "#567d91", symbolFirst: true, iconSize: 15);
            spin.style.position = UnityEngine.UIElements.Position.Absolute;
            spin.style.left = 12;
            spin.style.top = StyleKeyword.Auto;
            spin.style.bottom = 12;
            spin.style.height = 36;
            spin.style.paddingLeft = spin.style.paddingRight = 10;
            Border(spin, 0, "#ffffff00");
            Round(spin, 16);
            foreach (var child in spin.Children())
            {
                if (child is Label label)
                {
                    label.style.fontSize = 11;
                    label.style.unityFontStyleAndWeight = FontStyle.Normal;
                }
                else
                    child.style.marginRight = 5;
            }
            var counter = Text(catalogStage, (CatalogIndex + 1) + " / " + match.Data.Config.variants.Length, 0, 0, 0, 19, 12, "#648799", false, TextAnchor.MiddleRight);
            counter.style.left = counter.style.top = StyleKeyword.Auto;
            counter.style.width = StyleKeyword.Auto;
            counter.style.right = 17;
            counter.style.bottom = 21;
            var info = FlowBox(region, "catalog-info");
            if (landscape)
            {
                info.style.width = 220;
                info.style.marginLeft = gap;
            }
            else
                info.style.marginTop = gap;
            var description = FlowBox(info, "catalog-description");
            description.style.minHeight = 88;
            if (landscape)
            {
                description.style.flexGrow = 1;
                description.style.justifyContent = Justify.Center;
            }
            var variant = match.Data.Config.variants[CatalogIndex];
            if (shownCatalog != CatalogIndex)
            {
                shownCatalog = CatalogIndex;
                CatalogBirth = Time.unscaledTime;
            }
            var name = FlowText(description, variant.name, width <= 600 ? 18 : 21, "#3b6f88", true);
            name.style.unityTextAlign = TextAnchor.MiddleCenter;
            name.style.marginTop = 3;
            name.style.marginBottom = 5;
            FlowText(description, variant.width + " × " + variant.height + " マス", 11, "#7794a0").style.unityTextAlign = TextAnchor.MiddleCenter;
            var body = FlowText(description, match.Data.Config.pieces.First(p => p.kind == variant.kind).description, width <= 600 ? 11 : 12, "#5a7a8c", lineHeight: (width <= 600 ? 11 : 12) * 1.7f);
            body.style.unityTextAlign = TextAnchor.MiddleCenter;
            body.style.marginTop = 8;
            body.style.maxWidth = 480;
            body.style.alignSelf = Align.Center;
            body.style.width = Length.Percent(100);
            var hint = FlowText(info, "ドラッグで好きな角度から眺められます", 10, "#8ba4ad");
            hint.style.unityTextAlign = TextAnchor.MiddleCenter;
            hint.style.marginTop = gap;
            hint.style.minHeight = 16;
        }
        private void ChangeCatalog(int delta)
        {
            CatalogIndex = (CatalogIndex + delta + match.Data.Config.variants.Length) % match.Data.Config.variants.Length;
            Rebuild();
        }
        private void UpdateCatalogCamera()
        {
            var w = catalogStage.contentRect.width;
            var h = catalogStage.contentRect.height;
            if (w < 1 || h < 1 || float.IsNaN(w) || float.IsNaN(h))
                return;
            var rw = Mathf.Clamp(Mathf.RoundToInt(w * uiScale), 1, 1600);
            var rh = Mathf.Clamp(Mathf.RoundToInt(h * uiScale), 1, 1600);
            var resized = catalogTexture.width != rw || catalogTexture.height != rh;
            if (resized)
            {
                catalogTexture.Release();
                catalogTexture.width = rw;
                catalogTexture.height = rh;
                catalogTexture.Create();
            }
            if (resized || resetCatalogCamera)
            {
                resetCatalogCamera = false;
                CatalogAngle = 0;
                catalogPolar = Mathf.Acos(1.2f / Mathf.Sqrt(1.8f * 1.8f + 1.2f * 1.2f + 2.75f * 2.75f));
                catalogDistance = Mathf.Clamp(Mathf.Sqrt(1.8f * 1.8f + 1.2f * 1.2f + 2.75f * 2.75f) * Mathf.Max(1, h / w), 2.4f, 8);
            }
            ApplyCatalogOrbit();
            var theta = Mathf.Atan2(1.8f, 2.75f) - CatalogAngle * Mathf.Deg2Rad;
            var offset = new Vector3(Mathf.Sin(catalogPolar) * Mathf.Sin(theta), Mathf.Cos(catalogPolar), -Mathf.Sin(catalogPolar) * Mathf.Cos(theta)) * catalogDistance;
            catalogCamera.aspect = w / h;
            catalogCamera.transform.position = new Vector3(50, .56f, 0) + offset;
            catalogCamera.transform.LookAt(new Vector3(50, .56f, 0));
        }
    }
}
