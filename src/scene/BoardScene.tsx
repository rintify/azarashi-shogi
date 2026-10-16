import { Suspense, useMemo, useState, useEffect, type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, PCFSoftShadowMap } from 'three';
import type { ActionPreview, Cell, GameState, Player, Threat } from '../game/types';
import { cellKey } from '../game/types';
import { hasTransformation, HOVER_HEIGHT, type MoveMotion } from '../presentation/motion';
import type { PlayArea } from '../presentation/usePlayArea';
import { SceneCamera } from './SceneCamera';
import { IceWorld } from './IceWorld';
import { PieceActor } from './PieceActor';
import { CellGuide } from './CellGuide';
import { PlacementGhost } from './PlacementGhost';
import { CaptureTransfers } from './CaptureTransfers';
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
  previewUnsafe: boolean;
  threats: Threat[];
  kingCaptureIds: string[];
  threatSources: string[];
  view: 'perspective' | 'top';
  area: PlayArea | null;
  motion: MoveMotion | null;
  busy: boolean;
  reduced: boolean;
  focusResult?: boolean;
  onCell: (cell: Cell) => void;
  onHover: (cell: Cell | null) => void;
  onThreat: (id: string) => void;
}
function BoardContents(props: BoardProps & { htmlPortal: RefObject<HTMLDivElement> }) {
  const { game, selectedId, preview, motion, busy } = props;
  useEffect(props.onReady, [props.onReady]);
  const inspectingEnemy = game.pieces.some(
    (piece) => piece.id === selectedId && piece.owner !== props.human,
  );
  const focusPiece = useMemo(
    () =>
      props.focusResult && game.lastAction?.captured.some((piece) => piece.kind === 'walrus')
        ? (game.pieces.find((piece) => piece.id === game.lastAction?.piece.id) ?? null)
        : null,
    [props.focusResult, game.lastAction, game.pieces],
  );
  const legal = useMemo(() => new Set(props.legalCells.map(cellKey)), [props.legalCells]);
  const reachable = new Set(props.reachableCells.map(cellKey));
  const unsafe = new Set(props.unsafeCells.map(cellKey));
  const shownAction = preview ?? (motion?.stage === 'return' ? null : motion?.action);
  const target = new Set(shownAction?.footprint.map(cellKey));
  const extra = new Set(shownAction?.captureCells.map(cellKey));
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
            <CellGuide
              inspectingEnemy={inspectingEnemy}
              active={active}
              additional={additional}
              reachable={reachable.has(key)}
              last={last.has(key)}
              legal={legal.has(key) && !busy}
              unsafe={unsafe.has(key)}
              previewUnsafe={!!preview && props.previewUnsafe}
              reduced={props.reduced}
            />
          </group>
        );
      })}
      {[
        ...game.pieces,
        ...(motion?.action.captured.filter(
          (p) => !game.pieces.some((current) => current.id === p.id),
        ) ?? []),
      ].map((piece) => (
        <PieceActor
          key={piece.id}
          piece={piece}
          motion={motion}
          victim={
            motion?.stage !== 'choice' && !!motion?.action.captured.some((p) => p.id === piece.id)
          }
          selected={selectedId === piece.id}
          targeted={captured.has(piece.id)}
          source={props.threatSources.includes(piece.id)}
          threatened={
            game.turn === props.human && props.threats.some((t) => t.targetId === piece.id)
          }
          kingCapture={game.turn === props.human && props.kingCaptureIds.includes(piece.id)}
          disabled={busy}
          reduced={props.reduced}
          intro={game.revision === 0}
          htmlPortal={props.htmlPortal}
          onCell={props.onCell}
          onHover={props.onHover}
          onThreat={() => props.onThreat(piece.id)}
        />
      ))}
      <PlacementGhost
        piece={preview?.action.type === 'place' && !busy ? preview.piece : null}
        reduced={props.reduced}
      />
      {motion && motion.stage !== 'return' && <ActionEffects key={game.revision} motion={motion} />}
      {motion && <CaptureTransfers motion={motion} />}
      <SceneCamera
        focusPiece={focusPiece}
        area={props.area}
        view={props.view}
        human={props.human}
        reduced={props.reduced}
        ceiling={motion && (motion.stage || hasTransformation(motion)) ? HOVER_HEIGHT + 1.8 : 1.7}
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
