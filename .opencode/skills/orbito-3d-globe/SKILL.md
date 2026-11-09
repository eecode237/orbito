---
name: ORBITO 3D Globe
description: Use when building or changing 3D scenes in ORBITO (the Planet globe, the orbital scene, or any React Three Fiber or three.js visual), including textures, markers, animation loops, and SSR-safe loading in Next.js.
---

## Where

- `apps/web/src/components/planet/globe.tsx`: the R3F scene (sphere, atmosphere, markers, starfield, controls).
- `apps/web/src/components/planet/planet-view.tsx`: data loading, marker aggregation, and headline UI.
- `apps/web/src/app/planet/page.tsx`: the route.
- `apps/web/src/components/three/orbital-scene.tsx`: an existing scene.

Stack: `@react-three/fiber` 9, `@react-three/drei` 10, `three` 0.187.

## Rules

- Load R3F scenes with `next/dynamic(() => import(...), { ssr: false })`. Give the container an explicit size (`h-full` with a `minHeight`).
- Textures load with fallback URLs. If every source fails, render a solid-color Earth, never a blank canvas. Set `colorSpace = SRGBColorSpace` on color maps.
- Markers are data-driven. Convert lat/lon with `latLonToVec3`. When a location is approximate, say so in the UI.
- Animate in `useFrame` using the `delta` argument. Don't allocate objects every frame. Memoize geometry and vectors with `useMemo`.
- Dispose anything you create imperatively with `new THREE.*`. Declarative R3F meshes clean up themselves.
- Clock warning: the browser logs "THREE.Clock is deprecated, use THREE.Timer". The source is probably drei or OrbitControls internals, not our code. Verify before blaming ours. In ORBITO code, use the `clock` from `useFrame` state, or `THREE.Timer`, not `THREE.Clock`.
- Performance: keep DPR capped (`[1, 1.75]`), keep star counts modest, and pulse only a few markers when there are many.
- Remote textures come from unpkg. Treat them as an external dependency. Consider vendoring them into `public/` for offline use.

## Verify

Open `/planet` in the browser and check:

- no console errors
- the WebGL context is alive
- markers render
- drag and zoom work
- the page still renders when texture URLs are blocked
- `typecheck` and `lint` pass
