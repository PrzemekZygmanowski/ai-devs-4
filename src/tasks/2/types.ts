export interface Suspect {
  name: string;
  surname: string;
  gender: string;
  born: number;
  city: string;
  tags: string[];
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface PowerPlant {
  code: string;
  lat: number;
  lon: number;
}

export interface NearestPlantResult {
  code: string;
  distanceKm: number;
  isNear: boolean;
}

export interface SuspectLocationsToolResult {
  locations: GeoPoint[];
  nearestPlant: NearestPlantResult | null;
}

export interface AccessLevelToolResult {
  accessLevel: number;
}

export interface FindhimAnswer {
  name: string;
  surname: string;
  accessLevel: number;
  powerPlant: string;
}

export interface VerifyFindhimPayload {
  apikey: string;
  task: "findhim";
  answer: FindhimAnswer;
}

export interface FindhimRunResult {
  ok: boolean;
  dryRun: boolean;
  answer: FindhimAnswer | null;
  verifyResponse?: unknown;
  agentSteps: number;
}
