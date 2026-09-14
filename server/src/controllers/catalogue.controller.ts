import type { Request, Response } from 'express';
import { sendData } from '../lib/respond.js';
import { getEquipmentCatalogue } from '../services/equipment-catalogue.service.js';
import { getServiceCatalogue } from '../services/service-catalogue.service.js';

export async function serviceCatalogue(_req: Request, res: Response): Promise<void> {
  sendData(res, await getServiceCatalogue());
}

export async function equipmentCatalogue(_req: Request, res: Response): Promise<void> {
  sendData(res, await getEquipmentCatalogue());
}
