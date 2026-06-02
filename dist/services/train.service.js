import { railApi } from "../utils/axios.js";
import { getToken } from "./token.service.js";
function mapStop(stop) {
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
function getNextStoppage(timetable) {
    const next = timetable.find((stop) => stop.has_arrived !== "1" || stop.has_departed !== "1");
    if (!next) {
        return null;
    }
    return mapStop(next);
}
function getUpcomingStops(timetable) {
    return timetable
        .filter((stop) => stop.has_arrived !== "1" || stop.has_departed !== "1")
        .slice(0, 3)
        .map(mapStop);
}
export async function getLiveTrains() {
    const token = await getToken();
    const response = await railApi.get(`/index.php?action=get_trains&tk=${token}`, {
        headers: {
            "x-secure-token": token,
        },
    });
    return response.data;
}
export function normalizeDate(dateStr) {
    const normalized = dateStr.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
    const parts = normalized.split(/\s+/);
    if (parts.length < 2)
        return "";
    let day = parts[0];
    if (day.length === 1) {
        day = "0" + day;
    }
    const month = parts[1];
    const monthMap = {
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
    if (!mappedMonth)
        return "";
    return `${day} ${mappedMonth}`;
}
export function getISTDateString(offsetDays = 0) {
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
export async function findTrain(trainNo, startDate) {
    const trainsResponse = await getLiveTrains();
    const allMatches = trainsResponse.data.filter((train) => train.train_no === trainNo);
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
        }
        else if (startDate.toLowerCase() === "yesterday") {
            normalizedTarget = getISTDateString(-1).toLowerCase();
            console.error(`[findTrain] Keyword "yesterday" resolved to IST date: "${getISTDateString(-1)}" (normalized target: "${normalizedTarget}")`);
        }
        else {
            normalizedTarget = normalizeDate(startDate);
            console.error(`[findTrain] Explicit date "${startDate}" normalized target: "${normalizedTarget}"`);
        }
        const match = allMatches.find((train) => normalizeDate(train.start_date) === normalizedTarget);
        if (match) {
            console.error(`[findTrain] MATCH FOUND: ${match.train_no} started on "${match.start_date}"`);
        }
        else {
            console.error(`[findTrain] NO MATCH FOUND for normalized target "${normalizedTarget}"`);
        }
        return { match, allMatches };
    }
    console.error(`[findTrain] No startDate specified. Defaulting to first instance: "${allMatches[0]?.start_date}"`);
    return { match: allMatches[0], allMatches };
}
export async function getTrainInfo(trainNo, startDate) {
    const token = await getToken();
    const response = await railApi.get(`/index.php?action=check_train_info&trainNo=${trainNo}&startDate=${startDate}-2026&tk=${token}`, {
        headers: {
            "x-secure-token": token,
        },
    });
    return response.data;
}
export async function getLiveTrainStatus(trainNo, startDateParam) {
    const trainsResponse = await getLiveTrains();
    const allMatches = trainsResponse.data.filter((train) => train.train_no === trainNo);
    console.error(`[getLiveTrainStatus] Query for Train: ${trainNo}, startDateParam: "${startDateParam}"`);
    console.error(`[getLiveTrainStatus] Found ${allMatches.length} matching instances in live feed:`);
    allMatches.forEach(t => {
        console.error(`  - Start Date: "${t.start_date}" (Normalized: "${normalizeDate(t.start_date)}") at station: ${t.station_name}`);
    });
    let resolvedApiDate = "";
    let train = undefined;
    if (startDateParam) {
        const lower = startDateParam.toLowerCase();
        let normalizedTarget = "";
        if (lower === "today") {
            normalizedTarget = getISTDateString(0).toLowerCase();
            console.error(`[getLiveTrainStatus] Keyword "today" resolved to IST date: "${getISTDateString(0)}" (normalized target: "${normalizedTarget}")`);
        }
        else if (lower === "yesterday") {
            normalizedTarget = getISTDateString(-1).toLowerCase();
            console.error(`[getLiveTrainStatus] Keyword "yesterday" resolved to IST date: "${getISTDateString(-1)}" (normalized target: "${normalizedTarget}")`);
        }
        else {
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
            train = allMatches.find((t) => normalizeDate(t.start_date) === normalizedTarget);
            if (train) {
                console.error(`[getLiveTrainStatus] MATCH FOUND IN LIVE FEED: ${train.train_no} started on "${train.start_date}"`);
            }
            else {
                console.error(`[getLiveTrainStatus] NO MATCH IN LIVE FEED for normalized target "${normalizedTarget}". Querying API directly with resolved date "${resolvedApiDate}".`);
            }
        }
    }
    if (!resolvedApiDate) {
        if (allMatches.length > 0) {
            train = allMatches[0];
            resolvedApiDate = train.start_date.replace(" ", "-");
            console.error(`[getLiveTrainStatus] No startDate specified/valid. Defaulting to first live feed instance: "${train.start_date}" (API date: "${resolvedApiDate}")`);
        }
        else {
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
    }
    else {
        stationCode = details.current_location || "";
        const matchingStop = details.train_public_time_table?.find((stop) => stop.station_code === stationCode);
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
    };
}
