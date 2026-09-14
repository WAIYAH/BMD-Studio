import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '@bmd/shared';
import {
  api,
  getAccessToken,
  http,
  refreshSession,
  setAccessToken,
  setSessionListener,
} from './api-client';
import { TEST_USER } from '@/test/render';

const SESSION: AuthSession = { accessToken: 'fresh-token', expiresIn: 900, user: TEST_USER };

const originalAdapter = http.defaults.adapter;

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  return { data, status, statusText: '', headers: {}, config };
}

function reject(config: InternalAxiosRequestConfig, status: number, code: string): never {
  throw new AxiosError(
    'Request failed',
    'ERR_BAD_REQUEST',
    config,
    null,
    respond(config, status, {
      success: false,
      error: { code, message: code },
      requestId: 'req-test',
    }),
  );
}

function useAdapter(adapter: AxiosAdapter) {
  http.defaults.adapter = adapter;
}

afterEach(() => {
  http.defaults.adapter = originalAdapter;
  setAccessToken(null);
  setSessionListener(null);
});

describe('refreshSession', () => {
  it('shares one renewal between concurrent callers', async () => {
    let calls = 0;
    useAdapter((config) => {
      calls += 1;
      return Promise.resolve(respond(config, 200, { success: true, data: SESSION }));
    });

    const [first, second] = await Promise.all([refreshSession(), refreshSession()]);

    expect(calls).toBe(1);
    expect(first).toEqual(SESSION);
    expect(second).toEqual(SESSION);
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('ends the local session when the refresh cookie is refused', async () => {
    const listener = vi.fn();
    setSessionListener(listener);
    setAccessToken('stale-token');
    useAdapter((config) => Promise.resolve(reject(config, 401, 'SESSION_REVOKED')));

    await expect(refreshSession()).resolves.toBeNull();

    expect(listener).toHaveBeenCalledWith(null);
    expect(getAccessToken()).toBeNull();
  });
});

describe('expired access tokens', () => {
  it('renews once and replays the request with the new token', async () => {
    setAccessToken('stale-token');
    const seen: string[] = [];
    useAdapter((config) => {
      if (config.url === '/auth/refresh') {
        return Promise.resolve(respond(config, 200, { success: true, data: SESSION }));
      }
      const authorization = String(config.headers.get('Authorization') ?? '');
      seen.push(authorization);
      if (authorization === 'Bearer stale-token') {
        return Promise.resolve(reject(config, 401, 'TOKEN_EXPIRED'));
      }
      return Promise.resolve(respond(config, 200, { success: true, data: { ok: true } }));
    });

    await expect(api.get('/me/dashboard')).resolves.toEqual({ ok: true });
    expect(seen).toEqual(['Bearer stale-token', 'Bearer fresh-token']);
  });

  it('does not try to renew for any other kind of refusal', async () => {
    setAccessToken('token');
    let refreshes = 0;
    useAdapter((config) => {
      if (config.url === '/auth/refresh') refreshes += 1;
      return Promise.resolve(reject(config, 403, 'FORBIDDEN'));
    });

    await expect(api.get('/me/dashboard')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(refreshes).toBe(0);
  });
});
