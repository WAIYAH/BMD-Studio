import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { API_PREFIX } from '@bmd/shared';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('GET /api/v1/health', () => {
  it('reports service liveness in the success envelope', async () => {
    const res = await request(app).get(`${API_PREFIX}/health`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status: 'ok',
      service: 'bmd-studio-api',
      environment: 'test',
      timezone: 'Africa/Nairobi',
    });
    expect(typeof res.body.data.uptimeSeconds).toBe('number');
  });

  it('echoes a correlation id on every response', async () => {
    const res = await request(app).get(`${API_PREFIX}/health`);
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('reuses a caller-supplied correlation id', async () => {
    const res = await request(app).get(`${API_PREFIX}/health`).set('X-Request-Id', 'trace-abc-123');
    expect(res.headers['x-request-id']).toBe('trace-abc-123');
  });

  it('ignores a malformed caller-supplied correlation id', async () => {
    const res = await request(app).get(`${API_PREFIX}/health`).set('X-Request-Id', 'bad id!!');
    expect(res.headers['x-request-id']).not.toBe('bad id!!');
  });
});

describe('GET /api/v1/health/ready', () => {
  it('lists dependency probes without claiming unwired dependencies are up', async () => {
    const res = await request(app).get(`${API_PREFIX}/health/ready`);

    expect([200, 503]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.checks)).toBe(true);

    const names = res.body.data.checks.map((check: { name: string }) => check.name);
    expect(names).toContain('database');
    expect(names).toContain('object-storage');

    for (const check of res.body.data.checks) {
      expect(['up', 'down', 'skipped']).toContain(check.status);
    }
  });
});

describe('error handling', () => {
  it('returns the failure envelope with a request id for unknown routes', async () => {
    const res = await request(app).get(`${API_PREFIX}/does-not-exist`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.requestId).toBeTruthy();
  });

  it('rejects malformed JSON with a validation error, not a stack trace', async () => {
    const res = await request(app)
      .post(`${API_PREFIX}/health`)
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('at ');
  });
});

describe('security headers', () => {
  it('sets hardened headers and hides the server implementation', async () => {
    const res = await request(app).get(`${API_PREFIX}/health`);

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });
});
