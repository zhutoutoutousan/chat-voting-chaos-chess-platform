import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

class CustomIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: any) {
    console.log('Creating IO Server with options:', {
      port,
      frontendUrl: process.env.FRONTEND_URL,
      nodeEnv: process.env.NODE_ENV,
      options
    });

    console.log(process.env.FRONTEND_URL)
    console.log(process.env.NODE_ENV)

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

    server.on('connection', (socket) => {
      console.log('Socket connected:', {
        id: socket.id,
        handshake: {
          query: socket.handshake.query,
          headers: socket.handshake.headers,
          auth: socket.handshake.auth
        }
      });
    });

    server.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });

    server.on('error', (err) => {
      console.error('Socket server error:', err);
    });

    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'debug', 'log', 'verbose'],
  });
  
  console.log('Configuring CORS with:', {
    frontendUrl: process.env.FRONTEND_URL,
    nodeEnv: process.env.NODE_ENV
  });

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useWebSocketAdapter(new CustomIoAdapter(app));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Application is running on port ${port}`);
}
bootstrap();
