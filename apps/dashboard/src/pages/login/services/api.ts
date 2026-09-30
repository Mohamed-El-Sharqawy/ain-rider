import { api } from "@/api/client";
import type { LoginDTO, LoginResponseDTO, AuthUserDTO } from "./dto";

/**
 * Authentication API client for the admin dashboard.
 *
 * Token delivery: Dashboard uses cookie-based authentication (httpOnly cookies).
 * The server sets tokens as cookies via Set-Cookie headers, and withCredentials: true
 * ensures cookies are sent with requests (unlike mobile which receives tokens in the response body).
 */
export const authApi = {
  login: (data: LoginDTO) =>
    api.post<LoginResponseDTO>("/auth/login", data, {
      withCredentials: true,
    }),

  getMe: () => api.get<AuthUserDTO>("/auth/me"),

  logout: () => api.post<{ success: boolean }>("/auth/logout"),
};
