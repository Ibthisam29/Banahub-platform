import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error('DATABASE_URL is not defined');

  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error:', err));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
}
