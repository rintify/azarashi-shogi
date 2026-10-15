import { AnimalIcon } from './AnimalIcon';
import { DEFINITIONS, KINDS } from '../game/pieces';
import { otherPlayer, type GameState, type Player } from '../game/types';
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
export function StockItems({ game, player }: { game: GameState; player: Player }) {
  return (
    <div className="opponent-stock">
      {KINDS.map((kind) => (
        <div key={kind} aria-label={`${DEFINITIONS[kind].name} ${game.stocks[player][kind]}体`}>
          <AnimalIcon kind={kind} />
          <span>{game.stocks[player][kind]}</span>
        </div>
      ))}
    </div>
  );
}
