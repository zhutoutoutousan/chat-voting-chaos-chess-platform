import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

class CustomIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header", "Authorization"],
      },
      allowEIO3: true,
      path: '/socket.io',
      transports: ['websocket'],
      pingInterval: 25000,
      pingTimeout: 20000,
      cookie: {
        name: "io",
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === 'production'
      }
    });
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useWebSocketAdapter(new CustomIoAdapter(app));

  await app.listen(process.env.PORT || 3001);
}
bootstrap();
