import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getLiveTrains, getTrainInfo } from "./rail-api.service.js";
import { getISTDateString, parseISTDateTime } from "../utils/date.js";
import { getStationCoordinates, haversineDistance, STATION_CODE_MAPPING } from "../utils/geo.js";

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
      let scheduledStops = mapping[normStation];
      if (!scheduledStops && STATION_CODE_MAPPING[normStation]) {
        scheduledStops = mapping[STATION_CODE_MAPPING[normStation]];
      }
      scheduledStops = scheduledStops || [];

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

        const liveStop = details.train_public_time_table.find((s) => {
          const code = s.station_code.trim().toUpperCase();
          return (
            code === normStation ||
            (STATION_CODE_MAPPING[normStation] &&
              code === STATION_CODE_MAPPING[normStation])
          );
        });

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

export async function getTrainsBetweenStations(
  fromStationCode: string,
  toStationCode: string,
  hours: number = 4
): Promise<any[]> {
  const normFrom = fromStationCode.trim().toUpperCase();
  const normTo = toStationCode.trim().toUpperCase();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, "..", "..");

  let activeTrains: any[] = [];
  try {
    const trainsResponse = await getLiveTrains();
    activeTrains = trainsResponse.data || [];
  } catch (err: any) {
    console.error(`[getTrainsBetweenStations] Error fetching active trains: ${err.message}`);
  }

  // 1. Get active trains within 120 km of the source station coordinates
  let nearbyTrainNos: string[] = [];
  const stationCoords = getStationCoordinates(normFrom);
  if (stationCoords) {
    const [stationLat, stationLon] = stationCoords;
    const nearby = activeTrains.filter((t) => {
      const dist = haversineDistance(stationLat, stationLon, t.lat, t.lon);
      return dist <= 120; // 120 km threshold
    });
    nearbyTrainNos = nearby.map((t) => t.train_no);
  }

  // 2. Get scheduled trains from local JSON for the source station
  let scheduledTrainNos: string[] = [];
  try {
    const stationTrainsPath = path.join(projectRoot, "src", "data", "station_trains.json");
    if (fs.existsSync(stationTrainsPath)) {
      const rawData = fs.readFileSync(stationTrainsPath, "utf8");
      const mapping = JSON.parse(rawData);
      let scheduledStops = mapping[normFrom];
      if (!scheduledStops && STATION_CODE_MAPPING[normFrom]) {
        scheduledStops = mapping[STATION_CODE_MAPPING[normFrom]];
      }
      scheduledStops = scheduledStops || [];

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
    console.error(`[getTrainsBetweenStations] Error reading station_trains.json: ${err.message}`);
  }

  // 3. Merge candidate train numbers
  const mergedTrainNos = Array.from(new Set([...scheduledTrainNos, ...nearbyTrainNos]));
  console.error(
    `[getTrainsBetweenStations] Station ${normFrom} to ${normTo}: found ${mergedTrainNos.length} candidate trains to check (scheduled in window: ${scheduledTrainNos.length}, active within 120km: ${nearbyTrainNos.length}).`
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
  const minWindow = -20 * 60 * 1000; // allow trains that departed up to 20 mins ago

  const batchSize = 15;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchPromises = batch.map(async (cand) => {
      try {
        const trainNo = cand.trainNo;
        const details = await getTrainInfo(trainNo, cand.startDate);
        if (!details || !details.train_public_time_table) return;

        // Find fromStop
        const fromStopIdx = details.train_public_time_table.findIndex((s) => {
          const code = s.station_code.trim().toUpperCase();
          return (
            code === normFrom ||
            (STATION_CODE_MAPPING[normFrom] &&
              code === STATION_CODE_MAPPING[normFrom])
          );
        });
        if (fromStopIdx === -1) return;

        // Find toStop
        const toStopIdx = details.train_public_time_table.findIndex((s) => {
          const code = s.station_code.trim().toUpperCase();
          return (
            code === normTo ||
            (STATION_CODE_MAPPING[normTo] &&
              code === STATION_CODE_MAPPING[normTo])
          );
        });
        if (toStopIdx === -1) return;

        // Verify destination is after source in the route
        if (toStopIdx <= fromStopIdx) return;

        const fromStop = details.train_public_time_table[fromStopIdx];
        const toStop = details.train_public_time_table[toStopIdx];

        // Only include if the train has not departed the source station yet
        if (fromStop.has_departed === "1" || fromStop.has_departed === "Yes") {
          return;
        }

        const etaStr = fromStop.eta || fromStop.sta;
        const etdStr = fromStop.etd || fromStop.std;

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
            currentLocation: details.current_location || cand.liveLocation,
            fromStation: {
              stationCode: fromStop.station_code,
              stationName: fromStop.station_name,
              sta: fromStop.sta || "Source",
              std: fromStop.std || "Destination",
              eta: fromStop.eta || "Source",
              etd: fromStop.etd || "Destination",
              delayArrival: fromStop.delay_arrival || "On Time",
              delayDeparture: fromStop.delay_departure || "On Time",
              platform: fromStop.pf || "N/A",
              hasArrived: fromStop.has_arrived === "1" || fromStop.has_arrived === "Yes",
              hasDeparted: fromStop.has_departed === "1" || fromStop.has_departed === "Yes",
            },
            toStation: {
              stationCode: toStop.station_code,
              stationName: toStop.station_name,
              sta: toStop.sta || "Source",
              std: toStop.std || "Destination",
              eta: toStop.eta || "Source",
              etd: toStop.etd || "Destination",
              delayArrival: toStop.delay_arrival || "On Time",
              delayDeparture: toStop.delay_departure || "On Time",
              platform: toStop.pf || "N/A",
              hasArrived: toStop.has_arrived === "1" || toStop.has_arrived === "Yes",
              hasDeparted: toStop.has_departed === "1" || toStop.has_departed === "Yes",
            },
            estimatedTime,
          });
        }
      } catch (err: any) {
        console.error(`[getTrainsBetweenStations] Error checking details for ${cand.trainNo}: ${err.message}`);
      }
    });

    await Promise.allSettled(batchPromises);
  }

  results.sort((a, b) => a.estimatedTime.getTime() - b.estimatedTime.getTime());

  return results.map(({ estimatedTime, ...rest }) => rest);
}

