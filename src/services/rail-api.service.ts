import { railApi } from "../utils/axios.js";
import { getToken } from "./token.service.js";
import type { LiveTrainsResponse } from "../types/live-trains.types.js";
import type { TrainInfoResponse } from "../types/train-info.types.js";

export async function getLiveTrains(): Promise<LiveTrainsResponse> {
  const token = await getToken();

  const response = await railApi.get<LiveTrainsResponse>(
    `/index.php?action=get_trains&tk=${token}`,
    {
      headers: {
        "x-secure-token": token,
      },
    }
  );

  return response.data;
}

export async function getTrainInfo(
  trainNo: string,
  startDate: string
): Promise<TrainInfoResponse> {
  const token = await getToken();

  const response = await railApi.get<TrainInfoResponse>(
    `/index.php?action=check_train_info&trainNo=${trainNo}&startDate=${startDate}-2026&tk=${token}`,
    {
      headers: {
        "x-secure-token": token,
      },
    }
  );

  return response.data;
}
