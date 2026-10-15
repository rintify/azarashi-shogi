import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, X } from 'lucide-react';
import type { Difficulty, MatchSettings } from '../match/record';
import type { Player } from '../game/types';
import { aiDifficulty, isSpectator } from '../match/record';
import { AnimalIcon } from './AnimalIcon';
import { LEVELS } from '../ai/levels';
export function NewGameDialog({
  current,
  close,
  start,
}: {
  current: MatchSettings;
  close: () => void;
  start: (settings: MatchSettings) => void;
}) {
  const [watching, setWatching] = useState(isSpectator(current));
  const [southLevel, setSouthLevel] = useState(aiDifficulty(current, 'south'));
  const ref = useRef<HTMLDialogElement>(null);
  const [human, setHuman] = useState<Player>(current.human);
  const [difficulty, setDifficulty] = useState<Difficulty>(current.difficulty);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="new-game-title"
      className="dialog new-match-dialog"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <header>
        <div className="dialog-title">
          <AnimalIcon kind="seal" />
          <h2 id="new-game-title">新しい対局</h2>
        </div>
        <button className="icon-button" onClick={close} aria-label="設定を閉じる">
          <X size={20} />
        </button>
      </header>
      <p className="dialog-intro">対戦モードと強さを選びます。開始すると現在の対局は終了します。</p>
      <label className="setting-label">対戦モード</label>
      <div className="side-options mode-options">
        <button
          aria-pressed={!watching}
          className={!watching ? 'active' : ''}
          onClick={() => setWatching(false)}
        >
          <div className="mode-portraits" aria-hidden="true">
            <AnimalIcon kind="seal" />
            <b>VS</b>
            <AnimalIcon kind="penguin" />
          </div>
          あなた vs AI<span>自分で対局する</span>
        </button>
        <button
          aria-pressed={watching}
          className={watching ? 'active' : ''}
          onClick={() => setWatching(true)}
        >
          <div className="mode-portraits" aria-hidden="true">
            <AnimalIcon kind="penguin" />
            <b>VS</b>
            <AnimalIcon kind="orca" />
          </div>
          AI vs AI<span>対局を観戦する</span>
        </button>
      </div>
      {!watching && (
        <>
          <label className="setting-label">あなたの手番</label>
          <div className="side-options">
            <button
              aria-pressed={human === 'south'}
              className={human === 'south' ? 'active' : ''}
              onClick={() => setHuman('south')}
            >
              先手<span>あなたから配置</span>
            </button>
            <button
              aria-pressed={human === 'north'}
              className={human === 'north' ? 'active' : ''}
              onClick={() => setHuman('north')}
            >
              後手<span>NPCから配置</span>
            </button>
          </div>
        </>
      )}
      {watching && (
        <>
          <label className="setting-label" htmlFor="south-difficulty">
            先手AIの強さ
            <span>
              Lv.{southLevel} · {LEVELS[southLevel].name}
            </span>
          </label>
          <input
            id="south-difficulty"
            type="range"
            min="1"
            max="5"
            step="1"
            value={southLevel}
            onChange={(e) => setSouthLevel(Number(e.target.value) as Difficulty)}
          />
        </>
      )}
      <label className="setting-label" htmlFor="difficulty">
        {watching ? '後手AIの強さ' : '相手の強さ'}
        <span>
          Lv.{difficulty} · {LEVELS[difficulty].name}
        </span>
      </label>
      <input
        id="difficulty"
        type="range"
        min="1"
        max="5"
        step="1"
        value={difficulty}
        onChange={(e) => setDifficulty(Number(e.target.value) as Difficulty)}
      />
      <div className="range-labels">
        <span>気軽に</span>
        <span>じっくり勝負</span>
      </div>
      <p className="difficulty-note">
        {watching
          ? `先手は最大${LEVELS[southLevel].thinkingMs / 1000}秒、後手は最大${LEVELS[difficulty].thinkingMs / 1000}秒。同じルールで対局します。`
          : difficulty === 5
            ? '最長10秒じっくり考える「極」。同じルールで、全力の一手を指します。'
            : `NPCの思考時間は最大${LEVELS[difficulty].thinkingMs / 1000}秒。${LEVELS[difficulty].name}レベルで対戦します。`}
      </p>
      <button
        className="primary-button full"
        onClick={() =>
          start({
            human: watching ? 'south' : human,
            difficulty,
            mode: watching ? 'ai-vs-ai' : 'human-vs-ai',
            aiLevels: watching ? { south: southLevel, north: difficulty } : undefined,
          })
        }
      >
        この設定ではじめる
        <ArrowRight size={17} />
      </button>
      <button className="cancel-button" onClick={close}>
        いまの対局に戻る
        <ChevronDown size={14} />
      </button>
    </dialog>
  );
}
