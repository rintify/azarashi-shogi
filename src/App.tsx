import { AnimatedPresence, AnimatedValue } from './components/AnimatedUI';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Grid2X2,
  Maximize2,
  RotateCcw,
  Box,
  Volume2,
  VolumeX,
  Snowflake,
  X,
} from 'lucide-react';
import { AnimalIcon } from './components/AnimalIcon';
import { aiDifficulty, isSpectator, playerLabel } from './match/record';
import { otherPlayer } from './game/types';
import { SpectatorDock } from './components/SpectatorDock';
import { useMatch } from './match/useMatch';
import { useNpc } from './ai/useNpc';
import { TransformationDialog } from './components/TransformationDialog';
import { MatchResult } from './components/MatchResult';
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
  const watching = isSpectator(settings);
  const [paused, setPaused] = useState(false);
  const [stepRequested, setStepRequested] = useState(false);
  useEffect(() => setStepRequested(false), [game.revision]);
  const [sceneReady, setSceneReady] = useState(false);
  const markReady = useCallback(() => setSceneReady(true), []);
  const [rulesOpen, setRulesOpen] = useState(false),
    [newGameOpen, setNewGameOpen] = useState(false);
  const [rulesVisible, setRulesVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [view, setView] = useState<'perspective' | 'top'>('perspective');
  const [resultDismissed, setResultDismissed] = useState(false);
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
  const interaction = useBoardInteraction(
    game,
    settings.human,
    submit,
    sceneReady && !playback.resolving && !watching,
    playback.presentChoice,
  );
  useEffect(() => {
    if (interaction.pending) playback.previewChoice(interaction.preview);
  }, [interaction.pending, interaction.preview, playback.previewChoice]);
  const { area, ref: playRef } = usePlayArea();
  const {
    status: aiStatus,
    error: aiError,
    retry: retryNpc,
  } = useNpc(
    game,
    watching ? null : settings.human,
    aiDifficulty(settings, game.turn),
    submit,
    sceneReady &&
      !playback.busy &&
      !rulesOpen &&
      !newGameOpen &&
      !rulesVisible &&
      !settingsVisible &&
      (!watching || !paused || stepRequested),
  );
  const status = statusCopy(game, settings.human, interaction);
  const resultTitle = watching
    ? game.result?.winner
      ? `${playerLabel(settings, game.result.winner)}の勝ちです`
      : '引き分けです'
    : status.title;
  const actorLabel = (owner = game.turn) => playerLabel(settings, owner);
  useEffect(() => {
    if (interaction.pending && interaction.pending.length > 1) setKeyboardOpen(false);
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) {
        interaction.clearSelection();
        setKeyboardOpen(false);
      }
    }
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [interaction]);
  const king = game.pieces.find((p) => p.kind === 'walrus' && p.owner === settings.human);
  const kingDanger =
    !watching &&
    !!king &&
    interaction.threats.some((t) => t.targetId === king.id) &&
    !playback.busy;
  const ended = game.phase === 'finished' && !playback.busy;
  const last = game.lastAction;
  return (
    <main className={`play-screen ${ended ? 'match-ended' : ''}`} onPointerDown={audio.unlock}>
      <section className="world-layer" aria-label="対局盤" aria-busy={playback.busy}>
        <SceneBoundary
          onFallback={() => {
            setSceneReady(true);
            setKeyboardOpen(true);
          }}
        >
          <Suspense
            fallback={
              <div className="canvas-loading">
                <Snowflake size={32} />
                <span>氷原を準備しています</span>
              </div>
            }
          >
            <BoardScene
              onReady={markReady}
              game={game}
              human={settings.human}
              selectedId={interaction.selectedId}
              legalCells={interaction.legalCells}
              reachableCells={interaction.reachableCells}
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
          <AnimalIcon kind="seal" className="brand-mascot" />
          <h1>アザラシ将棋</h1>
        </div>
        <nav aria-label="対局メニュー">
          <button
            className="hud-button"
            aria-label={audio.enabled ? 'サウンドをオフ' : 'サウンドをオン'}
            aria-pressed={audio.enabled}
            onClick={audio.toggle}
          >
            <AnimatedValue valueKey={String(audio.enabled)}>
              {audio.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </AnimatedValue>
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
              <AnimatedValue valueKey={view}>
                {view === 'top' ? <Box size={18} /> : <Maximize2 size={18} />}
              </AnimatedValue>
              <span>{view === 'top' ? '3D' : '真上'}</span>
            </button>
            <button
              className="hud-button"
              aria-label="マス一覧で操作"
              aria-pressed={keyboardOpen}
              onClick={() => setKeyboardOpen((v) => !v)}
            >
              <AnimatedValue valueKey={String(keyboardOpen)}>
                {keyboardOpen ? <X size={18} /> : <Grid2X2 size={18} />}
              </AnimatedValue>
            </button>
          </div>
        </nav>
      </header>
      <div className="opponent-hud">
        <OpponentBar
          game={game}
          human={settings.human}
          difficulty={aiDifficulty(settings, otherPlayer(settings.human))}
          name={actorLabel(otherPlayer(settings.human))}
          thinking={aiStatus.thinking}
        />
      </div>
      <div className={`turn-banner ${kingDanger ? 'king-danger' : ''}`} role="status">
        <AnimatedValue
          valueKey={`${game.revision}:${playback.motion?.stage}:${playback.busy}:${kingDanger}:${paused}:${status.title}`}
        >
          {!sceneReady ? (
            '氷原を準備しています'
          ) : playback.busy ? (
            <>
              <span className="status-pulse" />{' '}
              {actorLabel(playback.motion?.action.piece.owner ?? last?.piece.owner)}：
              {playback.motion?.stage === 'choice' ? (
                '好きな姿をえらぼう！'
              ) : (
                <>
                  {last && pieceName(last.piece)}を{last?.from ? '移動' : '配置'}
                </>
              )}
            </>
          ) : ended ? (
            resultTitle
          ) : kingDanger ? (
            <>
              <b>!</b> 王が狙われています <small>捕食されると敗北</small>
            </>
          ) : (
            <>
              <span className={`status-pulse ${interaction.humanTurn ? 'human' : ''}`} />
              {watching
                ? `${actorLabel()}${paused && !stepRequested ? ' · 一時停止' : 'の手番'}`
                : interaction.humanTurn
                  ? interaction.portrait
                    ? status.title
                    : 'あなたの手番'
                  : 'NPCの手番'}
              <small>{`${game.revision + 1}手目`}</small>
            </>
          )}
        </AnimatedValue>
      </div>
      <div className="play-window" ref={playRef} aria-hidden="true" />
      <AnimatedPresence show={keyboardOpen}>
        <section
          className="coordinate-overlay"
          aria-label="座標で操作"
          style={
            area ? { left: area.x, top: area.y, width: area.width, height: area.height } : undefined
          }
        >
          <CoordinateBoard
            unsafeCells={interaction.unsafeCells}
            game={game}
            human={settings.human}
            legalCells={interaction.legalCells}
            reachableCells={interaction.reachableCells}
            onCell={interaction.clickCell}
            onHover={interaction.setHover}
          />
        </section>
      </AnimatedPresence>
      <AnimatedPresence show={!ended && !(interaction.pending && interaction.pending.length > 1)}>
        <div className="bottom-hud">
          {watching ? (
            <SpectatorDock
              game={game}
              settings={settings}
              paused={paused}
              busy={playback.busy}
              thinking={aiStatus.thinking}
              onPause={() => {
                setStepRequested(false);
                setPaused((p) => !p);
              }}
              onStep={() => setStepRequested(true)}
            />
          ) : (
            <ActionDock
              game={game}
              settings={settings}
              interaction={interaction}
              busy={playback.busy || !sceneReady}
              onHelp={() => setRulesOpen(true)}
            />
          )}
        </div>
      </AnimatedPresence>
      <div className="match-message" aria-live="polite">
        <AnimatedValue
          valueKey={`${game.revision}:${playback.busy}:${playback.motion?.stage}:${warning}:${aiError}`}
        >
          {playback.motion?.stage === 'choice' ? null : aiError ? (
            <span role="alert">
              {aiError} <button onClick={retryNpc}>再試行</button>
            </span>
          ) : warning ? (
            <span role="alert">{warning}</span>
          ) : last && !playback.busy ? (
            <span>
              {actorLabel(last.piece.owner)} · {pieceName(last.piece)}{' '}
              {last.from ? `${coordinate(last.from)} → ` : ''}
              {coordinate(last.piece.at)}
              {last.captured.length ? ` · ${last.captured.map(pieceName).join('・')}を捕食` : ''}
            </span>
          ) : (
            <span>
              {playback.busy
                ? '一手を再生中'
                : watching
                  ? '先手AI・青 / 後手AI・橙'
                  : `あなたは${settings.human === 'south' ? '先手・青' : '後手・橙'}`}
            </span>
          )}
        </AnimatedValue>
      </div>
      <AnimatedPresence show={ended && !resultDismissed}>
        <MatchResult
          title={resultTitle}
          detail={
            game.result?.reason === 'both-kings'
              ? '両方の王が同じ一手で捕食されました。'
              : `${last ? pieceName(last.piece) : '駒'}が${actorLabel(last?.captured.find((p) => p.kind === 'walrus')?.owner)}の王を捕食しました。`
          }
          onNewGame={() => setNewGameOpen(true)}
          onInspect={() => setResultDismissed(true)}
        />
      </AnimatedPresence>
      <AnimatedPresence show={ended && resultDismissed}>
        <div className="bottom-hud">
          <div className="result-actions">
            <button className="primary-button" onClick={() => setResultDismissed(false)}>
              結果を見る
            </button>
            <button className="primary-button" onClick={() => setNewGameOpen(true)}>
              新しい対局
            </button>
          </div>
        </div>
      </AnimatedPresence>
      <AnimatedPresence
        show={!!interaction.pending && interaction.pending.length > 1 && playback.choiceReady}
      >
        <TransformationDialog human={settings.human} interaction={interaction} />
      </AnimatedPresence>
      <AnimatedPresence show={rulesOpen} onPresenceChange={setRulesVisible}>
        <RulesDialog close={() => setRulesOpen(false)} />
      </AnimatedPresence>
      <AnimatedPresence show={newGameOpen} onPresenceChange={setSettingsVisible}>
        <NewGameDialog
          current={settings}
          close={() => setNewGameOpen(false)}
          start={(s) => {
            setResultDismissed(false);
            setPaused(false);
            setStepRequested(false);
            restart(s);
            setNewGameOpen(false);
            interaction.clearSelection();
            setKeyboardOpen(false);
          }}
        />
      </AnimatedPresence>
    </main>
  );
}
