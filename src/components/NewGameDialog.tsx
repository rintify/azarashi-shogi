import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, X } from 'lucide-react';
import type { Difficulty, MatchSettings } from '../match/record';
import type { Player } from '../game/types';
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
        <div>
          <span className="eyebrow">A FRESH START</span>
          <h2 id="new-game-title">新しい氷上の一戦。</h2>
        </div>
        <button className="icon-button" onClick={close} aria-label="設定を閉じる">
          <X size={20} />
        </button>
      </header>
      <p className="dialog-intro">現在の対局を終了して、新しい対局を始めます。</p>
      <label className="setting-label">あなたの手番</label>
      <div className="side-options">
        <button className={human === 'south' ? 'active' : ''} onClick={() => setHuman('south')}>
          先手<span>あなたから配置</span>
        </button>
        <button className={human === 'north' ? 'active' : ''} onClick={() => setHuman('north')}>
          後手<span>NPCから配置</span>
        </button>
      </div>
      <label className="setting-label" htmlFor="difficulty">
        相手の強さ
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
        {difficulty === 5
          ? '最長10秒じっくり考える「極」。同じルールで、全力の一手を指します。'
          : `NPCの思考時間は最大${LEVELS[difficulty].thinkingMs / 1000}秒。${LEVELS[difficulty].name}のペンギンがお相手します。`}
      </p>
      <button className="primary-button full" onClick={() => start({ human, difficulty })}>
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
