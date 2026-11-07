"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";

/**
 * Ambient orbital illustration for the command center.
 *
 * This is decoration only — it visualises the ORBITO mark (a core with two
 * orbital rings) and never encodes live data. Real telemetry is rendered as
 * text and charts elsewhere; a spinning shape must not imply system state.
 */
function OrbitalCore() {
  const group = useRef<Group>(null);
  const ringA = useRef<Group>(null);
  const ringB = useRef<Group>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.rotation.y += delta * 0.16;
      group.current.rotation.x = Math.sin(t * 0.22) * 0.12;
    }
    if (ringA.current) ringA.current.rotation.z += delta * 0.24;
    if (ringB.current) ringB.current.rotation.z -= delta * 0.18;
  });

  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[0.86, 1]} />
        <meshStandardMaterial
          color="#9470ff"
          emissive="#5b3fd6"
          emissiveIntensity={0.55}
          wireframe
          transparent
          opacity={0.72}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.3, 24, 24]} />
        <meshStandardMaterial
          color="#d9ccff"
          emissive="#9470ff"
          emissiveIntensity={1.1}
          roughness={0.28}
          metalness={0.2}
        />
      </mesh>

      <group ref={ringA} rotation={[Math.PI / 2.7, 0.4, 0.2]}>
        <mesh>
          <torusGeometry args={[1.32, 0.012, 12, 128]} />
          <meshBasicMaterial color="#43c6f5" transparent opacity={0.7} />
        </mesh>
      </group>

      <group ref={ringB} rotation={[Math.PI / 1.7, -0.5, -0.3]}>
        <mesh>
          <torusGeometry args={[1.56, 0.009, 12, 128]} />
          <meshBasicMaterial color="#9470ff" transparent opacity={0.5} />
        </mesh>
      </group>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.9, 0.006, 8, 128]} />
        <meshBasicMaterial color="#35d399" transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

export default function OrbitalScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.4], fov: 42 }}
      dpr={[1, 1.6]}
      gl={{ alpha: true, antialias: true }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.55} />
      <pointLight position={[3, 4, 5]} intensity={24} color="#a78bfa" />
      <pointLight position={[-4, -2, 2]} intensity={12} color="#43c6f5" />
      <OrbitalCore />
    </Canvas>
  );
}
