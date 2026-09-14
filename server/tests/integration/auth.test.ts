/**
 * Authentication: registration, sign-in, refresh rotation with reuse
 * detection, sign-out, and account checks on every request.
 *
 * Run against real PostgreSQL: rotation is a conditional update, and reuse
 * detection depends on rows an earlier request has already changed.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { API_PREFIX } from '@bmd/shared';
import { createApp } from '../../src/app.js';
import {
  PASSWORD,
  ensureCustomerRole,
  refreshCookieFrom,
  registerCustomer,
} from '../helpers/auth.js';
import { disconnectTestDb, testDb, truncateAll } from '../helpers/db.js';

const app = createApp();
const AUTH = `${API_PREFIX}/auth`;

const setCookies = (res: request.Response): string[] =>
  (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await truncateAll();
  await disconnectTestDb();
});

describe('POST /auth/register', () => {
  it('creates an active customer, signs them in and sets a locked-down refresh cookie', async () => {
    await ensureCustomerRole();

    const res = await request(app).post(`${AUTH}/register`).send({
      firstName: ' Wanjiku ',
      lastName: 'Kamau',
      email: 'Wanjiku@Example.test',
      phone: '0722 000 000',
      password: PASSWORD,
      acceptTerms: true,
    });

    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data).toMatchObject({
      accessToken: expect.any(String),
      expiresIn: expect.any(Number),
      user: {
        email: 'wanjiku@example.test',
        firstName: 'Wanjiku',
        lastName: 'Kamau',
        phone: '+254722000000',
        status: 'ACTIVE',
        emailVerified: false,
        roles: ['CUSTOMER'],
      },
    });
    expect(res.body.data.user.permissions).toContain('booking:create');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);

    const cookie = setCookies(res).find((value) => value.startsWith('bmd_rt='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

    const audit = await testDb.auditLog.findFirstOrThrow({ where: { action: 'auth.register' } });
    expect(audit.after).toEqual({ acceptedTerms: true });
  });

  it.each([
    ['a weak password', { password: 'short' }, 'password'],
    ['no acceptance of the terms', { acceptTerms: false }, 'acceptTerms'],
    ['an invalid phone number', { phone: '12345' }, 'phone'],
    ['an invalid email', { email: 'not-an-email' }, 'email'],
  ])('rejects %s', async (_label, override, path) => {
    const res = await request(app)
      .post(`${AUTH}/register`)
      .send({
        firstName: 'Amina',
        lastName: 'Otieno',
        email: 'amina@example.test',
        password: PASSWORD,
        acceptTerms: true,
        ...override,
      });

    expect(res.status).toBe(400);
    expect((res.body.error.details as Array<{ path: string }>).map((d) => d.path)).toContain(path);
  });

  it('refuses a second account for the same email', async () => {
    await registerCustomer(app, { email: 'taken@example.test' });

    const res = await request(app).post(`${AUTH}/register`).send({
      firstName: 'Amina',
      lastName: 'Otieno',
      email: 'TAKEN@example.test',
      password: PASSWORD,
      acceptTerms: true,
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
  });
});

describe('POST /auth/login', () => {
  it('signs in with the right password and records the sign-in', async () => {
    const { session } = await registerCustomer(app, { email: 'login@example.test' });

    const res = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: 'LOGIN@example.test', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(session.user.id);
    expect(refreshCookieFrom(res)).toMatch(/^bmd_rt=.+/);
    const user = await testDb.user.findUniqueOrThrow({ where: { id: session.user.id } });
    expect(user.lastLoginAt).not.toBeNull();
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    await registerCustomer(app, { email: 'login@example.test' });

    const wrong = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: 'login@example.test', password: 'not-the-password-1' });
    const unknown = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: 'nobody@example.test', password: PASSWORD });

    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      });
    }
  });

  it('reveals a suspended account only after the correct password', async () => {
    const { session } = await registerCustomer(app, { email: 'suspended@example.test' });
    await testDb.user.update({ where: { id: session.user.id }, data: { status: 'SUSPENDED' } });

    const wrong = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: 'suspended@example.test', password: 'not-the-password-1' });
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');

    const right = await request(app)
      .post(`${AUTH}/login`)
      .send({ email: 'suspended@example.test', password: PASSWORD });
    expect(right.status).toBe(403);
    expect(right.body.error.code).toBe('ACCOUNT_INACTIVE');
  });
});

describe('GET /auth/me', () => {
  it('returns the principal for a valid access token only', async () => {
    const { accessToken, session } = await registerCustomer(app);

    const ok = await request(app).get(`${AUTH}/me`).set('Authorization', `Bearer ${accessToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.id).toBe(session.user.id);

    const missing = await request(app).get(`${AUTH}/me`);
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('UNAUTHENTICATED');

    const forged = await request(app).get(`${AUTH}/me`).set('Authorization', 'Bearer not.a.token');
    expect(forged.status).toBe(401);
    expect(forged.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('ends access on the very next request when the account is suspended', async () => {
    const { accessToken, session } = await registerCustomer(app);
    await testDb.user.update({ where: { id: session.user.id }, data: { status: 'SUSPENDED' } });

    const res = await request(app).get(`${AUTH}/me`).set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const { cookie } = await registerCustomer(app);

    const first = await request(app).post(`${AUTH}/refresh`).set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(first.body.data.accessToken).toEqual(expect.any(String));

    const rotated = refreshCookieFrom(first);
    expect(rotated).not.toBe(cookie);
    expect((await request(app).post(`${AUTH}/refresh`).set('Cookie', rotated)).status).toBe(200);
  });

  it('treats an immediate second use of a rotated token as two tabs racing', async () => {
    const { cookie } = await registerCustomer(app);
    await request(app).post(`${AUTH}/refresh`).set('Cookie', cookie);

    const race = await request(app).post(`${AUTH}/refresh`).set('Cookie', cookie);

    expect(race.status).toBe(409);
    expect(race.body.error.code).toBe('CONFLICT');
  });

  it('ends the whole sign-in when a rotated token is replayed later', async () => {
    const { cookie, session } = await registerCustomer(app);
    const rotated = await request(app).post(`${AUTH}/refresh`).set('Cookie', cookie);
    const currentCookie = refreshCookieFrom(rotated);

    // Age the rotation past the grace window for concurrent tabs.
    await testDb.session.updateMany({
      where: { userId: session.user.id, revokedReason: 'rotated' },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    const replay = await request(app).post(`${AUTH}/refresh`).set('Cookie', cookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('SESSION_REVOKED');

    // Both the thief and the legitimate holder are now locked out.
    expect((await request(app).post(`${AUTH}/refresh`).set('Cookie', currentCookie)).status).toBe(
      401,
    );
    const me = await request(app)
      .get(`${AUTH}/me`)
      .set('Authorization', `Bearer ${rotated.body.data.accessToken as string}`);
    expect(me.status).toBe(401);
    expect(await testDb.auditLog.count({ where: { action: 'auth.session_reuse_detected' } })).toBe(
      1,
    );
  });

  it('answers 401 when there is no refresh cookie', async () => {
    const res = await request(app).post(`${AUTH}/refresh`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('POST /auth/logout', () => {
  it('ends the refresh session and every access token issued from it', async () => {
    const { cookie, accessToken } = await registerCustomer(app);

    const res = await request(app).post(`${AUTH}/logout`).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(setCookies(res).some((value) => value.startsWith('bmd_rt=;'))).toBe(true);
    expect((await request(app).post(`${AUTH}/refresh`).set('Cookie', cookie)).status).toBe(401);
    expect(
      (await request(app).get(`${AUTH}/me`).set('Authorization', `Bearer ${accessToken}`)).status,
    ).toBe(401);
  });
});
