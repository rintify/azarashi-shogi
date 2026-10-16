import { useEffect, useRef, useState } from 'react';
import { AnimatedValue } from './AnimatedUI';
import { AnimalIcon } from './AnimalIcon';
import { DEFINITIONS, KINDS } from '../game/pieces';
import { otherPlayer, type GameState, type Kind, type Player } from '../game/types';
import type { Difficulty } from '../match/record';

export function OpponentBar({
  game,
  human,
  difficulty,
  thinking,
  name = 'NPC',
}: {
  game: GameState;
  human: Player;
  difficulty: Difficulty;
  thinking: boolean;
  name?: string;
}) {
  return (
    <section className="opponent-bar" aria-label="相手のストック">
      <div className="opponent-name">
        <span className={`presence-dot ${thinking ? 'thinking' : ''}`} />
        <strong>
          {name} <small>Lv.{difficulty}</small>
        </strong>
        <span className="thinking-copy">{thinking ? '考え中…' : '氷原のペンギン'}</span>
      </div>
      <StockItems game={game} player={otherPlayer(human)} />
    </section>
  );
}
export function StockItems({
  game,
  player,
  includeKing = false,
  activeKind,
}: {
  game: GameState;
  player: Player;
  includeKing?: boolean;
  activeKind?: Kind | null;
}) {
  return (
    <span className="opponent-stock">
      {KINDS.filter((kind) => includeKing || kind !== 'walrus').map((kind) => (
        <StockToken
          key={kind}
          kind={kind}
          player={player}
          count={game.stocks[player][kind]}
          active={activeKind === kind}
          captured={
            game.revision > 0 &&
            game.lastAction?.piece.owner === player &&
            !!game.lastAction.captured.some((piece) => piece.kind === kind)
          }
        />
      ))}
    </span>
  );
}

function StockToken({
  kind,
  player,
  count,
  active,
  captured,
}: {
  kind: Kind;
  player: Player;
  count: number;
  active: boolean;
  captured: boolean;
}) {
  const previous = useRef(count);
  const [gain, setGain] = useState(0);
  useEffect(() => {
    const added = count - previous.current;
    previous.current = count;
    setGain(captured && added > 0 ? added : 0);
    const timer = window.setTimeout(() => setGain(0), 900);
    return () => window.clearTimeout(timer);
  }, [count, captured]);
  return (
    <span
      data-stock-player={player}
      data-stock-kind={kind}
      data-active={active || undefined}
      data-gaining={gain > 0 || undefined}
      aria-label={`${DEFINITIONS[kind].name} ${count}体`}
    >
      <AnimalIcon kind={kind} />
      <AnimatedValue valueKey={count}>{count}</AnimatedValue>
      {gain > 0 && (
        <span key={count} className="stock-gain" aria-hidden="true">
          +{gain}
        </span>
      )}
    </span>
  );
}
