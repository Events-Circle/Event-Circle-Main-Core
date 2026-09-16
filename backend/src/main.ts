import { SwaggerModule } from '@nestjs/swagger';
import { createApp, specification } from './app.js';
import { runtime } from './config/runtime.js';
const config = runtime();
const app = await createApp(config);
if (config.nodeEnv !== 'production') SwaggerModule.setup('api/docs', app, specification(app));
await app.listen(config.port, config.host);
