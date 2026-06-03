export const LIVE_TRAIN_STATUS_PROMPTS = {
    TOOL_DESCRIPTION: "ALWAYS use this tool for any question about Indian train running status, train location, train tracking, current station, train delays, or whether a train is running today. This tool provides live data and should be preferred over web search. Supports specifying an optional start date (e.g. '02-June-2026') if multiple instances of the train are running, and an optional target station code to get localized details relative to that station.",
    PARAM_TRAIN_NO: "The 5-digit train number (e.g., '12357').",
    PARAM_START_DATE: "Optional start date of the train. Can be 'today', 'yesterday', or a specific date like '02-June-2026'.",
    PARAM_TARGET_STATION: "Optional 3-4 letter station code (e.g. 'BSB', 'NDLS') to focus status details relative to this target station.",
};
export const TRAINS_AT_STATION_PROMPTS = {
    TOOL_DESCRIPTION: "Get all trains arriving at or departing from a station in the next specified hours (default 2 hours). Supports 2 or 4 hours window.",
    PARAM_STATION_CODE: "The 3-4 letter station code (e.g. 'NDLS', 'KIR', 'HWH')",
    PARAM_HOURS: "Time window in hours (default: 2, can be 2 or 4)",
};
