// Great-circle helpers shared by the flight server (simulation) and the
// browser client (route drawing).

export interface LatLng {
  lat: number;
  lng: number;
}

export const EARTH_RADIUS_NM = 3440.065;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export function greatCircleDistanceNm(a: LatLng, b: LatLng): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * Math.asin(Math.sqrt(h)) * EARTH_RADIUS_NM;
}

// Position along the great circle between origin and destination at the given
// fraction (0 = origin, 1 = destination), using spherical interpolation.
export function interpolatePosition(origin: LatLng, destination: LatLng, fraction: number): LatLng {
  const lat1 = toRadians(origin.lat);
  const lng1 = toRadians(origin.lng);
  const lat2 = toRadians(destination.lat);
  const lng2 = toRadians(destination.lng);

  const angularDistance = greatCircleDistanceNm(origin, destination) / EARTH_RADIUS_NM;

  if (angularDistance === 0) {
    return { lat: origin.lat, lng: origin.lng };
  }

  const a = Math.sin((1 - fraction) * angularDistance) / Math.sin(angularDistance);
  const b = Math.sin(fraction * angularDistance) / Math.sin(angularDistance);

  const x = a * Math.cos(lat1) * Math.cos(lng1) + b * Math.cos(lat2) * Math.cos(lng2);
  const y = a * Math.cos(lat1) * Math.sin(lng1) + b * Math.cos(lat2) * Math.sin(lng2);
  const z = a * Math.sin(lat1) + b * Math.sin(lat2);

  return {
    lat: toDegrees(Math.atan2(z, Math.sqrt(x ** 2 + y ** 2))),
    lng: toDegrees(Math.atan2(y, x))
  };
}

export function bearingDegrees(from: LatLng, to: LatLng): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLng = toRadians(to.lng - from.lng);

  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

// Points along the great-circle route, with longitudes unwrapped so a route
// crossing the antimeridian draws as one continuous line instead of a streak
// across the whole map.
export function routePoints(origin: LatLng, destination: LatLng, segments = 64): LatLng[] {
  const points: LatLng[] = [];
  let previousLng: number | null = null;
  let lngOffset = 0;

  for (let i = 0; i <= segments; i++) {
    const point = interpolatePosition(origin, destination, i / segments);

    if (previousLng !== null) {
      const delta = point.lng + lngOffset - previousLng;

      if (delta > 180) {
        lngOffset -= 360;
      } else if (delta < -180) {
        lngOffset += 360;
      }
    }

    const unwrapped = { lat: point.lat, lng: point.lng + lngOffset };
    previousLng = unwrapped.lng;
    points.push(unwrapped);
  }

  return points;
}
