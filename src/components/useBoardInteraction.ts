import { useEffect, useMemo, useState } from 'react';
import {
  getThreats,
  moveCells,
  moveOptions,
  pieceAt,
  placementCells,
  previewAction,
} from '../game/engine';
import { kingRescuers } from '../game/rescue';
import { actionSafety, hasOnlyRedPositions, stationarySafety } from '../game/safety';
import { footprint } from '../game/pieces';
import type { StationaryGuide } from '../presentation/guideStyle';
import { cellKey, sameCell, otherPlayer } from '../game/types';
import { displayAnchor } from '../presentation/boardAnchor';
import type {
  ActionPreview,
  Cell,
  GameAction,
  GameState,
  Kind,
  Piece,
  Player,
} from '../game/types';
/** Owns transient selection only. Canonical match state stays in useMatch. */
export function useBoardInteraction(
  game: GameState,
  human: Player,
  submit: (action: GameAction, revision: number) => void,
  enabled = true,
  onCaptureChoice?: (preview: ActionPreview | null) => void,
) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stockKind, setStockKind] = useState<Kind | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);
  const [pending, setPending] = useState<ActionPreview[] | null>(null);
  const [optionIndex, setOptionIndex] = useState(0);
  const [inspectedThreat, setInspectedThreat] = useState<string | null>(null);
  const humanTurn = enabled && game.turn === human && game.phase !== 'finished';
  const selected = game.pieces.find((p) => p.id === selectedId) ?? null;
  const inspectingEnemy = !!selected && selected.owner !== human;
  // Inspection uses the same rules with the selected side to move, without changing the match.
  const analysisGame = useMemo(
    () => (inspectingEnemy && selected ? { ...game, turn: selected.owner } : game),
    [game, inspectingEnemy, selected],
  );
  const activeKind = stockKind;
  const body = useMemo(
    () => selected ?? (activeKind ? { kind: activeKind, promoted: false } : null),
    [selected, activeKind],
  );
  // Rules use absolute anchors; guides and taps use the same visible corner for both sides.
  const actionCells = useMemo(() => {
    if (!humanTurn || pending) return [];
    if (selected) return moveCells(game, selected);
    return activeKind ? placementCells(game, activeKind) : [];
  }, [game, humanTurn, pending, selected, activeKind]);
  const legalCells = useMemo(
    () => (body ? actionCells.map((at) => displayAnchor(at, body, human)) : []),
    [actionCells, body, human],
  );
  const stationaryGuide = useMemo<StationaryGuide | null>(() => {
    if (!humanTurn || pending || !selected) return null;
    return {
      cells: footprint(selected),
      anchor: displayAnchor(selected.at, selected, human),
      safety: inspectingEnemy ? null : stationarySafety(game, selected),
    };
  }, [game, selected, human, humanTurn, pending, inspectingEnemy]);
  // Cache the exact actions offered by the UI, including automatic seal promotion.
  const destinations = useMemo(
    () =>
      new Map(
        actionCells.map((at) => {
          const moves = selected ? moveOptions(analysisGame, selected, at) : [];
          const preferred =
            selected?.kind === 'seal' && !selected.promoted && moves.some((p) => p.piece.promoted)
              ? moves.filter((p) => p.piece.promoted)
              : moves;
          // A king captured on landing ends the match; no transformation decision remains.
          // Keep the existing loss warning if the landing also captures our own king.
          const offered = preferred[0]?.captured.some((piece) => piece.kind === 'walrus')
            ? preferred.slice(0, 1)
            : preferred;
          const placement =
            !selected && activeKind
              ? previewAction(game, { type: 'place', kind: activeKind, at })
              : null;
          return [
            cellKey(body ? displayAnchor(at, body, human) : at),
            placement ? [placement] : offered,
          ] as const;
        }),
      ),
    [game, analysisGame, actionCells, selected, activeKind, body, human],
  );
  const destinationSafety = useMemo(
    () =>
      new Map(
        [...destinations].flatMap(([key, options]) =>
          !inspectingEnemy && options[0]
            ? [[key, actionSafety(analysisGame, options[0])] as const]
            : [],
        ),
      ),
    [analysisGame, destinations, inspectingEnemy],
  );
  const transformationSafeCells = useMemo(() => {
    if (inspectingEnemy || selected?.kind !== 'orca') return [];
    return legalCells.filter((at) => {
      const key = cellKey(at);
      if (!destinationSafety.get(key)?.unsafe) return false;
      return (destinations.get(key) ?? []).some(
        (option) =>
          option.action.type === 'move' &&
          option.action.transformation?.type === 'rotate' &&
          !actionSafety(game, option).unsafe,
      );
    });
  }, [game, selected, inspectingEnemy, legalCells, destinations, destinationSafety]);
  const transformationSafeKeys = useMemo(
    () => new Set(transformationSafeCells.map(cellKey)),
    [transformationSafeCells],
  );
  const kingCaptureTrapCells = useMemo(
    () =>
      legalCells.filter(
        (at) =>
          !transformationSafeKeys.has(cellKey(at)) &&
          destinationSafety.get(cellKey(at))?.kingCaptureTrap,
      ),
    [legalCells, destinationSafety, transformationSafeKeys],
  );
  // Red marks risk, never illegality. Empty drops and non-royal moves need the same analysis.
  const unsafeCells = useMemo(
    () =>
      legalCells.filter(
        (at) =>
          !transformationSafeKeys.has(cellKey(at)) &&
          !destinationSafety.get(cellKey(at))?.kingCaptureTrap &&
          destinationSafety.get(cellKey(at))?.unsafe,
      ),
    [legalCells, destinationSafety, transformationSafeKeys],
  );
  const kingDangerCells = useMemo(
    () =>
      legalCells.filter((at) => {
        const safety = destinationSafety.get(cellKey(at));
        return (
          !transformationSafeKeys.has(cellKey(at)) && (safety?.kingThreatened || safety?.losesGame)
        );
      }),
    [legalCells, destinationSafety, transformationSafeKeys],
  );
  const helperIds = useMemo(() => kingRescuers(game, human), [game, human]);
  const pendingSafety = useMemo(
    () => pending?.map((option) => actionSafety(game, option)) ?? [],
    [game, pending],
  );
  // Destination markers use anchors; the pale guide covers each body's entire footprint.
  const reachableCells = useMemo(() => {
    const cells = new Map<string, Cell>();
    const options = pending ?? [...destinations.values()].flat();
    for (const option of options)
      for (const cell of [...option.footprint, ...option.captureCells])
        cells.set(cellKey(cell), cell);
    return [...cells.values()];
  }, [pending, destinations]);
  const threats = useMemo(() => getThreats(game, human), [game, human]);
  const trappedIds = useMemo(
    () =>
      humanTurn
        ? game.pieces
            .filter(
              (piece) =>
                piece.owner === human &&
                threats.some((threat) => threat.targetId === piece.id) &&
                hasOnlyRedPositions(game, piece),
            )
            .map((piece) => piece.id)
        : [],
    [game, human, humanTurn, threats],
  );
  const kingCaptureIds = useMemo(() => {
    const enemy = otherPlayer(human);
    const king = game.pieces.find((p) => p.kind === 'walrus' && p.owner === enemy);
    return king
      ? (getThreats(game, enemy).find((t) => t.targetId === king.id)?.attackerIds ?? [])
      : [];
  }, [game, human]);
  const threat = threats.find((t) => t.targetId === (inspectedThreat ?? selectedId));
  const preview = useMemo(() => {
    if (inspectingEnemy) return null;
    if (pending) return pending[optionIndex];
    if (!hover || !legalCells.some((c) => sameCell(c, hover))) return null;
    return destinations.get(cellKey(hover))?.[0] ?? null;
  }, [pending, optionIndex, hover, legalCells, destinations, inspectingEnemy]);
  const previewUnsafe = pending
    ? !!pendingSafety[optionIndex]?.unsafe
    : !!hover &&
      !transformationSafeKeys.has(cellKey(hover)) &&
      !!destinationSafety.get(cellKey(hover))?.unsafe;
  const previewSafety = pending
    ? pendingSafety[optionIndex]
    : hover
      ? destinationSafety.get(cellKey(hover))
      : undefined;
  const previewKingCaptureTrap =
    !(hover && !pending && transformationSafeKeys.has(cellKey(hover))) &&
    !!previewSafety?.kingCaptureTrap;
  const previewKingDanger =
    !(hover && !pending && transformationSafeKeys.has(cellKey(hover))) &&
    !!(previewSafety?.kingThreatened || previewSafety?.losesGame);
  const portrait: Piece | null =
    selected ??
    (activeKind
      ? { id: 'portrait', kind: activeKind, owner: human, at: { x: 4, y: 4 }, promoted: false }
      : null);
  const clearChoice = () => {
    onCaptureChoice?.(null);
    setPending(null);
    setOptionIndex(0);
    setHover(null);
  };
  useEffect(() => {
    setSelectedId(null);
    setStockKind(null);
    setPending(null);
    setHover(null);
    setInspectedThreat(null);
    setOptionIndex(0);
  }, [game.revision, human]);
  function clearSelection() {
    clearChoice();
    setSelectedId(null);
    setStockKind(null);
    setInspectedThreat(null);
  }
  function selectStock(kind: Kind) {
    if (!humanTurn || game.stocks[human][kind] === 0) return;
    clearChoice();
    setSelectedId(null);
    setStockKind(kind === stockKind ? null : kind);
    setInspectedThreat(null);
  }
  function clickCell(cell: Cell) {
    if (!humanTurn || pending) return;
    if (!inspectingEnemy && legalCells.some((c) => sameCell(c, cell))) {
      if (selected) {
        const options = destinations.get(cellKey(cell)) ?? [];
        if (
          options.length > 1 ||
          options[0]?.captured.some((p) => p.kind === 'walrus' && p.owner === human)
        ) {
          setPending(options);
          if (options.length > 1) onCaptureChoice?.(options[0]);
          setOptionIndex(0);
        } else if (options[0]) submit(options[0].action, game.revision);
      } else if (activeKind) {
        const placement = destinations.get(cellKey(cell))?.[0];
        if (placement) submit(placement.action, game.revision);
      }
      return;
    }
    const piece = pieceAt(game, cell);
    if (piece) {
      setSelectedId(piece.id === selectedId ? null : piece.id);
      setStockKind(null);
      setInspectedThreat(null);
      setHover(null);
    } else {
      setSelectedId(null);
      setStockKind(null);
      setHover(null);
    }
  }
  function clickPiece(id: string, cell: Cell) {
    if (!humanTurn || pending) return;
    const piece = game.pieces.find((candidate) => candidate.id === id);
    if (!piece) return;
    if (!selected || inspectingEnemy || !legalCells.some((at) => sameCell(at, cell))) {
      setSelectedId(selected?.id === id ? null : id);
      setStockKind(null);
      setInspectedThreat(null);
      setHover(null);
    } else clickCell(cell);
  }
  function inspectThreat(id: string) {
    setInspectedThreat(id);
    if (humanTurn && !pending) {
      setSelectedId(id);
      setStockKind(null);
    }
  }
  function chooseOption(preview: ActionPreview) {
    if (humanTurn && !inspectingEnemy) submit(preview.action, game.revision);
  }
  return {
    selectedId,
    selected,
    inspectingEnemy,
    activeKind,
    pending,
    optionIndex,
    humanTurn,
    legalCells,
    stationaryGuide,
    reachableCells,
    unsafeCells,
    kingDangerCells,
    transformationSafeCells,
    kingCaptureTrapCells,
    previewKingCaptureTrap,
    previewKingDanger,
    helperIds,
    previewUnsafe,
    pendingSafety,
    threats,
    trappedIds,
    kingCaptureIds,
    threat,
    preview,
    portrait,
    selectStock,
    clickCell,
    clickPiece,
    inspectThreat,
    clearChoice,
    clearSelection,
    chooseOption,
    setOptionIndex,
    setHover,
  };
}
export type BoardInteraction = ReturnType<typeof useBoardInteraction>;
