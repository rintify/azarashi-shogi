Shader "Azarashi/Surface" {
    Properties {
        _Catalog ("Catalog lighting", Float) = 0
        _Color ("Linear color", Vector) = (1,1,1,1)
        _Emission ("Linear emission", Vector) = (0,0,0,1)
        _MainTex ("Texture", 2D) = "white" {}
        _Smoothness ("Smoothness", Range(0,1)) = .5
        _Metallic ("Metallic", Range(0,1)) = 0
        _Clearcoat ("Clearcoat", Range(0,1)) = 0
        _ClearcoatRoughness ("Clearcoat roughness", Range(0,1)) = 0
        _EnvIntensity ("Environment intensity", Float) = 1
        _FlatShading ("Flat shading", Float) = 0
        _Cull ("Cull", Float) = 2
        _ZWrite ("Depth write", Float) = 1
        _ZTest ("Depth test", Float) = 4
        _SrcBlend ("Source blend", Float) = 1
        _DstBlend ("Destination blend", Float) = 0
    }
    SubShader {
        Tags {"RenderType"="Opaque"}
        Pass {
            Tags {"LightMode"="ForwardBase"}
            Cull [_Cull] ZWrite [_ZWrite] ZTest [_ZTest] Blend [_SrcBlend] [_DstBlend]
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0
            #include "UnityCG.cginc"
            #include "Filmic.cginc"
            #include "PhysicalLighting.cginc"
            #include "SourceShadow.cginc"
            struct appdata {float4 vertex:POSITION;float3 normal:NORMAL;float2 uv:TEXCOORD0;};
            struct v2f {float4 pos:SV_POSITION;float3 world:TEXCOORD0;float3 normal:TEXCOORD1;float2 uv:TEXCOORD2;float4 shadow:TEXCOORD3;};
            sampler2D _MainTex;float4 _Color;float3 _Emission;
            float _Smoothness,_Metallic,_Clearcoat,_ClearcoatRoughness,_EnvIntensity,_FlatShading;
            v2f vert(appdata v){v2f o;o.pos=UnityObjectToClipPos(v.vertex);o.world=mul(unity_ObjectToWorld,v.vertex).xyz;o.normal=UnityObjectToWorldNormal(v.normal);o.uv=v.uv;o.shadow=SourceShadowCoord(o.world,o.normal);return o;}
            float4 frag(v2f i):SV_Target {
                float3 normal=normalize(i.normal);
                if(_FlatShading>.5)normal=normalize(cross(ddy(i.world),ddx(i.world)));
                float3 view=normalize(_WorldSpaceCameraPos-i.world);
                float3 dxy=max(abs(ddx(normal)),abs(ddy(normal)));
                float geometric=max(max(dxy.x,dxy.y),dxy.z);
                float roughness=min(1,max(1-_Smoothness,.0525)+geometric);
                float coatRoughness=min(1,max(_ClearcoatRoughness,.0525)+geometric);
                float4 base=tex2D(_MainTex,i.uv)*_Color;
                float3 color=PhysicalLight(normal,view,base.rgb,roughness,_Metallic,_Clearcoat,coatRoughness,_EnvIntensity,SourceShadow(i.shadow))+_Emission;
                float fog=_Catalog>.5?0:smoothstep(38,100,-mul(UNITY_MATRIX_V,float4(i.world,1)).z);
                color=lerp(AzarashiFilmic(color),float3(.25818285,.57758044,.77582222),fog);
                return float4(color,base.a);
            }
            ENDCG
        }
    }
}
