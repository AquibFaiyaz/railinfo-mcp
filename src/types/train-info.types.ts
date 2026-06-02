// src/types/train-info.types.ts

export interface TrainInfoResponse {
  status: boolean;
  train_no: string;
  train_name: string;
  train_name_unicode: string;
  train_sub_type: string;
  start_date: string;

  current_location: string;
  location_source: string;

  rejected_location: string;
  rejected_source: string;

  loco_attached: boolean;
  loco_no: string;
  last_spotted_at: string;
  loco_speed: number;

  gps_data_age: string;
  distance_to_next: string | null;

  current_position: CurrentPosition;

  train_public_time_table: TrainPublicTimeTableEntry[];

  full_running_schedule: FullRunningScheduleEntry[];

  running_average: RunningAverage | null;
}

export interface CurrentPosition {
  description: string;

  train_name: string;
  train_hindi_name: string;

  train_source: string;
  train_destination: string;

  last_station_location: string;
  last_station_location_event: string;

  last_station_location_scheduled_time: string;
  last_station_location_actual_time: string;

  last_station_location_delay: string;

  train_status_last_location: string;
}

export interface TrainPublicTimeTableEntry {
  sr: string;

  station_code: string;
  station_name: string;

  distance: string;

  sta: string;
  eta: string;

  arrival_cancel_flag: string;
  has_arrived: string;
  delay_arrival: string;

  std: string;
  etd: string;

  departure_cancel_flag: string;
  has_departed: string;
  delay_departure: string;

  pf: string;

  rake_reversal: string;
}

export interface FullRunningScheduleEntry {
  sr: string;

  station_code: string;
  station_name: string;

  division: string;
  zone: string;

  wtt_arr: string;
  act_arr: string;
  delay_arr: string;

  wtt_dep: string;
  act_dep: string;
  delay_dep: string;

  day: string;
  distance: string;

  updated_at: string;

  Crossing: NearbyTrain[];
  Behind: NearbyTrain[];
  Ahead: NearbyTrain[];
}

export interface NearbyTrain {
  train_no: string;
  train_name: string;

  actual_time: string;

  block_section: string;
  section: string;
}

export interface RunningAverage {
  [key: string]: unknown;
}