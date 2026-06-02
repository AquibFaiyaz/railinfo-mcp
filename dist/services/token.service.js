import { railApi } from "../utils/axios.js";
export async function getToken() {
    const response = await railApi.get("/index.php?action=init_token&tk=");
    return response.data.token;
}
