Shader "Azarashi/Ocean" {
    Properties { _Color ("Deep", Color) = (0.002,0.098,0.185,1) _Emission ("Light", Color) = (0.008,0.266,0.429,1) _OceanTime ("React scene time", Float) = 0 }
    SubShader {
        Tags { "RenderType"="Opaque" }
        Pass {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #include "UnityCG.cginc"
            #include "Filmic.cginc"
            struct appdata { float4 vertex: POSITION; float2 uv: TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 vertex: SV_POSITION; float2 uv: TEXCOORD0; };
            float4 _Color, _Emission; float _OceanTime;
            v2f vert(appdata v) { UNITY_SETUP_INSTANCE_ID(v); v2f o; o.vertex = UnityObjectToClipPos(v.vertex); o.uv = v.uv; return o; }
            fixed4 frag(v2f i): SV_Target {
                float2 p = i.uv * 300; float t = _OceanTime;
                float a = sin(p.x*1.7+p.y*.65+t*.35), c = sin(p.x*.35+p.y*.44+t*.15);
                float ripple = pow(max(0,sin(p.x*.55+p.y*1.8+t*.3)),30) * (.5+.5*sin(p.x*.34-p.y*.2));
                float3 color = lerp(_Color.rgb,_Emission.rgb,.40+.08*c+.025*a) + float3(.12,.22,.25)*ripple*.13;
                return float4(AzarashiFilmic(color),1);
            }
            ENDCG
        }
    }
}
