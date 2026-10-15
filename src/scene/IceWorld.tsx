import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer, RoundedBox, Line } from '@react-three/drei';
import { Color, Shape, ShaderMaterial } from 'three';

function Ocean() {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      deep: { value: new Color('#075877') },
      light: { value: new Color('#168daf') },
    }),
    [],
  );
  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.time.value = clock.elapsedTime;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
      <planeGeometry args={[300, 300]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`}
        fragmentShader={`varying vec2 vUv; uniform float time; uniform vec3 deep; uniform vec3 light;
        void main(){ vec2 p=vUv*300.; float a=sin(p.x*1.7+p.y*.65+time*.35); float b=sin(p.y*2.1-p.x*.4-time*.27); float c=sin(p.x*.35+p.y*.44+time*.15);
        float ripple=pow(max(0.,sin(p.x*.55+p.y*1.8+time*.3)),30.) * (.5+.5*sin(p.x*.34-p.y*.2)); vec3 col=mix(deep,light,.40+.08*c+.025*a); col+=vec3(.12,.22,.25)*ripple*.13;
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`}
      />
    </mesh>
  );
}
export function IceWorld() {
  const shelf = useMemo(() => {
    const shape = new Shape();
    const points = [
      [-6.7, -5.5],
      [-5.4, -6.3],
      [-2.8, -6.5],
      [0.8, -6.15],
      [4.7, -6.4],
      [6.1, -5.3],
      [6.65, -1.6],
      [6.3, 2.8],
      [5.5, 5.7],
      [2.3, 6.4],
      [-1.7, 6.1],
      [-5.7, 6.4],
      [-6.4, 3.2],
      [-6.1, -0.7],
    ];
    shape.moveTo(...(points[0] as [number, number]));
    points.slice(1).forEach((p) => shape.lineTo(...(p as [number, number])));
    shape.closePath();
    return shape;
  }, []);
  return (
    <>
      <color attach="background" args={['#73bce0']} />
      <fog attach="fog" args={['#8bc8e4', 38, 100]} />
      <hemisphereLight args={['#d3f0ff', '#3c718a', 0.55]} />
      <directionalLight
        position={[-7, 17, -5]}
        intensity={1.8}
        color="#fff2d8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-normalBias={0.025}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[8, 6, 6]} intensity={0.65} color="#92dcff" />
      <Environment resolution={128} frames={1}>
        <Lightformer
          intensity={2}
          color="#e4f5ff"
          position={[0, 8, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[14, 14, 1]}
        />
        <Lightformer
          intensity={3}
          color="#b3e6ff"
          position={[-8, 4, 0]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[5, 8, 1]}
        />
      </Environment>
      <Ocean />
      <mesh position={[0, -0.65, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
        <extrudeGeometry
          args={[
            shelf,
            {
              depth: 0.55,
              bevelEnabled: true,
              bevelSize: 0.16,
              bevelThickness: 0.14,
              bevelSegments: 3,
              steps: 1,
            },
          ]}
        />
        <meshPhysicalMaterial color="#c5ecfa" roughness={0.36} metalness={0.05} clearcoat={0.7} />
      </mesh>
      <RoundedBox
        args={[10.7, 0.5, 10.7]}
        position={[0, -0.21, 0]}
        radius={0.12}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial color="#57b4d3" roughness={0.2} clearcoat={1} />
      </RoundedBox>
      <RoundedBox args={[10.55, 0.16, 10.55]} position={[0, 0.06, 0]} radius={0.05} receiveShadow>
        <meshPhysicalMaterial color="#ebfaff" roughness={0.55} clearcoat={0.25} />
      </RoundedBox>
      {[
        [
          [-6, 0, -3],
          [-5.7, 0, -2.8],
          [-5.95, 0, -1.8],
        ],
        [
          [3.2, 0, 5.9],
          [3.8, 0, 5.7],
          [4.1, 0, 6.2],
        ],
      ].map((line, i) => (
        <Line
          key={i}
          points={line.map(([x, , z]) => [x, -0.04, z]) as [number, number, number][]}
          color="#7ebdd4"
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      ))}
      {Array.from({ length: 16 }, (_, i) => {
        const a = i * 2.399,
          r = 13 + (i % 4) * 4;
        return (
          <group key={i} position={[Math.cos(a) * r, -1.05, Math.sin(a) * r]} rotation={[0, a, 0]}>
            <mesh scale={[2.4 + (i % 3), 1.1 + (i % 4) * 0.5, 2.1]} castShadow>
              <icosahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color="#e4f5ff" roughness={0.8} flatShading />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
