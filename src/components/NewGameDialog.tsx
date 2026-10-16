import { GameDialog, AnimatedSize } from './AnimatedUI';
import { useState } from 'react';
import { ArrowRight, ChevronDown, X } from 'lucide-react';
import type { Difficulty, MatchSettings } from '../match/record';
import type { Player } from '../game/types';
import { aiDifficulty } from '../match/record';
import { AnimalIcon } from './AnimalIcon';
import { LEVELS, MAX_DIFFICULTY } from '../ai/levels';
export function NewGameDialog({
  current,
  close,
  start,
}: {
  current: MatchSettings;
  close: () => void;
  start: (settings: MatchSettings) => void;
}) {
  const [mode, setMode] = useState<NonNullable<MatchSettings['mode']>>(
    current.mode ?? 'human-vs-ai',
  );
  const watching = mode === 'ai-vs-ai';
  const local = mode === 'local-pvp';
  const [southLevel, setSouthLevel] = useState(aiDifficulty(current, 'south'));
  const [human, setHuman] = useState<Player>(current.human);
  const [difficulty, setDifficulty] = useState<Difficulty>(current.difficulty);
  return (
    <GameDialog
      aria-labelledby="new-game-title"
      className="dialog new-match-dialog"
      onDismiss={close}
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
      <AnimatedSize>
        <p className="dialog-intro">遊び方を選んではじめよう。今の対局はリプレイに残ります。</p>
        <label className="setting-label">対戦モード</label>
        <div className="side-options mode-options">
          <button
            aria-pressed={mode === 'human-vs-ai'}
            className={mode === 'human-vs-ai' ? 'active' : ''}
            onClick={() => setMode('human-vs-ai')}
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
            onClick={() => setMode('ai-vs-ai')}
          >
            <div className="mode-portraits" aria-hidden="true">
              <AnimalIcon kind="penguin" />
              <b>VS</b>
              <AnimalIcon kind="orca" />
            </div>
            AI vs AI<span>対局を観戦する</span>
          </button>
          <button
            aria-pressed={local}
            className={local ? 'active' : ''}
            onClick={() => setMode('local-pvp')}
          >
            <div className="mode-portraits" aria-hidden="true">
              <AnimalIcon kind="seal" />
              <b>VS</b>
              <AnimalIcon kind="seal" promoted />
            </div>
            ローカルPvP<span>同じ端末でふたり対戦</span>
          </button>
        </div>
        {!watching && !local && (
          <div className="settings-group">
            <label className="setting-label">あなたの手番</label>
            <div className="side-options">
              <button
                aria-pressed={human === 'south'}
                className={human === 'south' ? 'active' : ''}
                onClick={() => setHuman('south')}
              >
                先手<span>あなたから開始</span>
              </button>
              <button
                aria-pressed={human === 'north'}
                className={human === 'north' ? 'active' : ''}
                onClick={() => setHuman('north')}
              >
                後手<span>NPCから開始</span>
              </button>
            </div>
          </div>
        )}
        {watching && (
          <div className="settings-group">
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
              max={MAX_DIFFICULTY}
              step="1"
              value={southLevel}
              onChange={(e) => setSouthLevel(Number(e.target.value) as Difficulty)}
            />
          </div>
        )}
        {local ? (
          <p className="local-play-note">
            先手（青）から開始。1手ごとに視点と持ち駒が切り替わります。端末を交代しながら遊んでね。
          </p>
        ) : (
          <>
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
              max={MAX_DIFFICULTY}
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
                : difficulty === 6
                  ? '最大30秒、捕食の連鎖や王の救出まで深く読む「覇王」。同じルールで挑みます。'
                  : difficulty === 5
                    ? '最長10秒じっくり考える「極」。同じルールで、全力の一手を指します。'
                    : `NPCの思考時間は最大${LEVELS[difficulty].thinkingMs / 1000}秒。${LEVELS[difficulty].name}レベルで対戦します。`}
            </p>
          </>
        )}
        <button
          className="primary-button full"
          onClick={() =>
            start({
              human: watching || local ? 'south' : human,
              difficulty,
              mode,
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
      </AnimatedSize>
    </GameDialog>
  );
}
