import { lazy, Suspense, useState } from 'react';
import { BookOpen, Check, Flag, Grid2X2, Maximize2, RotateCcw, Box } from 'lucide-react';
import { useMatch } from './match/useMatch';
import { useNpc } from './ai/useNpc';
import { AnimalIcon } from './components/AnimalIcon';
import { RulesDialog } from './components/RulesDialog';
import { NewGameDialog } from './components/NewGameDialog';
import { SceneBoundary } from './components/SceneBoundary';
import { ActionDock } from './components/ActionDock';
import { OpponentBar } from './components/OpponentBar';
import { CoordinateBoard } from './components/CoordinateBoard';
import { statusCopy } from './components/statusCopy';
import { useBoardInteraction } from './components/useBoardInteraction';
import { pieceName } from './game/pieces';
import { coordinate } from './components/coordinates';
const BoardScene = lazy(() =>
  import('./scene/BoardScene').then((m) => ({ default: m.BoardScene })),
);

export default function App() {
  const { game, settings, warning, submit, restart } = useMatch();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [newGameOpen, setNewGameOpen] = useState(false);
  const [view, setView] = useState<'perspective' | 'top'>(() =>
    window.matchMedia('(max-width: 760px), (max-height: 520px)').matches ? 'top' : 'perspective',
  );
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
  const status = statusCopy(game, settings.human, interaction);
  const last = game.lastAction;
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand">
          <AnimalIcon kind="seal" />
          <div>
            <h1>
              アザラシ将棋<span>.</span>
            </h1>
            <span className="brand-caption">ANTARCTIC CHESS CLUB</span>
          </div>
        </div>
        <nav aria-label="対局メニュー">
          <span className="save-indicator">
            <Check size={13} />
            自動保存
          </span>
          <button
            className="icon-button"
            aria-label="あそびかた"
            onClick={() => setRulesOpen(true)}
          >
            <BookOpen size={19} />
          </button>
          <button
            className="icon-button"
            aria-label="新しい対局"
            onClick={() => setNewGameOpen(true)}
          >
            <RotateCcw size={19} />
          </button>
        </nav>
      </header>
      <main className={`match-layout ${interaction.pending ? 'capture-pending' : ''}`}>
        <OpponentBar
          game={game}
          human={settings.human}
          difficulty={settings.difficulty}
          thinking={aiStatus.thinking}
        />
        <section className="board-stage" aria-label="対局盤">
          <div className="field-heading">
            <span>
              <i className={humanTurn ? 'your-turn-dot' : ''} />
              {setup
                ? '王の配置'
                : game.phase === 'finished'
                  ? '対局終了'
                  : `${Math.max(1, game.revision - 1)}手目`}
            </span>
            <small>10 × 10</small>
          </div>
          <div className="board-viewport">
            <SceneBoundary onFallback={() => setKeyboardOpen(true)}>
              <Suspense fallback={<div className="canvas-loading">氷の盤面を準備しています…</div>}>
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
            {keyboardOpen && (
              <CoordinateBoard
                game={game}
                human={settings.human}
                legalCells={legalCells}
                onCell={clickCell}
                onHover={setHover}
              />
            )}
            {game.phase === 'finished' && (
              <div className="result-overlay">
                <div>
                  <Flag size={28} />
                  <h2>{status.title}</h2>
                  <p>
                    {game.result?.reason === 'both-kings'
                      ? '両方の王が捕食されました。'
                      : 'セイウチが捕食されました。'}
                  </p>
                  <button className="primary-button" onClick={() => setNewGameOpen(true)}>
                    もう一局あそぶ
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="board-tools">
            <div className="board-legend">
              <span>
                <i />
                移動先
              </span>
              <span>
                <b>!</b>捕食の危険
              </span>
            </div>
            <div className="view-controls">
              <button
                aria-label={view === 'top' ? '立体で見る' : '真上から見る'}
                aria-pressed={view === 'top'}
                onClick={() => {
                  setView(view === 'top' ? 'perspective' : 'top');
                  setCameraReset((n) => n + 1);
                }}
              >
                {view === 'top' ? <Box size={17} /> : <Maximize2 size={17} />}
                <span>{view === 'top' ? '3D視点' : '真上'}</span>
              </button>
              <button
                aria-label="マス一覧で操作"
                aria-pressed={keyboardOpen}
                onClick={() => setKeyboardOpen(!keyboardOpen)}
              >
                <Grid2X2 size={17} />
              </button>
            </div>
          </div>
        </section>
        <ActionDock
          game={game}
          settings={settings}
          interaction={interaction}
          onHelp={() => setRulesOpen(true)}
        />
        <div className="match-message" aria-live="polite">
          {aiError ? (
            <span role="alert">
              {aiError} <button onClick={retryNpc}>再試行</button>
            </span>
          ) : warning ? (
            <span role="alert">{warning}</span>
          ) : last ? (
            <span>
              {last.piece.owner === settings.human ? 'あなた' : 'NPC'}：{pieceName(last.piece)} →{' '}
              {coordinate(last.piece.at)}
              {last.captured.length ? ` · ${last.captured.length}体捕食` : ''}
            </span>
          ) : (
            <span>
              あなたは{settings.human === 'south' ? '先手' : '後手'} ·{' '}
              {settings.human === 'south' ? '青' : 'オレンジ'}の台座があなたの仲間
            </span>
          )}
        </div>
      </main>
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
