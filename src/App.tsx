import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, Compass, Flag, Keyboard, Maximize2, RotateCcw, Snowflake, Sparkles, Swords, X } from 'lucide-react';
import { getThreats, moveCells, moveOptions, pieceAt, placementCells, previewAction } from './game/engine';
import { DEFINITIONS, dimensions, KINDS, pieceName } from './game/pieces';
import type { ActionPreview, Cell, Kind, Piece, Player } from './game/types';
import { otherPlayer, sameCell } from './game/types';
import { useMatch } from './match/useMatch';
import { useNpc } from './ai/useNpc';
import type { Difficulty, MatchSettings } from './match/record';
import { AnimalIcon } from './components/AnimalIcon';
import { MovementDiagram } from './components/MovementDiagram';
import { RulesDialog } from './components/RulesDialog';
const BoardScene = lazy(() => import('./scene/BoardScene').then(m => ({ default: m.BoardScene })));
const LEVEL_NAMES = ['おさんぽ', '見習い', 'しっかり', '達人', '極'];
const coordinate = (c: Cell) => `${String.fromCharCode(65 + c.x)}${10 - c.y}`;

export default function App() {
  const { game, settings, warning, submit, restart, history } = useMatch();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stockKind, setStockKind] = useState<Kind | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);
  const [pending, setPending] = useState<ActionPreview[] | null>(null);
  const [optionIndex, setOptionIndex] = useState(0);
  const [inspectedThreat, setInspectedThreat] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [newGameOpen, setNewGameOpen] = useState(false);
  const [view, setView] = useState<'perspective' | 'top'>('perspective');
  const [cameraReset, setCameraReset] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const { status: aiStatus, error: aiError, retry: retryNpc } = useNpc(game, settings.human, settings.difficulty, submit);
  const humanTurn = game.turn === settings.human && game.phase !== 'finished';
  const setup = game.phase.startsWith('setup');
  const selected = game.pieces.find(p => p.id === selectedId) ?? null;
  const activeKind = setup ? 'walrus' : stockKind;
  const legalCells = useMemo(() => {
    if (!humanTurn) return [];
    if (pending) return [];
    if (selected) return moveCells(game, selected);
    return activeKind ? placementCells(game, activeKind) : [];
  }, [game, humanTurn, pending, selected, activeKind]);
  const threats = useMemo(() => getThreats(game, settings.human), [game, settings.human]);
  const threat = threats.find(t => t.targetId === (inspectedThreat ?? selectedId));
  const preview = useMemo(() => {
    if (pending) return pending[optionIndex];
    if (!hover || !legalCells.some(c => sameCell(c, hover))) return null;
    if (selected) return moveOptions(game, selected, hover)[0];
    return activeKind ? previewAction(game, { type: 'place', kind: activeKind, at: hover }) : null;
  }, [pending, optionIndex, hover, legalCells, selected, activeKind, game]);
  const portrait: Piece | null = selected ?? (activeKind ? { id: 'portrait', kind: activeKind, owner: settings.human, at: { x: 4, y: 4 }, promoted: false } : null);
  useEffect(() => {
    setSelectedId(null); setStockKind(null); setPending(null); setHover(null); setInspectedThreat(null); setOptionIndex(0);
  }, [game.revision, settings.human]);
  const clearChoice = () => { setPending(null); setOptionIndex(0); setHover(null); };
  function selectStock(kind: Kind) {
    if (!humanTurn || setup || game.stocks[settings.human][kind] === 0) return;
    clearChoice(); setSelectedId(null); setStockKind(kind === stockKind ? null : kind); setInspectedThreat(null);
  }
  function clickCell(cell: Cell) {
    if (!humanTurn || pending) return;
    if (legalCells.some(c => sameCell(c, cell))) {
      if (selected) {
        const options = moveOptions(game, selected, cell);
        if (options.length > 1) { setPending(options); setOptionIndex(0); }
        else if (options[0]) submit(options[0].action, game.revision);
      } else if (activeKind) submit({ type: 'place', kind: activeKind, at: cell }, game.revision);
      return;
    }
    const piece = pieceAt(game, cell);
    if (!setup && piece?.owner === settings.human) {
      setSelectedId(piece.id === selectedId ? null : piece.id); setStockKind(null); setInspectedThreat(null); setHover(null);
    } else if (!setup) { setSelectedId(null); setStockKind(null); setHover(null); }
  }
  const won = game.result?.winner === settings.human;
  const statusTitle = game.phase === 'finished' ? game.result?.winner === null ? '引き分けです' : won ? 'あなたの勝ち！' : 'NPCの勝ちです' : humanTurn ? setup ? '王を置いて、はじめよう' : 'あなたの番です' : setup ? '相手が王を配置しています' : '相手が考えています';
  const statusText = game.phase === 'finished' ? '氷上の一戦、おつかれさまでした。' : humanTurn ? setup ? '手前半分の緑のマスに、セイウチを置きましょう。' : pending ? '変身後の形と捕食する駒を確認して、選んでください。' : portrait ? `${pieceName(portrait)}を${selected ? '動かす' : '配置する'}場所を選んでください。` : '盤上の仲間を動かすか、ストックから仲間を呼ぼう。' : '盤面を眺めながら、次の一手を考えてみましょう。';
  const last = game.lastAction;
  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="./" aria-label="アザラシ将棋 ホーム"><div className="brand-mark"><AnimalIcon kind="seal" /></div><div><h1>アザラシ将棋<span className="brand-dot">.</span></h1><p>氷上の、小さな頭脳戦。</p></div></a>
      <nav><span className="local-pill"><span />LOCAL PLAY</span><button className="quiet-button" aria-label="あそびかた" onClick={() => setRulesOpen(true)}><BookOpen size={17} /><span>あそびかた</span></button><button className="new-game-button" onClick={() => setNewGameOpen(true)}><RotateCcw size={16} /><span>新しい対局</span></button></nav>
    </header>
    <main className="main-layout">
      <section className="game-section" aria-label="対局盤">
        <div className="game-heading"><div className="heading-copy"><span className="eyebrow"><span className="live-dot" />LET'S PLAY ON THE ICE</span><h2>今日も、氷の上で一局。</h2></div><span className="match-chip"><Swords size={14} />あなた <span>vs</span> NPC</span></div>
        <div className="board-card">
          <div className="board-status"><div className={`turn-avatar ${!humanTurn ? 'npc-avatar' : ''}`}><AnimalIcon kind={humanTurn ? 'seal' : 'penguin'} /></div><div><div className="status-title"><strong>{statusTitle}</strong>{humanTurn && <span className="your-turn">YOUR TURN</span>}</div><p>{statusText}</p></div><div className="turn-counter"><span>{setup ? '準備' : 'TURN'}</span><strong>{setup ? game.phase === 'setup-south' ? '01' : '02' : String(Math.max(1, game.revision - 1)).padStart(2, '0')}</strong></div></div>
          <div className="board-viewport">
            <div className="board-top-label"><Snowflake size={14} /><span>ANTARCTIC FIELD</span><b>10 × 10</b></div>
            <div className="view-controls"><button className={view === 'top' ? 'active' : ''} title="真上から見る" aria-label="真上から見る" onClick={() => setView(view === 'top' ? 'perspective' : 'top')}><Maximize2 size={17} /></button><button title="視点を戻す" aria-label="視点を戻す" onClick={() => { setView('perspective'); setCameraReset(n => n + 1); }}><Compass size={18} /></button></div>
            <Suspense fallback={<div className="canvas-loading">氷の盤面を準備しています…</div>}><BoardScene game={game} human={settings.human} selectedId={selectedId} legalCells={legalCells} preview={preview} threats={threats} threatSources={threat?.attackerIds ?? []} view={view} cameraReset={cameraReset} onCell={clickCell} onHover={setHover} onThreat={id => { setInspectedThreat(id); if (humanTurn && !pending) { setSelectedId(id); setStockKind(null); } }} /></Suspense>
            <div className="board-bottom-label"><span className="snow-line" /><span>南極の氷原</span><span className="board-latitude">78° S · 166° E</span></div>
            {game.phase === 'finished' && <div className="result-overlay"><div><Flag size={28} /><h2>{statusTitle}</h2><p>{game.result?.reason === 'both-kings' ? '2体の王が、同じ一手で捕食されました。' : 'セイウチが捕食され、勝負が決まりました。'}</p><button className="primary-button" onClick={() => setNewGameOpen(true)}>もう一局あそぶ <ArrowRight size={16} /></button></div></div>}
          </div>
          <div className="board-toolbar"><span><span className="legend-dot legal-dot" />動けるマス</span><span><span className="legend-dot capture-dot" />捕食する駒</span><span><b className="legend-alert">!</b>食べられるかも</span><button className={keyboardOpen ? 'active' : ''} onClick={() => setKeyboardOpen(!keyboardOpen)} aria-label="マス一覧で操作" title="マス一覧で操作"><Keyboard size={17} /></button></div>
          {keyboardOpen && <div className="keyboard-board" aria-label="マス一覧で操作">{Array.from({ length: 100 }, (_, i) => {
            const c = { x: i % 10, y: Math.floor(i / 10) }, p = pieceAt(game, c), legal = legalCells.some(l => sameCell(l, c));
            return <button key={i} className={legal ? 'legal' : ''} aria-label={`${coordinate(c)}${p ? ` ${pieceName(p)}` : ''}${legal ? ' 選択可能' : ''}`} onClick={() => clickCell(c)} onFocus={() => setHover(c)} onMouseEnter={() => setHover(c)}>{p ? <AnimalIcon kind={p.kind} promoted={p.promoted} /> : coordinate(c)}</button>;
          })}</div>}
        </div>
        <div className="below-board"><span><Compass size={14} />ドラッグで回転 · スクロールでズーム</span><span><Check size={13} />ブラウザーに自動保存</span></div>
        {warning && <p className="error-message" role="alert">{warning}</p>}
      </section>
      <aside className="sidebar">
        <section className="opponent-card"><div className="player-heading"><div className="npc-icon"><AnimalIcon kind="penguin" /></div><div><span className="eyebrow">YOUR OPPONENT</span><h3>氷原のペンギン<span className="level-pill">Lv.{settings.difficulty}</span></h3></div><span className={`presence-dot ${aiStatus.thinking ? 'thinking' : ''}`} /></div><div className="opponent-meta"><span>{LEVEL_NAMES[settings.difficulty - 1]}な対戦相手</span><button onClick={() => setNewGameOpen(true)}>難易度を変更<ChevronRight size={13} /></button></div><div className="stock-label"><span>相手のストック</span><small>{Object.values(game.stocks[otherPlayer(settings.human)]).reduce((a, b) => a + b, 0)}体</small></div><div className="opponent-stock">{KINDS.map(kind => <div key={kind} title={`${DEFINITIONS[kind].name} ${game.stocks[otherPlayer(settings.human)][kind]}体`}><AnimalIcon kind={kind} /><span>×{game.stocks[otherPlayer(settings.human)][kind]}</span></div>)}</div>{aiStatus.thinking && <div className="thinking-status"><span className="thinking-dots"><i /><i /><i /></span>一手を考えています{aiStatus.depth > 0 && <small>深さ {aiStatus.depth}</small>}</div>}{aiError && <p className="error-message" role="alert">{aiError}<button className="text-link" onClick={retryNpc}>もう一度考える</button></p>}</section>
        <section className="reserve-card"><div className="section-title"><h3><span className="small-square" />あなたのストック</h3><span>{Object.values(game.stocks[settings.human]).reduce((a, b) => a + b, 0)}体</span></div><p className="section-description">仲間を選んで、氷の上へ。</p><div className="reserve-grid">{KINDS.map(kind => <button key={kind} disabled={!humanTurn || setup || game.stocks[settings.human][kind] === 0} className={`${activeKind === kind ? 'selected' : ''} ${game.stocks[settings.human][kind] === 0 ? 'empty' : ''}`} onClick={() => selectStock(kind)} aria-label={`${DEFINITIONS[kind].name}を配置 残り${game.stocks[settings.human][kind]}体`}><div><AnimalIcon kind={kind} /><span className="stock-count">{game.stocks[settings.human][kind]}</span></div><span>{DEFINITIONS[kind].short}</span></button>)}</div><div className="reserve-tip"><span>↗</span>自分の駒のとなりに配置できます。</div></section>
        <section className={`detail-card ${pending ? 'choice-card' : ''}`} aria-live="polite">
          {pending ? <><div className="section-title"><h3><Sparkles size={16} />変身しますか？</h3><button className="icon-button" aria-label="移動を取り消す" onClick={clearChoice}><X size={17} /></button></div><p className="section-description">候補に触れると、盤面に形を表示します。</p><div className="transform-options">{pending.map((p, i) => <button key={i} className={optionIndex === i ? 'active' : ''} onMouseEnter={() => setOptionIndex(i)} onFocus={() => setOptionIndex(i)} onClick={() => submit(p.action, game.revision)}><AnimalIcon kind={p.piece.kind} promoted={p.piece.promoted} /><div><strong>{i === 0 ? 'そのまま進む' : p.piece.kind === 'orca' ? `回転 ${i} · ${coordinate(p.piece.at)}` : pieceName(p.piece)}<small>{dimensions(p.piece).join(' × ')} マス · {p.captured.length}体を捕食</small></strong></div><ChevronRight size={15} /></button>)}</div></> : portrait ? <><div className="section-title"><h3>{selected ? '選択中の仲間' : setup ? 'はじまりの一手' : '配置する仲間'}</h3><span className="soft-tag">{dimensions(portrait).join(' × ')}</span></div><div className="piece-detail"><div className="portrait-circle"><AnimalIcon kind={portrait.kind} promoted={portrait.promoted} /></div><div><h4>{pieceName(portrait)}</h4><p>{DEFINITIONS[portrait.kind].description}</p></div><MovementDiagram piece={portrait} /></div>{threat && <div className="danger-tip"><b>!</b><span>{threat.attackerIds.map(id => game.pieces.find(p => p.id === id)).filter((p): p is Piece => !!p).map(pieceName).join('・')}に捕食される可能性があります。</span></div>}{preview && <div className="preview-summary">{preview.captured.length ? <><Swords size={14} />{preview.captured.length}体を捕食<span>{preview.captured.map(pieceName).join('、')}</span></> : <><ArrowDown size={14} />{coordinate(preview.piece.at)}へ{selected ? '移動' : '配置'}</>}</div>}</> : <><span className="eyebrow">A LITTLE HINT</span><div className="hint-heading"><Sparkles size={19} /><h3>食べるほど、広がる一手。</h3></div><p className="hint-body">仲間を捕食しても、その駒はストックへ。変身のきっかけにしてみるのも、ひとつの作戦。</p><button className="text-link" onClick={() => setRulesOpen(true)}>駒の動かし方をみる<ArrowRight size={14} /></button></>}
        </section>
        <section className="last-move"><span className="eyebrow">LAST MOVE</span>{last ? <div><AnimalIcon kind={last.piece.kind} promoted={last.piece.promoted} /><p><strong>{last.piece.owner === settings.human ? 'あなた' : 'NPC'}</strong><span>{pieceName(last.piece)}を{coordinate(last.piece.at)}へ{last.from ? '移動' : '配置'}{last.captured.length ? ` · ${last.captured.length}体捕食` : ''}</span></p></div> : <p>最初の一手を、待っています。</p>}<span className="history-count">{history.length} ACTIONS</span></section>
      </aside>
    </main>
    <footer className="site-footer"><div><Snowflake size={13} /><span>ゆっくり考える時間も、あそびのうち。</span></div><span>AZARASHI SHOGI <span className="footer-divider">/</span> MADE FOR A LITTLE WONDER</span></footer>
    {rulesOpen && <RulesDialog close={() => setRulesOpen(false)} />}
    {newGameOpen && <NewGameDialog current={settings} close={() => setNewGameOpen(false)} start={s => { restart(s); setNewGameOpen(false); setSelectedId(null); setStockKind(null); clearChoice(); }} />}
  </div>;
}
function NewGameDialog({ current, close, start }: { current: MatchSettings; close: () => void; start: (settings: MatchSettings) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [human, setHuman] = useState<Player>(current.human);
  const [difficulty, setDifficulty] = useState<Difficulty>(current.difficulty);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="dialog new-match-dialog" onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}><header><div><span className="eyebrow">A FRESH START</span><h2>新しい氷上の一戦。</h2></div><button className="icon-button" onClick={close} aria-label="設定を閉じる"><X size={20} /></button></header><p className="dialog-intro">現在の対局を終了して、新しい対局を始めます。</p><label className="setting-label">あなたの手番</label><div className="side-options"><button className={human === 'south' ? 'active' : ''} onClick={() => setHuman('south')}>先手<span>あなたから配置</span></button><button className={human === 'north' ? 'active' : ''} onClick={() => setHuman('north')}>後手<span>NPCから配置</span></button></div><label className="setting-label" htmlFor="difficulty">相手の強さ<span>Lv.{difficulty} · {LEVEL_NAMES[difficulty - 1]}</span></label><input id="difficulty" type="range" min="1" max="5" step="1" value={difficulty} onChange={e => setDifficulty(Number(e.target.value) as Difficulty)} /><div className="range-labels"><span>気軽に</span><span>じっくり勝負</span></div><p className="difficulty-note">{difficulty === 5 ? '最長10秒じっくり考える「極」。同じルールで、全力の一手を指します。' : `NPCの思考時間は最大${[0.1, 0.3, 1, 3][difficulty - 1]}秒。${LEVEL_NAMES[difficulty - 1]}のペンギンがお相手します。`}</p><button className="primary-button full" onClick={() => start({ human, difficulty })}>この設定ではじめる<ArrowRight size={17} /></button><button className="cancel-button" onClick={close}>いまの対局に戻る<ChevronDown size={14} /></button></dialog>;
}
