import type { Express } from 'express';
import request from 'supertest';
import { API_PREFIX, ROLES, ROLE_PERMISSIONS, type AuthSession } from '@bmd/shared';
import { testDb } from './db.js';

/** A password that satisfies the registration policy. */
export const PASSWORD = 'studio-pass-123';

let customerRoleReady: Promise<void> | undefined;

/**
 * The test database is migrated but never seeded, and registration needs the
 * CUSTOMER role. Roles and permissions survive truncation, so this runs once
 * per test file.
 */
export function ensureCustomerRole(): Promise<void> {
  customerRoleReady ??= (async () => {
    const keys = ROLE_PERMISSIONS.CUSTOMER;
    for (const key of keys) {
      await testDb.permission.upsert({
        where: { key },
        update: {},
        create: { key, resource: key.split(':')[0] ?? 'other' },
      });
    }
    const role = await testDb.role.upsert({
      where: { key: ROLES.CUSTOMER },
      update: {},
      create: { key: ROLES.CUSTOMER, name: 'Customer' },
    });
    const permissions = await testDb.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true },
    });
    await testDb.rolePermission.createMany({
      data: permissions.map(({ id }) => ({ roleId: role.id, permissionId: id })),
      skipDuplicates: true,
    });
  })();
  return customerRoleReady;
}

/** `bmd_rt=<token>` from a response's Set-Cookie header, ready to send back. */
export function refreshCookieFrom(res: request.Response): string {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((value) => value.startsWith('bmd_rt='));
  if (!cookie) throw new Error('The response did not set a refresh cookie.');
  return cookie.split(';')[0] ?? '';
}

export interface SignedIn {
  accessToken: string;
  cookie: string;
  session: AuthSession;
}

let counter = 0;

export async function registerCustomer(
  app: Express,
  overrides: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
  }> = {},
): Promise<SignedIn> {
  await ensureCustomerRole();
  counter += 1;

  const res = await request(app)
    .post(`${API_PREFIX}/auth/register`)
    .send({
      firstName: 'Wanjiku',
      lastName: 'Kamau',
      email: `customer${counter}@example.test`,
      password: PASSWORD,
      acceptTerms: true,
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`Registration failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const session = res.body.data as AuthSession;
  return { accessToken: session.accessToken, cookie: refreshCookieFrom(res), session };
}
