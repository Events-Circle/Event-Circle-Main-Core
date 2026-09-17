import { PrismaClient } from '../generated/client/index.js';
if (process.env.NODE_ENV === 'production') throw new Error('Development seed cannot run in production');
const db = new PrismaClient();
console.log('Foundation seed: no default accounts, credentials or grants are created.');
await db.$disconnect();
