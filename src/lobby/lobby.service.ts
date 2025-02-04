import { Injectable, Logger } from '@nestjs/common';
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
import { GameService } from '../game/game.service';

@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);
  private connections = new Map<string, Socket>();
  private matchmakingQueue = new Map<string, { rating: number; timestamp: number }>();

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Game) private gameRepo: Repository<Game>,
    @InjectRepository(Player) private playerRepo: Repository<Player>,
    @InjectRepository(Lobby) private lobbyRepo: Repository<Lobby>,
    private gameService: GameService
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

  async createLobby(userId: string, data: CreateLobbyDto): Promise<Lobby> {
    const existingLobby = await this.findLobbyByHostId(userId);
    if (existingLobby) {
      throw new Error('User already has an active lobby');
    }

    const lobby = this.lobbyRepo.create({
      hostId: userId,
      mode: data.mode,
      timeControl: data.timeControl,
      status: 'waiting',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // Expires in 30 minutes
    });

    try {
      await this.lobbyRepo.save(lobby);
      this.notifyLobbyUpdate();
      return lobby;
    } catch (error) {
      this.logger.error('Failed to create lobby:', error);
      throw new Error('Failed to create lobby');
    }
  }

  async joinLobby(userId: string, lobbyId: string) {
    this.logger.log('Joining lobby:', { userId, lobbyId });

    const lobby = await this.lobbyRepo.findOne({
      where: { id: lobbyId },
      select: {
        id: true,
        hostId: true,
        mode: true,
        timeControl: true,
        status: true
      }
    });

    if (!lobby) {
      throw new Error('Lobby not found');
    }

    if (lobby.status !== 'waiting') {
      throw new Error('Lobby is no longer available');
    }

    // Create a new game
    const game = await this.gameService.createGame({
      whiteId: lobby.hostId,
      blackId: userId === lobby.hostId ? null : userId,
      timeControl: lobby.timeControl,
      mode: lobby.mode
    });

    // Update lobby status and gameId
    await this.lobbyRepo.update(lobbyId, { 
      status: 'active',
      gameId: game.id
    });

    this.logger.log('Game created:', {
      gameId: game.id,
      whiteId: game.whiteId,
      blackId: game.blackId,
      mode: game.mode
    });

    // Update lobby with guest info
    lobby.guestId = userId;
    await this.lobbyRepo.save(lobby);

    this.notifyLobbyUpdate();
    return lobby;
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
    this.logger.log('Fetching active lobbies...');
    
    try {
      // First log the total count of lobbies
      const totalCount = await this.lobbyRepo.count();
      this.logger.log(`Total lobbies in database: ${totalCount}`);

      // Get all lobbies first to check what we have
      const allLobbies = await this.lobbyRepo.find();
      this.logger.log('All lobbies:', {
        count: allLobbies.length,
        lobbies: allLobbies.map(l => ({
          id: l.id,
          status: l.status,
          hostId: l.hostId,
          createdAt: l.createdAt
        }))
      });

      // Now get active lobbies
      const activeLobbies = await this.lobbyRepo.find({
        where: { status: 'waiting' },
        order: { createdAt: 'DESC' },
        select: {
          id: true,
          hostId: true,
          mode: true,
          timeControl: true,
          status: true,
          createdAt: true
        }
      });

      this.logger.log('Active lobbies found:', {
        count: activeLobbies.length,
        lobbies: activeLobbies.map(l => ({
          id: l.id,
          status: l.status,
          hostId: l.hostId,
          createdAt: l.createdAt
        }))
      });

      return activeLobbies;
    } catch (error) {
      this.logger.error('Error fetching active lobbies:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
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
    try {
      const expiredLobbies = await this.lobbyRepo.find({
        where: {
          expiresAt: LessThan(new Date()),
          status: 'waiting'
        }
      });

      for (const lobby of expiredLobbies) {
        await this.removeLobby(lobby.id);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired lobbies:', error);
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

  async findLobbyByHostId(userId: string): Promise<Lobby | null> {
    return this.lobbyRepo.findOne({
      where: { hostId: userId }
    });
  }

  async getAllLobbies() {
    try {
      const lobbies = await this.lobbyRepo.find({
        where: [
          { status: 'waiting' },
          { status: 'active' }
        ],
        relations: ['host'],
        order: {
          createdAt: 'DESC'
        }
      });

      return lobbies.map(lobby => ({
        id: lobby.id,
        hostId: lobby.hostId,
        mode: lobby.mode,
        timeControl: lobby.timeControl,
        status: lobby.status,
        createdAt: lobby.createdAt,
        expiresAt: lobby.expiresAt,
        hostName: lobby.host?.username || 'Unknown'
      }));
    } catch (error) {
      this.logger.error('Error fetching all lobbies:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      throw new Error('Failed to fetch lobbies');
    }
  }

  async terminateLobby(lobbyId: string, userId: string) {
    try {
      const lobby = await this.lobbyRepo.findOne({
        where: { id: lobbyId, hostId: userId },
        relations: ['host']
      });

      if (!lobby) {
        throw new Error('Lobby not found or you are not the host');
      }

      // If lobby is active and has an associated game, end it
      if (lobby.status === 'active' && lobby.gameId) {
        const game = await this.gameRepo.findOne({
          where: { id: lobby.gameId }
        });
        if (game) {
          game.status = 'finished';
          await this.gameRepo.save(game);
        }
      }

      await this.lobbyRepo.remove(lobby);
      this.notifyLobbyUpdate();
      
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to terminate lobby:', {
        error: error.message,
        lobbyId,
        userId,
        timestamp: new Date().toISOString()
      });
      throw new Error('Failed to terminate lobby');
    }
  }

  async initiateGame(lobbyId: string, userId: string) {
    try {
      const lobby = await this.lobbyRepo.findOne({
        where: { id: lobbyId, hostId: userId },
        relations: ['host']
      });

      if (!lobby) {
        throw new Error('Lobby not found or you are not the host');
      }

      if (lobby.status !== 'waiting') {
        throw new Error('Game can only be started from waiting state');
      }

      // Create a new game
      const game = await this.gameService.createGame({
        whiteId: lobby.hostId,
        blackId: lobby.guestId, // We need to add this field to Lobby entity
        timeControl: lobby.timeControl,
        mode: lobby.mode
      });

      // Update lobby with game info
      lobby.status = 'active';
      lobby.gameId = game.id;
      await this.lobbyRepo.save(lobby);

      this.notifyLobbyUpdate();
      return game;
    } catch (error) {
      this.logger.error('Failed to initiate game:', error);
      throw new Error('Failed to start game');
    }
  }
} 