import type { CookieOptions, RequestHandler, Response } from "express";
import { env, isProduction } from "../config/env.js";
import { AUTH_PATH } from "../constants/routes.js";
import * as authService from "../services/auth.service.js";
import type { RegisterInput, LoginInput } from "../validators/auth.validator.js";
import { AppError } from "../utils/AppError.js";
import { ERROR_CODES, ERROR_MESSAGES } from "../constants/errors.js";
import { validated, getAuthUser } from "../utils/request.js";

/**
 * Auth controllers — HTTP only. Bodies arriving here are already validated by
 * the `validate` middleware, so handlers just call the service, manage the
 * refresh cookie, and shape the response. Express 5 forwards thrown AppErrors.
 */

// --- Refresh-token cookie helpers (HTTP-response concern) -----------------

const REFRESH_MAX_AGE_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Base cookie options. Scoped to /api/auth so it's only sent to refresh/logout. */
function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: AUTH_PATH,
  };
}

function setRefreshCookie(res: Response, raw: string): void {
  res.cookie(env.REFRESH_COOKIE_NAME, raw, {
    ...refreshCookieOptions(),
    maxAge: REFRESH_MAX_AGE_MS,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(env.REFRESH_COOKIE_NAME, refreshCookieOptions());
}

// --- Handlers -------------------------------------------------------------

/** Register a new user, set the refresh cookie, return the access token. */
export const register: RequestHandler = async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register(
    validated<RegisterInput>(req),
  );
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ user, accessToken });
};

/** Authenticate with email + password, set the refresh cookie. */
export const login: RequestHandler = async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(
    validated<LoginInput>(req),
  );
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ user, accessToken });
};

/** Rotate the refresh token (from cookie) and issue a fresh access token. */
export const refresh: RequestHandler = async (req, res) => {
  const raw = req.cookies?.[env.REFRESH_COOKIE_NAME];
  if (!raw) {
    throw AppError.unauthorized(
      ERROR_MESSAGES.MISSING_REFRESH_TOKEN,
      ERROR_CODES.MISSING_REFRESH_TOKEN,
    );
  }

  const { accessToken, refreshToken } = await authService.refresh(raw);
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ accessToken });
};

/** Revoke the current refresh token and clear the cookie. Always succeeds. */
export const logout: RequestHandler = async (req, res) => {
  const raw = req.cookies?.[env.REFRESH_COOKIE_NAME];
  if (raw) {
    await authService.logout(raw);
  }
  clearRefreshCookie(res);
  res.status(204).send();
};

/** Return the authenticated user's profile. */
export const me: RequestHandler = async (req, res) => {
  const user = await authService.getProfile(getAuthUser(req).id);
  res.json({ user });
};
