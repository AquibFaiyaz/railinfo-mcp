import axios from "axios";
import fs from "fs";
import path from "path";

async function main() {
  try {
    const url = "https://raw.githubusercontent.com/datameet/railways/master/stations.json";
    console.log("Downloading stations.json...");
    const response = await axios.get(url);
    const data = response.data;
    
    if (data && data.features) {
      const coordsMap: Record<string, [number, number]> = {};
      data.features.forEach((feature: any) => {
        const code = feature.properties?.code;
        const geom = feature.geometry;
        if (code && geom && geom.type === "Point" && Array.isArray(geom.coordinates)) {
          // GeoJSON coordinates are [lon, lat]
          const lon = geom.coordinates[0];
          const lat = geom.coordinates[1];
          coordsMap[code.trim().toUpperCase()] = [lat, lon];
        }
      });
      
      const outputPath = "./src/data/station_coords.json";
      fs.writeFileSync(outputPath, JSON.stringify(coordsMap, null, 2), "utf-8");
      console.log(`Saved coordinates for ${Object.keys(coordsMap).length} stations to ${outputPath}`);
    } else {
      console.error("Invalid stations.json format");
    }
  } catch (err: any) {
    console.error("Failed:", err.message);
  }
}

main();
