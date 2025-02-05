import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { LobbyService } from './lobby.service';
import { UseGuards } from '@nestjs/common';
import { WsAuthGuard } from '../auth/ws-auth.guard';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
@WebSocketGateway({
  namespace: '/lobby',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header", "Authorization"],
  },
  path: '/socket.io',
  transports: ['websocket'],
})
@UseGuards(WsAuthGuard)
export class LobbyGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LobbyGateway.name);
  private supabase: any;

  constructor(
    private configService: ConfigService,
    private lobbyService: LobbyService,
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
      
      this.logger.log('Supabase Realtime initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Supabase:', error);
      throw error;
    }
  }

  private setupRealtimeSubscriptions() {
    this.supabase
      .channel('lobby_updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'lobbies' },
        async (payload: any) => {
          try {
            const lobbies = await this.lobbyService.getAllLobbies();
            await this.broadcastLobbies(lobbies);
          } catch (error) {
            this.logger.error('Error handling lobby update:', error);
          }
        }
      )
      .subscribe();
  }

  private async broadcastLobbies(lobbies: any[]) {
    const channel = this.supabase.channel('lobby_broadcasts');
    await channel.send({
      type: 'broadcast',
      event: 'lobbies_update',
      payload: {
        lobbies: lobbies.map(lobby => ({
          id: lobby.id,
          hostId: lobby.hostId,
          hostName: lobby.hostName || 'Unknown',
          mode: lobby.mode,
          timeControl: lobby.timeControl,
          status: lobby.status,
          createdAt: lobby.createdAt,
          expiresAt: lobby.expiresAt,
          gameId: lobby.gameId
        }))
      }
    });
  }

  async handleConnection(client: Socket) {
    console.log('Client connected:', client.id);
    const userId = client.handshake.query.userId as string;
    if (!userId) {
      client.disconnect();
      return;
    }
    await this.lobbyService.addConnection(userId, client);
  }

  private async handleUserDisconnect(userId: string) {
    this.logger.log(`Handling user disconnect: ${userId}`);
    try {
      const lobby = await this.lobbyService.findLobbyByHostId(userId);
      if (lobby) {
        this.logger.log(`Removing lobby for disconnected user: ${userId}`, {
          lobbyId: lobby.id
        });
        await this.lobbyService.removeLobby(lobby.id);
      }
      await this.lobbyService.removeConnection(userId);
    } catch (error) {
      this.logger.error('Error handling user disconnect:', {
        error: error.message,
        stack: error.stack,
        userId,
        timestamp: new Date().toISOString()
      });
    }
  }

  @SubscribeMessage('create_lobby')
  async handleCreateLobby(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateLobbyDto
  ) {
    console.log('Received create_lobby event:', { clientId: client.id, payload });
    try {
      const userId = client.data.userId;
      if (!userId) {
        throw new Error('User ID is required');
      }

      const lobby = await this.lobbyService.createLobby(userId, payload);
      
      // Broadcast to all clients
      this.server.emit('lobby_created', lobby);
      
      // Send acknowledgment to creator
      return { event: 'create_lobby', data: { success: true, lobby } };
    } catch (error) {
      console.error('Create lobby error:', error);
      return { event: 'create_lobby', data: { success: false, error: error.message } };
    }
  }

  @SubscribeMessage('join_lobby')
  async handleJoinLobby(client: Socket, payload: { lobbyId: string }) {
    const userId = client.handshake.query.userId as string;
    const game = await this.lobbyService.joinLobby(userId, payload.lobbyId);
    
    // Notify about game creation
    client.emit('game_created', game.id);
    
    // Notify about lobby removal
    this.server.emit('lobby_removed', payload.lobbyId);
    
    return game;
  }

  @SubscribeMessage('find_match')
  async handleFindMatch(@ConnectedSocket() client: Socket) {
    await this.lobbyService.addToMatchmaking(client.data.userId);
    client.emit('matchmaking_status', { status: 'searching' });
  }

  @SubscribeMessage('cancel_matchmaking')
  async handleCancelMatchmaking(@ConnectedSocket() client: Socket) {
    await this.lobbyService.removeFromMatchmaking(client.data.userId);
    client.emit('matchmaking_status', { status: 'cancelled' });
  }

  // Required by OnGatewayDisconnect interface
  async handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      await this.handleUserDisconnect(userId);
    }
  }
} 