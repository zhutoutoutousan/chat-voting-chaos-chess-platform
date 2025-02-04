import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../entities/game.entity';
import { Player } from '../entities/player.entity';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(Game)
    private gameRepo: Repository<Game>,
    @InjectRepository(Player)
    private playerRepo: Repository<Player>,
  ) {}

  async createGame(data: {
    whiteId: string;
    blackId: string | null;
    timeControl: string;
    mode: string;
  }): Promise<Game> {
    const game = this.gameRepo.create({
      timeControl: data.timeControl,
      mode: data.mode,
      status: 'active' as const,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      whiteId: data.whiteId,
      blackId: data.blackId || null,
    } as Partial<Game>);

    await this.gameRepo.save(game);

    // Create players
    const players = [
      this.playerRepo.create({
        userId: data.whiteId,
        color: 'white',
        game,
      })
    ];

    if (data.blackId) {
      players.push(
        this.playerRepo.create({
          userId: data.blackId,
          color: 'black',
          game,
        })
      );
    }

    await this.playerRepo.save(players);
    return game;
  }

  async getGameState(gameId: string) {
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ['players'],
    });

    if (!game) {
      throw new Error('Game not found');
    }

    const white = game.players.find(p => p.color === 'white');
    const black = game.players.find(p => p.color === 'black');

    return {
      id: game.id,
      fen: game.fen,
      status: game.status,
      mode: game.mode,
      timeControl: game.timeControl,
      players: {
        white: white?.userId || null,
        black: black?.userId || null,
      },
      turn: game.fen.split(' ')[1] as 'w' | 'b',
    };
  }

  async makeMove(gameId: string, userId: string, move: any) {
    // Implement move logic
    return this.getGameState(gameId);
  }

  async getActiveGames(): Promise<Game[]> {
    return this.gameRepo.find({
      where: {
        status: 'active', // Add this status field to your Game entity if not exists
      },
      relations: ['players'],
    });
  }

  async joinGame(gameId: string, userId: string) {
    const game = await this.gameRepo.findOne({
      where: { id: gameId },
      relations: ['players'],
    });

    if (!game) {
      throw new Error('Game not found');
    }

    // Add player logic here
    game.status = 'active';
    await this.gameRepo.save(game);
    return game;
  }

  async leaveGame(gameId: string, userId: string) {
    // Remove player logic here
  }

  async sendMessage(gameId: string, userId: string, text: string) {
    // Message logic here
  }
} 