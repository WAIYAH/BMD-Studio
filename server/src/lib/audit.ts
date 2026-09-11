import type { Prisma } from '@prisma/client';

/** Who made a request and from where, captured once at the controller edge. */
export interface RequestContext {
  ip?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  after?: Prisma.InputJsonValue;
}

/**
 * Builds an `audit_logs` row. Callers insert it inside the same transaction as
 * the change it records, so an audited mutation can never commit unrecorded.
 */
export function auditRow(entry: AuditEntry, ctx: RequestContext): Prisma.AuditLogUncheckedCreateInput {
  return {
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    actorId: entry.actorId ?? null,
    ...(entry.after !== undefined ? { after: entry.after } : {}),
    actorIp: ctx.ip ?? null,
    actorAgent: ctx.userAgent?.slice(0, 512) ?? null,
    requestId: ctx.requestId ?? null,
  };
}
