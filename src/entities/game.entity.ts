import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Player } from './player.entity';
import { Move } from './move.entity';

@Entity()
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: 'waiting' })
  status: string;

  @ManyToOne(() => User, user => user.games)
  user: User;

  @OneToMany(() => Player, player => player.game)
  players: Player[];

  @OneToMany(() => Move, move => move.game)
  moves: Move[];
} 