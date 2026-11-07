"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

export type GlobeMarker = {
  id: string;
  lat: number;
  lon: number;
  label?: string;
  title?: string;
  color?: string;
  size?: number;
  pulse?: boolean;
};

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

const EARTH_TEXTURES = [
  "https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg",
  "https://unpkg.com/three-globe@2.31.1/example/img/earth-day.jpg",
];

function EarthMesh({ markers }: { markers: GlobeMarker[] }) {
  const group = useRef<THREE.Group>(null);
  const [mapTex, setMapTex] = useState<THREE.Texture | null>(null);
  const [bumpTex, setBumpTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    const loadOne = (urls: string[], onOk: (t: THREE.Texture) => void) => {
      let i = 0;
      const tryNext = () => {
        if (!alive || i >= urls.length) return;
        loader.load(
          urls[i++],
          (t) => { if (alive) { t.colorSpace = THREE.SRGBColorSpace; onOk(t); } },
          undefined,
          () => tryNext(),
        );
      };
      tryNext();
    };
    loadOne(EARTH_TEXTURES, setMapTex);
    loadOne(["https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png"], setBumpTex);
    return () => { alive = false; };
  }, []);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.06;
  });

  const radius = 2;
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshPhongMaterial
          color={mapTex ? "#ffffff" : "#1a5fb4"}
          map={mapTex ?? undefined}
          bumpMap={bumpTex ?? undefined}
          bumpScale={0.03}
          specular={new THREE.Color("#2a5a7a")}
          shininess={8}
          emissive={new THREE.Color("#071a2a")}
          emissiveIntensity={0.12}
        />
      </mesh>
      {/* Atmosphere glow */}
      <mesh scale={1.018}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshBasicMaterial color="#4da3ff" transparent opacity={0.08} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <mesh scale={1.045}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshBasicMaterial color="#7c6cff" transparent opacity={0.045} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {markers.map((m) => (
        <Marker key={m.id} marker={m} radius={radius} />
      ))}
    </group>
  );
}

function Marker({ marker, radius }: { marker: GlobeMarker; radius: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => latLonToVec3(marker.lat, marker.lon, radius + 0.015), [marker.lat, marker.lon, radius]);
  const color = marker.color || "#7c6cff";
  useFrame(({ clock }) => {
    if (marker.pulse && ringRef.current) {
      const t = (Math.sin(clock.elapsedTime * 2.2 + marker.lat) + 1) / 2;
      const s = 1 + t * 1.8;
      ringRef.current.scale.setScalar(s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - t);
    }
  });
  return (
    <group position={pos}>
      <mesh ref={ref}>
        <sphereGeometry args={[marker.size ?? 0.028, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {marker.pulse ? (
        <mesh ref={ringRef}>
          <ringGeometry args={[0.03, 0.042, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

export function PlanetGlobe({ markers, className }: { markers: GlobeMarker[]; className?: string }) {
  return (
    <div className={className} style={{ width: "100%", height: "100%", minHeight: 360 }}>
      <Canvas camera={{ position: [0, 0, 5.2], fov: 45 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 3, 5]} intensity={1.35} color="#ffffff" />
        <directionalLight position={[-4, -2, -3]} intensity={0.25} color="#6aa8ff" />
        <Stars radius={80} depth={40} count={2500} factor={3} saturation={0.15} fade speed={0.4} />
        <EarthMesh markers={markers} />
        <OrbitControls enablePan={false} minDistance={3.2} maxDistance={8} autoRotate autoRotateSpeed={0.35} enableDamping />
      </Canvas>
    </div>
  );
}
