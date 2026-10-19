// Three r180 shadowmap_pars_fragment / shadowmap_vertex (MIT).
// Fixed source light frusta, receiver normal/depth bias, and PCFSoft taps.
sampler2D _SourceShadowMap, _CatalogShadowMap;
float4x4 _SourceShadowMatrix, _CatalogShadowMatrix;
float4 _SourceShadowSettings, _CatalogShadowSettings;
float _SourceShadowIntensity, _CatalogShadowIntensity, _ReceiveSourceShadow;
float4 SourceShadowCoord(float3 world, float3 normal) {
    float bias=_Catalog>.5?_CatalogShadowSettings.w:_SourceShadowSettings.w;
    float4 p=float4(world+normalize(normal)*bias,1);
    return _Catalog>.5?mul(_CatalogShadowMatrix,p):mul(_SourceShadowMatrix,p);
}
float SourceDepthCompare(sampler2D map,float2 uv,float depth) {
    #if UNITY_UV_STARTS_AT_TOP
        uv.y=1-uv.y;
    #endif
    float4 packed=tex2D(map,uv);
    float d=dot(packed,float4(255.0/256.0,255.0/65536.0,255.0/16777216.0,1.0/16777216.0));
    return step(depth,d);
}
float SourcePCFSoft(sampler2D map,float2 size,float intensity,float bias,float4 coord) {
    coord.xyz/=coord.w; coord.z+=bias;
    if(coord.x<0||coord.x>1||coord.y<0||coord.y>1||coord.z>1)return 1;
    float2 texel=1/size,uv=coord.xy,f=frac(uv*size+.5);
    uv-=f*texel; float dx=texel.x,dy=texel.y,z=coord.z;
    float shadow=(
        SourceDepthCompare(map,uv,z)+
        SourceDepthCompare(map,uv+float2(dx,0),z)+
        SourceDepthCompare(map,uv+float2(0,dy),z)+
        SourceDepthCompare(map,uv+texel,z)+
        lerp(SourceDepthCompare(map,uv+float2(-dx,0),z),SourceDepthCompare(map,uv+float2(2*dx,0),z),f.x)+
        lerp(SourceDepthCompare(map,uv+float2(-dx,dy),z),SourceDepthCompare(map,uv+float2(2*dx,dy),z),f.x)+
        lerp(SourceDepthCompare(map,uv+float2(0,-dy),z),SourceDepthCompare(map,uv+float2(0,2*dy),z),f.y)+
        lerp(SourceDepthCompare(map,uv+float2(dx,-dy),z),SourceDepthCompare(map,uv+float2(dx,2*dy),z),f.y)+
        lerp(lerp(SourceDepthCompare(map,uv+float2(-dx,-dy),z),SourceDepthCompare(map,uv+float2(2*dx,-dy),z),f.x),
             lerp(SourceDepthCompare(map,uv+float2(-dx,2*dy),z),SourceDepthCompare(map,uv+float2(2*dx,2*dy),z),f.x),f.y)
    )/9;
    return lerp(1,shadow,intensity);
}
float SourceShadow(float4 coord) {
    if(_ReceiveSourceShadow<.5)return 1;
    return _Catalog>.5?
        SourcePCFSoft(_CatalogShadowMap,_CatalogShadowSettings.xy,_CatalogShadowIntensity,_CatalogShadowSettings.z,coord):
        SourcePCFSoft(_SourceShadowMap,_SourceShadowSettings.xy,_SourceShadowIntensity,_SourceShadowSettings.z,coord);
}
