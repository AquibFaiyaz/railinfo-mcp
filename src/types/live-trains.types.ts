export interface LiveTrainsResponse {
  status: boolean;
  count: number;
  data: LiveTrain[];
}

export interface LiveTrain {
  train_no: string;
  train_name: string;
  train_type: string;

  start_date: string;
  actual_time: string;

  lat: number;
  lon: number;

  source: string;

  block_section: string;
  section: string;

  gps_time: string | null;

  station_code: string;
  station_name: string;

  heading: number;
}