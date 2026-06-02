import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { railApi } from "../utils/axios.js";
import { getToken } from "./token.service.js";
import type {
  LiveTrainsResponse,
  LiveTrain,
} from "../types/live-trains.types.ts";
import type {
  TrainInfoResponse,
} from "../types/train-info.types.ts";

interface LiveTrainStatusNotFound {
  runningToday: false;
  trainNo: string;
  message: string;
}

interface NextStoppage {
  stationCode: string;
  stationName: string;
  eta: string;
  etd: string;
  platform: string;
  delayArrival: string;
  delayDeparture: string;
  hasArrived: string;
  hasDeparted: string;
}

interface UpcomingStop {
  stationCode: string;
  stationName: string;
  eta: string;
  etd: string;
  platform: string;
  delayArrival: string;
  delayDeparture: string;
  hasArrived: string;
  hasDeparted: string;
}

interface LiveTrainStatusFound {
  runningToday: true;
  trainNo: string;
  trainName: string;
  trainNameUnicode: string;
  trainSubType: string;
  startDate: string;
  currentStation: string;
  stationCode: string;
  latitude: number;
  longitude: number;
  lastUpdated: string;
  currentLocation: string;
  locationSource: string;
  rejectedLocation: string;
  rejectedSource: string;
  locoAttached: boolean;
  locoNo: string;
  lastSpottedAt: string;
  locoSpeed: number;
  distanceToNext: string | null;
  gpsDataAge: string;
  currentPosition: {
    description: string;
    train_source: string;
    train_destination: string;
    last_station_location: string;
    last_station_location_actual_time: string;
    last_station_location_delay: string;
    train_status_last_location: string;
  };
  nextStoppage: NextStoppage | null;
  upcomingStops: UpcomingStop[];
  trainPublicTimeTable: TrainInfoResponse["train_public_time_table"];
  fullRunningSchedule: TrainInfoResponse["full_running_schedule"];
  runningAverage: TrainInfoResponse["running_average"];
  availableDates?: string[];
}

function mapStop(
  stop: TrainInfoResponse["train_public_time_table"][number]
): UpcomingStop {
  return {
    stationCode: stop.station_code,
    stationName: stop.station_name,
    eta: stop.eta,
    etd: stop.etd,
    platform: stop.pf,
    delayArrival: stop.delay_arrival,
    delayDeparture: stop.delay_departure,
    hasArrived: stop.has_arrived,
    hasDeparted: stop.has_departed,
  };
}

function getNextStoppage(
  timetable: TrainInfoResponse["train_public_time_table"]
): NextStoppage | null {
  const next = timetable.find(
    (stop) => stop.has_arrived !== "1" || stop.has_departed !== "1"
  );

  if (!next) {
    return null;
  }

  return mapStop(next);
}

function getUpcomingStops(
  timetable: TrainInfoResponse["train_public_time_table"]
): UpcomingStop[] {
  return timetable
    .filter(
      (stop) => stop.has_arrived !== "1" || stop.has_departed !== "1"
    )
    .slice(0, 3)
    .map(mapStop);
}

export async function getLiveTrains(): Promise<LiveTrainsResponse> {
  const token = await getToken();

  const response = await railApi.get<LiveTrainsResponse>(
    `/index.php?action=get_trains&tk=${token}`,
    {
      headers: {
        "x-secure-token": token,
      },
    }
  );

  return response.data;
}

export function normalizeDate(dateStr: string): string {
  const normalized = dateStr.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
  const parts = normalized.split(/\s+/);
  if (parts.length < 2) return "";

  let day = parts[0];
  if (day.length === 1) {
    day = "0" + day;
  }

  const month = parts[1];
  const monthMap: Record<string, string> = {
    january: "jan", jan: "jan",
    february: "feb", feb: "feb",
    march: "mar", mar: "mar",
    april: "apr", apr: "apr",
    may: "may",
    june: "jun", jun: "jun",
    july: "jul", jul: "jul",
    august: "aug", aug: "aug",
    september: "sep", sep: "sep",
    october: "oct", oct: "oct",
    november: "nov", nov: "nov",
    december: "dec", dec: "dec"
  };

  const mappedMonth = monthMap[month];
  if (!mappedMonth) return "";

  return `${day} ${mappedMonth}`;
}

