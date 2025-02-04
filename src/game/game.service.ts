import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../entities/game.entity';
import { Socket } from 'socket.io';

@Injectable()
export class GameService {
  private gameConnections = new Map<string, Map<string, Socket>>();

  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
  ) {}

  async joinGame(gameId: string, userId: string, client: Socket) {
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['players'],
    });

    if (!game) {
      throw new Error('Game not found');
    }

    // Store connection
    if (!this.gameConnections.has(gameId)) {
      this.gameConnections.set(gameId, new Map());
    }
    this.gameConnections.get(gameId)?.set(userId, client);

    // Send initial game state
    client.emit('game_state', {
      type: 'game_state',
      state: game,
    });

    return game;
  }

  async leaveGame(client: Socket) {
    // Clean up connection
    for (const [gameId, connections] of this.gameConnections.entries()) {
      for (const [userId, socket] of connections.entries()) {
        if (socket === client) {
          connections.delete(userId);
          if (connections.size === 0) {
            this.gameConnections.delete(gameId);
          }
          break;
        }
      }
    }
  }

  async makeMove(gameId: string, userId: string, move: any) {
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
      relations: ['players'],
    });

    if (!game) {
      throw new Error('Game not found');
    }

    // Validate move
    // Update game state
    game.fen = move.fen;
    await this.gameRepository.save(game);

    // Broadcast move to all players
    const connections = this.gameConnections.get(gameId);
    if (connections) {
      for (const socket of connections.values()) {
        socket.emit('move', {
          type: 'move',
          move,
        });
      }
    }
  }

  async sendMessage(gameId: string, userId: string, text: string) {
    const connections = this.gameConnections.get(gameId);
    if (connections) {
      for (const socket of connections.values()) {
        socket.emit('message', {
          type: 'message',
          message: {
            text,
            userId,
            timestamp: Date.now(),
          },
        });
      }
    }
  }
} 