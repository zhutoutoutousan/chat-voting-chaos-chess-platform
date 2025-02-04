import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.entity';
import { Game } from './game.entity';

@Entity()
export class Player {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column()
  color: 'white' | 'black';

  @ManyToOne(() => User, user => user.players)
  user: User;

  @ManyToOne(() => Game, game => game.players)
  game: Game;
} 