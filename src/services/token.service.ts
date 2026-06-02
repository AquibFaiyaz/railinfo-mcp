import { railApi } from "../utils/axios.js";
import { TokenResponse } from "../types/token.types.js";

export async function getToken(): Promise<string> {
  const response = await railApi.get<TokenResponse>(
    "/index.php?action=init_token&tk="
  );

  return response.data.token;
}