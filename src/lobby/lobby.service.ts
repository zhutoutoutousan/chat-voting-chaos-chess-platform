import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLobbyDto } from './dto/create-lobby.dto';

@Injectable()
export class LobbyService {
  private connections = new Map<string, Socket>();
  private matchmakingQueue = new Map<string, { rating: number; timestamp: number }>();

  constructor(private prisma: PrismaService) {
    // Check matchmaking queue periodically
    setInterval(() => this.processMatchmakingQueue(), 5000);
  }

  async addConnection(userId: string, socket: Socket) {
    this.connections.set(userId, socket);
  }

  async removeConnection(userId: string) {
    this.connections.delete(userId);
  }

  async createLobby(userId: string, data: CreateLobbyDto) {
    const lobby = await this.prisma.lobby.create({
      data: {
        hostId: userId,
        timeControl: data.timeControl,
        mode: data.mode,
      },
      include: {
        host: true,
      },
    });
    return lobby;
  }

  async joinLobby(userId: string, lobbyId: string) {
    const lobby = await this.prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: { host: true },
    });

    if (!lobby) throw new Error('Lobby not found');

    // Create a new game
    const game = await this.prisma.game.create({
      data: {
        whiteId: lobby.hostId,
        blackId: userId,
        timeControl: lobby.timeControl,
        mode: lobby.mode,
      },
      include: {
        white: true,
        black: true,
      },
    });

    // Delete the lobby
    await this.prisma.lobby.delete({ where: { id: lobbyId } });

    return game;
  }

  async addToMatchmaking(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { rating: true },
    });

    this.matchmakingQueue.set(userId, {
      rating: user.rating,
      timestamp: Date.now(),
    });
  }

  async removeFromMatchmaking(userId: string) {
    this.matchmakingQueue.delete(userId);
  }

  private async processMatchmakingQueue() {
    if (this.matchmakingQueue.size < 2) return;

    const players = Array.from(this.matchmakingQueue.entries());
    
    // Sort by waiting time
    players.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Simple matching for now - match players with similar ratings
    for (let i = 0; i < players.length - 1; i++) {
      const [player1Id, player1Data] = players[i];
      const [player2Id, player2Data] = players[i + 1];

      // Match if rating difference is less than 200 or waiting time > 30 seconds
      const ratingDiff = Math.abs(player1Data.rating - player2Data.rating);
      const waitingTime = Date.now() - Math.min(player1Data.timestamp, player2Data.timestamp);

      if (ratingDiff < 200 || waitingTime > 30000) {
        // Create game
        const game = await this.createGame(player1Id, player2Id);
        
        // Remove from queue
        this.matchmakingQueue.delete(player1Id);
        this.matchmakingQueue.delete(player2Id);

        // Notify players
        const socket1 = this.connections.get(player1Id);
        const socket2 = this.connections.get(player2Id);

        if (socket1) socket1.emit('match_found', game);
        if (socket2) socket2.emit('match_found', game);

        i++; // Skip next player as they're matched
      }
    }
  }

  private async createGame(player1Id: string, player2Id: string) {
    // Randomly assign colors
    const isPlayer1White = Math.random() > 0.5;
    const [whiteId, blackId] = isPlayer1White 
      ? [player1Id, player2Id]
      : [player2Id, player1Id];

    return await this.prisma.game.create({
      data: {
        whiteId,
        blackId,
        timeControl: '10+0', // Default time control
        mode: 'Rated',
      },
      include: {
        white: true,
        black: true,
      },
    });
  }
} 