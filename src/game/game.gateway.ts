import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private gameService: GameService) {}

  async handleConnection(client: Socket) {
    const gameId = client.handshake.query.gameId as string;
    const userId = client.handshake.query.userId as string;
    
    if (!gameId || !userId) {
      client.disconnect();
      return;
    }

    await this.gameService.joinGame(gameId, userId, client);
  }

  async handleDisconnect(client: Socket) {
    await this.gameService.leaveGame(client);
  }

  @SubscribeMessage('move')
  async handleMove(client: Socket, payload: any) {
    const gameId = client.handshake.query.gameId as string;
    const userId = client.handshake.query.userId as string;
    
    await this.gameService.makeMove(gameId, userId, payload.move);
  }

  @SubscribeMessage('message')
  async handleMessage(client: Socket, payload: any) {
    const gameId = client.handshake.query.gameId as string;
    const userId = client.handshake.query.userId as string;
    
    await this.gameService.sendMessage(gameId, userId, payload.text);
  }
} 