export function getISTDateString(offsetDays: number = 0): string {
  const now = new Date();
  const istTime = now.getTime() + 19800000; // 5.5 hours offset
  const istDate = new Date(istTime);

  if (offsetDays !== 0) {
    istDate.setUTCDate(istDate.getUTCDate() + offsetDays);
  }

  const day = String(istDate.getUTCDate()).padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[istDate.getUTCMonth()];
  return `${day} ${month}`;
}

export async function findTrain(
  trainNo: string,
  startDate?: string
): Promise<{ match: LiveTrain | undefined; allMatches: LiveTrain[] }> {
  const trainsResponse = await getLiveTrains();

  const allMatches = trainsResponse.data.filter(
    (train) => train.train_no === trainNo
  );

  console.error(`[findTrain] Query for Train: ${trainNo}, startDateParam: "${startDate}"`);
  console.error(`[findTrain] Found ${allMatches.length} matching instances in live feed:`);
  allMatches.forEach(t => {
    console.error(`  - Start Date: "${t.start_date}" (Normalized: "${normalizeDate(t.start_date)}") at station: ${t.station_name}`);
  });

  if (startDate) {
    let normalizedTarget = "";
    if (startDate.toLowerCase() === "today") {
      normalizedTarget = getISTDateString(0).toLowerCase();
      console.error(`[findTrain] Keyword "today" resolved to IST date: "${getISTDateString(0)}" (normalized target: "${normalizedTarget}")`);
    } else if (startDate.toLowerCase() === "yesterday") {
      normalizedTarget = getISTDateString(-1).toLowerCase();
      console.error(`[findTrain] Keyword "yesterday" resolved to IST date: "${getISTDateString(-1)}" (normalized target: "${normalizedTarget}")`);
    } else {
      normalizedTarget = normalizeDate(startDate);
      console.error(`[findTrain] Explicit date "${startDate}" normalized target: "${normalizedTarget}"`);
    }

    const match = allMatches.find(
      (train) => normalizeDate(train.start_date) === normalizedTarget
    );
    if (match) {
      console.error(`[findTrain] MATCH FOUND: ${match.train_no} started on "${match.start_date}"`);
    } else {
      console.error(`[findTrain] NO MATCH FOUND for normalized target "${normalizedTarget}"`);
    }
    return { match, allMatches };
  }

  console.error(`[findTrain] No startDate specified. Defaulting to first instance: "${allMatches[0]?.start_date}"`);
  return { match: allMatches[0], allMatches };
}

export async function getTrainInfo(
  trainNo: string,
  startDate: string
): Promise<TrainInfoResponse> {
  const token = await getToken();

  const response = await railApi.get<TrainInfoResponse>(
    `/index.php?action=check_train_info&trainNo=${trainNo}&startDate=${startDate}-2026&tk=${token}`,
    {
      headers: {
        "x-secure-token": token,
      },
    }
  );

  return response.data;
}

