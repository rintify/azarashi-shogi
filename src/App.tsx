import { lazy, Suspense, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  Flag,
  Keyboard,
  Maximize2,
  RotateCcw,
  Snowflake,
  Swords,
} from 'lucide-react';
import { pieceAt } from './game/engine';
import { pieceName } from './game/pieces';
import { sameCell } from './game/types';
import { useMatch } from './match/useMatch';
import { useNpc } from './ai/useNpc';
import { AnimalIcon } from './components/AnimalIcon';
import { RulesDialog } from './components/RulesDialog';
import { NewGameDialog } from './components/NewGameDialog';
import { SceneBoundary } from './components/SceneBoundary';
import { Sidebar } from './components/Sidebar';
import { coordinate } from './components/coordinates';
import { statusCopy } from './components/statusCopy';
import { useBoardInteraction } from './components/useBoardInteraction';
const BoardScene = lazy(() =>
  import('./scene/BoardScene').then((m) => ({ default: m.BoardScene })),
);

export default function App() {
  const { game, settings, warning, submit, restart, history } = useMatch();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [newGameOpen, setNewGameOpen] = useState(false);
  const [view, setView] = useState<'perspective' | 'top'>('perspective');
  const [cameraReset, setCameraReset] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const interaction = useBoardInteraction(game, settings.human, submit);
  const {
    selectedId,
    humanTurn,
    setup,
    legalCells,
    threats,
    threat,
    preview,
    clickCell,
    inspectThreat,
    setHover,
  } = interaction;
  const {
    status: aiStatus,
    error: aiError,
    retry: retryNpc,
  } = useNpc(game, settings.human, settings.difficulty, submit);
  const { title: statusTitle, text: statusText } = statusCopy(game, settings.human, interaction);
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="./" aria-label="アザラシ将棋 ホーム">
          <div className="brand-mark">
            <AnimalIcon kind="seal" />
          </div>
          <div>
            <h1>
              アザラシ将棋<span className="brand-dot">.</span>
            </h1>
            <p>氷上の、小さな頭脳戦。</p>
          </div>
        </a>
        <nav>
          <span className="local-pill">
            <span />
            LOCAL PLAY
          </span>
          <button
            className="quiet-button"
            aria-label="あそびかた"
            onClick={() => setRulesOpen(true)}
          >
            <BookOpen size={17} />
            <span>あそびかた</span>
          </button>
          <button className="new-game-button" onClick={() => setNewGameOpen(true)}>
            <RotateCcw size={16} />
            <span>新しい対局</span>
          </button>
        </nav>
      </header>
      <main className="main-layout">
        <section className="game-section" aria-label="対局盤">
          <div className="game-heading">
            <div className="heading-copy">
              <span className="eyebrow">
                <span className="live-dot" />
                LET'S PLAY ON THE ICE
              </span>
              <h2>今日も、氷の上で一局。</h2>
            </div>
            <span className="match-chip">
              <Swords size={14} />
              あなた <span>vs</span> NPC
            </span>
          </div>
          <div className="board-card">
            <div className="board-status">
              <div className={`turn-avatar ${!humanTurn ? 'npc-avatar' : ''}`}>
                <AnimalIcon kind={humanTurn ? 'seal' : 'penguin'} />
              </div>
              <div>
                <div className="status-title">
                  <strong>{statusTitle}</strong>
                  {humanTurn && <span className="your-turn">YOUR TURN</span>}
                </div>
                <p>{statusText}</p>
              </div>
              <div className="turn-counter">
                <span>{setup ? '準備' : 'TURN'}</span>
                <strong>
                  {setup
                    ? game.phase === 'setup-south'
                      ? '01'
                      : '02'
                    : String(
                        Math.max(1, game.revision - (game.phase === 'finished' ? 2 : 1)),
                      ).padStart(2, '0')}
                </strong>
              </div>
            </div>
            <div className="board-viewport">
              <div className="board-top-label">
                <Snowflake size={14} />
                <span>ANTARCTIC FIELD</span>
                <b>10 × 10</b>
              </div>
              <div className="view-controls">
                <button
                  className={view === 'top' ? 'active' : ''}
                  title="真上から見る"
                  aria-label="真上から見る"
                  onClick={() => setView(view === 'top' ? 'perspective' : 'top')}
                >
                  <Maximize2 size={17} />
                </button>
                <button
                  title="視点を戻す"
                  aria-label="視点を戻す"
                  onClick={() => {
                    setView('perspective');
                    setCameraReset((n) => n + 1);
                  }}
                >
                  <Compass size={18} />
                </button>
              </div>
              <SceneBoundary onFallback={() => setKeyboardOpen(true)}>
                <Suspense
                  fallback={<div className="canvas-loading">氷の盤面を準備しています…</div>}
                >
                  <BoardScene
                    game={game}
                    human={settings.human}
                    selectedId={selectedId}
                    legalCells={legalCells}
                    preview={preview}
                    threats={threats}
                    threatSources={threat?.attackerIds ?? []}
                    view={view}
                    cameraReset={cameraReset}
                    onCell={clickCell}
                    onHover={setHover}
                    onThreat={inspectThreat}
                  />
                </Suspense>
              </SceneBoundary>
              <div className="board-bottom-label">
                <span className="snow-line" />
                <span>南極の氷原</span>
                <span className="board-latitude">78° S · 166° E</span>
              </div>
              {game.phase === 'finished' && (
                <div className="result-overlay">
                  <div>
                    <Flag size={28} />
                    <h2>{statusTitle}</h2>
                    <p>
                      {game.result?.reason === 'both-kings'
                        ? '2体の王が、同じ一手で捕食されました。'
                        : 'セイウチが捕食され、勝負が決まりました。'}
                    </p>
                    <button className="primary-button" onClick={() => setNewGameOpen(true)}>
                      もう一局あそぶ <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="board-toolbar">
              <span>
                <span className="legend-dot legal-dot" />
                動けるマス
              </span>
              <span>
                <span className="legend-dot capture-dot" />
                捕食する駒
              </span>
              <span>
                <b className="legend-alert">!</b>食べられるかも
              </span>
              <button
                className={keyboardOpen ? 'active' : ''}
                onClick={() => setKeyboardOpen(!keyboardOpen)}
                aria-label="マス一覧で操作"
                title="マス一覧で操作"
              >
                <Keyboard size={17} />
              </button>
            </div>
            {keyboardOpen && (
              <div className="keyboard-board" aria-label="マス一覧で操作">
                {Array.from({ length: 100 }, (_, i) => {
                  const c = { x: i % 10, y: Math.floor(i / 10) },
                    p = pieceAt(game, c),
                    legal = legalCells.some((l) => sameCell(l, c));
                  return (
                    <button
                      key={i}
                      className={legal ? 'legal' : ''}
                      aria-label={`${coordinate(c)}${p ? ` ${pieceName(p)}` : ''}${legal ? ' 選択可能' : ''}`}
                      onClick={() => clickCell(c)}
                      onFocus={() => setHover(c)}
                      onMouseEnter={() => setHover(c)}
                    >
                      {p ? <AnimalIcon kind={p.kind} promoted={p.promoted} /> : coordinate(c)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="below-board">
            <span>
              <Compass size={14} />
              ドラッグで回転 · スクロールでズーム
            </span>
            <span>
              <Check size={13} />
              ブラウザーに自動保存
            </span>
          </div>
          {warning && (
            <p className="error-message" role="alert">
              {warning}
            </p>
          )}
        </section>
        <Sidebar
          game={game}
          settings={settings}
          interaction={interaction}
          aiStatus={aiStatus}
          aiError={aiError}
          retryNpc={retryNpc}
          actionCount={history.length}
          onSettings={() => setNewGameOpen(true)}
          onHelp={() => setRulesOpen(true)}
        />
      </main>
      <footer className="site-footer">
        <div>
          <Snowflake size={13} />
          <span>ゆっくり考える時間も、あそびのうち。</span>
        </div>
        <span>
          AZARASHI SHOGI <span className="footer-divider">/</span> MADE FOR A LITTLE WONDER
        </span>
      </footer>
      {rulesOpen && <RulesDialog close={() => setRulesOpen(false)} />}
      {newGameOpen && (
        <NewGameDialog
          current={settings}
          close={() => setNewGameOpen(false)}
          start={(s) => {
            restart(s);
            setNewGameOpen(false);
            interaction.clearChoice();
          }}
        />
      )}
    </div>
  );
}
