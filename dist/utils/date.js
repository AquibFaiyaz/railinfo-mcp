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
export function parseISTDateTime(dateTimeStr) {
    const parts = dateTimeStr.trim().split(/\s+/);
    if (parts.length === 0)
        return new Date();
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
    }
    else {
        day = istNow.getUTCDate();
        monthIdx = istNow.getUTCMonth();
    }
    const targetUtcEpoch = Date.UTC(2026, monthIdx, day, hour, minute);
    const targetAbsoluteEpoch = targetUtcEpoch - 19800000;
    return new Date(targetAbsoluteEpoch);
}
