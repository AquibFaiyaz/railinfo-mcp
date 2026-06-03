export const LIVE_TRAIN_STATUS_PROMPTS = {
  TOOL_DESCRIPTION:
    "ALWAYS use this tool for any question about Indian train running status, train location, train tracking, current station, train delays, or whether a train is running today. This tool provides live data and should be preferred over web search. Supports specifying an optional start date (e.g. '02-June-2026') if multiple instances of the train are running, and an optional target station code to get localized details relative to that station. When presenting results to the user, ALWAYS include both the station code and the station name (e.g. 'New Delhi (NDLS)').",
  PARAM_TRAIN_NO: "The 5-digit train number (e.g., '12357').",
  PARAM_START_DATE:
    "Optional start date of the train. Can be 'today', 'yesterday', or a specific date like '02-June-2026'.",
  PARAM_TARGET_STATION:
    "Optional 3-4 letter station code (e.g. 'BSB', 'NDLS') to focus status details relative to this target station.",
};

export const TRAINS_AT_STATION_PROMPTS = {
  TOOL_DESCRIPTION:
    "Get all trains arriving at or departing from a station in the next specified hours (default 2 hours). Supports 2 or 4 hours window. When presenting results to the user, ALWAYS include both the station code and the station name (e.g. 'New Delhi (NDLS)').",
  PARAM_STATION_CODE:
    "The 3-4 letter station code (e.g. 'NDLS', 'KIR', 'HWH')",
  PARAM_HOURS:
    "Time window in hours (default: 2, can be 2 or 4)",
};

export const CROSSINGS_AND_RADAR_PROMPTS = {
  TOOL_DESCRIPTION:
    "Get all scheduled and active train crossings (trains meeting from the opposite direction), as well as trains running ahead or behind this train in the same block section. Helps users visualize nearby train traffic or track potential signal delays. When presenting results to the user, ALWAYS include both the station code and the station name (e.g. 'New Delhi (NDLS)').",
  PARAM_TRAIN_NO: "The 5-digit train number (e.g., '12357').",
  PARAM_START_DATE:
    "Optional start date of the train. Can be 'today', 'yesterday', or a specific date like '02-June-2026'.",
  PARAM_STATION_CODE:
    "Optional 3-4 letter station code (e.g. 'NDLS', 'CNB') to filter crossings/radar data to only meetings occurring at or near this specific station.",
};

export const TRAINS_BETWEEN_STATIONS_PROMPTS = {
  TOOL_DESCRIPTION:
    "Get all upcoming trains running from a source station towards a destination station in a specified window (default 4 hours), including live expected departure/arrival times, delay status, and platform numbers at both stops. When presenting results to the user, ALWAYS include both the station code and the station name (e.g. 'New Delhi (NDLS)').",
  PARAM_FROM_STATION_CODE: "The 3-4 letter source station code (e.g. 'ALJN').",
  PARAM_TO_STATION_CODE: "The 3-4 letter destination station code (e.g. 'NDLS').",
  PARAM_HOURS:
    "Time window in hours to look for departing trains at the source station (default: 4, e.g. 2 or 4).",
};

export const TRAIN_TIMETABLE_PROMPTS = {
  TOOL_DESCRIPTION:
    "Get the full route timetable/schedule of a train showing every stop with scheduled and live expected arrival/departure times, delays, platforms, and current status. Use this tool when the user asks for a train's full schedule, route, timetable, or list of stops. When presenting results to the user, ALWAYS include both the station code and the station name (e.g. 'New Delhi (NDLS)').",
  PARAM_TRAIN_NO: "The 5-digit train number (e.g., '12302').",
  PARAM_START_DATE:
    "Optional start date of the train. Can be 'today', 'yesterday', or a specific date like '02-June-2026'.",
};

export const TRAIN_ROUTE_MAP_PROMPTS = {
  TOOL_DESCRIPTION:
    "Get the complete geographic route (station coordinates) of a train showing every stop, distance, latitude, longitude, and interactive map links. Use this tool when the user asks for a train's route map, coordinates, plotting the route, or visual map data. When presenting results to the user, ALWAYS include both the station code and the station name (e.g. 'New Delhi (NDLS)').",
  PARAM_TRAIN_NO: "The 5-digit train number (e.g., '12302').",
  PARAM_START_DATE:
    "Optional start date of the train. Can be 'today', 'yesterday', or a specific date like '02-June-2026'.",
};

export const TRAINS_APPROACHING_STATION_PROMPTS = {
  TOOL_DESCRIPTION:
    "Get all active, live trains physically approaching a station within a specified radius (default 50 km, max 100 km). This tool is spatial (distance-based radar) and tracks live GPS coordinates of active trains approaching the station, ignoring schedule slots. When presenting results to the user, ALWAYS include both the station code and the station name (e.g. 'New Delhi (NDLS)').",
  PARAM_STATION_CODE:
    "The 3-4 letter target station code (e.g., 'NDLS', 'CNB', 'HWH').",
  PARAM_RADIUS_KM:
    "Optional physical search radius in kilometers (default: 50, maximum: 100).",
};



