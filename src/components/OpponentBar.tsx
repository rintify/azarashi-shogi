import { AnimalIcon } from './AnimalIcon';
import { DEFINITIONS, KINDS } from '../game/pieces';
import { otherPlayer, type GameState, type Player } from '../game/types';
import type { Difficulty } from '../match/record';

export function OpponentBar({
  game,
  human,
  difficulty,
  thinking,
}: {
  game: GameState;
  human: Player;
  difficulty: Difficulty;
  thinking: boolean;
}) {
  return (
    <section className="opponent-bar" aria-label="相手のストック">
      <div className="opponent-name">
        <span className={`presence-dot ${thinking ? 'thinking' : ''}`} />
        <strong>
          NPC <small>Lv.{difficulty}</small>
        </strong>
        <span className="thinking-copy">{thinking ? '考え中…' : '氷原のペンギン'}</span>
      </div>
      <div className="opponent-stock">
        {KINDS.map((kind) => (
          <div
            key={kind}
            aria-label={`${DEFINITIONS[kind].name} ${game.stocks[otherPlayer(human)][kind]}体`}
          >
            <AnimalIcon kind={kind} />
            <span>{game.stocks[otherPlayer(human)][kind]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
