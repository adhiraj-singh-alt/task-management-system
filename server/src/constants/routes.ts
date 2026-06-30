/**
 * API path constants. Centralized so the route mount and the refresh-cookie
 * path stay in sync. Bump API_PREFIX to introduce a new API version.
 */
export const API_PREFIX = "/api/v1";
export const AUTH_PATH = `${API_PREFIX}/auth`;
export const TASKS_PATH = `${API_PREFIX}/tasks`;
export const CATEGORIES_PATH = `${API_PREFIX}/categories`;
export const TAGS_PATH = `${API_PREFIX}/tags`;
export const USERS_PATH = `${API_PREFIX}/users`;
export const REPORTS_PATH = `${API_PREFIX}/reports`;
export const METRICS_PATH = `${API_PREFIX}/metrics`;
