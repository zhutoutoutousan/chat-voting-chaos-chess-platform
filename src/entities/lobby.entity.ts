import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

export type LobbyStatus = 'waiting' | 'full' | 'game_started';

@Entity('lobbies')
export class Lobby {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  hostId: string;

  @Column()
  mode: string;

  @Column()
  timeControl: string;

  @Column({
    type: 'enum',
    enum: ['waiting', 'active', 'finished'],
    default: 'waiting'
  })
  status: 'waiting' | 'active' | 'finished';

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'uuid', nullable: true })
  gameId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, user => user.hostedLobbies)
  host: User;

  @Column({ type: 'varchar', nullable: true })
  guestId?: string;

  @Column({ type: 'varchar', nullable: true })
  guestName?: string;

  @ManyToOne(() => User)
  guest?: User;
} 