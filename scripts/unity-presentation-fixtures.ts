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
import { sampleCameraOrbit } from '../src/presentation/cameraOrbit';
import { offeredMoveOptions, requiresChoice } from '../src/components/choiceOptions';
import { motionAudioCues } from '../src/presentation/motionAudio';
import { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three-stdlib';

export async function exportPresentationFixtures(directory: string) {
  const record = JSON.parse(await readFile('docs/fixtures/unity-smoke.json', 'utf8'));
  const cases: any[] = [];
  const add = (before: GameState, preview: ActionPreview, stage = 'travel', speed = 1) => {
    const after = applyPreview(before, preview);
    const motion = createMotion(before, after, 0)!;
    if (stage === 'choice') {
      motion.stage = 'choice';
      motion.duration = 620;
    }
    motion.duration /= speed;
    cases.push({
      before,
      preview: { ...preview, after },
      stage,
      speed,
      duration: motion.duration / 1000,
      playbackDuration: playbackDuration(motion) / 1000,
      landing: landingMoment(motion),
      audio: motionAudioCues(motion),
      resolveAudio: motionAudioCues({
        ...motion,
        stage: 'resolve',
        duration: motion.action.action.transformation ? 1150 : 620,
      }),
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
    add(state, next.lastAction!, 'travel', 0.5);
    add(state, next.lastAction!, 'travel', 2);
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
  const cameraOrbits = [
    [
      { x: 0, y: 20, z: 9 },
      { x: 0, y: 20, z: -9 },
    ],
    [
      { x: 0, y: 20, z: -9 },
      { x: 0, y: 20, z: 9 },
    ],
    [
      { x: 0, y: 24, z: 0.024 },
      { x: 0, y: 24, z: -0.024 },
    ],
    [
      { x: 0, y: 24, z: -0.024 },
      { x: 0, y: 24, z: 0.024 },
    ],
    [
      { x: 3, y: 12, z: 8 },
      { x: -5, y: 18, z: -10 },
    ],
    [
      { x: -5, y: 18, z: -10 },
      { x: 3, y: 12, z: 8 },
    ],
  ].map(([from, to]) => ({
    from,
    to,
    samples: Array.from({ length: 41 }, (_, i) => ({
      t: i / 40,
      position: sampleCameraOrbit(from, to, i / 40),
    })),
  }));
  await writeFile(
    '.openai/unity-presentation-fixtures.json',
    JSON.stringify({
      cases,
      guides,
      cameraOrbits,
      catalogZooms: [2.4, 3.499, 8].flatMap((distance) => {
        const make = () => {
          const camera = new PerspectiveCamera();
          camera.position.z = distance;
          const controls = new OrbitControls(camera);
          controls.minDistance = 2.4;
          controls.maxDistance = 8;
          return controls;
        };
        return [
          ...[-120, -3, -0.01, 0, 0.01, 3, 120].map((delta) => {
            const controls = make();
            if (delta < 0) controls.dollyIn();
            if (delta > 0) controls.dollyOut();
            return { distance, delta, previous: 0, current: 0, expected: controls.getDistance() };
          }),
          ...[50, 100, 200].map((current) => {
            const controls = make();
            controls.dollyOut(current / 100);
            return { distance, delta: 0, previous: 100, current, expected: controls.getDistance() };
          }),
        ];
      }),
      catalogDamping: ['yaw', 'polar', 'polar-limit', 'auto'].map((kind) => {
        const camera = new PerspectiveCamera();
        camera.position.set(1.8, 1.2, 2.75);
        const controls = new OrbitControls(camera);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minPolarAngle = 0.35;
        controls.maxPolarAngle = Math.PI / 2 - 0.04;
        controls.autoRotateSpeed = 0.7;
        const theta = controls.getAzimuthalAngle();
        const polar = controls.getPolarAngle();
        const yawDelta = kind === 'yaw' ? 0.8 : 0;
        const polarDelta = kind === 'polar' ? -0.4 : kind === 'polar-limit' ? -2 : 0;
        if (yawDelta) controls.setAzimuthalAngle(theta - yawDelta);
        if (polarDelta) controls.setPolarAngle(polar + polarDelta);
        controls.autoRotate = kind === 'auto';
        return {
          polar,
          yawDelta: (yawDelta * 180) / Math.PI,
          polarDelta,
          automatic: controls.autoRotate,
          samples: Array.from({ length: 61 }, (_, i) => {
            if (i > 0 || controls.autoRotate) controls.update();
            return {
              angle: ((theta - controls.getAzimuthalAngle()) * 180) / Math.PI,
              polar: controls.getPolarAngle(),
            };
          }),
        };
      }),
      choices: cases.flatMap(({ before }) => {
        const groups = new Map<string, ActionPreview[]>();
        for (const preview of legalPreviews(before)) {
          if (preview.action.type !== 'move') continue;
          const key = `${preview.action.pieceId}:${preview.action.to.x}:${preview.action.to.y}`;
          groups.set(key, [...(groups.get(key) ?? []), preview]);
        }
        return [...groups.values()].map((options) => {
          const selected = before.pieces.find(
            (piece: any) => piece.id === (options[0].action as any).pieceId,
          );
          const offered = offeredMoveOptions(selected, options);
          return {
            selected,
            owner: before.turn,
            options: options.map((p) => ({
              action: p.action,
              piece: p.piece,
              captured: p.captured,
            })),
            offered: offered.map((p) => options.indexOf(p)),
            warning: requiresChoice(offered, before.turn),
          };
        });
      }),
    }),
  );
}
