import { lazy, Suspense, useEffect, useState } from 'react';
import {
  BookOpen,
  Flag,
  Grid2X2,
  Maximize2,
  RotateCcw,
  Box,
  Volume2,
  VolumeX,
  Snowflake,
  X,
} from 'lucide-react';
import { useMatch } from './match/useMatch';
import { useNpc } from './ai/useNpc';
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
import { usePlayback } from './presentation/usePlayback';
import { usePlayArea } from './presentation/usePlayArea';
import { useGameAudio } from './presentation/useGameAudio';
const BoardScene = lazy(() =>
  import('./scene/BoardScene').then((m) => ({ default: m.BoardScene })),
);

export default function App() {
  const { game, settings, warning, submit, restart } = useMatch();
  const [rulesOpen, setRulesOpen] = useState(false),
    [newGameOpen, setNewGameOpen] = useState(false);
  const [view, setView] = useState<'perspective' | 'top'>('perspective');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const playback = usePlayback(game, reduced),
    audio = useGameAudio(playback.motion);
  const interaction = useBoardInteraction(game, settings.human, submit, !playback.busy);
  const { area, ref: playRef } = usePlayArea();
  const {
    status: aiStatus,
    error: aiError,
    retry: retryNpc,
  } = useNpc(
    game,
    settings.human,
    settings.difficulty,
    submit,
    !playback.busy && !rulesOpen && !newGameOpen,
  );
  const status = statusCopy(game, settings.human, interaction);
  useEffect(() => {
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape' && !rulesOpen && !newGameOpen) {
        interaction.clearSelection();
        setKeyboardOpen(false);
      }
    }
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [interaction, rulesOpen, newGameOpen]);
  const king = game.pieces.find((p) => p.kind === 'walrus' && p.owner === settings.human);
  const kingDanger =
    !!king && interaction.threats.some((t) => t.targetId === king.id) && !playback.busy;
  const ended = game.phase === 'finished' && !playback.busy;
  const last = game.lastAction;
  return (
    <main
      className={`play-screen ${interaction.pending ? 'capture-pending' : ''} ${ended ? 'match-ended' : ''}`}
      onPointerDown={audio.unlock}
    >
      <section className="world-layer" aria-label="対局盤" aria-busy={playback.busy}>
        <SceneBoundary onFallback={() => setKeyboardOpen(true)}>
          <Suspense
            fallback={
              <div className="canvas-loading">
                <Snowflake size={32} />
                <span>氷原を準備しています</span>
              </div>
            }
          >
            <BoardScene
              game={game}
              human={settings.human}
              selectedId={interaction.selectedId}
              legalCells={interaction.legalCells}
              unsafeCells={interaction.unsafeCells}
              preview={interaction.preview}
              threats={interaction.threats}
              threatSources={interaction.threat?.attackerIds ?? []}
              view={view}
              area={area}
              motion={playback.motion}
              busy={playback.busy}
              reduced={reduced}
              onCell={interaction.clickCell}
              onHover={interaction.setHover}
              onThreat={interaction.inspectThreat}
            />
          </Suspense>
        </SceneBoundary>
      </section>
      <div className="screen-vignette" />
      <header className="game-header">
        <div className="game-brand">
          <Snowflake size={24} />
          <h1>アザラシ将棋</h1>
        </div>
        <nav aria-label="対局メニュー">
          <button
            className="hud-button"
            aria-label={audio.enabled ? 'サウンドをオフ' : 'サウンドをオン'}
            aria-pressed={audio.enabled}
            onClick={audio.toggle}
          >
            {audio.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button className="hud-button" aria-label="あそびかた" onClick={() => setRulesOpen(true)}>
            <BookOpen size={18} />
          </button>
          <button
            className="hud-button"
            aria-label="新しい対局"
            onClick={() => setNewGameOpen(true)}
          >
            <RotateCcw size={18} />
          </button>
          <div className="view-controls" aria-label="盤面表示">
            <button
              className="hud-button"
              aria-label={view === 'top' ? '立体で見る' : '真上から見る'}
              aria-pressed={view === 'top'}
              onClick={() => setView((v) => (v === 'top' ? 'perspective' : 'top'))}
            >
              {view === 'top' ? <Box size={18} /> : <Maximize2 size={18} />}
              <span>{view === 'top' ? '3D' : '真上'}</span>
            </button>
            <button
              className="hud-button"
              aria-label="マス一覧で操作"
              aria-pressed={keyboardOpen}
              onClick={() => setKeyboardOpen((v) => !v)}
            >
              {keyboardOpen ? <X size={18} /> : <Grid2X2 size={18} />}
            </button>
          </div>
        </nav>
      </header>
      <div className="opponent-hud">
        <OpponentBar
          game={game}
          human={settings.human}
          difficulty={settings.difficulty}
          thinking={aiStatus.thinking}
        />
      </div>
      <div className={`turn-banner ${kingDanger ? 'king-danger' : ''}`} role="status">
        {playback.busy ? (
          <>
            <span className="status-pulse" />{' '}
            {last?.piece.owner === settings.human ? 'あなた' : 'NPC'}：
            {last && pieceName(last.piece)}を{last?.from ? '移動' : '配置'}
          </>
        ) : ended ? (
          status.title
        ) : kingDanger ? (
          <>
            <b>!</b> 王が狙われています <small>捕食されると敗北</small>
          </>
        ) : (
          <>
            <span className={`status-pulse ${interaction.humanTurn ? 'human' : ''}`} />
            {interaction.setup ? '王を配置' : interaction.humanTurn ? 'あなたの手番' : 'NPCの手番'}
            <small>
              {interaction.setup
                ? game.phase === 'setup-south'
                  ? '1 / 2'
                  : '2 / 2'
                : `${game.revision - 1}手目`}
            </small>
          </>
        )}
      </div>
      <div className="play-window" ref={playRef} aria-hidden="true" />
      {keyboardOpen && (
        <section
          className="coordinate-overlay"
          aria-label="座標で操作"
          style={
            area ? { left: area.x, top: area.y, width: area.width, height: area.height } : undefined
          }
        >
          <CoordinateBoard
            game={game}
            human={settings.human}
            legalCells={interaction.legalCells}
            onCell={interaction.clickCell}
            onHover={interaction.setHover}
          />
        </section>
      )}
      {!ended && (
        <div className="bottom-hud">
          <ActionDock
            game={game}
            settings={settings}
            interaction={interaction}
            busy={playback.busy}
            onHelp={() => setRulesOpen(true)}
          />
        </div>
      )}
      <div className="match-message" aria-live="polite">
        {aiError ? (
          <span role="alert">
            {aiError} <button onClick={retryNpc}>再試行</button>
          </span>
        ) : warning ? (
          <span role="alert">{warning}</span>
        ) : last && !playback.busy ? (
          <span>
            {last.piece.owner === settings.human ? 'あなた' : 'NPC'} · {pieceName(last.piece)}{' '}
            {last.from ? `${coordinate(last.from)} → ` : ''}
            {coordinate(last.piece.at)}
            {last.captured.length ? ` · ${last.captured.map(pieceName).join('・')}を捕食` : ''}
          </span>
        ) : (
          <span>
            {playback.busy
              ? '一手を再生中'
              : `あなたは${settings.human === 'south' ? '先手・青' : '後手・橙'}`}
          </span>
        )}
      </div>
      {ended && (
        <div className="result-overlay">
          <section>
            <Flag size={32} />
            <p className="result-kicker">対局終了</p>
            <h2>{status.title}</h2>
            <p>
              {game.result?.reason === 'both-kings'
                ? '両方の王が同じ一手で捕食されました。'
                : `${last ? pieceName(last.piece) : '駒'}が${last?.captured.find((p) => p.kind === 'walrus')?.owner === settings.human ? 'あなた' : '相手'}の王を捕食しました。`}
            </p>
            <button className="primary-button full" onClick={() => setNewGameOpen(true)}>
              新しい対局
            </button>
          </section>
        </div>
      )}
      {rulesOpen && <RulesDialog close={() => setRulesOpen(false)} />}
      {newGameOpen && (
        <NewGameDialog
          current={settings}
          close={() => setNewGameOpen(false)}
          start={(s) => {
            restart(s);
            setNewGameOpen(false);
            interaction.clearSelection();
            setKeyboardOpen(false);
          }}
        />
      )}
    </main>
  );
}
