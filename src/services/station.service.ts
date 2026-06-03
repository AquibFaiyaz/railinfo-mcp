import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getLiveTrains, getTrainInfo } from "./rail-api.service.js";
import { getISTDateString, parseISTDateTime } from "../utils/date.js";
import { getStationCoordinates, haversineDistance } from "../utils/geo.js";

export async function getTrainsAtStation(
  stationCode: string,
  hours: number = 2
): Promise<any[]> {
  const normStation = stationCode.trim().toUpperCase();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, "..", "..");

  let activeTrains: any[] = [];
  try {
    const trainsResponse = await getLiveTrains();
    activeTrains = trainsResponse.data || [];
  } catch (err: any) {
    console.error(`[getTrainsAtStation] Error fetching active trains: ${err.message}`);
  }

  // 1. Get active trains within 120 km of the station coordinates
  let nearbyTrainNos: string[] = [];
  const stationCoords = getStationCoordinates(normStation);
  if (stationCoords) {
    const [stationLat, stationLon] = stationCoords;
    const nearby = activeTrains.filter((t) => {
      const dist = haversineDistance(stationLat, stationLon, t.lat, t.lon);
      return dist <= 120; // 120 km threshold
    });
    nearbyTrainNos = nearby.map((t) => t.train_no);
  }

  // 2. Get scheduled trains from local JSON
  let scheduledTrainNos: string[] = [];
  try {
    const stationTrainsPath = path.join(projectRoot, "src", "data", "station_trains.json");
    if (fs.existsSync(stationTrainsPath)) {
      const rawData = fs.readFileSync(stationTrainsPath, "utf8");
      const mapping = JSON.parse(rawData);
      const scheduledStops = mapping[normStation] || [];

      const now = new Date();
      const istNow = new Date(now.getTime() + 19800000);
      const nowMinutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();

      const isTimeInWindow = (timeStr: string | null): boolean => {
        if (!timeStr) return false;
        const parts = timeStr.split(":");
        const hour = parseInt(parts[0]) || 0;
        const minute = parseInt(parts[1]) || 0;
        const stopMinutes = hour * 60 + minute;

        const startMinutes = nowMinutes - 120; // past 2 hours
        const endMinutes = nowMinutes + hours * 60; // next N hours

        if (stopMinutes >= startMinutes && stopMinutes <= endMinutes) return true;
        if (endMinutes > 1440) {
          const stopMinutesNextDay = stopMinutes + 1440;
          if (stopMinutesNextDay >= startMinutes && stopMinutesNextDay <= endMinutes) return true;
        }
        if (startMinutes < 0) {
          const stopMinutesPrevDay = stopMinutes - 1440;
          if (stopMinutesPrevDay >= startMinutes && stopMinutesPrevDay <= endMinutes) return true;
        }
        return false;
      };

      const candidateStops = scheduledStops.filter(
        (stop: any) => isTimeInWindow(stop.a) || isTimeInWindow(stop.d)
      );
      scheduledTrainNos = candidateStops.map((stop: any) => stop.t);
    }
  } catch (err: any) {
    console.error(`[getTrainsAtStation] Error reading station_trains.json: ${err.message}`);
  }

  // 3. Merge candidate train numbers
  const mergedTrainNos = Array.from(new Set([...scheduledTrainNos, ...nearbyTrainNos]));
  console.error(
    `[getTrainsAtStation] Station ${normStation}: found ${mergedTrainNos.length} candidate trains to check (scheduled in window: ${scheduledTrainNos.length}, active within 120km: ${nearbyTrainNos.length}).`
  );

  if (mergedTrainNos.length === 0) {
    return [];
  }

  // 4. Construct candidates list for API status check (handles multiple active instances per train)
  const candidates: { trainNo: string; startDate: string; liveLocation: string }[] = [];
  for (const trainNo of mergedTrainNos) {
    const activeInstances = activeTrains.filter((t) => t.train_no === trainNo);
    if (activeInstances.length > 0) {
      activeInstances.forEach((inst) => {
        candidates.push({
          trainNo,
          startDate: inst.start_date.replace(" ", "-"),
          liveLocation: inst.station_name,
        });
      });
    } else {
      candidates.push({
        trainNo,
        startDate: getISTDateString(0).replace(" ", "-"),
        liveLocation: "Not Started yet",
      });
    }
  }

  const results: any[] = [];
  const now = new Date();
  const maxWindow = hours * 3600000;
  const minWindow = -20 * 60 * 1000; // allow trains that arrived up to 20 mins ago

  const batchSize = 15;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchPromises = batch.map(async (cand) => {
      try {
        const trainNo = cand.trainNo;
        const details = await getTrainInfo(trainNo, cand.startDate);
        if (!details || !details.train_public_time_table) return;

        const liveStop = details.train_public_time_table.find(
          (s) => s.station_code === normStation
        );

        if (!liveStop) return;

        if (liveStop.has_departed === "1" || liveStop.has_departed === "Yes") {
          return;
        }

        const etaStr = liveStop.eta || liveStop.sta;
        const etdStr = liveStop.etd || liveStop.std;

        if (!etaStr && !etdStr) return;

        let estimatedTime: Date | null = null;
        if (etaStr) {
          estimatedTime = parseISTDateTime(etaStr);
        } else if (etdStr) {
          estimatedTime = parseISTDateTime(etdStr);
        }

        if (!estimatedTime) return;

        const timeDiff = estimatedTime.getTime() - now.getTime();

        if (timeDiff >= minWindow && timeDiff <= maxWindow) {
          results.push({
            trainNo: details.train_no,
            trainName: details.train_name,
            sta: liveStop.sta || "Source",
            std: liveStop.std || "Destination",
            eta: liveStop.eta || "Source",
            etd: liveStop.etd || "Destination",
            delayArrival: liveStop.delay_arrival || "On Time",
            delayDeparture: liveStop.delay_departure || "On Time",
            platform: liveStop.pf || "N/A",
            hasArrived: liveStop.has_arrived === "1" || liveStop.has_arrived === "Yes",
            hasDeparted: liveStop.has_departed === "1" || liveStop.has_departed === "Yes",
            currentLocation: details.current_location || cand.liveLocation,
            estimatedTime,
          });
        }
      } catch (err: any) {
        console.error(`[getTrainsAtStation] Error checking details for ${cand.trainNo}: ${err.message}`);
      }
    });

    await Promise.allSettled(batchPromises);
  }

  results.sort((a, b) => a.estimatedTime.getTime() - b.estimatedTime.getTime());

  return results.map(({ estimatedTime, ...rest }) => rest);
}
