import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import {
  API_ERROR_CODES,
  API_PREFIX,
  type ApiErrorCode,
  type ApiFailure,
  type ApiFieldError,
  type ApiSuccess,
  type AuthSession,
  type PaginationMeta,
} from '@bmd/shared';

/**
 * Normalised client-side failure. Every rejected request from this module
 * throws one of these, so UI code branches on `code` and never has to inspect
 * raw Axios internals.
 */
export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: ApiFieldError[];
  readonly requestId: string | undefined;

  constructor(
    message: string,
    options: {
      code: ApiErrorCode;
      status: number;
      details?: ApiFieldError[];
      requestId?: string;
    },
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = options.code;
    this.status = options.status;
    this.details = options.details ?? [];
    this.requestId = options.requestId;
  }

  /** Field-level messages keyed by form field name, for form error display. */
  get fieldErrors(): Record<string, string> {
    return this.details.reduce<Record<string, string>>((acc, detail) => {
      acc[detail.path] = detail.message;
      return acc;
    }, {});
  }
}

/**
 * The access token lives in memory only. Persisting it to localStorage would
 * expose it to any XSS on the page; the refresh token is an httpOnly cookie the
 * JavaScript context cannot read at all.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

const baseURL = import.meta.env.VITE_API_URL ?? API_PREFIX;

export const http: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

function toApiClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) return error;

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiFailure>;
    const payload = axiosError.response?.data;

    if (payload && payload.success === false && payload.error) {
      return new ApiClientError(payload.error.message, {
        code: payload.error.code,
        status: axiosError.response?.status ?? 500,
        ...(payload.error.details ? { details: payload.error.details } : {}),
        ...(payload.requestId ? { requestId: payload.requestId } : {}),
      });
    }

    if (!axiosError.response) {
      return new ApiClientError(
        'Could not reach the server. Check your connection and try again.',
        { code: API_ERROR_CODES.UPSTREAM_ERROR, status: 0 },
      );
    }

    return new ApiClientError('Something went wrong. Please try again.', {
      code: API_ERROR_CODES.INTERNAL_ERROR,
      status: axiosError.response.status,
    });
  }

  return new ApiClientError('Something went wrong. Please try again.', {
    code: API_ERROR_CODES.INTERNAL_ERROR,
    status: 0,
  });
}

// ---------------------------------------------------------------------------
// Session renewal
// ---------------------------------------------------------------------------

type SessionListener = (session: AuthSession | null) => void;

let sessionListener: SessionListener | null = null;

/**
 * Lets the auth provider hear about renewals and forced sign-outs, whichever
 * request happened to cause them.
 */
export function setSessionListener(listener: SessionListener | null): void {
  sessionListener = listener;
}

const AUTH_ENDPOINT = /^\/auth\//;
const CONFLICT_RETRIES = 2;

let renewal: Promise<AuthSession | null> | null = null;

const pause = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

async function renew(attempt = 0): Promise<AuthSession | null> {
  try {
    const response = await http.post<ApiSuccess<AuthSession>>('/auth/refresh');
    const session = response.data.data;
    accessToken = session.accessToken;
    sessionListener?.(session);
    return session;
  } catch (error) {
    const failure = toApiClientError(error);
    // Another tab renewed a moment ago; the browser already holds its new cookie.
    if (failure.code === API_ERROR_CODES.CONFLICT && attempt < CONFLICT_RETRIES) {
      await pause(300);
      return renew(attempt + 1);
    }
    if (failure.status === 401 || failure.status === 403) {
      accessToken = null;
      sessionListener?.(null);
      return null;
    }
    throw failure;
  }
}

/**
 * Exchanges the httpOnly refresh cookie for a new access token, resolving null
 * when there is no valid session. Concurrent callers share one request: the
 * server rotates the cookie on every renewal, so parallel renewals would trip
 * its reuse detection.
 */
export function refreshSession(): Promise<AuthSession | null> {
  renewal ??= renew().finally(() => {
    renewal = null;
  });
  return renewal;
}

type RetryableConfig = InternalAxiosRequestConfig & { authRetried?: boolean };

// An expired access token is renewed once, then the original request replayed.
http.interceptors.response.use(undefined, async (error: unknown) => {
  if (!axios.isAxiosError(error) || !error.config) throw error;

  const config = error.config as RetryableConfig;
  const payload = error.response?.data as Partial<ApiFailure> | undefined;
  const expired =
    error.response?.status === 401 && payload?.error?.code === API_ERROR_CODES.TOKEN_EXPIRED;
  if (!expired || config.authRetried || AUTH_ENDPOINT.test(config.url ?? '')) throw error;

  const session = await refreshSession();
  if (!session) throw error;
  return http.request({ ...config, authRetried: true } as RetryableConfig);
});

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** Performs a request and unwraps the success envelope, or throws ApiClientError. */
export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await http.request<ApiSuccess<T>>(config);
    return response.data.data;
  } catch (error) {
    throw toApiClientError(error);
  }
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export async function apiRequestPaginated<T>(
  config: AxiosRequestConfig,
): Promise<PaginatedResult<T>> {
  try {
    const response = await http.request<ApiSuccess<T[]>>(config);
    const meta = response.data.meta ?? {
      page: 1,
      pageSize: response.data.data.length,
      total: response.data.data.length,
      totalPages: 1,
    };
    return { items: response.data.data, meta };
  } catch (error) {
    throw toApiClientError(error);
  }
}

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'GET', url }),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'POST', url, data }),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'PATCH', url, data }),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'PUT', url, data }),
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    apiRequest<T>({ ...config, method: 'DELETE', url }),
  paginated: apiRequestPaginated,
};
