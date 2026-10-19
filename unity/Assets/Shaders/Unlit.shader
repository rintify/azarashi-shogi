Shader "Azarashi/Unlit" {
    Properties {
        _Color ("Color", Color) = (1,1,1,1)
        _MainTex ("Texture", 2D) = "white" {}
        _Cull ("Cull", Float) = 2
        _ZWrite ("Depth write", Float) = 1
        _ZTest ("Depth test", Float) = 4
        _SrcBlend ("Source blend", Float) = 1
        _DstBlend ("Destination blend", Float) = 0
    }
    SubShader {
        Tags { "RenderType"="Transparent" }
        Pass {
            Tags { "LightMode"="ForwardBase" }
            Cull [_Cull] ZWrite [_ZWrite] ZTest [_ZTest] Blend [_SrcBlend] [_DstBlend]
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #pragma multi_compile_fwdbase nolightmap nodirlightmap nodynlightmap novertexlight
            #include "UnityCG.cginc"
            #include "AutoLight.cginc"
            struct appdata { float4 vertex: POSITION; float2 uv: TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 pos: SV_POSITION; float2 uv: TEXCOORD0; SHADOW_COORDS(1) };
            sampler2D _MainTex; float4 _Color;
            v2f vert(appdata v) { UNITY_SETUP_INSTANCE_ID(v); v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = v.uv; TRANSFER_SHADOW(o); return o; }
            fixed4 frag(v2f i): SV_Target { fixed4 c=tex2D(_MainTex, i.uv)*_Color;return fixed4(LinearToGammaSpace(c.rgb*lerp(.78,1,SHADOW_ATTENUATION(i))),c.a); }
            ENDCG
        }
    }
}
