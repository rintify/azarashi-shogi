import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls, RoundedBox } from '@react-three/drei';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { ActionPreview, Cell, GameState, Piece, Player, Threat } from '../game/types';
import { cellKey } from '../game/types';
import { dimensions } from '../game/pieces';
import { Animal } from './Animals';

export interface BoardProps {
  game: GameState;
  human: Player;
  selectedId: string | null;
  legalCells: Cell[];
  preview: ActionPreview | null;
  threats: Threat[];
  threatSources: string[];
  view: 'perspective' | 'top';
  cameraReset: number;
  onCell: (cell: Cell) => void;
  onHover: (cell: Cell | null) => void;
  onThreat: (id: string) => void;
}
const world = (cell: Cell, width = 1, height = 1): [number, number, number] => [cell.x - 5 + width / 2, 0, cell.y - 5 + height / 2];
function Camera({ view, reset, human }: { view: BoardProps['view']; reset: number; human: Player }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  useEffect(() => {
    const side = human === 'south' ? 1 : -1;
    const scale = Math.max(1, size.height / size.width);
    camera.position.set(view === 'top' ? 0 : 7.5 * side * scale, (view === 'top' ? 20 : 15.5) * scale, view === 'top' ? 0.01 * side : 13 * side * scale);
    camera.lookAt(new Vector3(0, 0, 0));
    if (controls.current) { controls.current.target.set(0, 0, 0); controls.current.update(); }
  }, [camera, view, reset, human, size.width, size.height]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={10} maxDistance={34} minPolarAngle={0.02} maxPolarAngle={Math.PI / 2.65} enableRotate={view !== 'top'} />;
}
function IceWorld() {
  return <>
    <color attach="background" args={['#cce6f1']} />
    <fog attach="fog" args={['#cce6f1', 25, 68]} />
    <hemisphereLight args={['#f1fbff', '#a5b9c1', 1.5]} />
    <directionalLight position={[-8, 18, 8]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-normalBias={0.035} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.66, 0]} receiveShadow><planeGeometry args={[180, 180]} /><meshStandardMaterial color="#e6f2f6" roughness={0.95} /></mesh>
    {[[-18, -14, 4], [15, -22, 6], [-9, -30, 5], [25, -13, 3], [-22, 5, 2]].map(([x, z, size], i) => <mesh key={i} position={[x, -0.2, z]} rotation={[0, i * 0.7, 0]} receiveShadow><coneGeometry args={[size, size * 0.8, 5]} /><meshStandardMaterial color={i % 2 ? '#eaf5f8' : '#f6fbfc'} flatShading /></mesh>)}
    <RoundedBox args={[10.6, 0.55, 10.6]} radius={0.16} position={[0, -0.32, 0]} receiveShadow castShadow><meshStandardMaterial color="#9fc9d5" roughness={0.35} /></RoundedBox>
    <RoundedBox args={[10.4, 0.12, 10.4]} radius={0.05} position={[0, -0.04, 0]} receiveShadow><meshStandardMaterial color="#f8fcfc" roughness={0.6} /></RoundedBox>
  </>;
}
function BoardContents(props: BoardProps) {
  const { game, selectedId, legalCells, preview, threats, threatSources, onCell, onHover, onThreat } = props;
  const legal = useMemo(() => new Set(legalCells.map(cellKey)), [legalCells]);
  const capturedIds = new Set(preview?.captured.map(p => p.id));
  const targetCells = new Set(preview?.footprint.map(cellKey));
  const captureCells = new Set(preview?.captureCells.map(cellKey));
  const lastCells = new Set(game.lastAction?.footprint.map(cellKey));
  return <>
    <IceWorld />
    {Array.from({ length: 100 }, (_, i) => {
      const cell = { x: i % 10, y: Math.floor(i / 10) }, key = cellKey(cell);
      const available = legal.has(key), target = targetCells.has(key), extra = captureCells.has(key) && !target;
      const color = target ? '#80d3bd' : extra ? '#f0c184' : available ? '#d0e8da' : lastCells.has(key) ? '#d4e9ed' : (cell.x + cell.y) % 2 === 0 ? '#e6f2f5' : '#c5dce6';
      return <group key={key} position={world(cell)}>
        <mesh position={[0, 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={e => { e.stopPropagation(); onCell(cell); }} onPointerMove={e => { e.stopPropagation(); onHover(cell); }} onPointerOut={() => onHover(null)}>
          <planeGeometry args={[0.974, 0.974]} /><meshStandardMaterial color={color} roughness={0.65} />
        </mesh>
        {available && !target && <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.075, 24]} /><meshBasicMaterial color="#64a99a" transparent opacity={0.75} /></mesh>}
      </group>;
    })}
    {Array.from({ length: 10 }, (_, i) => <group key={i}>
      <Html position={[i - 4.5, 0.04, 5.32]} center className="board-coordinate" zIndexRange={[1, 0]}>{String.fromCharCode(65 + i)}</Html>
      <Html position={[-5.32, 0.04, i - 4.5]} center className="board-coordinate" zIndexRange={[1, 0]}>{10 - i}</Html>
    </group>)}
    {game.pieces.map(piece => <BoardAnimal key={piece.id} piece={piece} selected={selectedId === piece.id} captured={capturedIds.has(piece.id)} source={threatSources.includes(piece.id)} threatened={threats.some(t => t.targetId === piece.id)} onClick={() => onCell(piece.at)} onHover={onHover} onThreat={() => onThreat(piece.id)} />)}
    {preview && <group position={world(preview.piece.at, ...dimensions(preview.piece))}>
      {preview.footprint.map(c => <mesh key={cellKey(c)} position={[c.x - preview.piece.at.x - (dimensions(preview.piece)[0] - 1) / 2, 0.08, c.y - preview.piece.at.y - (dimensions(preview.piece)[1] - 1) / 2]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.39, 0.44, 4, 1, Math.PI / 4]} /><meshBasicMaterial color="#2c9c81" transparent opacity={0.9} /></mesh>)}
      {preview.action.type === 'place' && <group position={[0, 0.13, 0]} scale={0.85}><Animal kind={preview.piece.kind} /></group>}
    </group>}
    <Camera view={props.view} reset={props.cameraReset} human={props.human} />
  </>;
}
function BoardAnimal({ piece, selected, captured, source, threatened, onClick, onHover, onThreat }: { piece: Piece; selected: boolean; captured: boolean; source: boolean; threatened: boolean; onClick: () => void; onHover: BoardProps['onHover']; onThreat: () => void }) {
  const [w, h] = dimensions(piece);
  const rotation = piece.kind === 'orca' && piece.promoted ? Math.PI / 2 : piece.owner === 'north' ? Math.PI : 0;
  const color = captured ? '#e79571' : source ? '#edb85c' : selected ? '#52b59d' : piece.owner === 'south' ? '#78b6c7' : '#e8b095';
  return <group position={world(piece.at, w, h)} onClick={e => { e.stopPropagation(); onClick(); }} onPointerMove={e => { e.stopPropagation(); onHover(piece.at); }} onPointerOut={() => onHover(null)}>
    <RoundedBox args={[w - 0.14, 0.09, h - 0.14]} radius={0.06} position={[0, 0.1, 0]} castShadow><meshStandardMaterial color={color} roughness={0.4} transparent opacity={captured ? 0.6 : 1} /></RoundedBox>
    <RoundedBox args={[w - 0.22, 0.055, h - 0.22]} radius={0.04} position={[0, 0.165, 0]} receiveShadow><meshStandardMaterial color={selected ? '#e4f5eb' : '#f2f5ed'} /></RoundedBox>
    <group position={[0, 0.21, 0]} rotation={[0, rotation, 0]} scale={piece.kind === 'orca' ? 0.88 : piece.kind === 'walrus' ? 1 : 0.86}><Animal kind={piece.kind} promoted={piece.promoted} animate={selected} /></group>
    <mesh position={[0, 0.202, (h / 2 - 0.19) * (piece.owner === 'south' ? -1 : 1)]} rotation={[-Math.PI / 2, 0, piece.owner === 'south' ? 0 : Math.PI]}><circleGeometry args={[0.068, 3]} /><meshBasicMaterial color={color} /></mesh>
    {threatened && <Html position={[w / 2 - 0.12, piece.kind === 'walrus' ? 1.5 : 1.2, 0]} center zIndexRange={[20, 10]}><button className="threat-badge" aria-label="この駒を捕食できる相手を表示" onClick={e => { e.stopPropagation(); onThreat(); }}>!</button></Html>}
  </group>;
}
export function BoardScene(props: BoardProps) {
  return <Suspense fallback={<div className="canvas-loading">氷の盤面を準備しています…</div>}>
    <Canvas shadows dpr={[1, 1.7]} camera={{ position: [7.8, 12.8, 11.8], fov: 43 }} gl={{ antialias: true, alpha: false }} onPointerMissed={() => props.onHover(null)}>
      <BoardContents {...props} />
    </Canvas>
  </Suspense>;
}
