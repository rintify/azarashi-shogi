import { ArrowDown, ArrowRight, ChevronRight, Sparkles, Swords, X } from 'lucide-react';
import type { ActionPreview, GameState, Piece } from '../game/types';
import { otherPlayer } from '../game/types';
import { DEFINITIONS, dimensions, KINDS, pieceName } from '../game/pieces';
import type { MatchSettings } from '../match/record';
import { LEVELS } from '../ai/levels';
import { AnimalIcon } from './AnimalIcon';
import { MovementDiagram } from './MovementDiagram';
import type { BoardInteraction } from './useBoardInteraction';
import { coordinate } from './coordinates';
interface SidebarProps {
  game: GameState;
  settings: MatchSettings;
  interaction: BoardInteraction;
  aiStatus: { thinking: boolean; depth: number; nodes: number };
  aiError: string | null;
  retryNpc: () => void;
  actionCount: number;
  onSettings: () => void;
  onHelp: () => void;
}
export function Sidebar({
  game,
  settings,
  interaction,
  aiStatus,
  aiError,
  retryNpc,
  actionCount,
  onSettings,
  onHelp,
}: SidebarProps) {
  const {
    activeKind,
    humanTurn,
    setup,
    selectStock,
    pending,
    optionIndex,
    setOptionIndex,
    clearChoice,
    portrait,
    selected,
    preview,
    threat,
    chooseOption,
  } = interaction;
  const last = game.lastAction;
  return (
    <aside className="sidebar">
      <section className="opponent-card">
        <div className="player-heading">
          <div className="npc-icon">
            <AnimalIcon kind="penguin" />
          </div>
          <div>
            <span className="eyebrow">YOUR OPPONENT</span>
            <h3>
              氷原のペンギン<span className="level-pill">Lv.{settings.difficulty}</span>
            </h3>
          </div>
          <span className={`presence-dot ${aiStatus.thinking ? 'thinking' : ''}`} />
        </div>
        <div className="opponent-meta">
          <span>強さ：{LEVELS[settings.difficulty].name}</span>
          <button onClick={() => onSettings()}>
            難易度を変更
            <ChevronRight size={13} />
          </button>
        </div>
        <div className="stock-label">
          <span>相手のストック</span>
          <small>
            {Object.values(game.stocks[otherPlayer(settings.human)]).reduce((a, b) => a + b, 0)}体
          </small>
        </div>
        <div className="opponent-stock">
          {KINDS.map((kind) => (
            <div
              key={kind}
              title={`${DEFINITIONS[kind].name} ${game.stocks[otherPlayer(settings.human)][kind]}体`}
            >
              <AnimalIcon kind={kind} />
              <span>×{game.stocks[otherPlayer(settings.human)][kind]}</span>
            </div>
          ))}
        </div>
        {aiStatus.thinking && (
          <div className="thinking-status">
            <span className="thinking-dots">
              <i />
              <i />
              <i />
            </span>
            一手を考えています{aiStatus.depth > 0 && <small>深さ {aiStatus.depth}</small>}
          </div>
        )}
        {aiError && (
          <p className="error-message" role="alert">
            {aiError}
            <button className="text-link" onClick={retryNpc}>
              もう一度考える
            </button>
          </p>
        )}
      </section>
      <section className="reserve-card">
        <div className="section-title">
          <h3>
            <span className="small-square" />
            あなたのストック
          </h3>
          <span>{Object.values(game.stocks[settings.human]).reduce((a, b) => a + b, 0)}体</span>
        </div>
        <p className="section-description">仲間を選んで、氷の上へ。</p>
        <div className="reserve-grid">
          {KINDS.map((kind) => (
            <button
              key={kind}
              disabled={!humanTurn || setup || game.stocks[settings.human][kind] === 0}
              className={`${activeKind === kind ? 'selected' : ''} ${game.stocks[settings.human][kind] === 0 ? 'empty' : ''}`}
              onClick={() => selectStock(kind)}
              aria-label={`${DEFINITIONS[kind].name}を配置 残り${game.stocks[settings.human][kind]}体`}
            >
              <div>
                <AnimalIcon kind={kind} />
                <span className="stock-count">{game.stocks[settings.human][kind]}</span>
              </div>
              <span>{DEFINITIONS[kind].short}</span>
            </button>
          ))}
        </div>
        <div className="reserve-tip">
          <span>↗</span>自分の駒のとなりに配置できます。
        </div>
      </section>
      <section className={`detail-card ${pending ? 'choice-card' : ''}`} aria-live="polite">
        {pending ? (
          <>
            <div className="section-title">
              <h3>
                <Sparkles size={16} />
                {pending.length > 1 ? '変身しますか？' : '捕食する駒を確認'}
              </h3>
              <button className="icon-button" aria-label="移動を取り消す" onClick={clearChoice}>
                <X size={17} />
              </button>
            </div>
            <p className="section-description">候補を選ぶと、盤面に形を表示します。</p>
            <div className="transform-options">
              {pending.map((p, i) => (
                <button
                  key={i}
                  className={optionIndex === i ? 'active' : ''}
                  onMouseEnter={() => setOptionIndex(i)}
                  onFocus={() => setOptionIndex(i)}
                  aria-pressed={optionIndex === i}
                  onClick={() => setOptionIndex(i)}
                >
                  <AnimalIcon kind={p.piece.kind} promoted={p.piece.promoted} />
                  <div>
                    <strong>
                      {transformationLabel(p, pending[0], i, pending.length > 1)}
                      <small>
                        {dimensions(p.piece).join(' × ')} マス · {p.captured.length}体を捕食
                      </small>
                    </strong>
                  </div>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
            <div className="capture-list">
              {pending[optionIndex].captured.map((p) => (
                <span key={p.id} className={p.owner === settings.human ? 'friendly' : ''}>
                  <AnimalIcon kind={p.kind} promoted={p.promoted} />
                  {p.owner === settings.human ? '味方' : '相手'}の{pieceName(p)}
                </span>
              ))}
            </div>
            {pending[optionIndex].captured.some(
              (p) => p.kind === 'walrus' && p.owner === settings.human,
            ) && (
              <p className="error-message">
                {pending[optionIndex].captured.some(
                  (p) => p.kind === 'walrus' && p.owner !== settings.human,
                )
                  ? '両方の王を捕食するため、引き分けになります。'
                  : '自分の王を捕食するため、この手で敗北します。'}
              </p>
            )}
            <button
              className="primary-button full confirm-move"
              onClick={() => chooseOption(pending[optionIndex])}
            >
              この手を指す
              <ArrowRight size={14} />
            </button>
          </>
        ) : portrait ? (
          <>
            <div className="section-title">
              <h3>{selected ? '選択中の仲間' : setup ? 'はじまりの一手' : '配置する仲間'}</h3>
              <span className="soft-tag">{dimensions(portrait).join(' × ')}</span>
            </div>
            <div className="piece-detail">
              <div className="portrait-circle">
                <AnimalIcon kind={portrait.kind} promoted={portrait.promoted} />
              </div>
              <div>
                <h4>{pieceName(portrait)}</h4>
                <p>{DEFINITIONS[portrait.kind].description}</p>
              </div>
              <MovementDiagram piece={portrait} />
            </div>
            {threat && (
              <div className="danger-tip">
                <b>!</b>
                <span>
                  {threat.attackerIds
                    .map((id) => game.pieces.find((p) => p.id === id))
                    .filter((p): p is Piece => !!p)
                    .map(pieceName)
                    .join('・')}
                  に捕食される可能性があります。
                </span>
              </div>
            )}
            {preview && (
              <div className="preview-summary">
                {preview.captured.length ? (
                  <>
                    <Swords size={14} />
                    {preview.captured.length}体を捕食
                    <span>{preview.captured.map(pieceName).join('、')}</span>
                  </>
                ) : (
                  <>
                    <ArrowDown size={14} />
                    {coordinate(preview.piece.at)}へ{selected ? '移動' : '配置'}
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <span className="eyebrow">A LITTLE HINT</span>
            <div className="hint-heading">
              <Sparkles size={19} />
              <h3>食べるほど、広がる一手。</h3>
            </div>
            <p className="hint-body">
              仲間を捕食しても、その駒はストックへ。変身のきっかけにしてみるのも、ひとつの作戦。
            </p>
            <button className="text-link" onClick={() => onHelp()}>
              駒の動かし方をみる
              <ArrowRight size={14} />
            </button>
          </>
        )}
      </section>
      <section className="last-move">
        <span className="eyebrow">LAST MOVE</span>
        {last ? (
          <div>
            <AnimalIcon kind={last.piece.kind} promoted={last.piece.promoted} />
            <p>
              <strong>{last.piece.owner === settings.human ? 'あなた' : 'NPC'}</strong>
              <span>
                {pieceName(last.piece)}を{coordinate(last.piece.at)}へ{last.from ? '移動' : '配置'}
                {last.captured.length ? ` · ${last.captured.length}体捕食` : ''}
              </span>
            </p>
          </div>
        ) : (
          <p>最初の一手を、待っています。</p>
        )}
        <span className="history-count">{actionCount} ACTIONS</span>
      </section>
    </aside>
  );
}

function transformationLabel(
  preview: ActionPreview,
  landing: ActionPreview,
  index: number,
  hasChoices: boolean,
): string {
  if (index === 0) return hasChoices ? 'そのまま進む' : 'この形で進む';
  const action = preview.action;
  if (action.type === 'move' && action.transformation?.type === 'rotate') {
    const { direction, pivot } = action.transformation;
    return `${direction === 1 ? '右' : '左'}回転 · 軸 ${coordinate(landing.footprint[pivot])}`;
  }
  return pieceName(preview.piece);
}
