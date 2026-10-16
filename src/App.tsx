import { GUIDE_COLORS } from './presentation/guideStyle';
import type { CSSProperties } from 'react';
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
  Film,
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
import { useCaptureStocks } from './presentation/useCaptureStocks';
import { usePlayback } from './presentation/usePlayback';
import { usePlayArea } from './presentation/usePlayArea';
import { useGameAudio } from './presentation/useGameAudio';
import { useReplayLibrary } from './match/useReplayLibrary';
import { useReplay } from './match/useReplay';
import { ReplayLibraryDialog } from './components/ReplayLibraryDialog';
import { ReplayDock } from './components/ReplayDock';
import { TurnSplash } from './components/TurnSplash';
import { PieceCatalog } from './components/PieceCatalog';
const BoardScene = lazy(() =>
  import('./scene/BoardScene').then((m) => ({ default: m.BoardScene })),
);

export default function App() {
  const match = useMatch();
  const library = useReplayLibrary(match.record);
  const replay = useReplay();
  const game = replay.game ?? match.game;
  const settings = replay.record?.settings ?? match.settings;
  const { submit, restart } = match;
  const warning = match.warning ?? library.warning;
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [libraryVisible, setLibraryVisible] = useState(false);
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
  const playback = usePlayback(game, reduced, replay.epoch, replay.active ? replay.speed : 1),
    audio = useGameAudio(playback.motion);
  const stockGame = useCaptureStocks(game, playback.motion);
  const interaction = useBoardInteraction(
    game,
    settings.human,
    submit,
    sceneReady &&
      !playback.resolving &&
      !watching &&
      !replay.active &&
      !libraryOpen &&
      !catalogOpen,
    playback.presentChoice,
  );
  useEffect(() => {
    if (interaction.pending && interaction.optionIndex > 0)
      playback.previewChoice(interaction.preview);
  }, [interaction.pending, interaction.preview, playback.previewChoice]);
  const { area, ref: playRef } = usePlayArea();
  const {
    status: aiStatus,
    error: aiError,
    retry: retryNpc,
  } = useNpc(
    match.game,
    isSpectator(match.settings) ? null : match.settings.human,
    aiDifficulty(match.settings, match.game.turn),
    submit,
    sceneReady &&
      !playback.busy &&
      !rulesOpen &&
      !newGameOpen &&
      !rulesVisible &&
      !settingsVisible &&
      !libraryOpen &&
      !libraryVisible &&
      !catalogOpen &&
      !catalogVisible &&
      !replay.active &&
      (!watching || !paused || stepRequested),
    match.record.seed,
  );
  useEffect(() => {
    if (
      !replay.active ||
      !replay.playing ||
      playback.busy ||
      libraryVisible ||
      catalogOpen ||
      catalogVisible ||
      rulesOpen ||
      rulesVisible ||
      newGameOpen ||
      settingsVisible ||
      !sceneReady
    )
      return;
    if (replay.cursor === replay.total) {
      replay.pause();
      return;
    }
    const timer = window.setTimeout(replay.advance, 340 / replay.speed);
    return () => window.clearTimeout(timer);
  }, [
    replay.active,
    replay.playing,
    replay.cursor,
    replay.total,
    replay.speed,
    replay.advance,
    playback.busy,
    libraryVisible,
    catalogOpen,
    catalogVisible,
    rulesOpen,
    rulesVisible,
    newGameOpen,
    settingsVisible,
    sceneReady,
  ]);
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
    !replay.active &&
    !!king &&
    interaction.threats.some((t) => t.targetId === king.id) &&
    !playback.busy;
  const ended = game.phase === 'finished' && !playback.busy && !replay.active;
  const last = game.lastAction;
  return (
    <main
      className={`play-screen ${ended ? 'match-ended' : ''} ${ended && !resultDismissed ? 'result-cinematic' : ''}`}
      style={{ '--danger-color': GUIDE_COLORS.danger } as CSSProperties}
      onPointerDown={audio.unlock}
    >
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
              focusResult={ended && !resultDismissed}
              onReady={markReady}
              game={game}
              human={settings.human}
              selectedId={interaction.selectedId}
              legalCells={interaction.legalCells}
              reachableCells={interaction.reachableCells}
              unsafeCells={interaction.unsafeCells}
              preview={interaction.preview}
              previewUnsafe={interaction.previewUnsafe}
              threats={interaction.threats}
              kingCaptureIds={interaction.kingCaptureIds}
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
      <TurnSplash
        key={match.record.id}
        game={playback.settled}
        settings={settings}
        ready={
          sceneReady &&
          !replay.active &&
          !libraryVisible &&
          !rulesVisible &&
          !settingsVisible &&
          !catalogVisible
        }
        busy={playback.busy}
      />
      <header className="game-header">
        <div className="game-brand">
          <button
            className="brand-catalog"
            aria-label="駒の図鑑"
            title="駒の図鑑"
            onClick={() => {
              replay.pause();
              setCatalogOpen(true);
            }}
          >
            <AnimalIcon kind="seal" className="brand-mascot" />
            <span>図鑑</span>
          </button>
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
            className="hud-button replay-menu"
            aria-label="保存したリプレイ"
            onClick={() => {
              replay.pause();
              interaction.clearSelection();
              setLibraryOpen(true);
            }}
          >
            <Film size={18} />
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
          game={stockGame}
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
          {replay.active ? (
            <>
              {' '}
              <Film size={14} /> リプレイ{' '}
              <small>
                {replay.cursor} / {replay.total}手
              </small>
            </>
          ) : !sceneReady ? (
            '氷原を準備しています'
          ) : playback.busy ? (
            <>
              <span className="status-pulse" />{' '}
              {actorLabel(playback.motion?.action.piece.owner ?? last?.piece.owner)}：
              {playback.motion?.stage === 'choice' ? (
                '好きな姿をえらぼう！'
              ) : playback.motion?.stage === 'return' ? (
                'もとの場所へ戻ります'
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
            inspectingEnemy={interaction.inspectingEnemy}
            kingCaptureIds={interaction.kingCaptureIds}
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
      <AnimatedPresence
        show={replay.active || (!ended && !(interaction.pending && interaction.pending.length > 1))}
      >
        <div className="bottom-hud">
          {replay.active ? (
            <ReplayDock
              replay={replay}
              busy={playback.busy}
              game={stockGame}
              human={settings.human}
            />
          ) : watching ? (
            <SpectatorDock
              game={stockGame}
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
              game={stockGame}
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
          outcome={
            game.result?.winner == null
              ? 'draw'
              : watching || game.result.winner === settings.human
                ? 'victory'
                : 'defeat'
          }
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
      <AnimatedPresence show={catalogOpen} onPresenceChange={setCatalogVisible}>
        <PieceCatalog close={() => setCatalogOpen(false)} reduced={reduced} />
      </AnimatedPresence>
      <AnimatedPresence show={rulesOpen} onPresenceChange={setRulesVisible}>
        <RulesDialog close={() => setRulesOpen(false)} />
      </AnimatedPresence>
      <AnimatedPresence show={newGameOpen} onPresenceChange={setSettingsVisible}>
        <NewGameDialog
          current={match.settings}
          close={() => setNewGameOpen(false)}
          start={(s) => {
            replay.close();
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
      <AnimatedPresence show={libraryOpen} onPresenceChange={setLibraryVisible}>
        <ReplayLibraryDialog
          items={library.items}
          currentId={match.record.id}
          warning={library.warning}
          close={() => setLibraryOpen(false)}
          importRecord={library.importRecord}
          watch={(record) => {
            setKeyboardOpen(false);
            setLibraryOpen(false);
            replay.open(record);
          }}
        />
      </AnimatedPresence>
    </main>
  );
}
