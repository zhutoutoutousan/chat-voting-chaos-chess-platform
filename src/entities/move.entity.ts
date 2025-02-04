import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Game } from './game.entity';

@Entity()
export class Move {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  from: string;

  @Column()
  to: string;

  @Column({ nullable: true })
  promotion?: string;

  @Column()
  fen: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Game)
  game: Game;
} 