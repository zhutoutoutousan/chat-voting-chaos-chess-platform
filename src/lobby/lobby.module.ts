import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LobbyGateway } from './lobby.gateway';
import { LobbyService } from './lobby.service';
import { AuthModule } from '../auth/auth.module';
import { User } from '../entities/user.entity';
import { Game } from '../entities/game.entity';
import { Player } from '../entities/player.entity';
import { Lobby } from '../entities/lobby.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Game, Player, Lobby]),
    AuthModule
  ],
  providers: [LobbyGateway, LobbyService],
})
export class LobbyModule {} 