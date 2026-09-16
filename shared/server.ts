import { configuration } from '../packages/runtime/config.js';
import { listen } from '../packages/runtime/http.js';
import { createCore } from './app.js';

const config = configuration();
await listen(await createCore(config), config.CORE_PORT, config.HOST);
