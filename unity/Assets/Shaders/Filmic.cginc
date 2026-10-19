// ACES fitted curve and matrices, matching the Three.js renderer's viewing transform.
// Source: three.js tonemapping_pars_fragment (MIT), ACES fit by Stephen Hill.
float3 AzarashiFilmic(float3 color) {
    const float3x3 inputMatrix = float3x3(
        .59719, .35458, .04823,
        .07600, .90834, .01566,
        .02840, .13383, .83777);
    const float3x3 outputMatrix = float3x3(
        1.60475, -.53108, -.07367,
        -.10208, 1.10813, -.00605,
        -.00327, -.07276, 1.07602);
    color = mul(inputMatrix, color * (.95 / .6));
    float3 a = color * (color + .0245786) - .000090537;
    float3 b = color * (.983729 * color + .4329510) + .238081;
    return saturate(mul(outputMatrix, a / b));
}
