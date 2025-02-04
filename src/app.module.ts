import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LobbyModule } from './lobby/lobby.module';
import { User } from './entities/user.entity';
import { Game } from './entities/game.entity';
import { Player } from './entities/player.entity';
import { Move } from './entities/move.entity';
import { Lobby } from './entities/lobby.entity';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [User, Game, Player, Move, Lobby],
      synchronize: true,
      ssl: {
        rejectUnauthorized: false
      },
      extra: {
        ssl: false
      }
    }),
    LobbyModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
