import { useRef, useState } from 'react';
import { Download, Film, Play, Upload, X } from 'lucide-react';
import { GameDialog } from './AnimatedUI';
import { AnimalIcon } from './AnimalIcon';
import { isSpectator, type GameRecord } from '../match/record';
import { replayTimeline, type SavedReplay } from '../match/replayLibrary';

function downloadRecord(record: GameRecord) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `azarashi-${record.createdAt.slice(0, 10)}-${record.id.slice(0, 8)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ReplayCard({
  item,
  current,
  watch,
}: {
  item: SavedReplay;
  current: boolean;
  watch: () => void;
}) {
  const { record } = item;
  const result = replayTimeline(record).at(-1)!.result;
  const caption = result
    ? result.winner === null
      ? '引き分け'
      : `${result.winner === 'south' ? '先手' : '後手'}の勝ち`
    : '対局の途中まで';
  return (
    <article className="replay-card">
      <AnimalIcon kind={isSpectator(record.settings) ? 'penguin' : 'seal'} />
      <div className="replay-card-copy">
        <strong>
          {isSpectator(record.settings)
            ? 'AI vs AI'
            : `あなた vs AI · Lv.${record.settings.difficulty}`}
        </strong>
        <span>
          {new Date(record.createdAt).toLocaleString('ja-JP', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          · {record.actions.length}手
        </span>
        <small>
          {current ? 'いまの対局' : caption}
        </small>
      </div>
      <button
        className="replay-watch"
        onClick={watch}
        aria-label={`${record.actions.length}手の棋譜を再生`}
      >
        <Play size={18} fill="currentColor" />
        再生
      </button>
      <button
        className="icon-button"
        onClick={() => downloadRecord(record)}
        aria-label="棋譜をファイルに保存"
        title="棋譜をファイルに保存"
      >
        <Download size={19} />
      </button>
    </article>
  );
}
export function ReplayLibraryDialog({
  items,
  currentId,
  warning,
  close,
  watch,
  importRecord,
}: {
  items: SavedReplay[];
  currentId: string;
  warning: string | null;
  close: () => void;
  watch: (record: GameRecord) => void;
  importRecord: (text: string) => GameRecord;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <GameDialog className="dialog replay-library" aria-labelledby="replay-title" onDismiss={close}>
      <header>
        <div className="dialog-title">
          <Film />
          <h2 id="replay-title">対局のリプレイ</h2>
        </div>
        <button className="icon-button" aria-label="棋譜一覧を閉じる" onClick={close}>
          <X />
        </button>
      </header>
      <p className="dialog-intro">対局はこの端末に自動保存。途中の棋譜も、あとから見返せます。</p>
      {(error || warning) && (
        <p className="replay-warning" role="alert">
          {error ?? warning}
        </p>
      )}
      <div className="replay-list">
        {items.length ? (
          items.map((item) => (
            <ReplayCard
              key={item.record.id}
              item={item}
              current={item.record.id === currentId}
              watch={() => watch(item.record)}
            />
          ))
        ) : (
          <div className="replay-empty">
            <AnimalIcon kind="seal" />
            <p>一手指すと、ここに保存されます</p>
          </div>
        )}
      </div>
      <button className="replay-import" onClick={() => input.current?.click()}>
        <Upload size={18} />
        棋譜ファイルを読み込む
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="棋譜ファイル"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          try {
            if (file.size > 5_000_000) throw new Error('棋譜ファイルは5MB以内にしてください。');
            importRecord(await file.text());
            setError(null);
          } catch (e) {
            setError(e instanceof Error ? e.message : '棋譜を読み込めません。');
          }
        }}
      />
    </GameDialog>
  );
}
