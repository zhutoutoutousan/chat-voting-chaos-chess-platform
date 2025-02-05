import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { GameService } from './game.service';

@Injectable()
export class GameGateway implements OnModuleInit {
  private readonly logger = new Logger(GameGateway.name);
  private supabase: any;

  constructor(
    private configService: ConfigService,
    private gameService: GameService,
  ) {}

  async onModuleInit() {
    try {
      const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
      const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.setupRealtimeSubscriptions();
      
      this.logger.log('Supabase Realtime initialized for games');
    } catch (error) {
      this.logger.error('Failed to initialize Supabase:', error);
      throw error;
    }
  }

  private setupRealtimeSubscriptions() {
    this.supabase
      .channel('game_updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'games' },
        async (payload: any) => {
          try {
            const game = await this.gameService.findGameById(payload.new.id);
            await this.broadcastGameUpdate(game);
          } catch (error) {
            this.logger.error('Error handling game update:', error);
          }
        }
      )
      .subscribe();
  }

  private async broadcastGameUpdate(game: any) {
    const channel = this.supabase.channel('game_broadcasts');
    await channel.send({
      type: 'broadcast',
      event: 'game_update',
      payload: {
        id: game.id,
        fen: game.fen,
        turn: game.turn,
        status: game.status,
        winner: game.winner,
        players: game.players,
        timeControl: game.timeControl,
        mode: game.mode
      }
    });
  }

  async handleMove(gameId: string, userId: string, move: any) {
    try {
      const game = await this.gameService.makeMove(gameId, userId, move);
      await this.broadcastGameUpdate(game);
      return game;
    } catch (error) {
      this.logger.error('Error handling move:', error);
      throw error;
    }
  }
} 