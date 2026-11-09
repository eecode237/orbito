import * as THREE from "three";

/**
 * Convert geographic coordinates to a point on a sphere that matches the
 * equirectangular textures (u = 0 at lon -180, north at the top).
 */
export function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const colatitude = THREE.MathUtils.degToRad(90 - lat);
  const phi = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -(radius * Math.sin(colatitude) * Math.cos(phi)),
    radius * Math.cos(colatitude),
    radius * Math.sin(colatitude) * Math.sin(phi),
  );
}

/**
 * Sub-solar point (where the sun is overhead) for a given instant.
 *
 * Uses the NOAA solar position approximation: declination and equation of time
 * from the fractional year. Accuracy is well under one degree, which is enough
 * to place the day/night terminator on the globe.
 */
export function subsolarPoint(date: Date): { lat: number; lon: number } {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86_400_000);
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (utcHours - 12) / 24);
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const lonDegrees = (12 - utcHours - equationOfTime / 60) * 15;
  const lon = ((((lonDegrees + 180) % 360) + 360) % 360) - 180;
  return { lat: THREE.MathUtils.radToDeg(declination), lon };
}

/** Reference physical facts about Earth (IAU / NASA published values). */
export const EARTH_FACTS = [
  { label: "Mean radius", value: "6,371 km" },
  { label: "Equatorial radius", value: "6,378 km" },
  { label: "Polar radius", value: "6,357 km" },
  { label: "Circumference (equator)", value: "40,075 km" },
  { label: "Surface area", value: "510 million km²" },
  { label: "Ocean coverage", value: "71%" },
  { label: "Highest point", value: "Everest, 8,849 m" },
  { label: "Lowest point", value: "Challenger Deep, −10,935 m" },
  { label: "Axial tilt", value: "23.44°" },
  { label: "Rotation (sidereal)", value: "23 h 56 min" },
  { label: "Orbital period", value: "365.256 days" },
  { label: "Mean distance from Sun", value: "149.6 million km" },
] as const;

export function vec3ToLatLon(point: THREE.Vector3): { lat: number; lon: number } {
  const length = point.length() || 1;
  const lat = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(point.y / length, -1, 1)));
  const phi = THREE.MathUtils.radToDeg(Math.atan2(point.z, -point.x));
  const lon = ((((phi - 180) % 360) + 540) % 360) - 180;
  return { lat, lon };
}
