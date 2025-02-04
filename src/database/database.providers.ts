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
            max: 1,
            idleTimeoutMillis: 10000,
            connectTimeoutMS: 5000,
            keepalive: true,
            keepaliveInitialDelayMillis: 10000
          },
          poolSize: 1,
          connectTimeoutMS: 5000,
          maxQueryExecutionTime: 5000,
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