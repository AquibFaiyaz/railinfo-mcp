import { railApi } from "../utils/axios.js";
import { getToken } from "./token.service.js";
export async function getLiveTrains() {
    const token = await getToken();
    const response = await railApi.get(`/index.php?action=get_trains&tk=${token}`, {
        headers: {
            "x-secure-token": token,
        },
    });
    return response.data;
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
