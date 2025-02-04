import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = client.handshake.query.token as string || 
                   client.handshake.auth?.token as string;

      if (!token) {
        client.emit('auth_error', { 
          type: 'NO_TOKEN',
          message: 'Authentication token is required' 
        });
        return false;
      }

      const publicKey = this.configService.get<string>('CLERK_PEM_PUBLIC_KEY');
      if (!publicKey) {
        throw new Error('CLERK_PEM_PUBLIC_KEY not configured');
      }

      try {
        // Verify the token with RS256 algorithm
        const decoded = verify(token, publicKey, {
          algorithms: ['RS256'],
          issuer: this.configService.get('CLERK_ISSUER'),
        }) as { sub: string };
        
        // Store the verified user data in the socket
        client.data.userId = decoded.sub;
        return true;

      } catch (tokenError: any) {
        if (tokenError.name === 'TokenExpiredError') {
          // Notify client to refresh token
          client.emit('auth_error', { 
            type: 'TOKEN_EXPIRED',
            message: 'Session expired, please refresh your token'
          });
        } else {
          // Other token verification errors
          client.emit('auth_error', { 
            type: 'INVALID_TOKEN',
            message: 'Invalid authentication token'
          });
        }
        return false;
      }

    } catch (err) {
      console.error('WsAuthGuard error:', err);
      throw new WsException(err.message);
    }
  }
} 