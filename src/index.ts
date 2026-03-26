import { loadConfig, validateConfig } from './config.js';
import { buildServer } from './server.js';

const config = loadConfig();
validateConfig(config);
const server = await buildServer();

server.listen({ port: config.port, host: config.host }, (err, address) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
  server.log.info(`${config.serviceName} listening at ${address}`);
});

// Graceful shutdown
const shutdown = async () => {
  server.log.info('Shutting down...');
  await server.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
