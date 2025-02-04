import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LobbyModule } from './lobby/lobby.module';
import { GameModule } from './game/game.module';
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
      envFilePath: ['.env', '.env.local'],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [User, Game, Player, Move, Lobby],
      synchronize: process.env.NODE_ENV !== 'production',
      ssl: {
        rejectUnauthorized: false
      },
      extra: {
        max: 1,
        idleTimeoutMillis: 10000,
        connectTimeoutMS: 5000,
        keepalive: true,
        keepaliveInitialDelayMillis: 10000
      },
      poolSize: 1,
      connectTimeoutMS: 5000,
      maxQueryExecutionTime: 5000,
      autoLoadEntities: true
    }),
    LobbyModule,
    GameModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
