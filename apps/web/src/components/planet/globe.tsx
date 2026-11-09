"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

import { latLonToVec3, subsolarPoint, vec3ToLatLon } from "@/lib/planet/geo";

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

export type PlanetLayers = {
  nightLights: boolean;
  clouds: boolean;
  relief: boolean;
  oceanGlint: boolean;
  atmosphere: boolean;
  liveSun: boolean;
  autoRotate: boolean;
};

export type TextureStatus = "loading" | "ready" | "error";

export type SunPosition = { lat: number; lon: number };

export type GlobeHover =
  | { kind: "marker"; id: string; clientX: number; clientY: number }
  | { kind: "surface"; lat: number; lon: number; clientX: number; clientY: number };

const RADIUS = 2;
const RELIEF_SCALE = 0.025;
const FIXED_SUN: SunPosition = { lat: 20, lon: -30 };

/** Equirectangular 4K day map plus supporting layers, all served locally. */
const TEXTURE_URLS = {
  day: "/planet/earth-blue-marble.jpg",
  night: "/planet/earth-night.jpg",
  relief: "/planet/earth-topology.png",
  water: "/planet/earth-water.png",
  clouds: "/planet/earth-clouds-1024.png",
} as const;

type TextureKey = keyof typeof TEXTURE_URLS;
type EarthTextures = Record<TextureKey, THREE.Texture>;

const SRGB_KEYS: TextureKey[] = ["day", "night", "clouds"];

function useEarthTextures(onStatus: (status: TextureStatus) => void) {
  const { gl } = useThree();
  const [textures, setTextures] = useState<EarthTextures | null>(null);

  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    const anisotropy = gl.capabilities.getMaxAnisotropy();
    const keys = Object.keys(TEXTURE_URLS) as TextureKey[];

    Promise.all(
      keys.map(async (key) => {
        const texture = await loader.loadAsync(TEXTURE_URLS[key]);
        texture.colorSpace = SRGB_KEYS.includes(key) ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.anisotropy = anisotropy;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true;
        return [key, texture] as const;
      }),
    )
      .then((entries) => {
        const loaded = Object.fromEntries(entries) as EarthTextures;
        if (!alive) {
          Object.values(loaded).forEach((texture) => texture.dispose());
          return;
        }
        setTextures(loaded);
        onStatus("ready");
      })
      .catch(() => {
        if (alive) onStatus("error");
      });

    return () => {
      alive = false;
    };
  }, [gl, onStatus]);

  useEffect(() => {
    return () => {
      if (textures) Object.values(textures).forEach((texture) => texture.dispose());
    };
  }, [textures]);

  return textures;
}

const EARTH_VERTEX = /* glsl */ `
  uniform sampler2D uRelief;
  uniform float uReliefScale;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    float height = texture2D(uRelief, uv).r;
    vec3 displaced = position + normal * (height * uReliefScale);
    vNormal = normalize(normal);
    vPosition = displaced;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const EARTH_FRAGMENT = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uWater;
  uniform vec3 uSun;
  uniform float uNightLights;
  uniform float uOceanGlint;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 sun = normalize(uSun);
    float ndl = dot(n, sun);

    vec3 color = texture2D(uDay, vUv).rgb * (0.06 + 0.94 * max(ndl, 0.0));

    vec3 viewDir = normalize(cameraPosition - vPosition);
    vec3 halfVec = normalize(sun + viewDir);
    float water = texture2D(uWater, vUv).r;
    float glint = pow(max(dot(n, halfVec), 0.0), 80.0) * water * uOceanGlint;
    color += vec3(0.55, 0.7, 0.9) * glint * max(ndl, 0.0);

    float nightSide = 1.0 - smoothstep(-0.12, 0.05, ndl);
    color += texture2D(uNight, vUv).rgb * 1.35 * uNightLights * nightSide;

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
    gl_FragColor = vec4(0.36, 0.65, 1.0, 1.0) * intensity;
  }
`;

