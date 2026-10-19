using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Azarashi.UnityView
{
    /// <summary>Instances meshes exported from the existing TSX models; Unity owns their playback.</summary>
    public sealed class NativeBoard
    {
        private readonly SceneRenderer renderer;
        private readonly NativeGameData data;
        private readonly Dictionary<string,ModelAsset> models;
        private readonly HashSet<string> active=new HashSet<string>();
        private readonly HashSet<string> next=new HashSet<string>();
        private readonly HashSet<string> guideMaterials=new HashSet<string>();
        private readonly Dictionary<string,ActorCache> actorCache=new Dictionary<string,ActorCache>();
        private sealed class ActorCache {public string model;public Vector3 position;public float yaw,scale,morph;public bool before;public string[] ids;}
        private readonly string fillMesh="native-cell",dotMesh="native-dot";
        private readonly string sphereMesh;
        public Camera Camera=>renderer.Camera;
        public NativeBoard(SceneRenderer renderer,NativeGameData data)
        {
            this.renderer=renderer;this.data=data;models=data.Assets.models.ToDictionary(m=>m.key);
            sphereMesh=data.Assets.models[0].frame.nodes[0].mesh;
            renderer.ConfigureLighting(data.Assets.lighting);
            renderer.LoadAssets(data.Assets.world);
            foreach(var model in data.Assets.models)renderer.LoadAssets(model.frame);
            var sourceMaterials=data.Assets.world.materials.ToDictionary(m=>m.id);
            foreach(var node in data.Assets.world.nodes)
            {
                if(!node.visible)continue;
                // Floor colors retain their original source palette instead of inheriting a new light tint.
                if(Math.Abs(node.matrix[13]-.16f)<.002f&&node.materials.Length==1&&sourceMaterials.TryGetValue(node.materials[0],out var material))
                {material.shader="unlit";renderer.LoadAssets(new RenderFrame{meshes=Array.Empty<MeshResource>(),materials=new[]{material}});}
                renderer.PutNode(node);
            }
            var quad=new MeshResource{id=fillMesh,positions=new[]{-.49f,0f,-.49f,.49f,0f,-.49f,.49f,0f,.49f,-.49f,0f,.49f},normals=new[]{0f,1f,0f,0f,1f,0f,0f,1f,0f,0f,1f,0f},uv=new float[8],indices=new[]{0,2,1,0,3,2},groups=Array.Empty<MeshGroup>()};
            var vertices=new List<float>{0,0,0};var indices=new List<int>();
            for(var i=0;i<=32;i++){var a=i*Mathf.PI*2/32;vertices.Add(Mathf.Cos(a)*.105f);vertices.Add(0);vertices.Add(Mathf.Sin(a)*.105f);if(i>0){indices.Add(0);indices.Add(i+1);indices.Add(i);}}
            var dot=new MeshResource{id=dotMesh,positions=vertices.ToArray(),normals=Array.Empty<float>(),uv=Array.Empty<float>(),indices=indices.ToArray(),groups=Array.Empty<MeshGroup>()};
            renderer.LoadAssets(new RenderFrame{meshes=new[]{quad,dot},materials=Array.Empty<MaterialResource>()});
            var ringVertices=new List<float>();var ringIndices=new List<int>();for(var i=0;i<=64;i++){var angle=i*Mathf.PI*2/64;foreach(var radius in new[]{1f,.95f}){ringVertices.Add(Mathf.Cos(angle)*radius);ringVertices.Add(0);ringVertices.Add(Mathf.Sin(angle)*radius);}if(i>0){var a=(i-1)*2;ringIndices.AddRange(new[]{a,a+2,a+1,a+1,a+2,a+3});}}
            renderer.LoadAssets(new RenderFrame{meshes=new[]{new MeshResource{id="native-ring",positions=ringVertices.ToArray(),normals=Array.Empty<float>(),uv=Array.Empty<float>(),indices=ringIndices.ToArray(),groups=Array.Empty<MeshGroup>()}},materials=Array.Empty<MaterialResource>()});
            var edges=new List<float>();var edgeIndices=new List<int>();
            var corners=new[]{new Vector2(-.49f,-.49f),new Vector2(.49f,-.49f),new Vector2(.49f,.49f),new Vector2(-.49f,.49f)};
            for(var i=0;i<4;i++){var a=corners[i];var b=corners[(i+1)%4];var n=(b-a).normalized;var perpendicular=new Vector2(-n.y,n.x)*.022f;var start=edges.Count/3;foreach(var v in new[]{a,b,b+perpendicular,a+perpendicular})edges.AddRange(new[]{v.x,0,v.y});edgeIndices.AddRange(new[]{start,start+2,start+1,start,start+3,start+2});}
            renderer.LoadAssets(new RenderFrame{meshes=new[]{new MeshResource{id="native-outline",positions=edges.ToArray(),normals=Array.Empty<float>(),uv=Array.Empty<float>(),indices=edgeIndices.ToArray(),groups=Array.Empty<MeshGroup>()}},materials=Array.Empty<MaterialResource>()});
        }
        private static Matrix4x4 Matrix(float[] values)=>SceneRenderer.Matrix(values);
        private static float[] ArrayOf(Matrix4x4 matrix){var values=new float[16];for(var i=0;i<16;i++)values[i]=matrix[i];return values;}
        public void Begin(){next.Clear();}
        public void End(){foreach(var id in active)if(!next.Contains(id))renderer.RemoveNode(id);active.Clear();foreach(var id in next)active.Add(id);}
        public void Piece(PieceState piece,Vector3 position,float yaw,float scale=1,float morph=-1,bool beforePromoted=false)
        {
            var key=data.ModelKey(piece);
            if(actorCache.TryGetValue(piece.id,out var cached)&&cached.ids.Length>0&&active.Contains(cached.ids[0])&&cached.model==key&&cached.position==position&&cached.yaw==yaw&&cached.scale==scale&&cached.morph==morph&&cached.before==beforePromoted){foreach(var id in cached.ids)next.Add(id);return;}
            var shown=new PieceState{id=piece.id,at=piece.at,kind=piece.kind,owner=piece.owner,promoted=morph>=0?beforePromoted:piece.promoted};
            var model=models[data.ModelKey(shown)];ModelAsset target=null;
            if(morph>=0&&piece.kind=="penguin")target=models[piece.kind+":"+piece.owner+":"+(beforePromoted?0:1)];
            var root=Matrix4x4.TRS(position+Vector3.up*.16f,Quaternion.Euler(0,yaw,0),Vector3.one*scale);
            var ids=new string[model.frame.nodes.Length];
            for(var i=0;i<model.frame.nodes.Length;i++)
            {
                var source=model.frame.nodes[i];var local=Matrix(source.matrix);var visible=source.visible;
                if(target!=null&&i<target.frame.nodes.Length)
                {
                    var end=target.frame.nodes[i];var to=Matrix(end.matrix);var blend=Mathf.SmoothStep(0,1,morph);
                    local=Matrix4x4.TRS(Vector3.Lerp(local.GetColumn(3),to.GetColumn(3),blend),Quaternion.Slerp(local.rotation,to.rotation,blend),Vector3.Lerp(local.lossyScale,to.lossyScale,blend));
                    visible=source.visible||end.visible&&morph>.01f;
                }
                var id="piece:"+piece.id+":"+i;next.Add(id);ids[i]=id;
                renderer.PutNode(new RenderNode{id=id,mesh=source.mesh,materials=source.materials,matrix=ArrayOf(root*local),visible=visible&&scale>.005f,castShadow=piece.id!="catalog"&&source.castShadow,receiveShadow=piece.id!="catalog"&&source.receiveShadow,order=source.order});
            }
            actorCache[piece.id]=new ActorCache{model=key,position=position,yaw=yaw,scale=scale,morph=morph,before=beforePromoted,ids=ids};
        }
        private string GuideMaterial(string color,float opacity)
        {
            var materialId="guide:"+color+":"+opacity.ToString("F3",System.Globalization.CultureInfo.InvariantCulture);
            ColorUtility.TryParseHtmlString(color,out var c);c=c.linear;
            if(guideMaterials.Add(materialId))renderer.LoadAssets(new RenderFrame{meshes=Array.Empty<MeshResource>(),materials=new[]{new MaterialResource{id=materialId,shader="unlit",color=new[]{c.r,c.g,c.b},emissive=new[]{0f,0f,0f},opacity=opacity,transparent=true,side=2,depthTest=true,depthWrite=false,roughness=1,texture=""}}});
            return materialId;
        }
        public void Guide(Cell cell,string color,float opacity,bool dot=false,int layer=0)
        {
            var materialId=GuideMaterial(color,opacity);
            var id="guide:"+cell.x+":"+cell.y+":"+(dot?"dot":"fill")+":"+layer;next.Add(id);
            renderer.PutNode(new RenderNode{id=id,mesh=dot?dotMesh:fillMesh,materials=new[]{materialId},matrix=ArrayOf(Matrix4x4.Translate(new Vector3(cell.x-4.5f,.17f+layer*.002f+(dot?.004f:0),cell.y-4.5f))),visible=true,castShadow=false,receiveShadow=false});
        }
        public void Outline(Cell cell,string color)
        {
            var id="outline:"+cell.x+":"+cell.y;next.Add(id);
            var materialId=GuideMaterial(color,.8f);
            renderer.PutNode(new RenderNode{id=id,mesh="native-outline",materials=new[]{materialId},matrix=ArrayOf(Matrix4x4.Translate(new Vector3(cell.x-4.5f,.183f,cell.y-4.5f))),visible=true,castShadow=false,receiveShadow=false});
        }
        public bool CellAt(Vector2 screen,out Cell cell)
        {
            var ray=Camera.ScreenPointToRay(screen);var plane=new Plane(Vector3.up,new Vector3(0,.17f,0));
            if(plane.Raycast(ray,out var distance)){var p=ray.GetPoint(distance);cell=new Cell(Mathf.FloorToInt(p.x+5),Mathf.FloorToInt(-p.z+5));return cell.x>=0&&cell.x<10&&cell.y>=0&&cell.y<10;}
            cell=null;return false;
        }
        public bool PieceAt(Vector2 screen,out string id,out Vector3 point)=>renderer.Pick(Camera.ScreenPointToRay(screen),out id,out point);
        public Vector2 Marker(string id)=>renderer.SurfaceAnchor("piece:"+id+":");
        public void OceanTime(float time)=>renderer.OceanTime(time);
        public void Effect(string id,Vector3 position,Vector3 scale,string color,float opacity,bool ring=false,float yaw=0)
        {
            opacity=Mathf.Round(Mathf.Clamp01(opacity)*20)/20;if(opacity<=0)return;var materialId="effect:"+color+":"+opacity;
            if(guideMaterials.Add(materialId)){ColorUtility.TryParseHtmlString(color,out var c);c=c.linear;renderer.LoadAssets(new RenderFrame{meshes=Array.Empty<MeshResource>(),materials=new[]{new MaterialResource{id=materialId,shader="unlit",color=new[]{c.r,c.g,c.b},emissive=new[]{0f,0f,0f},opacity=opacity,transparent=true,side=2,depthTest=true,depthWrite=false,roughness=1,texture=""}}});}
            var key="fx:"+id;next.Add(key);renderer.PutNode(new RenderNode{id=key,mesh=ring?"native-ring":sphereMesh,materials=new[]{materialId},matrix=ArrayOf(Matrix4x4.TRS(position,Quaternion.Euler(0,yaw,0),scale)),visible=true,castShadow=false,receiveShadow=false});
        }
    }
}
