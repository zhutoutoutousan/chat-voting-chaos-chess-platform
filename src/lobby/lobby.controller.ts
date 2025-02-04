import { Controller, Get } from '@nestjs/common';
import { LobbyService } from './lobby.service';

@Controller('lobbies')
export class LobbyController {
  constructor(private readonly lobbyService: LobbyService) {}

  @Get()
  async getAllLobbies() {
    return this.lobbyService.getAllLobbies();
  }

  @Get()
  async getLobbies() {
    try {
      const lobbies = await this.lobbyService.getActiveLobbies();
      return lobbies.map(lobby => ({
        id: lobby.id,
        hostId: lobby.hostId,
        mode: lobby.mode,
        timeControl: lobby.timeControl,
        status: lobby.status,
        createdAt: lobby.createdAt
      }));
    } catch (error) {
      console.error('Error getting lobbies:', error);
      throw error;
    }
  }
} 