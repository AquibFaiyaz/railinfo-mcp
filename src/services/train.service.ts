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

export async function findTrain(
  trainNo: string
): Promise<LiveTrain | undefined> {
  const trainsResponse = await getLiveTrains();

  return trainsResponse.data.find(
    (train) => train.train_no === trainNo
  );
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
  trainNo: string
): Promise<LiveTrainStatusNotFound | LiveTrainStatusFound> {
  const train = await findTrain(trainNo);

  if (!train) {
    return {
      runningToday: false,
      trainNo,
      message: "Train not found in live feed",
    };
  }

  const startDate = train.start_date.replace(
    " ",
    "-"
  );

  const details = await getTrainInfo(
    trainNo,
    startDate
  );

  return {
    runningToday: true,
    trainNo: details.train_no,
    trainName: details.train_name,
    trainNameUnicode: details.train_name_unicode,
    trainSubType: details.train_sub_type,
    startDate: details.start_date,

    currentStation: train.station_name,
    stationCode: train.station_code,

    latitude: train.lat,
    longitude: train.lon,

    lastUpdated: train.actual_time,
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
  };
}
