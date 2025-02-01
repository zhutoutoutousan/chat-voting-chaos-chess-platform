import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity()
export class Lobby {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  hostId: string;

  @Column()
  timeControl: string;

  @Column()
  mode: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, user => user.hostedLobbies)
  host: User;
} 