export async function getTrainsApproachingStation(
  stationCode: string,
  radiusKm: number = 50
): Promise<any[]> {
  const normStation = stationCode.trim().toUpperCase();

  // 1. Get coordinates of the target station
  const stationCoords = getStationCoordinates(normStation);
  if (!stationCoords) {
    console.error(`[getTrainsApproachingStation] Station coordinates not found for ${normStation}`);
    return [];
  }
  const [stationLat, stationLon] = stationCoords;

  // 2. Fetch all active trains
  let activeTrains: any[] = [];
  try {
    const trainsResponse = await getLiveTrains();
    activeTrains = trainsResponse.data || [];
  } catch (err: any) {
    console.error(`[getTrainsApproachingStation] Error fetching active trains: ${err.message}`);
    return [];
  }

  // 3. Filter active trains within radiusKm using haversineDistance
  const candidates: { trainNo: string; startDate: string; physicalDistance: number; liveLocation: string }[] = [];
  for (const train of activeTrains) {
    const dist = haversineDistance(stationLat, stationLon, train.lat, train.lon);
    if (dist <= radiusKm) {
      candidates.push({
        trainNo: train.train_no,
        startDate: train.start_date.replace(" ", "-"),
        physicalDistance: dist,
        liveLocation: train.station_name,
      });
    }
  }

  console.error(
    `[getTrainsApproachingStation] Station ${normStation}: found ${candidates.length} active trains within ${radiusKm} km.`
  );

  if (candidates.length === 0) {
    return [];
  }

  const results: any[] = [];

  // 4. Batch query details of candidates to verify if they are approaching
  const batchSize = 15;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchPromises = batch.map(async (cand) => {
      try {
        const details = await getTrainInfo(cand.trainNo, cand.startDate);
        if (!details || !details.train_public_time_table) return;

        // Find the stop for our target station
        const targetStop = details.train_public_time_table.find((s) => {
          const code = s.station_code.trim().toUpperCase();
          return (
            code === normStation ||
            (STATION_CODE_MAPPING[normStation] &&
              code === STATION_CODE_MAPPING[normStation])
          );
        });

        if (!targetStop) return; // Train doesn't stop at this station

        // If the train has already departed, it is no longer approaching
        if (targetStop.has_departed === "1" || targetStop.has_departed === "Yes") {
          return;
        }

        results.push({
          trainNo: details.train_no,
          trainName: details.train_name,
          stationCode: targetStop.station_code,
          stationName: targetStop.station_name,
          sta: targetStop.sta || "Source",
          std: targetStop.std || "Destination",
          eta: targetStop.eta || "Source",
          etd: targetStop.etd || "Destination",
          delayArrival: targetStop.delay_arrival || "On Time",
          delayDeparture: targetStop.delay_departure || "On Time",
          platform: targetStop.pf || "N/A",
          hasArrived: targetStop.has_arrived === "1" || targetStop.has_arrived === "Yes",
          hasDeparted: targetStop.has_departed === "1" || targetStop.has_departed === "Yes",
          physicalDistance: cand.physicalDistance,
          currentLocation: details.current_location || cand.liveLocation,
          lastSpottedAt: details.last_spotted_at || "N/A",
        });
      } catch (err: any) {
        console.error(`[getTrainsApproachingStation] Error checking details for ${cand.trainNo}: ${err.message}`);
      }
    });

    await Promise.allSettled(batchPromises);
  }

  // Sort by physical distance ascending
  results.sort((a, b) => a.physicalDistance - b.physicalDistance);

  return results;
}