function EarthSurface({
  textures,
  layers,
  onSun,
  onHover,
  sunLight,
}: {
  textures: EarthTextures;
  layers: PlanetLayers;
  onSun?: (sun: SunPosition) => void;
  onHover?: (hover: GlobeHover | null) => void;
  sunLight: RefObject<THREE.DirectionalLight | null>;
}) {
  const sunVector = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const lastEmit = useRef(0);

  const { nightLights, oceanGlint, relief } = layers;
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: EARTH_VERTEX,
        fragmentShader: EARTH_FRAGMENT,
        uniforms: {
          uDay: { value: textures.day },
          uNight: { value: textures.night },
          uRelief: { value: textures.relief },
          uWater: { value: textures.water },
          uSun: { value: sunVector },
          uNightLights: { value: nightLights ? 1 : 0 },
          uOceanGlint: { value: oceanGlint ? 0.2 : 0 },
          uReliefScale: { value: relief ? RELIEF_SCALE : 0 },
        },
      }),
    [textures, sunVector, nightLights, oceanGlint, relief],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const sun = layers.liveSun ? subsolarPoint(new Date()) : FIXED_SUN;
    sunVector.copy(latLonToVec3(sun.lat, sun.lon, 1));
    if (sunLight.current) sunLight.current.position.copy(sunVector).multiplyScalar(10);

    const now = performance.now();
    if (onSun && now - lastEmit.current > 2000) {
      lastEmit.current = now;
      onSun(sun);
    }
  });

  return (
    <mesh
      onPointerMove={(event: ThreeEvent<PointerEvent>) => {
        const { lat, lon } = vec3ToLatLon(event.point);
        onHover?.({ kind: "surface", lat, lon, clientX: event.clientX, clientY: event.clientY });
      }}
      onPointerLeave={() => onHover?.(null)}
    >
      <sphereGeometry args={[RADIUS, 256, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function FallbackSurface({ sunLight }: { sunLight: RefObject<THREE.DirectionalLight | null> }) {
  useFrame(() => {
    const sun = subsolarPoint(new Date());
    if (sunLight.current) {
      sunLight.current.position.copy(latLonToVec3(sun.lat, sun.lon, 10));
    }
  });
  return (
    <mesh>
      <sphereGeometry args={[RADIUS, 96, 48]} />
      <meshStandardMaterial color="#1f5a96" roughness={0.9} />
    </mesh>
  );
}

function CloudLayer({ map }: { map: THREE.Texture }) {
  return (
    <mesh>
      <sphereGeometry args={[RADIUS + 0.06, 128, 64]} />
      <meshStandardMaterial
        color="#ffffff"
        map={map}
        transparent
        opacity={0.85}
        depthWrite={false}
        roughness={1}
      />
    </mesh>
  );
}

function AtmosphereLayer() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ATMOSPHERE_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh scale={1.08}>
      <sphereGeometry args={[RADIUS, 64, 48]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function Marker({
  marker,
  selected,
  onSelect,
  onHover,
}: {
  marker: GlobeMarker;
  selected: boolean;
  onSelect?: (id: string) => void;
  onHover?: (hover: GlobeHover | null) => void;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const position = useMemo(
    () => latLonToVec3(marker.lat, marker.lon, RADIUS + 0.05),
    [marker.lat, marker.lon],
  );
  const color = selected ? "#ffffff" : marker.color || "#7c6cff";
  const size = (marker.size ?? 0.03) * (selected ? 1.6 : 1);

  useFrame(({ clock }) => {
    if (!marker.pulse || !ringRef.current) return;
    const t = (Math.sin(clock.elapsedTime * 2.2 + marker.lat) + 1) / 2;
    ringRef.current.scale.setScalar(1 + t * 1.8);
    (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - t);
  });

  return (
    <group position={position}>
      <mesh
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          onSelect?.(marker.id);
        }}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          onHover?.({ kind: "marker", id: marker.id, clientX: event.clientX, clientY: event.clientY });
        }}
        onPointerOver={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
          onHover?.({ kind: "marker", id: marker.id, clientX: event.clientX, clientY: event.clientY });
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
          onHover?.(null);
        }}
      >
        <sphereGeometry args={[size, 14, 14]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {marker.pulse ? (
        <mesh ref={ringRef}>
          <ringGeometry args={[0.03, 0.042, 28]} />
          <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function Scene({
  markers,
  layers,
  selectedId,
  onSelect,
  onHover,
  onSun,
  onStatus,
  paused,
}: {
  markers: GlobeMarker[];
  layers: PlanetLayers;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (hover: GlobeHover | null) => void;
  onSun?: (sun: SunPosition) => void;
  onStatus?: (status: TextureStatus) => void;
  paused?: boolean;
}) {
  const handleStatus = useCallback((status: TextureStatus) => onStatus?.(status), [onStatus]);
  const textures = useEarthTextures(handleStatus);
  const sunLight = useRef<THREE.DirectionalLight>(null);

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight ref={sunLight} intensity={2.2} color="#fff6e6" />
      <Stars radius={80} depth={40} count={3000} factor={3} saturation={0.1} fade speed={0.3} />

      {textures ? (
        <EarthSurface textures={textures} layers={layers} onSun={onSun} onHover={onHover} sunLight={sunLight} />
      ) : (
        <FallbackSurface sunLight={sunLight} />
      )}
      {textures && layers.clouds ? <CloudLayer map={textures.clouds} /> : null}
      {layers.atmosphere ? <AtmosphereLayer /> : null}

      {markers.map((marker) => (
        <Marker key={marker.id} marker={marker} selected={marker.id === selectedId} onSelect={onSelect} onHover={onHover} />
      ))}

      <OrbitControls
        enablePan={false}
        enableDamping
        minDistance={3.2}
        maxDistance={9}
        autoRotate={layers.autoRotate && !paused}
        autoRotateSpeed={0.35}
      />
    </>
  );
}

export function PlanetGlobe({
  markers,
  layers,
  selectedId,
  onSelect,
  onHover,
  onSun,
  onStatus,
  paused,
  className,
}: {
  markers: GlobeMarker[];
  layers: PlanetLayers;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (hover: GlobeHover | null) => void;
  onSun?: (sun: SunPosition) => void;
  onStatus?: (status: TextureStatus) => void;
  paused?: boolean;
  className?: string;
}) {
  return (
    <div className={className} style={{ width: "100%", height: "100%", minHeight: 360 }}>
      <Canvas
        camera={{ position: [0, 0, 6.2], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Scene
          markers={markers}
          layers={layers}
          selectedId={selectedId}
          onSelect={onSelect}
          onHover={onHover}
          onSun={onSun}
          onStatus={onStatus}
          paused={paused}
        />
      </Canvas>
    </div>
  );
}
