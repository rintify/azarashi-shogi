import { Canvas, type CanvasProps } from '@react-three/fiber';
import { UnityRenderer } from '../unity/UnityRenderer';

/** One rendering seam; UI, pointer raycasting, models, effects and Rust keep their existing owners. */
export function GameCanvas(props: CanvasProps) {
  const unity =
    import.meta.env.VITE_RENDERER === 'unity' ||
    new URLSearchParams(window.location.search).get('renderer') === 'unity';
  return (
    <Canvas
      {...props}
      gl={
        unity
          ? async (defaults) => UnityRenderer.create(defaults.canvas as HTMLCanvasElement)
          : props.gl
      }
    />
  );
}
