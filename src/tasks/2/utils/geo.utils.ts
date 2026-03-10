import type { GeoPoint, NearestPlantResult, PowerPlant } from "../types.js";

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => degrees * (Math.PI / 180);

/**
 * Calculates the great-circle distance between two points on Earth using the Haversine formula.
 * @returns Distance in kilometers.
 */
export const haversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Finds the nearest power plant to any of the provided locations.
 * Always returns the closest plant with an isNear flag based on the threshold.
 * Returns null only when locations or plants are empty.
 */
export const findNearestPlant = (
  locations: GeoPoint[],
  plants: PowerPlant[],
  thresholdKm: number,
): NearestPlantResult | null => {
  if (locations.length === 0 || plants.length === 0) return null;

  let nearest: NearestPlantResult | null = null;

  for (const location of locations) {
    for (const plant of plants) {
      const distanceKm = haversineDistanceKm(
        location.lat,
        location.lon,
        plant.lat,
        plant.lon,
      );

      if (!nearest || distanceKm < nearest.distanceKm) {
        nearest = {
          code: plant.code,
          distanceKm,
          isNear: distanceKm <= thresholdKm,
        };
      }
    }
  }

  if (!nearest) return null;

  return {
    code: nearest.code,
    distanceKm: Math.round(nearest.distanceKm * 10) / 10,
    isNear: nearest.isNear,
  };
};
