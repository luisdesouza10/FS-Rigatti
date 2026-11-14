import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './db/connection';

async function main() {
  await connectDatabase(env.MONGO_URI);
  const server = createApp().listen(env.PORT, () => {
    logger.info(`🚀 API listening on http://localhost:${env.PORT} (model: ${env.ANTHROPIC_MODEL})`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down…`);
    server.close(() => {
      disconnectDatabase().then(
        () => process.exit(0),
        () => process.exit(1),
      );
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start the API');
  process.exit(1);
});
