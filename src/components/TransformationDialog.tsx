import { useEffect, useRef } from 'react';
import type { Player } from '../game/types';
import type { BoardInteraction } from './useBoardInteraction';
import { CaptureChoice } from './CaptureChoice';

/** The board remains visible while the piece waits above its destination. */
export function TransformationDialog({
  human,
  interaction,
}: {
  human: Player;
  interaction: BoardInteraction;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="transformation-dialog"
      aria-label="空中で変身を選択"
      onCancel={interaction.clearChoice}
    >
      <CaptureChoice human={human} interaction={interaction} />
    </dialog>
  );
}
