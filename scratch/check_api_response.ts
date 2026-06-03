import { getLiveTrains } from "../src/services/rail-api.service.js";
import { getToken } from "../src/services/token.service.js";
import { railApi } from "../src/utils/axios.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  try {
    const token = await getToken();
    console.log("Token:", token);

    const liveTrains = await getLiveTrains();
    const matches = liveTrains.data.filter(t => t.train_no === "15484");
    console.log("Active 15484 matches:");
    console.log(matches.map(m => ({ start_date: m.start_date, actual_time: m.actual_time })));

    for (const match of matches) {
      // Let's try matching with space
      const spaceDate = match.start_date; // e.g. "03 Jun"
      console.log(`\nQuerying with space: "${spaceDate}"...`);
      const res1 = await railApi.get(
        `/index.php?action=get_train&train_no=15484&start_date=${spaceDate}&tk=${token}`,
        { headers: { "x-secure-token": token } }
      );
      console.log("Response Type:", typeof res1.data);
      if (typeof res1.data === "string" && res1.data.includes("<!DOCTYPE html>")) {
        console.log("Returned HTML");
      } else {
        console.log("Response Keys:", Object.keys(res1.data || {}));
      }

      // Let's try matching with hyphen
      const hyphenDate = spaceDate.replace(" ", "-"); // e.g. "03-Jun"
      console.log(`Querying with hyphen: "${hyphenDate}"...`);
      const res2 = await railApi.get(
        `/index.php?action=get_train&train_no=15484&start_date=${hyphenDate}&tk=${token}`,
        { headers: { "x-secure-token": token } }
      );
      console.log("Response Type:", typeof res2.data);
      if (typeof res2.data === "string" && res2.data.includes("<!DOCTYPE html>")) {
        console.log("Returned HTML");
      } else {
        console.log("Response Keys:", Object.keys(res2.data || {}));
      }
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
run();
