import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ApiError } from "./types";

/**
 * Axios instance for the TaskFlow API.
 *
 * Auth model: the access token lives in memory only (not localStorage — safer
 * against XSS); the refresh token is an httpOnly cookie the browser sends
 * automatically (`withCredentials`). On a 401 we transparently hit
 * /auth/refresh once, then retry the original request. In dev, Vite proxies
 * `/api` to the backend so this is same-origin.
 */
export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
});

// --- In-memory access token ---------------------------------------------------

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Called when refresh fails — lets the auth layer drop the session. */
let onAuthFailure: (() => void) | null = null;
export function setOnAuthFailure(handler: (() => void) | null): void {
  onAuthFailure = handler;
}

// --- Request: attach the bearer token ----------------------------------------

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// --- Response: refresh-on-401 with retry, de-duped -------------------------

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string> | null = null;

/** Hit /auth/refresh once at a time; share the in-flight promise. */
export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  const clear = () => {
    refreshPromise = null;
  };
  const pending = api
    .post<{ accessToken: string }>("/auth/refresh", undefined, { _retry: true } as RetriableConfig)
    .then(
      (res) => {
        setAccessToken(res.data.accessToken);
        clear();
        return res.data.accessToken;
      },
      (err) => {
        clear();
        throw err;
      },
    );
  refreshPromise = pending;
  return pending;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiError>) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    // Only attempt a refresh for a genuine 401 on a non-auth request we haven't
    // already retried. The refresh/login calls carry `_retry` so they never loop.
    const isAuthRoute = original?.url?.startsWith("/auth/");
    if (status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        await refreshAccessToken();
        return api(original);
      } catch {
        setAccessToken(null);
        onAuthFailure?.();
      }
    }
    return Promise.reject(error);
  },
);

/** Extract the API error message from an axios error, with a fallback. */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    return (error as AxiosError<ApiError>).response?.data?.error?.message ?? fallback;
  }
  return fallback;
}

/** Extract the stable error `code` from an axios error, if present. */
export function apiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    return (error as AxiosError<ApiError>).response?.data?.error?.code;
  }
  return undefined;
}
