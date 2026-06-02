import { getTrainInfo } from "./src/services/train.service.ts";

async function main() {
  try {
    const details = await getTrainInfo("20504", "02-Jun");
    console.log("Train Name:", details.train_name);
    console.log("Start Date:", details.start_date);
    
    if (details.train_public_time_table) {
      console.log(`Timetable has ${details.train_public_time_table.length} stops.`);
      const stop = details.train_public_time_table.find(s => s.station_code === "BSB");
      if (stop) {
        console.log("BSB Stop details:", JSON.stringify(stop, null, 2));
      } else {
        console.log("BSB NOT FOUND in timetable!");
        // Print all stops to see if there is another code or if it doesn't stop
        console.log("Stops:", details.train_public_time_table.map(s => `${s.station_code} (${s.station_name})`).join(", "));
      }
    } else {
      console.log("No timetable found in response!");
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

main();
