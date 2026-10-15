import { useLayoutEffect, useRef, useState } from 'react';
export interface PlayArea {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** The HUD reserves a clear rectangle; the 3D camera frames the board inside it. */
export function usePlayArea() {
  const ref = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<PlayArea | null>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const element = ref.current;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setArea({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('resize', update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);
  return { ref, area };
}