export async function getLiveTrainStatus(
  trainNo: string,
  startDateParam?: string
): Promise<LiveTrainStatusNotFound | LiveTrainStatusFound> {
  const trainsResponse = await getLiveTrains();
  const allMatches = trainsResponse.data.filter(
    (train) => train.train_no === trainNo
  );

  console.error(`[getLiveTrainStatus] Query for Train: ${trainNo}, startDateParam: "${startDateParam}"`);
  console.error(`[getLiveTrainStatus] Found ${allMatches.length} matching instances in live feed:`);
  allMatches.forEach(t => {
    console.error(`  - Start Date: "${t.start_date}" (Normalized: "${normalizeDate(t.start_date)}") at station: ${t.station_name}`);
  });

  let resolvedApiDate = "";
  let train: LiveTrain | undefined = undefined;

  if (startDateParam) {
    const lower = startDateParam.toLowerCase();
    let normalizedTarget = "";
    if (lower === "today") {
      normalizedTarget = getISTDateString(0).toLowerCase();
      console.error(`[getLiveTrainStatus] Keyword "today" resolved to IST date: "${getISTDateString(0)}" (normalized target: "${normalizedTarget}")`);
    } else if (lower === "yesterday") {
      normalizedTarget = getISTDateString(-1).toLowerCase();
      console.error(`[getLiveTrainStatus] Keyword "yesterday" resolved to IST date: "${getISTDateString(-1)}" (normalized target: "${normalizedTarget}")`);
    } else {
      normalizedTarget = normalizeDate(startDateParam);
      console.error(`[getLiveTrainStatus] Explicit date "${startDateParam}" normalized target: "${normalizedTarget}"`);
    }

    if (normalizedTarget) {
      const parts = normalizedTarget.split(" ");
      if (parts.length >= 2) {
        const day = parts[0];
        const month = parts[1];
        const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
        resolvedApiDate = `${day}-${capitalizedMonth}`;
      }

      train = allMatches.find(
        (t) => normalizeDate(t.start_date) === normalizedTarget
      );
      if (train) {
        console.error(`[getLiveTrainStatus] MATCH FOUND IN LIVE FEED: ${train.train_no} started on "${train.start_date}"`);
      } else {
        console.error(`[getLiveTrainStatus] NO MATCH IN LIVE FEED for normalized target "${normalizedTarget}". Querying API directly with resolved date "${resolvedApiDate}".`);
      }
    }
  }

  if (!resolvedApiDate) {
    if (allMatches.length > 0) {
      train = allMatches[0];
      resolvedApiDate = train.start_date.replace(" ", "-");
      console.error(`[getLiveTrainStatus] No startDate specified/valid. Defaulting to first live feed instance: "${train.start_date}" (API date: "${resolvedApiDate}")`);
    } else {
      resolvedApiDate = getISTDateString(0).replace(" ", "-");
      console.error(`[getLiveTrainStatus] No startDate specified/valid and train not in live feed. Defaulting to today's date: "${getISTDateString(0)}" (API date: "${resolvedApiDate}")`);
    }
  }

  console.error(`[getLiveTrainStatus] Fetching details for ${trainNo} with API date "${resolvedApiDate}-2026"`);
  const details = await getTrainInfo(trainNo, resolvedApiDate);

  if (!details.train_name) {
    console.error(`[getLiveTrainStatus] Train ${trainNo} not found in database.`);
    return {
      runningToday: false,
      trainNo,
      message: `Train ${trainNo} not found.`,
    };
  }

  if (!details.current_position) {
    console.error(`[getLiveTrainStatus] No running status or live data found for train ${trainNo} on start date ${resolvedApiDate}.`);
    return {
      runningToday: false,
      trainNo,
      message: `No running status or live data found for train ${trainNo} on start date ${startDateParam || resolvedApiDate}.`,
    };
  }

  let currentStation = "";
  let stationCode = "";
  let latitude = 0;
  let longitude = 0;
  let lastUpdated = "";

  if (train) {
    currentStation = train.station_name;
    stationCode = train.station_code;
    latitude = train.lat;
    longitude = train.lon;
    lastUpdated = train.actual_time;
  } else {
    stationCode = details.current_location || "";
    const matchingStop = details.train_public_time_table?.find(
      (stop) => stop.station_code === stationCode
    );
    currentStation = matchingStop
      ? matchingStop.station_name
      : (details.current_position.last_station_location || stationCode);
    latitude = 0;
    longitude = 0;
    lastUpdated = details.current_position.last_station_location_actual_time || "";
  }

  const availableDates = allMatches.map(t => t.start_date);

  console.error(`[getLiveTrainStatus] SUCCESS: Found status for ${trainNo} on ${details.start_date} at ${currentStation} (${stationCode})`);

  return {
    runningToday: true,
    trainNo: details.train_no,
    trainName: details.train_name,
    trainNameUnicode: details.train_name_unicode,
    trainSubType: details.train_sub_type,
    startDate: details.start_date,

    currentStation,
    stationCode,

    latitude,
    longitude,

    lastUpdated,
    currentLocation: details.current_location,
    locationSource: details.location_source,
    rejectedLocation: details.rejected_location,
    rejectedSource: details.rejected_source,
    locoAttached: details.loco_attached,
    locoNo: details.loco_no,
    lastSpottedAt: details.last_spotted_at,
    locoSpeed: details.loco_speed,
    distanceToNext: details.distance_to_next,
    gpsDataAge: details.gps_data_age,
    currentPosition: {
      description: details.current_position.description,
      train_source: details.current_position.train_source,
      train_destination:
        details.current_position.train_destination,
      last_station_location:
        details.current_position.last_station_location,
      last_station_location_actual_time:
        details.current_position.last_station_location_actual_time,
      last_station_location_delay:
        details.current_position.last_station_location_delay,
      train_status_last_location:
        details.current_position.train_status_last_location,
    },
    nextStoppage: getNextStoppage(
      details.train_public_time_table
    ),
    upcomingStops: getUpcomingStops(
      details.train_public_time_table
    ),
    trainPublicTimeTable:
      details.train_public_time_table,
    fullRunningSchedule:
      details.full_running_schedule,
    runningAverage: details.running_average,
    availableDates: availableDates.length > 1 ? availableDates : undefined,
  };
}

