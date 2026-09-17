import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureHttp } from './common/http.js';
import type { Runtime } from './config/runtime.js';
export async function createApp(config: Runtime) {
  const app = await NestFactory.create(AppModule.forRoot(config), {
    logger: config.nodeEnv === 'test' ? false : ['error', 'warn', 'log'],
    bodyParser: true,
  });
  configureHttp(app, config);
  return app;
}
export function specification(app: Awaited<ReturnType<typeof createApp>>) {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Events Circle API').setVersion('0.2.0').addBearerAuth().build(),
    { operationIdFactory: (controller, method) => `${controller}_${method}` },
  );
}
