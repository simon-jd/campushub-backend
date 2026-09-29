import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { healthRouter } from './routes/health.routes';

export const app = express();

app.use('/api/v1', healthRouter);
app.use(notFoundHandler);
app.use(errorHandler);
