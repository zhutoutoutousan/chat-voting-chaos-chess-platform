import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

export type LobbyStatus = 'waiting' | 'full' | 'game_started';

@Entity()
export class Lobby {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  hostId: string;

  @Column()
  timeControl: string;

  @Column()
  mode: string;

  @Column({ type: 'varchar', default: 'waiting' })
  status: LobbyStatus;

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, user => user.hostedLobbies)
  host: User;
} 