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
import * as Ably from 'ably';
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
  private ably: Ably.Realtime;
  private channel: Ably.RealtimeChannel;

  constructor(
    private readonly lobbyService: LobbyService,
    private configService: ConfigService
  ) {
    const ablyKey = this.configService.get<string>('ABLY_API_KEY');
    if (!ablyKey) {
      this.logger.error('Ably API key not configured');
      return;
    }

    try {
      this.ably = new Ably.Realtime({
        key: ablyKey,
        clientId: 'lobby-gateway',
        logLevel: 4 // Enable detailed Ably logs
      });

      this.logger.log('Ably client created');
    } catch (error) {
      this.logger.error('Failed to initialize Ably client:', error);
    }
  }

  onModuleInit() {
    if (!this.ably) {
      this.logger.error('Ably client not initialized');
      return;
    }

    this.logger.log('Initializing LobbyGateway...');
    this.channel = this.ably.channels.get('lobby');
    
    // Log connection state changes
    this.ably.connection.on('connected', () => {
      this.logger.log('Connected to Ably');
    });

    this.ably.connection.on('disconnected', () => {
      this.logger.warn('Disconnected from Ably');
    });

    this.ably.connection.on('failed', (err) => {
      this.logger.error('Ably connection failed:', err);
    });

    // Presence logging
    this.channel.presence.subscribe('enter', (member) => {
      this.logger.log(`Member entered: ${member.clientId}`, {
        userId: member.data?.userId,
        timestamp: new Date().toISOString()
      });
    });

    this.channel.presence.subscribe('leave', async (member) => {
      this.logger.log(`Member left: ${member.clientId}`, {
        userId: member.data?.userId,
        timestamp: new Date().toISOString()
      });
      await this.handleUserDisconnect(member.clientId);
    });

    // Message handlers with detailed logging
    this.channel.subscribe('get_lobbies', async (message) => {
      this.logger.log('Received get_lobbies request', {
        connectionId: message.connectionId,
        clientId: message.clientId,
        timestamp: new Date().toISOString(),
        data: message.data
      });

      try {
        const lobbies = await this.lobbyService.getAllLobbies();
        this.logger.log('Fetched active lobbies', {
          count: lobbies.length,
          lobbies: lobbies.map(l => ({ 
            id: l.id, 
            status: l.status,
            hostId: l.hostId,
            createdAt: l.createdAt 
          }))
        });

        // Log the exact data we're publishing
        const publishData = { lobbies };
        this.logger.log('Publishing lobbies_update', {
          data: publishData,
          timestamp: new Date().toISOString()
        });

        await this.channel.publish('lobbies_update', publishData);
      } catch (error) {
        this.logger.error('Error fetching lobbies:', {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        
        await this.channel.publish('error', { 
          message: 'Failed to fetch lobbies',
          error: error.message 
        });
      }
    });

    this.channel.subscribe('create_lobby', async (message) => {
      this.logger.log('Received create_lobby request', {
        userId: message.data?.userId,
        data: message.data,
        timestamp: new Date().toISOString()
      });

      try {
        const { userId, data } = message.data;
        const lobby = await this.lobbyService.createLobby(userId, data);
        
        this.logger.log('Lobby created successfully', {
          lobbyId: lobby.id,
          userId,
          timestamp: new Date().toISOString()
        });

        await this.channel.publish('lobby_created', lobby);
      } catch (error) {
        this.logger.error('Create lobby error:', {
          error: error.message,
          stack: error.stack,
          userId: message.data?.userId,
          timestamp: new Date().toISOString()
        });
        
        await this.channel.publish('error', { 
          type: 'CREATE_LOBBY_ERROR',
          message: error.message 
        });
      }
    });

    this.channel.subscribe('join_lobby', async (message) => {
      this.logger.log('Received join_lobby request', {
        userId: message.data?.userId,
        lobbyId: message.data?.lobbyId,
        timestamp: new Date().toISOString()
      });

      try {
        const { userId, lobbyId } = message.data;
        const game = await this.lobbyService.joinLobby(userId, lobbyId);
        
        this.logger.log('Game created from lobby join', {
          gameId: game.id,
          lobbyId,
          userId,
          timestamp: new Date().toISOString()
        });

        // Publish game creation event
        await this.channel.publish('game_created', { gameId: game.id });
        this.logger.log('Published game_created event', {
          gameId: game.id,
          timestamp: new Date().toISOString()
        });
        
        // Remove the lobby since a game was created
        await this.channel.publish('lobby_removed', { lobbyId });
        this.logger.log('Published lobby_removed event', {
          lobbyId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Join lobby error:', {
          error: error.message,
          stack: error.stack,
          userId: message.data?.userId,
          lobbyId: message.data?.lobbyId,
          timestamp: new Date().toISOString()
        });
        
        await this.channel.publish('error', {
          type: 'JOIN_LOBBY_ERROR',
          message: error.message
        });
      }
    });

    this.channel.subscribe('terminate_lobby', async (message) => {
      try {
        const { userId, lobbyId } = message.data;
        await this.lobbyService.terminateLobby(lobbyId, userId);
        await this.channel.publish('lobby_terminated', { lobbyId });
      } catch (error) {
        this.logger.error('Terminate lobby error:', error);
        await this.channel.publish('error', { 
          type: 'TERMINATE_LOBBY_ERROR',
          message: error.message 
        });
      }
    });

    this.channel.subscribe('initiate_game', async (message) => {
      try {
        const { userId, lobbyId } = message.data;
        const game = await this.lobbyService.initiateGame(lobbyId, userId);
        await this.channel.publish('game_created', { gameId: game.id });
      } catch (error) {
        this.logger.error('Initiate game error:', error);
        await this.channel.publish('error', { 
          type: 'INITIATE_GAME_ERROR',
          message: error.message 
        });
      }
    });

    this.logger.log('LobbyGateway initialized successfully');
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
        await this.channel.publish('lobby_removed', { lobbyId: lobby.id });
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

  private async notifyLobbyUpdate() {
    try {
      const lobbies = await this.lobbyService.getAllLobbies();
      const channel = this.ably.channels.get('lobby');
      await channel.publish('lobbies_update', { lobbies });
    } catch (error) {
      this.logger.error('Failed to notify lobby update:', error);
    }
  }
} 