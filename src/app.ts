import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { healthRouter } from './routes/health.routes';
import { reservationRouter } from './routes/reservation.routes';
import { resourceRouter } from './routes/resource.routes';

export const app = express();

app.use('/api/v1', healthRouter);
app.use('/api/v1', resourceRouter);
app.use('/api/v1', reservationRouter);
app.use(notFoundHandler);
app.use(errorHandler);
