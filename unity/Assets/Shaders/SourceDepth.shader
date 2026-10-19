// Three r180 packing.glsl, MeshDepthMaterial RGBA depth packing (MIT).
Shader "Azarashi/SourceDepth" {
    Properties { _Cull ("Cull", Float) = 1 }
    SubShader {
        Pass {
            Cull [_Cull] ZWrite On ZTest LEqual
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 3.0
            #include "UnityCG.cginc"
            float4x4 _CasterShadowMatrix;
            struct v2f { float4 pos:SV_POSITION; float4 depth:TEXCOORD0; };
            v2f vert(float4 vertex:POSITION) {
                v2f o; o.pos=UnityObjectToClipPos(vertex);
                o.depth=mul(_CasterShadowMatrix,mul(unity_ObjectToWorld,vertex)); return o;
            }
            float4 frag(v2f i):SV_Target {
                float v=i.depth.z/i.depth.w;
                if(v<=0)return 0;
                if(v>=1)return 1;
                float whole=floor(v*16777216.0),a=frac(v*16777216.0);
                float b=frac(whole/256.0); whole=floor(whole/256.0);
                float g=frac(whole/256.0); whole=floor(whole/256.0);
                return float4(whole/255.0,g*(256.0/255.0),b*(256.0/255.0),a);
            }
            ENDCG
        }
    }
}
