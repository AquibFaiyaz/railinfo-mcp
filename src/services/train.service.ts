import { getLiveTrains, getTrainInfo } from "./rail-api.service.js";
import { normalizeDate, getISTDateString } from "../utils/date.js";
import { getStationCoordinates, haversineDistance } from "../utils/geo.js";
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
  targetStationInfo?: any;
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
  if (!timetable || !Array.isArray(timetable)) {
    return null;
  }
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
  if (!timetable || !Array.isArray(timetable)) {
    return [];
  }
  return timetable
    .filter(
      (stop) => stop.has_arrived !== "1" || stop.has_departed !== "1"
    )
    .slice(0, 3)
    .map(mapStop);
}

export async function findTrain(
  trainNo: string,
  startDate?: string
): Promise<{ match: LiveTrain | undefined; allMatches: LiveTrain[] }> {
  const trainsResponse = await getLiveTrains();
  const data = trainsResponse?.data || [];

  const allMatches = data.filter(
    (train) => train.train_no === trainNo
  );

  console.error(`[findTrain] Query for Train: ${trainNo}, startDateParam: "${startDate}"`);
  console.error(`[findTrain] Found ${allMatches.length} matching instances in live feed:`);
  allMatches.forEach((t) => {
    console.error(
      `  - Start Date: "${t.start_date}" (Normalized: "${normalizeDate(t.start_date)}") at station: ${t.station_name}`
    );
  });

  let resolvedTarget = "";
  if (startDate) {
    const lower = startDate.toLowerCase();
    if (lower === "today") {
      resolvedTarget = getISTDateString(0).toLowerCase();
    } else if (lower === "yesterday") {
      resolvedTarget = getISTDateString(-1).toLowerCase();
    } else {
      resolvedTarget = normalizeDate(startDate);
    }
  }

  let match: LiveTrain | undefined = undefined;
  if (resolvedTarget) {
    match = allMatches.find(
      (t) => normalizeDate(t.start_date) === resolvedTarget
    );
  }

  return { match, allMatches };
}

export async function getLiveTrainStatus(
  trainNo: string,
  startDateParam?: string,
  targetStationCode?: string
): Promise<LiveTrainStatusNotFound | LiveTrainStatusFound> {
  const trainsResponse = await getLiveTrains();
  const data = trainsResponse?.data || [];
  const allMatches = data.filter(
    (train) => train.train_no === trainNo
  );

  console.error(`[getLiveTrainStatus] Query for Train: ${trainNo}, startDateParam: "${startDateParam}"`);
  console.error(`[getLiveTrainStatus] Found ${allMatches.length} matching instances in live feed:`);
  allMatches.forEach((t) => {
    console.error(
      `  - Start Date: "${t.start_date}" (Normalized: "${normalizeDate(t.start_date)}") at station: ${t.station_name}`
    );
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

  if (!details || !details.train_name) {
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

  const availableDates = allMatches.map((t) => t.start_date);

  let targetStationInfo: any = undefined;
  if (targetStationCode && details.train_public_time_table) {
    const normTarget = targetStationCode.trim().toUpperCase();
    const targetStop = details.train_public_time_table.find(
      (s) => s.station_code === normTarget
    );

    if (targetStop) {
      let currentStop = details.train_public_time_table.find(
        (s) => s.station_code === stationCode
      );

      // Fallback: if the train is at a passing station not in the timetable,
      // use the last departed scheduled stop to compute track distance bounds
      if (!currentStop) {
        const departedStops = details.train_public_time_table.filter(
          (s) => s.has_departed === "1" || s.has_departed === "Yes"
        );
        if (departedStops.length > 0) {
          currentStop = departedStops[departedStops.length - 1];
        } else {
          // Default to the first stop (source) if it hasn't departed any stop yet
          currentStop = details.train_public_time_table[0];
        }
      }

      const targetDistance = parseInt(targetStop.distance) || 0;
      const currentDistance = currentStop ? (parseInt(currentStop.distance) || 0) : 0;

      const targetIdx = details.train_public_time_table.indexOf(targetStop);
      const currentIdx = currentStop ? details.train_public_time_table.indexOf(currentStop) : -1;

      let distanceRemainingKm: number | null = null;
      let stopsRemaining: number | null = null;
      let alreadyPassed = false;

      if (currentIdx !== -1) {
        if (targetIdx > currentIdx) {
          distanceRemainingKm = targetDistance - currentDistance;
          stopsRemaining = targetIdx - currentIdx;
        } else if (targetIdx === currentIdx) {
          distanceRemainingKm = 0;
          stopsRemaining = 0;
        } else {
          alreadyPassed = true;
        }
      }

      // Calculate straight-line GPS distance if coordinates are active
      let gpsDistanceKm: number | null = null;
      if (latitude && longitude) {
        const targetCoords = getStationCoordinates(normTarget);
        if (targetCoords) {
          const [tLat, tLon] = targetCoords;
          gpsDistanceKm = haversineDistance(latitude, longitude, tLat, tLon);
        }
      }

      // Extract remaining scheduled stops between current position and target
      let remainingStations: any[] = [];
      if (currentIdx !== -1 && targetIdx > currentIdx) {
        // Include stops from (currentIdx + 1) up to and including targetIdx
        for (let idx = currentIdx + 1; idx <= targetIdx; idx++) {
          const s = details.train_public_time_table[idx];
          remainingStations.push({
            stationCode: s.station_code,
            stationName: s.station_name,
            sta: s.sta || s.eta || "—",
            eta: s.eta || s.sta || "—",
            delay: s.delay_arrival || "On Time",
            platform: s.pf || "—",
            hasArrived: s.has_arrived === "1" || s.has_arrived === "Yes",
            hasDeparted: s.has_departed === "1" || s.has_departed === "Yes",
            distance: s.distance,
          });
        }
      }

      targetStationInfo = {
        stationCode: targetStop.station_code,
        stationName: targetStop.station_name,
        distanceRemainingKm,
        stopsRemaining,
        gpsDistanceKm,
        eta: targetStop.eta || "Source",
        sta: targetStop.sta || "Source",
        etd: targetStop.etd || "Destination",
        std: targetStop.std || "Destination",
        delayArrival: targetStop.delay_arrival || "On Time",
        delayDeparture: targetStop.delay_departure || "On Time",
        platform: targetStop.pf || "N/A",
        hasArrived: targetStop.has_arrived === "1" || targetStop.has_arrived === "Yes",
        hasDeparted: targetStop.has_departed === "1" || targetStop.has_departed === "Yes",
        alreadyPassed,
        remainingStations,
      };
    }
  }

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
      train_destination: details.current_position.train_destination,
      last_station_location: details.current_position.last_station_location,
      last_station_location_actual_time: details.current_position.last_station_location_actual_time,
      last_station_location_delay: details.current_position.last_station_location_delay,
      train_status_last_location: details.current_position.train_status_last_location,
    },
    nextStoppage: getNextStoppage(details.train_public_time_table),
    upcomingStops: getUpcomingStops(details.train_public_time_table),
    trainPublicTimeTable: details.train_public_time_table,
    fullRunningSchedule: details.full_running_schedule,
    runningAverage: details.running_average,
    availableDates: availableDates.length > 1 ? availableDates : undefined,
    targetStationInfo,
  };
}
