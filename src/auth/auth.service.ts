import { Injectable } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private clerk;

  constructor(private configService: ConfigService) {
    this.clerk = createClerkClient({
      secretKey: this.configService.get<string>('CLERK_SECRET_KEY'),
    });
  }

  async validateToken(token: string) {
    try {
      const { sub: userId } = await this.clerk.verifyToken(token);
      const user = await this.clerk.users.getUser(userId);
      return user;
    } catch (error) {
      return null;
    }
  }
} 