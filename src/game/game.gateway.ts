import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as Ably from 'ably';
import { ConfigService } from '@nestjs/config';
import { GameService } from './game.service';

@Injectable()
export class GameGateway implements OnModuleInit {
  private readonly logger = new Logger(GameGateway.name);
  private ably: Ably.Realtime;

  constructor(
    private configService: ConfigService,
    private gameService: GameService,
  ) {
    const ablyKey = this.configService.get<string>('ABLY_API_KEY');
    if (!ablyKey) {
      this.logger.error('Ably API key not configured');
      return;
    }

    try {
      this.ably = new Ably.Realtime({
        key: ablyKey,
        clientId: 'game-gateway'
      });
    } catch (error) {
      this.logger.error('Failed to initialize Ably client:', error);
    }
  }

  onModuleInit() {
    if (!this.ably) {
      this.logger.error('Ably client not initialized');
      return;
    }

    const gameChannel = this.ably.channels.get('game:*');
    
    gameChannel.subscribe((message) => {
      this.handleMessage(gameChannel, message).catch(error => {
        this.logger.error('Error handling message:', error);
      });
    });
  }

  private async handleMessage(channel: Ably.RealtimeChannel, message: Ably.Message) {
    try {
      const channelName = channel.name;
      const gameId = channelName.split(':')[1];

      if (!gameId) {
        this.logger.error('Invalid channel name format:', channelName);
        return;
      }

      if (!message.name) {
        this.logger.error('Message has no name:', message);
        return;
      }

      switch (message.name) {
        case 'move':
          await this.handleMove(gameId, message.data);
          break;
        case 'join':
          await this.handleJoin(gameId, message.data);
          break;
        case 'leave':
          await this.handleLeave(gameId, message.data);
          break;
        case 'message':
          await this.handleGameMessage(gameId, message.data);
          break;
        case 'get_active_games':
          try {
            const activeGames = await this.gameService.getActiveGames();
            channel.publish('active_games', { games: activeGames });
          } catch (error) {
            this.logger.error('Failed to get active games:', error);
          }
          break;
        case 'get_game_state':
          try {
            const game = await this.gameService.getGameState(gameId);
            channel.publish('game_state', game);
          } catch (error) {
            this.logger.error('Failed to get game state:', error);
          }
          break;
      }
    } catch (error) {
      this.logger.error('Error handling game message:', error);
    }
  }

  private async handleMove(gameId: string, data: any) {
    try {
      const { userId, move } = data;
      const gameState = await this.gameService.makeMove(gameId, userId, move);
      
      const channel = this.ably.channels.get(`game:${gameId}`);
      channel.publish('move_made', gameState);
    } catch (error) {
      this.logger.error('Move error:', error);
    }
  }

  private async handleJoin(gameId: string, data: any) {
    try {
      const { userId } = data;
      await this.gameService.joinGame(gameId, userId);
      
      const channel = this.ably.channels.get(`game:${gameId}`);
      channel.publish('player_joined', { userId });
    } catch (error) {
      this.logger.error('Join error:', error);
    }
  }

  private async handleLeave(gameId: string, data: any) {
    try {
      const { userId } = data;
      await this.gameService.leaveGame(gameId, userId);
      
      const channel = this.ably.channels.get(`game:${gameId}`);
      channel.publish('player_left', { userId });
    } catch (error) {
      this.logger.error('Leave error:', error);
    }
  }

  private async handleGameMessage(gameId: string, data: any) {
    try {
      const { userId, text } = data;
      await this.gameService.sendMessage(gameId, userId, text);
      
      const channel = this.ably.channels.get(`game:${gameId}`);
      channel.publish('message_sent', { userId, text });
    } catch (error) {
      this.logger.error('Message error:', error);
    }
  }
} 