import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Player } from './player.entity';

@Entity()
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' })
  fen: string;

  @Column({ default: 'active' })
  status: 'active' | 'completed';

  @Column({ nullable: true })
  winner?: string;

  @Column()
  timeControl: string;

  @Column()
  mode: string;

  @OneToMany(() => Player, player => player.game)
  players: Player[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 