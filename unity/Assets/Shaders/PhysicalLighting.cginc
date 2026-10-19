// Port of Three r180 cube_uv_reflection_fragment and lights_physical_pars_fragment (MIT).
// Keep all light accumulation linear; the view transform is applied once after accumulation.
sampler2D _OriginalEnvironment;
float4 _OriginalEnvironmentSize;
float3 _OriginalSky, _OriginalGround,_CatalogSky,_CatalogGround;
float _Catalog;
float4 _OriginalLightDirection[2], _OriginalLightColor[2];
float3 EnvironmentTile(float3 direction,float mip)
{
    float3 a=abs(direction);float face;
    if(a.x>a.z)face=a.x>a.y?(direction.x>0?0:3):(direction.y>0?1:4);
    else face=a.z>a.y?(direction.z>0?2:5):(direction.y>0?1:4);
    float2 uv;
    if(face==0)uv=float2(direction.z,direction.y)/a.x;
    else if(face==1)uv=float2(-direction.x,-direction.z)/a.y;
    else if(face==2)uv=float2(-direction.x,direction.y)/a.z;
    else if(face==3)uv=float2(-direction.z,direction.y)/a.x;
    else if(face==4)uv=float2(-direction.x,direction.z)/a.y;
    else uv=float2(direction.x,direction.y)/a.z;
    uv=.5*(uv+1);
    float filter=max(4-mip,0);mip=max(mip,4);float size=exp2(mip);
    uv=uv*(size-2)+1;
    if(face>2){uv.y+=size;face-=3;}
    uv.x+=face*size+filter*48;
    uv.y+=4*(exp2(_OriginalEnvironmentSize.z)-size);
    return tex2Dlod(_OriginalEnvironment,float4(uv/_OriginalEnvironmentSize.xy,0,0)).rgb;
}
float3 SampleEnvironment(float3 direction,float roughness)
{
    // The native world mirrors source Z once. Undo it before sampling the exported source map.
    direction.z=-direction.z;
    float mip;
    if(roughness>=.8)mip=(1-roughness)*5-2;
    else if(roughness>=.4)mip=(.8-roughness)*7.5-1;
    else if(roughness>=.305)mip=(.4-roughness)/.095+2;
    else if(roughness>=.21)mip=(.305-roughness)/.095+3;
    else mip=-2*log2(1.16*max(roughness,.001));
    mip=clamp(mip,-2,_OriginalEnvironmentSize.z);
    float level=floor(mip);
    return lerp(EnvironmentTile(direction,level),EnvironmentTile(direction,level+1),frac(mip));
}
float3 Schlick(float3 f0,float dotVH)
{
    float fresnel=exp2((-5.55473*dotVH-6.98316)*dotVH);
    return f0*(1-fresnel)+fresnel;
}
float3 GGX(float3 normal,float3 view,float3 light,float3 f0,float roughness)
{
    float3 halfDir=normalize(light+view);
    float nl=saturate(dot(normal,light)),nv=saturate(dot(normal,view)),nh=saturate(dot(normal,halfDir)),vh=saturate(dot(view,halfDir));
    float alpha=roughness*roughness,a2=alpha*alpha;
    float gv=nl*sqrt(a2+(1-a2)*nv*nv),gl=nv*sqrt(a2+(1-a2)*nl*nl);
    float visibility=.5/max(gv+gl,1e-6);
    float denom=nh*nh*(a2-1)+1;
    float distribution=.318309886*a2/(denom*denom);
    return Schlick(f0,vh)*visibility*distribution;
}
float2 DFG(float nv,float roughness)
{
    float4 r=roughness*float4(-1,-.0275,-.572,.022)+float4(1,.0425,1.04,-.04);
    float a004=min(r.x*r.x,exp2(-9.28*nv))*r.x+r.y;
    return float2(-1.04,1.04)*a004+r.zw;
}
float3 PhysicalLight(float3 normal,float3 view,float3 albedo,float roughness,float metallic,float clearcoat,float coatRoughness,float envIntensity,float shadow)
{
    const float invPi=.318309886;
    float3 diffuse=albedo*(1-metallic),specular=lerp(float3(.04,.04,.04),albedo,metallic);
    float nv=saturate(dot(normal,view));
    float3 color=0,coat=0;
    for(int k=0;k<2;k++)
    {
        if(_Catalog>.5&&k==1)break;
        float3 light=_Catalog>.5?normalize(float3(-3,6,-4)):_OriginalLightDirection[k].xyz;
        float3 irradiance=saturate(dot(normal,light))*(_Catalog>.5?float3(2.5,2.5,2.5):_OriginalLightColor[k].rgb)*(k==0?shadow:1);
        color+=irradiance*(diffuse*invPi+GGX(normal,view,light,specular,roughness));
        coat+=irradiance*GGX(normal,view,light,float3(.04,.04,.04),coatRoughness);
    }
    // Three's hemisphere is diffuse irradiance, separate from image-based multiscattering.
    color+=lerp(_Catalog>.5?_CatalogGround:_OriginalGround,_Catalog>.5?_CatalogSky:_OriginalSky,.5*normal.y+.5)*diffuse*invPi;
    if(_Catalog>.5)return color*(1-clearcoat*Schlick(float3(.04,.04,.04),nv))+coat*clearcoat;
    float3 irradiance=UNITY_PI*SampleEnvironment(normal,1)*envIntensity;
    float3 reflection=reflect(-view,normal);
    float3 radiance=SampleEnvironment(normalize(lerp(reflection,normal,roughness*roughness)),roughness)*envIntensity;
    float2 fab=DFG(nv,roughness);
    float3 single=specular*fab.x+fab.y;
    float ems=1-(fab.x+fab.y);
    float3 avg=specular+(1-specular)*.047619;
    float3 multi=single*avg/(1-ems*avg)*ems;
    float3 total=single+multi;
    float3 remaining=diffuse*(1-max(max(total.r,total.g),total.b));
    color+=radiance*single+(multi+remaining)*irradiance*invPi;
    float2 cc=DFG(nv,coatRoughness);
    coat+=SampleEnvironment(normalize(lerp(reflection,normal,coatRoughness*coatRoughness)),coatRoughness)*envIntensity*(.04*cc.x+cc.y);
    return color*(1-clearcoat*Schlick(float3(.04,.04,.04),nv))+coat*clearcoat;
}
