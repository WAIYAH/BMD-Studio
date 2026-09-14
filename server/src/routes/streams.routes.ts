import { Router } from 'express';
import { liveStreams } from '../controllers/broadcast.controller.js';

export const streamsRouter: Router = Router();

// Public. Creating, starting and stopping streams needs Phase 3 permissions and
// a connected provider.
streamsRouter.get('/live', liveStreams);
