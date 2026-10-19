/** Developer-only asset capture. Unity consumes the original Three PMREM as linear half floats. */
import { Canvas, useThree } from '@react-three/fiber';
import { useState, useEffect } from 'react';
import { HalfFloatType, PMREMGenerator } from 'three';
import { IceWorld } from '../scene/IceWorld';
import { scheduleBite } from '../presentation/biteAudio';

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
    </main>
  );
}
