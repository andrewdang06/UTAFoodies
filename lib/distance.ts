const EARTH_RADIUS_MILES = 3958.8;

export const UTA_COORDS = {
  lat: 32.7299,
  lng: -97.1131
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

export function distanceFromUTA(lat: number, lng: number): number {
  return haversineMiles(UTA_COORDS.lat, UTA_COORDS.lng, lat, lng);
}
