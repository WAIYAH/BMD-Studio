import type { Request, Response } from 'express';
import type { CancelRentalData, CreateRentalData, HireQuoteData } from '@bmd/shared';
import { ApiError } from '../lib/api-error.js';
import { requestContext } from '../lib/request-context.js';
import { sendData } from '../lib/respond.js';
import * as rentals from '../services/rental.service.js';
import type { AuthenticatedUser } from '../types/express.js';

function principal(req: Request): AuthenticatedUser {
  if (!req.user) throw ApiError.unauthenticated();
  return req.user;
}

export async function equipmentAvailability(req: Request, res: Response): Promise<void> {
  const { from, to } = req.query as unknown as { from: string; to: string };
  sendData(res, await rentals.getEquipmentAvailability(from, to));
}

export async function hireQuote(req: Request, res: Response): Promise<void> {
  sendData(res, await rentals.quoteHire(req.body as HireQuoteData));
}

export async function create(req: Request, res: Response): Promise<void> {
  const rental = await rentals.createRental(
    principal(req).id,
    req.body as CreateRentalData,
    requestContext(req),
  );
  sendData(res, rental, 201);
}

export async function detail(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  sendData(res, await rentals.getRentalDetail(principal(req).id, id));
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const rental = await rentals.cancelRental(
    principal(req).id,
    id,
    req.body as CancelRentalData,
    requestContext(req),
  );
  sendData(res, rental);
}
