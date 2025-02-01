import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Game } from './game.entity';
import { Move } from './move.entity';

@Entity()
export class Player {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  gameId: string;

  @Column()
  color: string;

  @ManyToOne(() => User, user => user.players)
  user: User;

  @ManyToOne(() => Game, game => game.players)
  game: Game;

  @OneToMany(() => Move, move => move.player)
  moves: Move[];
} 