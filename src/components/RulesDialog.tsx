import { GameDialog } from './AnimatedUI';
import { X } from 'lucide-react';
import { DEFINITIONS, KINDS } from '../game/pieces';
import { AnimalIcon } from './AnimalIcon';
export function RulesDialog({ close }: { close: () => void }) {
  return (
    <GameDialog aria-labelledby="rules-title" className="dialog rules-dialog" onDismiss={close}>
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
          <strong>王は最初から手前中央に</strong>
          <p>
            2×2のセイウチは両者の手前中央に配置済み。先手からすぐに移動・持ち駒の配置を始められます。
          </p>
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
            捕食した手で1回だけ、成るか選べます。白アザラシ以外は捕食時に元へ戻れます。ジェットペンギンに成るときは4方向から向きを選び、その向きに進みます。シャチは、最初の着地点で捕食したマスを回転後も最低1つ踏む向きだけ選べます。変形前後のL字3マスで追加の捕食もできます。
          </p>
        </li>
        <li>
          <strong>勝敗の条件</strong>
          <p>
            自分の王を食べると負け。1手で両方の王を食べると引き分け。王手による移動制限はありません。自分の手番では「!」が捕食されうる駒に、金色の王冠が相手の王を捕食できる駒に付きます。両方に当てはまるときは王冠を優先します。
          </p>
        </li>
      </ol>
      <p className="rule-note">
        千日手・手数制限はありません。対局はこのブラウザーに自動保存されます。
      </p>
      <button className="primary-button full" onClick={close}>
        盤面に戻る
      </button>
    </GameDialog>
  );
}
