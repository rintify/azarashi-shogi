import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { DEFINITIONS, KINDS } from '../game/pieces';
import { AnimalIcon } from './AnimalIcon';
export function RulesDialog({ close }: { close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="rules-title"
      className="dialog rules-dialog"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <header>
        <div>
          <h2 id="rules-title">あそびかた</h2>
        </div>
        <button className="icon-button" onClick={close} aria-label="ルールを閉じる">
          <X size={20} />
        </button>
      </header>
      <p className="dialog-intro">
        相手のセイウチを捕食したら勝ち。仲間を食べることだって、次の一手につながります。
      </p>
      <div className="rule-animal-list">
        {KINDS.map((kind) => (
          <div key={kind}>
            <AnimalIcon kind={kind} />
            <section>
              <strong>
                {DEFINITIONS[kind].name}
                <small> ×{DEFINITIONS[kind].count}</small>
              </strong>
              <p>{DEFINITIONS[kind].description}</p>
            </section>
          </div>
        ))}
      </div>
      <ol className="rule-steps">
        <li>
          <strong>王の配置</strong>
          <p>先手から、自分側の半分に2×2のセイウチを配置。両者の王が揃ったら先手からスタート。</p>
        </li>
        <li>
          <strong>移動と配置</strong>
          <p>
            1手に移動か配置を1回。配置は自軍の駒に縦横斜めで隣接する空きマスへ。大きな駒は体全体が収まる必要があります。
          </p>
        </li>
        <li>
          <strong>重なったら、まとめて捕食</strong>
          <p>
            途中の駒は飛び越え、移動先と1マスでも重なる全駒を捕食。ジェットだけは前方の最初の駒で止まります。捕食した敵味方の駒は、成る前の姿で自分のストックへ。
          </p>
        </li>
        <li>
          <strong>捕食後の変身</strong>
          <p>
            捕食した手で1回だけ、成るか選べます。白アザラシ以外は捕食時に元へ戻れます。シャチは軸と回転方向を選び、変形前後のL字3マスを捕食できます。
          </p>
        </li>
        <li>
          <strong>勝敗の条件</strong>
          <p>
            自分の王を食べると負け。1手で両方の王を食べると引き分け。王手による移動制限はありません。「!」は相手の次の1手で食べられる可能性がある印です。
          </p>
        </li>
      </ol>
      <p className="rule-note">
        千日手・手数制限はありません。対局はこのブラウザーに自動保存されます。
      </p>
      <button className="primary-button full" onClick={close}>
        盤面に戻る
      </button>
    </dialog>
  );
}
