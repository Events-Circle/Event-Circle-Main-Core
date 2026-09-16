import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  ValidationPipe,
  INestApplication,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import type { Runtime } from '../config/runtime.js';
@Catch()
export class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : (error as { code?: string })?.code === 'P2002'
          ? 409
          : 500;
    if (status === 500)
      console.error(
        'Request failure',
        (error as { name?: string; code?: string }).name,
        (error as { code?: string }).code,
      );
    res.status(status).json({
      error: status === 500 ? 'INTERNAL_ERROR' : `HTTP_${status}`,
      requestId: res.getHeader('X-Request-Id'),
    });
  }
}
export function configureHttp(app: INestApplication, config: Runtime) {
  app.setGlobalPrefix('api/v1');
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', config.trustProxy.length ? config.trustProxy : false);
  app.use(helmet());
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Request-Id', randomUUID());
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableCors({ origin: config.cors, credentials: false });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      disableErrorMessages: true,
    }),
  );
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
}