function parseISTDateTime(dateTimeStr: string): Date {
  const parts = dateTimeStr.trim().split(/\s+/);
  if (parts.length === 0) return new Date();

  const timeStr = parts[0];
  const dateStr = parts.length > 1 ? parts[1] : "";

  const timeParts = timeStr.split(":");
  const hour = parseInt(timeParts[0]) || 0;
  const minute = parseInt(timeParts[1]) || 0;

  let day = 0;
  let monthIdx = 0;
  const now = new Date();
  const istNow = new Date(now.getTime() + 19800000);

  if (dateStr) {
    const dateParts = dateStr.split("-");
    day = parseInt(dateParts[0]) || istNow.getUTCDate();
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const cleanMonth = dateParts[1].replace(/[^a-zA-Z]/g, "").toLowerCase();
    monthIdx = monthNames.indexOf(cleanMonth);
    if (monthIdx === -1) {
      monthIdx = istNow.getUTCMonth();
    }
  } else {
    day = istNow.getUTCDate();
    monthIdx = istNow.getUTCMonth();
  }

  const targetUtcEpoch = Date.UTC(2026, monthIdx, day, hour, minute);
  const targetAbsoluteEpoch = targetUtcEpoch - 19800000;
  return new Date(targetAbsoluteEpoch);
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  try {
    const coordsPath = path.join(projectRoot, "src", "data", "station_coords.json");
    if (fs.existsSync(coordsPath)) {
      const coordsMap = JSON.parse(fs.readFileSync(coordsPath, "utf8"));
      const stationCoords = coordsMap[normStation];
      if (stationCoords) {
        const [stationLat, stationLon] = stationCoords;
        const nearby = activeTrains.filter(t => {
          const dist = haversineDistance(stationLat, stationLon, t.lat, t.lon);
          return dist <= 120; // 120 km threshold
        });
        nearbyTrainNos = nearby.map(t => t.train_no);
      }
    }
  } catch (err: any) {
    console.error(`[getTrainsAtStation] Error reading station_coords.json: ${err.message}`);
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

      function isTimeInWindow(timeStr: string | null): boolean {
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
      }

      const candidateStops = scheduledStops.filter((stop: any) => isTimeInWindow(stop.a) || isTimeInWindow(stop.d));
      scheduledTrainNos = candidateStops.map((stop: any) => stop.t);
    }
  } catch (err: any) {
    console.error(`[getTrainsAtStation] Error reading station_trains.json: ${err.message}`);
  }

  // 3. Merge candidate train numbers
  const mergedTrainNos = Array.from(new Set([...scheduledTrainNos, ...nearbyTrainNos]));
  console.error(`[getTrainsAtStation] Station ${normStation}: found ${mergedTrainNos.length} candidate trains to check (scheduled in window: ${scheduledTrainNos.length}, active within 120km: ${nearbyTrainNos.length}).`);

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
