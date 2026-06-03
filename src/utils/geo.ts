import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const STATION_CODE_MAPPING: Record<string, string> = {
  // New Code -> Old Code
  "DDU": "MGS",   // Pt. Deen Dayal Upadhyaya Jn -> Mughalsarai
  "PRYJ": "ALD",  // Prayagraj Jn -> Allahabad
  "BSBS": "MUV",  // Banaras -> Manduadih
  "AYC": "FD",    // Ayodhya Cantt -> Faizabad
  "VGLB": "JHS",  // Virangana Lakshmibai Jhansi -> Jhansi

  // Old Code -> New Code
  "MGS": "DDU",
  "ALD": "PRYJ",
  "MUV": "BSBS",
  "FD": "AYC",
  "JHS": "VGLB"
};

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
  let coords = coordsMap[normCode];
  if (!coords && STATION_CODE_MAPPING[normCode]) {
    coords = coordsMap[STATION_CODE_MAPPING[normCode]];
  }
  return coords || null;
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
