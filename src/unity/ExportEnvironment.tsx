/** Developer-only asset capture. Unity consumes the original Three PMREM as linear half floats. */
import { Canvas, useThree } from '@react-three/fiber';
import { useState, useEffect } from 'react';
import { HalfFloatType, PMREMGenerator } from 'three';
import { IceWorld } from '../scene/IceWorld';
import { scheduleBite } from '../presentation/biteAudio';
import { scheduleTone, TONE_CUES, type ToneCue } from '../presentation/motionAudio';

function ExportButton({ setExport }: { setExport: (fn: () => void) => void }) {
  const { gl, scene } = useThree();
  useEffect(
    () =>
      setExport(() => () => {
        if (!scene.environment) throw new Error('Environment has not finished rendering');
        const generator = new PMREMGenerator(gl);
        const target = generator.fromCubemap(scene.environment as import('three').CubeTexture);
        if (target.texture.type !== HalfFloatType)
          throw new Error('Expected original half-float PMREM');
        const data = new Uint16Array(target.width * target.height * 4);
        gl.readRenderTargetPixels(target, 0, 0, target.width, target.height, data);
        const header = new Uint32Array([target.width, target.height]);
        const blob = new Blob([header, data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'azarashi-original-environment.bytes';
        a.click();
        URL.revokeObjectURL(url);
        target.dispose();
        generator.dispose();
      }),
    [gl, scene, setExport],
  );
  return <IceWorld reduced />;
}
async function exportBite() {
  const rate = 48000;
  const context = new OfflineAudioContext(1, Math.floor(rate * 0.28), rate);
  scheduleBite(context as unknown as AudioContext, 0);
  const buffer = await context.startRendering();
  const samples = buffer.getChannelData(0);
  const blob = new Blob([new Uint32Array([rate, samples.length]), samples], {
    type: 'application/octet-stream',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'azarashi-original-bite.bytes';
  a.click();
  URL.revokeObjectURL(url);
}
async function exportTones() {
  const rate = 48000;
  const chunks: BlobPart[] = [new Uint32Array([rate, Object.keys(TONE_CUES).length])];
  for (const cue of Object.keys(TONE_CUES) as ToneCue[]) {
    const context = new OfflineAudioContext(1, Math.ceil(rate * (TONE_CUES[cue][1] + 0.025)), rate);
    scheduleTone(context, 0, cue);
    const samples = (await context.startRendering()).getChannelData(0);
    const name = new TextEncoder().encode(cue);
    chunks.push(new Uint32Array([name.length]), name, new Uint32Array([samples.length]), samples);
  }
  const url = URL.createObjectURL(new Blob(chunks, { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'azarashi-original-tones.bytes';
  a.click();
  URL.revokeObjectURL(url);
}
export default function ExportEnvironment() {
  const [run, setRun] = useState<() => void>(() => () => {});
  return (
    <main style={{ height: '100vh' }}>
      <Canvas>
        <ExportButton setExport={setRun} />
      </Canvas>
      <button
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          padding: 20,
          background: 'white',
          color: 'black',
        }}
        onClick={run}
      >
        元の環境照明をUnity用に保存
      </button>
      <button
        style={{
          position: 'absolute',
          top: 90,
          left: 20,
          padding: 20,
          background: 'white',
          color: 'black',
        }}
        onClick={exportBite}
      >
        元の捕食音をUnity用に保存
      </button>
      <button
        style={{
          position: 'absolute',
          top: 160,
          left: 20,
          padding: 20,
          background: 'white',
          color: 'black',
        }}
        onClick={exportTones}
      >
        元の移動・着地・変身音をUnity用に保存
      </button>
    </main>
  );
}
