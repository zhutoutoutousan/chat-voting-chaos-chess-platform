import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { Game } from '../entities/game.entity';
import { Player } from '../entities/player.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, Player]),
    ConfigModule
  ],
  providers: [GameService, GameGateway],
  exports: [GameService],
})
export class GameModule {} 