import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const baseURL = process.env.RAILJOURNAL_BASE_URL || "https://railjournal.in";

export const railApi = axios.create({
  baseURL,
  timeout: 50000,
  headers: {
    "x-requested-with": "XMLHttpRequest",
    referer: `${baseURL}/`,
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36",
  },
});