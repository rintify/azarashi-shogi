import { JSDOM } from 'jsdom';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createElement } from 'react';
import { createRoot, extend, advance, act } from '@react-three/fiber';
import * as Three from 'three';
import { SceneEncoder } from '../src/unity/SceneEncoder';
import { createGame } from '../src/game/engine';
import { KINDS, DEFINITIONS, pieceName, dimensions } from '../src/game/pieces';
import { LEVELS } from '../src/ai/levels';
import { GUIDE_COLORS } from '../src/presentation/guideStyle';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimalIcon } from '../src/components/AnimalIcon';
import { Resvg } from '@resvg/resvg-js';

async function main() {
const dom = new JSDOM('<!doctype html><body></body>');
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, HTMLCanvasElement: dom.window.HTMLCanvasElement, IS_REACT_ACT_ENVIRONMENT: true });
extend(Three);
const { Animal } = await import('../src/scene/Animals');
const { BoardContents } = await import('../src/scene/BoardScene');
const canvas = document.createElement('canvas');
let sampledScene: Three.Scene, sampledCamera: Three.Camera;
const renderer = {
  domElement: canvas, render(scene:Three.Scene,camera:Three.Camera) { if(!this.target){sampledScene=scene;sampledCamera=camera;} }, dispose() {}, setSize() {}, setPixelRatio() {},
  xr: Object.assign(new Three.EventDispatcher(), { enabled:false, isPresenting:false, setAnimationLoop(){} }),
  shadowMap: { enabled:false, type:0 }, coordinateSystem: Three.WebGLCoordinateSystem,
  autoClear:true, toneMapping:0, outputColorSpace:'',
  target:null, getRenderTarget(){return this.target;}, setRenderTarget(target: null){this.target=target;}, getActiveCubeFace(){return 0;}, getActiveMipmapLevel(){return 0;},
};
const root = createRoot(canvas);
await root.configure({gl:renderer, frameloop:'never', size:{width:800,height:600,top:0,left:0}, camera:{position:[0,20,10],fov:38}, dpr:1});
const frames: { key:string; frame: ReturnType<SceneEncoder['encode']> }[] = [];
async function sample(element: ReturnType<typeof createElement>) {
  await act(async()=> { root.render(element); });
  advance(performance.now()/1000,true);
  advance(performance.now()/1000,true);
  return new SceneEncoder().encode(sampledScene,sampledCamera);
}
for (const kind of KINDS) for (const owner of ['south','north'] as const) for (const promoted of (['seal','penguin','orca'].includes(kind)?[false,true]:[false])) {
  const frame = await sample(createElement('group',{key:`${kind}:${owner}:${promoted}`,scale:kind==='walrus'?1:kind==='orca'?.9:.86},createElement(Animal,{kind,owner,promoted})));
  frames.push({key:`${kind}:${owner}:${promoted?1:0}`, frame});
}
const empty = {...createGame(),pieces:[]};
const noop=()=>{};
const world = await sample(createElement(BoardContents, {
  onReady:noop,game:empty,human:'south',selectedId:null,legalCells:[],stationaryGuide:null,reachableCells:[],unsafeCells:[],kingDangerCells:[],transformationSafeCells:[],kingCaptureTrapCells:[],previewKingCaptureTrap:false,previewKingDanger:false,helperIds:[],trappedIds:[],preview:null,previewUnsafe:false,threats:[],kingCaptureIds:[],view:'perspective',area:{x:20,y:140,width:760,height:390},motion:null,busy:false,reduced:true,onCell:noop,onPiece:noop,onHover:noop,htmlPortal:{current:document.createElement('div')},
}));
const lighting={hemisphere:{sky:'#ffffff',ground:'#000000',intensity:0},directional:[] as {position:number[];color:string;intensity:number;shadows:boolean}[]};
sampledScene.traverse(node=>{if(node instanceof Three.HemisphereLight)lighting.hemisphere={sky:'#'+node.color.getHexString(),ground:'#'+node.groundColor.getHexString(),intensity:node.intensity};if(node instanceof Three.DirectionalLight)lighting.directional.push({position:node.getWorldPosition(new Three.Vector3()).toArray(),color:'#'+node.color.getHexString(),intensity:node.intensity,shadows:node.castShadow});});
const directory='unity/Assets/Resources/Native';
const seenMeshes=new Set<string>(),seenMaterials=new Set<string>();
for(const frame of [world,...frames.map(entry=>entry.frame)]) {
  frame.meshes=frame.meshes.filter(mesh=>{if(seenMeshes.has(mesh.id))return false;seenMeshes.add(mesh.id);return true;});
  frame.materials=frame.materials.filter(material=>{if(seenMaterials.has(material.id))return false;seenMaterials.add(material.id);return true;});
}
await mkdir(directory,{recursive:true});
await mkdir(`${directory}/Icons`,{recursive:true});
for (const kind of KINDS) for (const promoted of (['seal','penguin','orca'].includes(kind)?[false,true]:[false])) {
  const svg=renderToStaticMarkup(createElement(AnimalIcon,{kind,promoted})).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ').replaceAll('var(--icon-cutout)','#f8fcff');
  await writeFile(`${directory}/Icons/${kind}-${promoted?1:0}.png`,new Resvg(svg,{fitTo:{mode:'width',value:128}}).render().asPng());
}
await writeFile(`${directory}/SceneAssets.json`, JSON.stringify({world, models:frames,lighting}));
await writeFile(`${directory}/GameConfig.json`, JSON.stringify({ initial:createGame(), levels:Object.entries(LEVELS).map(([level,config])=>({level:Number(level),...config})), pieces:KINDS.map(kind=>({kind,...DEFINITIONS[kind]})), variants:KINDS.flatMap(kind=>(['seal','penguin','orca'].includes(kind)?[false,true]:[false]).map(promoted=>({kind,promoted,name:pieceName({kind,promoted}),width:dimensions({kind,promoted})[0],height:dimensions({kind,promoted})[1]}))), colors:GUIDE_COLORS }));
await copyFile('src/ai/wasm/azarashi_engine.wasm',`${directory}/azarashi_engine.bytes`);
await copyFile('docs/fixtures/unity-smoke.json',`${directory}/smoke.json`);
console.log(`Exported ${frames.length} existing TSX animal variants and the original ice world.`);
await act(async()=>root.unmount());
}
main().catch(error=>{console.error(error);process.exitCode=1;});
