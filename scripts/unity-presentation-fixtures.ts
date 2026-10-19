import { readFile, writeFile } from 'node:fs/promises';
import { createGame, applyAction, applyPreview, legalPreviews } from '../src/game/engine';
import {
  createMotion,
  sampleMotion,
  captureMoment,
  transformationProgress,
  landingMoment,
  type MoveMotion,
} from '../src/presentation/motion';
import { bodyDynamics } from '../src/presentation/movement';
import { captureTransfers, playbackDuration } from '../src/presentation/captureTransfers';
import { guideStyle, type GuideState } from '../src/presentation/guideStyle';
import type { GameState, ActionPreview } from '../src/game/types';

export async function exportPresentationFixtures(directory: string) {
  const record = JSON.parse(await readFile('docs/fixtures/unity-smoke.json', 'utf8'));
  const cases: any[] = [];
  const add = (before: GameState, preview: ActionPreview, stage = 'travel') => {
    const after = applyPreview(before, preview);
    const motion = createMotion(before, after, 0)!;
    if (stage === 'choice') {
      motion.stage = 'choice';
      motion.duration = 620;
    }
    cases.push({
      before,
      preview: { ...preview, after },
      stage,
      duration: motion.duration / 1000,
      playbackDuration: playbackDuration(motion) / 1000,
      landing: landingMoment(motion),
      samples: Array.from({ length: 41 }, (_, index) => {
        const t = index / 40,
          pose = sampleMotion(motion, t),
          body = bodyDynamics(motion, t);
        return {
          t,
          position: pose.position,
          yaw: (pose.yaw * 180) / Math.PI,
          scale: pose.scale,
          promoted: pose.promoted,
          change: transformationProgress(motion, t),
          pitch: (body.pitch * 180) / Math.PI,
          roll: (body.roll * 180) / Math.PI,
          stretch: body.stretch,
          thrust: body.thrust,
        };
      }),
      captures: preview.captured.map((v) => ({ id: v.id, at: captureMoment(motion, v) })),
      flights: captureTransfers(motion).map((f) => ({
        id: f.victim.id,
        launch: f.launchAt / 1000,
        arrival: f.arriveAt / 1000,
      })),
    });
  };
  let state = createGame();
  for (const action of record.actions) {
    const next = applyAction(state, action);
    add(state, next.lastAction!);
    if (next.lastAction!.action.type === 'move' && next.lastAction!.action.transformation)
      add(state, next.lastAction!, 'choice');
    state = next;
  }
  for (const kind of ['seal', 'penguin', 'bear', 'orca', 'walrus'] as const)
    for (const promoted of kind === 'seal' || kind === 'penguin' || kind === 'orca'
      ? [false, true]
      : [false]) {
      const before = createGame();
      before.pieces = before.pieces.filter((p) => p.owner !== 'south');
      before.pieces.push({ id: 'sample', owner: 'south', kind, promoted, at: { x: 4, y: 6 } });
      const preview = legalPreviews(before, false).find(
        (p) => p.piece.id === 'sample' && p.action.type === 'move',
      );
      if (preview) add(before, preview);
    }
  const guides: any[] = [];
  // Exhaustive independent booleans across danger, stationary, hover, enemy and transform precedence.
  const fields = [
    'stationary',
    'stationaryAnchor',
    'inspectingEnemy',
    'active',
    'additional',
    'reachable',
    'last',
    'legal',
    'unsafe',
    'previewUnsafe',
    'kingDanger',
    'previewKingDanger',
    'transformationSafe',
    'kingCaptureTrap',
    'previewKingCaptureTrap',
  ];
  for (let bits = 0; bits < 1 << fields.length; bits++) {
    const input = Object.fromEntries(
      fields.map((field, index) => [field, !!(bits & (1 << index))]),
    ) as unknown as GuideState;
    const value = guideStyle(input);
    guides.push({
      bits,
      fill: value.fill,
      dot: value.dot,
      outline: value.outline,
      fillOpacity: value.fillOpacity,
      dotOpacity: value.dotOpacity,
      outlineOpacity: value.outlineOpacity,
    });
  }
  await writeFile('.openai/unity-presentation-fixtures.json', JSON.stringify({ cases, guides }));
}
