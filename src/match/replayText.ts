import { DEFINITIONS, KINDS, footprint, pieceName } from '../game/pieces';
import type { Cell, Piece, Player, Stock } from '../game/types';
import { coordinate } from '../shared/coordinates';
import { aiDifficulty, isLocalPvP, playerLabel, type GameRecord } from './record';
import { replayTimeline } from './replayLibrary';

const side = (owner: Player) => (owner === 'south' ? '先手' : '後手');
const cells = (positions: Cell[]) => positions.map(coordinate).join('・');
const piece = (p: Piece) =>
  `${side(p.owner)} ${pieceName(p)} [${p.id}]（占有: ${cells(footprint(p))}）`;
const stock = (s: Stock) => KINDS.map((k) => `${DEFINITIONS[k].name}=${s[k]}`).join('、');

/** Observed facts from canonical replay states; no invented strategy or evaluation. */
export function replayText(record: GameRecord): string {
  const states = replayTimeline(record);
  const initial = states[0],
    final = states[states.length - 1];
  const lines = [
    'アザラシ将棋 — 実況・解説用棋譜',
    `対局ID: ${record.id}`,
    `開始日時: ${record.createdAt}（ISO 8601）`,
    `ルールバージョン: ${record.rulesVersion}${isLocalPvP(record.settings) ? '' : ` / NPC乱数シード: ${record.seed}`}`,
    `先手: ${playerLabel(record.settings, 'south')} / 後手: ${playerLabel(record.settings, 'north')}`,
    isLocalPvP(record.settings)
      ? '対戦モード: ローカルPvP（先手・後手とも人間）'
      : `NPC難度: 先手Lv.${aiDifficulty(record.settings, 'south')}、後手Lv.${aiDifficulty(record.settings, 'north')}（人間側には適用しない）`,
    `記録手数: ${record.actions.length}`,
    '',
    '【実況・解説のための読み方】',
    '以下は実際の合法手から再現した事実。戦略・狙い・形勢評価は推測として区別すること。',
    '盤は10×10。左からA〜J、上から10〜1。先手の前方は数字が増える方向、後手は減る方向。',
    '駒IDは同じ個体を追う識別子。大型駒は記載された全マスを占有する。',
    '「着地点」は変身前の占有範囲、「最終占有」は変身完了後の占有範囲。',
    '',
    '【ルール】',
    ...KINDS.map(
      (kind) =>
        `${DEFINITIONS[kind].name}: 各陣営${DEFINITIONS[kind].count}体。${DEFINITIONS[kind].description}`,
    ),
    'シロクマは縦横の最大距離がちょうど2の外周16マスへ跳ぶ。',
    'シャチ縦は1×2、横は2×1、王は2×2。駒全体が盤内に収まる必要がある。',
    'ジェットペンギンは前方の最初の駒、または盤端まで進み、途中停止はできない。',
    '通常の移動は途中の駒を飛び越え、着地点の占有範囲に1マスでも重なる駒を丸ごと捕食する。複数・味方の捕食も可能。',
    '捕食した非王は敵味方を問わず、捕食者のストックへ成る前の種類で戻る。',
    '1体以上の捕食で任意の変身が可能。白→黒は不可逆。ペンギンとシャチは可逆。',
    'シャチの回転は着地点の捕食後に軸を選び90度回転。変形前後のL字3マスで捕食する。回転後も最初に捕食したマスを最低1つ踏む。',
    'ストックからの配置は成る前の姿。全占有マスが空き、自軍の駒に辺か角で隣接する必要がある。',
    '王は最初から手前中央に配置され、先手から開始する。王手だけでは終局しない。危険な手も禁止されない。',
    '敵王だけの捕食で勝ち、自軍王だけの捕食で負け、両王同時捕食は引き分け。',
    '',
    '【初期局面】',
    ...initial.pieces.map(piece),
    `先手ストック: ${stock(initial.stocks.south)}`,
    `後手ストック: ${stock(initial.stocks.north)}`,
    '',
    '【着手記録】',
  ];
  states.slice(1).forEach((state, index) => {
    const previous = states[index];
    const preview = state.lastAction!;
    const action = preview.action;
    const original = previous.pieces.find((p) => p.id === preview.piece.id);
    lines.push(
      '',
      `${index + 1}手目 | ${side(previous.turn)}（${playerLabel(record.settings, previous.turn)}）`,
    );
    if (action.type === 'place') {
      lines.push(`配置: ${piece(preview.piece)}`);
    } else {
      lines.push(
        `移動: ${pieceName(original!)} [${preview.piece.id}] ${cells(footprint(original!))} → 着地点 ${cells(footprint({ ...original!, at: action.to }))}`,
      );
      const transformation = action.transformation;
      lines.push(
        `変身: ${
          transformation?.type === 'rotate'
            ? `軸 ${coordinate(footprint({ ...original!, at: action.to })[transformation.pivot])} を中心に${transformation.direction === 1 ? '右' : '左'}90度回転 → ${pieceName(preview.piece)}`
            : transformation
              ? `${pieceName(original!)} → ${pieceName(preview.piece)}`
              : 'なし'
        }`,
      );
      lines.push(`最終占有: ${cells(preview.footprint)}`);
    }
    lines.push(`捕食判定範囲: ${cells(preview.captureCells) || 'なし（配置）'}`);
    lines.push(
      `捕食: ${preview.captured.length ? preview.captured.map((p) => `${p.owner === previous.turn ? '味方' : '相手'} ${piece(p)}`).join(' / ') : 'なし'}`,
    );
    lines.push(
      `先手ストック: ${stock(state.stocks.south)}`,
      `後手ストック: ${stock(state.stocks.north)}`,
    );
    if (state.result)
      lines.push(
        `終局: ${state.result.winner ? `${side(state.result.winner)}の勝利` : '引き分け'}（${state.result.reason === 'both-kings' ? '両王同時捕食' : '王の捕食'}）`,
      );
  });
  lines.push('', '【最終局面】', ...final.pieces.map(piece));
  lines.push(
    final.result
      ? `結果: ${final.result.winner ? `${side(final.result.winner)}の勝利` : '引き分け'}`
      : `未終局。次は${side(final.turn)}の手番。`,
  );
  return lines.join('\n') + '\n';
}
