using System;

namespace Azarashi.UnityView
{
    // JsonUtility DTOs deliberately mirror src/unity/protocol.ts. No game rules live in Unity.
    [Serializable] public sealed class MeshGroup { public int start, count, materialIndex; }
    [Serializable] public sealed class MeshResource
    {
        public string id;
        public float[] positions, normals, uv;
        public int[] indices;
        public MeshGroup[] groups;
    }
    [Serializable] public sealed class MaterialResource
    {
        public string id, shader, texture;
        public float[] color, emissive;
        public float opacity, roughness, metalness, clearcoat, time;
        public bool transparent, additive, depthTest, depthWrite;
        public int side;
    }
    [Serializable] public sealed class RenderNode
    {
        public string id, mesh;
        public string[] materials;
        public float[] matrix;
        public bool visible, castShadow, receiveShadow;
        public int order;
    }
    [Serializable] public sealed class RenderCamera { public float[] world, projection; public float near, far; }
    [Serializable] public sealed class RenderFrame
    {
        public int protocol;
        public MeshResource[] meshes;
        public MaterialResource[] materials;
        public RenderNode[] nodes;
        public string[] removedNodes, removedMeshes, removedMaterials;
        public RenderCamera camera;
        public float[] background;
    }
}
