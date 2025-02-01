import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthService } from './auth.service';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = client.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        throw new WsException('Unauthorized');
      }

      const user = await this.authService.validateToken(token);
      if (!user) {
        throw new WsException('Invalid token');
      }

      // Attach user data to socket
      client.data.userId = user.id;
      client.data.user = user;
      return true;
    } catch (err) {
      throw new WsException('Unauthorized');
    }
  }
} 