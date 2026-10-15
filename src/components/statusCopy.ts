import type { GameState, Player } from '../game/types';
import { pieceName } from '../game/pieces';
import type { BoardInteraction } from './useBoardInteraction';
/** UI copy follows the same phases as the match, without introducing rule decisions. */
export function statusCopy(game: GameState, human: Player, interaction: BoardInteraction) {
  if (game.phase === 'finished') {
    let title = '引き分けです';
    if (game.result?.winner)
      title = game.result.winner === human ? 'あなたの勝ち！' : 'NPCの勝ちです';
    return { title, text: '氷上の一戦、おつかれさまでした。' };
  }
  if (!interaction.humanTurn)
    return {
      title: interaction.setup ? '相手が王を配置しています' : '相手が考えています',
      text: '盤面を眺めながら、次の一手を考えてみましょう。',
    };
  if (interaction.setup)
    return {
      title: '王を置いて、はじめよう',
      text: '手前半分の緑のマスに、セイウチを置きましょう。',
    };
  let text = '盤上の仲間を動かすか、ストックから仲間を呼ぼう。';
  if (interaction.pending) text = '捕食する駒と変身後の形を確認し、「この手を指す」で決定。';
  else if (interaction.portrait)
    text = `${pieceName(interaction.portrait)}を${interaction.selected ? '動かす' : '配置する'}場所を選んでください。`;
  if (interaction.selected?.kind === 'walrus' && interaction.unsafeCells.length)
    text = '橙のマスは、移動後に王が捕食される危険があります。';
  return { title: 'あなたの番です', text };
}
