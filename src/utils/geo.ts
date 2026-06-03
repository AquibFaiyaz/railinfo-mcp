import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

let coordsCache: Record<string, [number, number]> | null = null;

function loadCoords(): Record<string, [number, number]> {
  if (coordsCache) {
    return coordsCache;
  }

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.resolve(__dirname, "..", "..");
    const coordsPath = path.join(projectRoot, "src", "data", "station_coords.json");

    if (fs.existsSync(coordsPath)) {
      const data = fs.readFileSync(coordsPath, "utf8");
      coordsCache = JSON.parse(data);
      return coordsCache || {};
    }
  } catch (err: any) {
    console.error(`[geo] Error loading station coordinates: ${err.message}`);
  }

  return {};
}

export function getStationCoordinates(stationCode: string): [number, number] | null {
  const normCode = stationCode.trim().toUpperCase();
  const coordsMap = loadCoords();
  return coordsMap[normCode] || null;
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
