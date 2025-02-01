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
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
})
@UseGuards(WsAuthGuard)
export class LobbyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly lobbyService: LobbyService) {}

  async handleConnection(client: Socket) {
    const userId = client.data.userId;
    if (!userId) {
      client.disconnect();
      return;
    }
    await this.lobbyService.addConnection(userId, client);
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      await this.lobbyService.removeConnection(userId);
      await this.lobbyService.removeFromMatchmaking(userId);
    }
  }

  @SubscribeMessage('create_lobby')
  async handleCreateLobby(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CreateLobbyDto,
  ) {
    const lobby = await this.lobbyService.createLobby(client.data.userId, data);
    this.server.emit('lobby_created', lobby);
    return lobby;
  }

  @SubscribeMessage('join_lobby')
  async handleJoinLobby(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { lobbyId: string },
  ) {
    const game = await this.lobbyService.joinLobby(client.data.userId, data.lobbyId);
    this.server.emit('game_started', game);
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