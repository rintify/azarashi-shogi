import { expect, it } from 'vitest';
import { applyAction, createGame } from '../game/engine';
import { newRecord } from './record';
import { replayText } from './replayText';

it('exports exact captures, ownership, transformation and stock counts for commentary', () => {
  const record = newRecord();
  record.actions = [
    { type: 'place', kind: 'penguin', at: { x: 3, y: 7 } },
    { type: 'move', pieceId: 'king-north', to: { x: 4, y: 1 } },
    { type: 'place', kind: 'seal', at: { x: 3, y: 6 } },
    { type: 'move', pieceId: 'king-north', to: { x: 4, y: 0 } },
    { type: 'move', pieceId: 'p0', to: { x: 3, y: 6 }, transformation: { type: 'promote' } },
  ];
  // Use the actual engine-assigned king ID rather than depending on its spelling.
  const king = createGame().pieces.find((p) => p.owner === 'north')!;
  record.actions[1] = { type: 'move', pieceId: king.id, to: { x: 4, y: 1 } };
  record.actions[3] = { type: 'move', pieceId: king.id, to: { x: 4, y: 0 } };
  let game = createGame();
  for (const action of record.actions) game = applyAction(game, action);
  const text = replayText(record);
  expect(text).toContain('記録手数: 5');
  expect(text).toContain('5手目 | 先手（あなた）');
  expect(text).toContain('ペンギン（歩行） [p0] D3 → 着地点 D4');
  expect(text).toContain('変身: ペンギン（歩行） → ペンギン（ジェット）');
  expect(text).toContain('捕食: 味方 先手 白アザラシ [p2]（占有: D4）');
  expect(text).toContain(`先手ストック: アザラシ=${game.stocks.south.seal}`);
  expect(text).toContain('未終局。次は後手の手番。');
  expect(text).toContain('王手だけでは終局しない');
});

it('can describe an empty record without inventing a result', () => {
  const text = replayText(newRecord());
  expect(text).toContain('記録手数: 0');
  expect(text).toContain('未終局。次は先手の手番。');
});
