import 'dotenv/config';
import app from './app';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';
import { validateEnv } from './config/env';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    validateEnv();
    await connectDatabase();
    app.listen(PORT, () => {
      logger.info(`🚀 BANAHub API running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  } catch (err) {
    logger.error('Fatal startup error:', err);
    process.exit(1);
  }
}

bootstrap();
