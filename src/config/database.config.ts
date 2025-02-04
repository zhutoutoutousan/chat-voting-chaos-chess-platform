import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  const isProduction = configService.get('NODE_ENV') === 'production';
  
  return {
    type: 'postgres',
    url: isProduction ? configService.get('DIRECT_URL') : configService.get('DATABASE_URL'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: !isProduction,
    ssl: isProduction ? {
      rejectUnauthorized: false,
      ca: configService.get('SSL_CA'),
      key: configService.get('SSL_KEY'),
      cert: configService.get('SSL_CERT'),
    } : false,
    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  };
}; 