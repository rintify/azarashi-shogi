Shader "Azarashi/Surface" {
    Properties {
        _Color ("Color", Color) = (1,1,1,1)
        _Emission ("Emission", Color) = (0,0,0,1)
        _MainTex ("Texture", 2D) = "white" {}
        _Smoothness ("Smoothness", Range(0,1)) = 0.5
        _Metallic ("Metallic", Range(0,1)) = 0
        [Enum(UnityEngine.Rendering.CullMode)] _Cull ("Cull", Float) = 2
        _ZWrite ("Depth write", Float) = 1
        _ZTest ("Depth test", Float) = 4
        _SrcBlend ("Source blend", Float) = 1
        _DstBlend ("Destination blend", Float) = 0
    }
    SubShader {
        Tags { "RenderType"="Opaque" }
        Cull [_Cull] ZWrite [_ZWrite] ZTest [_ZTest] Blend [_SrcBlend] [_DstBlend]
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows addshadow keepalpha finalcolor:filmic
        #pragma target 3.0
        #pragma multi_compile_instancing
        #include "Filmic.cginc"
        sampler2D _MainTex;
        fixed4 _Color;
        half3 _Emission;
        half _Smoothness, _Metallic;
        struct Input { float2 uv_MainTex; };
        void surf(Input IN, inout SurfaceOutputStandard o) {
            fixed4 c = tex2D(_MainTex, IN.uv_MainTex) * _Color;
            o.Albedo = c.rgb; o.Alpha = c.a; o.Emission = _Emission;
            o.Metallic = _Metallic; o.Smoothness = _Smoothness;
        }
        void filmic(Input IN, SurfaceOutputStandard o, inout fixed4 color) {
            color.rgb = LinearToGammaSpace(AzarashiFilmic(color.rgb));
        }
        ENDCG
    }
    FallBack "Diffuse"
}
