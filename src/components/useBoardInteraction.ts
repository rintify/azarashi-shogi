import { useEffect, useMemo, useState } from 'react';
import {
  getThreats,
  moveCells,
  moveOptions,
  pieceAt,
  placementCells,
  previewAction,
} from '../game/engine';
import { sameCell } from '../game/types';
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
) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stockKind, setStockKind] = useState<Kind | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);
  const [pending, setPending] = useState<ActionPreview[] | null>(null);
  const [optionIndex, setOptionIndex] = useState(0);
  const [inspectedThreat, setInspectedThreat] = useState<string | null>(null);
  const humanTurn = game.turn === human && game.phase !== 'finished';
  const setup = game.phase.startsWith('setup');
  const selected = game.pieces.find((p) => p.id === selectedId) ?? null;
  const activeKind = setup ? 'walrus' : stockKind;
  const legalCells = useMemo(() => {
    if (!humanTurn || pending) return [];
    if (selected) return moveCells(game, selected);
    return activeKind ? placementCells(game, activeKind) : [];
  }, [game, humanTurn, pending, selected, activeKind]);
  const threats = useMemo(() => getThreats(game, human), [game, human]);
  const threat = threats.find((t) => t.targetId === (inspectedThreat ?? selectedId));
  const preview = useMemo(() => {
    if (pending) return pending[optionIndex];
    if (!hover || !legalCells.some((c) => sameCell(c, hover))) return null;
    if (selected) return moveOptions(game, selected, hover)[0];
    return activeKind ? previewAction(game, { type: 'place', kind: activeKind, at: hover }) : null;
  }, [pending, optionIndex, hover, legalCells, selected, activeKind, game]);
  const portrait: Piece | null =
    selected ??
    (activeKind
      ? { id: 'portrait', kind: activeKind, owner: human, at: { x: 4, y: 4 }, promoted: false }
      : null);
  const clearChoice = () => {
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
  function selectStock(kind: Kind) {
    if (!humanTurn || setup || game.stocks[human][kind] === 0) return;
    clearChoice();
    setSelectedId(null);
    setStockKind(kind === stockKind ? null : kind);
    setInspectedThreat(null);
  }
  function clickCell(cell: Cell) {
    if (!humanTurn || pending) return;
    if (legalCells.some((c) => sameCell(c, cell))) {
      if (selected) {
        const options = moveOptions(game, selected, cell);
        if (options.length > 1 || options[0]?.captured.length) {
          setPending(options);
          setOptionIndex(0);
        } else if (options[0]) submit(options[0].action, game.revision);
      } else if (activeKind) submit({ type: 'place', kind: activeKind, at: cell }, game.revision);
      return;
    }
    const piece = pieceAt(game, cell);
    if (!setup && piece?.owner === human) {
      setSelectedId(piece.id === selectedId ? null : piece.id);
      setStockKind(null);
      setInspectedThreat(null);
      setHover(null);
    } else if (!setup) {
      setSelectedId(null);
      setStockKind(null);
      setHover(null);
    }
  }
  function inspectThreat(id: string) {
    setInspectedThreat(id);
    if (humanTurn && !pending) {
      setSelectedId(id);
      setStockKind(null);
    }
  }
  function chooseOption(preview: ActionPreview) {
    submit(preview.action, game.revision);
  }
  return {
    selectedId,
    selected,
    activeKind,
    pending,
    optionIndex,
    humanTurn,
    setup,
    legalCells,
    threats,
    threat,
    preview,
    portrait,
    selectStock,
    clickCell,
    inspectThreat,
    clearChoice,
    chooseOption,
    setOptionIndex,
    setHover,
  };
}
export type BoardInteraction = ReturnType<typeof useBoardInteraction>;
