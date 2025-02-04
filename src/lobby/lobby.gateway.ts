import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LobbyService } from './lobby.service';
import { UseGuards } from '@nestjs/common';
import { WsAuthGuard } from '../auth/ws-auth.guard';
import { CreateLobbyDto } from './dto/create-lobby.dto';

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
export class LobbyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly lobbyService: LobbyService) {}

  async handleConnection(client: Socket) {
    console.log('Client connected:', client.id);
    const userId = client.handshake.query.userId as string;
    if (!userId) {
      client.disconnect();
      return;
    }
    await this.lobbyService.addConnection(userId, client);
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = client.handshake.query.userId as string;
      const lobbyId = client.data.lobbyId;

      if (lobbyId) {
        // Clean up lobby if host disconnects
        const lobby = await this.lobbyService.getLobby(lobbyId);
        if (lobby && lobby.hostId === userId) {
          await this.lobbyService.removeLobby(lobbyId);
          this.server.emit('lobby_removed', lobbyId);
        }
      }

      await this.lobbyService.removeConnection(userId);
    } catch (error) {
      console.error('Disconnect error:', error);
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
} 