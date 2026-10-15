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
  includeKing = true,
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
        <span
          key={kind}
          data-active={activeKind === kind || undefined}
          aria-label={`${DEFINITIONS[kind].name} ${game.stocks[player][kind]}体`}
        >
          <AnimalIcon kind={kind} />
          <span>{game.stocks[player][kind]}</span>
        </span>
      ))}
    </span>
  );
}
