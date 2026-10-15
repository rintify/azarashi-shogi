import { Suspense, useMemo, useState, useEffect, type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three';
import type { ActionPreview, Cell, GameState, Player, Threat } from '../game/types';
import { cellKey } from '../game/types';
import { dimensions } from '../game/pieces';
import { Animal } from './Animals';
import { center, facing, type MoveMotion } from '../presentation/motion';
import type { PlayArea } from '../presentation/usePlayArea';
import { SceneCamera } from './SceneCamera';
import { IceWorld } from './IceWorld';
import { PieceActor } from './PieceActor';
import { ActionEffects } from './ActionEffects';
export interface BoardProps {
  onReady: () => void;
  game: GameState;
  human: Player;
  selectedId: string | null;
  legalCells: Cell[];
  reachableCells: Cell[];
  unsafeCells: Cell[];
  preview: ActionPreview | null;
  threats: Threat[];
  threatSources: string[];
  view: 'perspective' | 'top';
  area: PlayArea | null;
  motion: MoveMotion | null;
  busy: boolean;
  reduced: boolean;
  onCell: (cell: Cell) => void;
  onHover: (cell: Cell | null) => void;
  onThreat: (id: string) => void;
}
function BoardContents(props: BoardProps & { htmlPortal: RefObject<HTMLDivElement> }) {
  const { game, selectedId, preview, motion, busy } = props;
  useEffect(props.onReady, [props.onReady]);
  const legal = useMemo(() => new Set(props.legalCells.map(cellKey)), [props.legalCells]);
  const reachable = new Set(props.reachableCells.map(cellKey));
  const unsafe = new Set(props.unsafeCells.map(cellKey));
  const target = new Set((preview ?? motion?.action)?.footprint.map(cellKey));
  const extra = new Set((preview ?? motion?.action)?.captureCells.map(cellKey));
  const captured = new Set(preview?.captured.map((p) => p.id));
  const last = new Set(game.lastAction?.footprint.map(cellKey));
  return (
    <>
      <IceWorld reduced={props.reduced} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.151, 0]} receiveShadow>
        <planeGeometry args={[10.04, 10.04]} />
        <meshStandardMaterial color="#74a7bd" roughness={0.85} envMapIntensity={0.15} />
      </mesh>
      {Array.from({ length: 100 }, (_, i) => {
        const cell = { x: i % 10, y: Math.floor(i / 10) },
          key = cellKey(cell);
        const active = target.has(key),
          additional = extra.has(key) && !active;
        return (
          <group key={key} position={[cell.x - 4.5, 0.16, cell.y - 4.5]}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                if (!busy && e.delta < 6) props.onCell(cell);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (!busy) props.onHover(cell);
              }}
              onPointerMove={(e) => {
                e.stopPropagation();
                if (!busy) props.onHover(cell);
              }}
              onPointerOut={() => props.onHover(null)}
            >
              <planeGeometry args={[0.98, 0.98]} />
              <meshStandardMaterial
                envMapIntensity={0.2}
                color={(cell.x + cell.y) % 2 ? '#b9d4e0' : '#e3f0f5'}
                roughness={0.82}
              />
            </mesh>
            {(active || additional || reachable.has(key) || last.has(key)) && (
              <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <planeGeometry args={[0.98, 0.98]} />
                <meshBasicMaterial
                  color={additional ? '#f4ad62' : '#42b9d8'}
                  transparent
                  opacity={active || additional ? 0.36 : reachable.has(key) ? 0.2 : 0.1}
                  depthWrite={false}
                />
              </mesh>
            )}
            {legal.has(key) && !busy && (
              <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.105, 32]} />
                <meshBasicMaterial
                  color={unsafe.has(key) ? '#d8782c' : '#087b9f'}
                  transparent
                  opacity={0.8}
                />
              </mesh>
            )}
            {(active || additional || last.has(key)) && (
              <mesh position={[0, 0.009, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.43, 0.46, 4, 1, Math.PI / 4]} />
                <meshBasicMaterial
                  color={active ? '#098bba' : additional ? '#e8893d' : '#6fa9be'}
                  transparent
                  opacity={active || additional ? 0.9 : 0.45}
                />
              </mesh>
            )}
          </group>
        );
      })}
      {Array.from({ length: 10 }, (_, i) => (
        <group key={i}>
          <Html
            position={[i - 4.5, 0.18, 5.25]}
            center
            className="board-coordinate"
            portal={props.htmlPortal}
            zIndexRange={[5, 4]}
          >
            {String.fromCharCode(65 + i)}
          </Html>
          <Html
            position={[-5.25, 0.18, i - 4.5]}
            center
            className="board-coordinate"
            portal={props.htmlPortal}
            zIndexRange={[5, 4]}
          >
            {10 - i}
          </Html>
        </group>
      ))}
      {[...game.pieces, ...(motion?.action.captured ?? [])].map((piece) => (
        <PieceActor
          key={piece.id}
          piece={piece}
          motion={motion}
          victim={!!motion?.action.captured.some((p) => p.id === piece.id)}
          selected={selectedId === piece.id}
          targeted={captured.has(piece.id)}
          source={props.threatSources.includes(piece.id)}
          threatened={props.threats.some((t) => t.targetId === piece.id)}
          disabled={busy}
          htmlPortal={props.htmlPortal}
          onCell={props.onCell}
          onHover={props.onHover}
          onThreat={() => props.onThreat(piece.id)}
        />
      ))}
      {preview?.action.type === 'place' && !busy && (
        <group position={center(preview.piece)}>
          <RoundedBox
            args={[dimensions(preview.piece)[0] - 0.1, 0.06, dimensions(preview.piece)[1] - 0.1]}
            position={[0, 0.25, 0]}
            radius={0.02}
          >
            <meshBasicMaterial color="#18afd2" transparent opacity={0.3} />
          </RoundedBox>
          <group position={[0, 0.33, 0]} rotation={[0, facing(preview.piece), 0]} scale={0.82}>
            <Animal kind={preview.piece.kind} />
          </group>
        </group>
      )}
      {motion && <ActionEffects key={game.revision} motion={motion} />}
      <SceneCamera
        area={props.area}
        view={props.view}
        human={props.human}
        reduced={props.reduced}
      />
    </>
  );
}
export function BoardScene(props: BoardProps) {
  const [labelHost, setLabelHost] = useState<HTMLDivElement | null>(null);
  const htmlPortal = useMemo(() => (labelHost ? { current: labelHost } : null), [labelHost]);
  return (
    <div className="scene-root">
      <div className="scene-labels" ref={setLabelHost} />
      <Suspense fallback={<div className="canvas-loading">氷原に向かっています…</div>}>
        {htmlPortal && (
          <Canvas
            shadows={{ type: PCFSoftShadowMap }}
            dpr={[1, 1.8]}
            camera={{ position: [0, 20, 10], fov: 38, near: 0.1, far: 160 }}
            gl={{
              antialias: true,
              alpha: false,
              toneMapping: ACESFilmicToneMapping,
              toneMappingExposure: 0.95,
            }}
          >
            <BoardContents {...props} htmlPortal={htmlPortal} />
          </Canvas>
        )}
      </Suspense>
    </div>
  );
}
