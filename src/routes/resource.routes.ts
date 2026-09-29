import { Router } from 'express';
import { listResourcesController } from '../controllers/resource.controller';

export const resourceRouter = Router();
resourceRouter.get('/resources', listResourcesController);
