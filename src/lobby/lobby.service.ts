import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Game } from '../entities/game.entity';
import { Player } from '../entities/player.entity';
import { Lobby } from '../entities/lobby.entity';
import { Socket } from 'socket.io';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { Cron } from '@nestjs/schedule';
import { LessThan } from 'typeorm';

@Injectable()
export class LobbyService {
  private connections = new Map<string, Socket>();
  private matchmakingQueue = new Map<string, { rating: number; timestamp: number }>();

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Game) private gameRepo: Repository<Game>,
    @InjectRepository(Player) private playerRepo: Repository<Player>,
    @InjectRepository(Lobby) private lobbyRepo: Repository<Lobby>,
  ) {
    // Check matchmaking queue periodically
    setInterval(() => this.processMatchmakingQueue(), 5000);
  }

  async addConnection(userId: string, socket: Socket) {
    this.connections.set(userId, socket);
  }

  async removeConnection(userId: string) {
    this.connections.delete(userId);
  }

  private debugLog(socket: Socket, message: string, data?: any) {
    socket.emit('debug', { message, data, timestamp: new Date().toISOString() });
  }

  async createLobby(userId: string, data: CreateLobbyDto) {
    try {
      // Check if user exists, if not create them
      let user = await this.userRepo.findOne({ where: { id: userId } });
      
      if (!user) {
        user = this.userRepo.create({
          id: userId,
          username: `Player_${userId.slice(-6)}`,
          email: '',
        });
        await this.userRepo.save(user);
      }

      // Check for existing active lobby
      const existingLobby = await this.lobbyRepo.findOne({
        where: { 
          hostId: userId,
          status: 'waiting'
        }
      });

      if (existingLobby) {
        throw new Error('User already has an active lobby');
      }

      // Create new lobby
      const lobby = this.lobbyRepo.create({
        hostId: userId,
        timeControl: data.timeControl,
        mode: data.mode,
        status: 'waiting',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      const savedLobby = await this.lobbyRepo.save(lobby);
      return savedLobby;
    } catch (error) {
      console.error('Create lobby error:', error);
      throw error;
    }
  }

  async joinLobby(userId: string, lobbyId: string) {
    const lobby = await this.lobbyRepo.findOne({
      where: { id: lobbyId, status: 'waiting' }
    });

    if (!lobby) {
      throw new Error('Lobby not found or no longer available');
    }

    if (lobby.hostId === userId) {
      throw new Error('Cannot join your own lobby');
    }

    // Create the game
    const game = this.gameRepo.create({
      timeControl: lobby.timeControl,
      mode: lobby.mode,
      status: 'active',
    });
    await this.gameRepo.save(game);

    // Create players
    const players = [
      this.playerRepo.create({
        userId: lobby.hostId,
        color: 'white',
        game,
      }),
      this.playerRepo.create({
        userId,
        color: 'black',
        game,
      }),
    ];
    await this.playerRepo.save(players);

    // Update lobby status
    lobby.status = 'game_started';
    await this.lobbyRepo.save(lobby);

    return game;
  }

  private notifyLobbyUpdate() {
    // Get all active lobbies and emit to all connected clients
    this.getActiveLobbies().then(lobbies => {
      const sockets = Array.from(this.connections.values());
      sockets.forEach(socket => {
        socket.emit('lobbies', lobbies);
      });
    });
  }

  async getActiveLobbies() {
    return this.lobbyRepo.find({
      where: { status: 'waiting' },
      order: { createdAt: 'DESC' },
    });
  }

  async addToMatchmaking(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['rating'],
    });

    this.matchmakingQueue.set(userId, {
      rating: user!.rating,
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
        const game = await this.createGame(player1Id, player2Id, {
          timeControl: '5+0',
          mode: 'standard',
        });
        
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

  async createGame(
    player1Id: string,
    player2Id: string,
    options: { timeControl: string; mode: string }
  ) {
    const game = this.gameRepo.create({
      timeControl: options.timeControl,
      mode: options.mode,
      status: 'active',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    });
    await this.gameRepo.save(game);

    const players = [
      this.playerRepo.create({ userId: player1Id, color: 'white', game }),
      this.playerRepo.create({ userId: player2Id, color: 'black', game }),
    ];
    await this.playerRepo.save(players);

    return game;
  }

  // Add a method to clean up expired lobbies
  @Cron('*/5 * * * *') // Run every 5 minutes
  async cleanupExpiredLobbies() {
    const expiredLobbies = await this.lobbyRepo.find({
      where: {
        expiresAt: LessThan(new Date())
      }
    });

    for (const lobby of expiredLobbies) {
      await this.lobbyRepo.remove(lobby);
      this.notifyLobbyUpdate();
    }
  }

  async getLobby(lobbyId: string) {
    return this.lobbyRepo.findOne({
      where: { id: lobbyId },
      relations: ['host']
    });
  }

  async removeLobby(lobbyId: string) {
    const lobby = await this.getLobby(lobbyId);
    if (lobby) {
      await this.lobbyRepo.remove(lobby);
      this.notifyLobbyUpdate();
    }
  }
} 