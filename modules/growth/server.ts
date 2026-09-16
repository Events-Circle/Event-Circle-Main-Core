import { configuration } from '../../packages/runtime/config.js';
import { listen } from '../../packages/runtime/http.js';
import { createGrowth } from './app.js';

const config = configuration();
await listen(await createGrowth(config), config.GROWTH_PORT, config.HOST);
