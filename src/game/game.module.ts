import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { Game } from '../entities/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Game])],
  providers: [GameGateway, GameService],
  exports: [GameService],
})
export class GameModule {} 