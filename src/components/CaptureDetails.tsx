import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Piece, Player } from '../game/types';
import { pieceName } from '../game/pieces';
import { AnimalIcon } from './AnimalIcon';

export function CaptureDetails({
  pieces,
  human,
  close,
}: {
  pieces: Piece[];
  human: Player;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="capture-title"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <header>
        <h2 id="capture-title">捕食する{pieces.length}体</h2>
        <button className="icon-button" aria-label="捕食の内訳を閉じる" onClick={close}>
          <X size={20} />
        </button>
      </header>
      <div className="rule-animal-list">
        {pieces.map((piece) => (
          <div key={piece.id}>
            <AnimalIcon kind={piece.kind} promoted={piece.promoted} />
            <section>
              <strong>
                {piece.owner === human ? '味方' : '相手'}の{pieceName(piece)}
              </strong>
              <p>
                {piece.kind === 'walrus'
                  ? '王の捕食で勝敗が決まります。'
                  : '成る前の姿であなたのストックに戻ります。'}
              </p>
            </section>
          </div>
        ))}
      </div>
      <button className="primary-button full" style={{ marginTop: 20 }} onClick={close}>
        盤面に戻る
      </button>
    </dialog>
  );
}
