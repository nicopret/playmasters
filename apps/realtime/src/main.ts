import { startServer } from './server';

startServer().catch((err) => {
  console.error('Realtime service failed to start', err);
  process.exit(1);
});
