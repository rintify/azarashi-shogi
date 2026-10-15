import { GameDialog } from './AnimatedUI';
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
  return (
    <GameDialog
      className="transformation-dialog"
      aria-label="空中で変身を選択"
      onDismiss={interaction.clearChoice}
      dismissOnBackdrop={false}
    >
      <CaptureChoice human={human} interaction={interaction} />
    </GameDialog>
  );
}
