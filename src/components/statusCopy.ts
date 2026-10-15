import type { GameState, Player } from '../game/types';
import { pieceName } from '../game/pieces';
import type { BoardInteraction } from './useBoardInteraction';
/** UI copy follows the same phases as the match, without introducing rule decisions. */
export function statusCopy(game: GameState, human: Player, interaction: BoardInteraction) {
  if (game.phase === 'finished') {
    let title = '引き分けです';
    if (game.result?.winner)
      title = game.result.winner === human ? 'あなたの勝ち！' : 'NPCの勝ちです';
    return { title, text: '王の捕食で対局が終了しました。' };
  }
  if (!interaction.humanTurn)
    return {
      title: '相手が考えています',
      text: 'NPCの手を待っています。',
    };
  let text = '盤上の駒、または持ち駒を選択してください。';
  if (interaction.pending) text = '空中の姿を確認し、「成る」「そのまま」で決定。';
  else if (interaction.portrait)
    text = `${pieceName(interaction.portrait)}を${interaction.selected ? '動かす' : '配置する'}場所を選んでください。`;
  if (interaction.selected?.kind === 'walrus' && interaction.unsafeCells.length)
    text = '橙のマスは、移動後に王が捕食される危険があります。';
  const title = interaction.portrait
    ? `${pieceName(interaction.portrait)}${interaction.selected ? '' : 'を配置'}`
    : 'あなたの番です';
  return { title, text };
}
