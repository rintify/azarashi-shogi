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
  if (interaction.inspectingEnemy && interaction.selected)
    return {
      title: `敵の${pieceName(interaction.selected)} · 移動範囲`,
      text: '相手の移動範囲を確認中。自分の駒か持ち駒を選ぶと操作に戻ります。',
    };
  let text = '盤上の駒、または持ち駒を選択してください。';
  if (interaction.pending) text = '空中の姿を確認し、「成る」「そのまま」で決定。';
  else if (interaction.portrait)
    text = `${pieceName(interaction.portrait)}を${interaction.selected ? '動かす' : '配置する'}場所を選んでください。`;
  if (interaction.unsafeCells.length)
    text = '赤いマスは、この手の後に動かす駒か自分の王が捕食される危険があります。';
  const title = interaction.portrait
    ? `${pieceName(interaction.portrait)}${interaction.selected ? '' : 'を配置'}`
    : 'あなたの番です';
  return { title, text };
}
