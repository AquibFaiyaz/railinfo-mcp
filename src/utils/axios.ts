import axios from "axios";

export const railApi = axios.create({
  baseURL: "https://railjournal.in",
  timeout: 50000,
  headers: {
    "x-requested-with": "XMLHttpRequest",
    referer: "https://railjournal.in/",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36",
  },
});