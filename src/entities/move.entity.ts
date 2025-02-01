import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Game } from './game.entity';
import { Player } from './player.entity';

@Entity()
export class Move {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  gameId: string;

  @Column()
  playerId: string;

  @Column()
  from: string;

  @Column()
  to: string;

  @Column()
  piece: string;

  @ManyToOne(() => Game, game => game.moves)
  game: Game;

  @ManyToOne(() => Player, player => player.moves)
  player: Player;
} 