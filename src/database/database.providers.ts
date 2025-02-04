import { createConnection } from 'typeorm';
import { Logger } from '@nestjs/common';

export const databaseProviders = [
  {
    provide: 'DATABASE_CONNECTION',
    useFactory: async () => {
      const logger = new Logger('DatabaseProvider');
      
      try {
        const connection = await createConnection({
          type: 'postgres',
          url: process.env.DATABASE_URL,
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          synchronize: process.env.NODE_ENV !== 'production',
          ssl: {
            rejectUnauthorized: false
          },
          extra: {
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
          },
          logging: ['error', 'warn'],
        });
        
        logger.log('Database connection established');
        return connection;
      } catch (error) {
        logger.error('Database connection failed:', error);
        throw error;
      }
    },
  },
]; 