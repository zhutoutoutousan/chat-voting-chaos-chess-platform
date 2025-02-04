import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { Player } from './player.entity';
import { User } from './user.entity';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  timeControl: string;

  @Column()
  mode: string;

  @Column({
    type: 'enum',
    enum: ['waiting', 'active', 'finished'],
    default: 'waiting'
  })
  status: 'waiting' | 'active' | 'finished';

  @Column({ default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' })
  fen: string;

  @Column({ nullable: true })
  winner?: string;

  @Column({ type: 'varchar', nullable: true })
  whiteId: string | null;

  @Column({ type: 'varchar', nullable: true })
  blackId: string | null;

  @OneToMany(() => Player, player => player.game)
  players: Player[];

  @ManyToMany(() => User)
  @JoinTable()
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 