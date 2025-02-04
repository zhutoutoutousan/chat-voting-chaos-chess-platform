import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { LobbyGateway } from './lobby.gateway';
import { LobbyService } from './lobby.service';
import { AuthModule } from '../auth/auth.module';
import { User } from '../entities/user.entity';
import { Game } from '../entities/game.entity';
import { Player } from '../entities/player.entity';
import { Lobby } from '../entities/lobby.entity';
import { WsAuthGuard } from '../auth/ws-auth.guard';
import { LobbyController } from './lobby.controller';
import { GameModule } from '../game/game.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Game, Player, Lobby]),
    AuthModule,
    ConfigModule,
    GameModule
  ],
  controllers: [LobbyController],
  providers: [LobbyGateway, LobbyService, WsAuthGuard],
  exports: [LobbyService],
})
export class LobbyModule {} 