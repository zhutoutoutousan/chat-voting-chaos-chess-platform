import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  // Create custom logger instance
  const logger = new Logger('Bootstrap');

  // Create app with explicit logging configuration
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: false  // Disable log buffering
  });
  
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  // Add startup logging
  logger.log(`Application is running on port ${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV}`);
  logger.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
}

// Add error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

bootstrap().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
