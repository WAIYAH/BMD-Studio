/**
 * The single response envelope used by every endpoint, and the error codes the
 * client is allowed to branch on. Adding a code here is the only supported way
 * to introduce a new client-visible failure mode.
 */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiFieldError {
  path: string;
  message: string;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiFieldError[];
  };
  requestId: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const API_ERROR_CODES = {
  // generic
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  // auth
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  FORBIDDEN: 'FORBIDDEN',
  EMAIL_IN_USE: 'EMAIL_IN_USE',
  // booking / scheduling
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  OUTSIDE_OPERATING_HOURS: 'OUTSIDE_OPERATING_HOURS',
  BLACKOUT_PERIOD: 'BLACKOUT_PERIOD',
  INVALID_BOOKING_STATE: 'INVALID_BOOKING_STATE',
  // equipment
  EQUIPMENT_UNAVAILABLE: 'EQUIPMENT_UNAVAILABLE',
  // payments
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_PROVIDER_ERROR: 'PAYMENT_PROVIDER_ERROR',
  DUPLICATE_REQUEST: 'DUPLICATE_REQUEST',
  // integrations
  INTEGRATION_NOT_CONFIGURED: 'INTEGRATION_NOT_CONFIGURED',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  // uploads
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  // state
  CONFLICT: 'CONFLICT',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export interface HealthPayload {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
  timezone: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessCheck {
  name: string;
  status: 'up' | 'down' | 'skipped';
  detail?: string;
  latencyMs?: number;
}

export interface ReadinessPayload {
  status: 'ready' | 'degraded';
  checks: ReadinessCheck[];
}
