/**
 * Single source of truth for client-facing error messages and their stable
 * codes. Throw via AppError using these instead of hardcoding strings, so
 * messages/codes stay consistent and are changed in one place.
 */

export const ERROR_CODES = {
  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  // Access-token / authentication
  MISSING_TOKEN: "MISSING_TOKEN",
  INVALID_TOKEN: "INVALID_TOKEN",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  // Refresh tokens
  MISSING_REFRESH_TOKEN: "MISSING_REFRESH_TOKEN",
  INVALID_REFRESH_TOKEN: "INVALID_REFRESH_TOKEN",
  REFRESH_TOKEN_REUSED: "REFRESH_TOKEN_REUSED",
  REFRESH_TOKEN_EXPIRED: "REFRESH_TOKEN_EXPIRED",
  // Registration / login
  EMAIL_TAKEN: "EMAIL_TAKEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  // Rate limiting
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  // Database (mapped Prisma errors)
  RESOURCE_CONFLICT: "RESOURCE_CONFLICT",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  RELATED_RESOURCE_NOT_FOUND: "RELATED_RESOURCE_NOT_FOUND",
  // Authorization
  FORBIDDEN: "FORBIDDEN",
  // Resources
  TASK_NOT_FOUND: "TASK_NOT_FOUND",
  CATEGORY_NOT_FOUND: "CATEGORY_NOT_FOUND",
  TAG_NOT_FOUND: "TAG_NOT_FOUND",
  PARENT_TASK_NOT_FOUND: "PARENT_TASK_NOT_FOUND",
  SUBTASK_NESTING_NOT_ALLOWED: "SUBTASK_NESTING_NOT_ALLOWED",
} as const;

export const ERROR_MESSAGES = {
  VALIDATION_ERROR: "Invalid request body",
  MISSING_TOKEN: "Missing bearer token",
  INVALID_TOKEN: "Invalid or expired token",
  USER_NOT_FOUND: "User no longer exists",
  MISSING_REFRESH_TOKEN: "Missing refresh token",
  INVALID_REFRESH_TOKEN: "Invalid refresh token",
  REFRESH_TOKEN_REUSED: "Refresh token reuse detected",
  REFRESH_TOKEN_EXPIRED: "Refresh token expired",
  EMAIL_TAKEN: "Email already registered",
  INVALID_CREDENTIALS: "Invalid credentials",
  TOO_MANY_REQUESTS: "Too many requests, please try again later",
  RESOURCE_CONFLICT: "A record with these details already exists",
  RESOURCE_NOT_FOUND: "The requested record was not found",
  RELATED_RESOURCE_NOT_FOUND: "A referenced record does not exist",
  FORBIDDEN: "You do not have permission to perform this action",
  TASK_NOT_FOUND: "Task not found",
  CATEGORY_NOT_FOUND: "Category not found",
  TAG_NOT_FOUND: "Tag not found",
  PARENT_TASK_NOT_FOUND: "Parent task not found",
  SUBTASK_NESTING_NOT_ALLOWED: "Subtasks can only be nested one level deep",
} as const;
