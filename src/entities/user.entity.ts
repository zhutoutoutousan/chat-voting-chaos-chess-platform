import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { Player } from './player.entity';
import { Lobby } from './lobby.entity';

@Entity()
export class User {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column()
  username: string;

  @Column()
  email: string;

  @Column({ default: 1200 })
  rating: number;

  @OneToMany(() => Player, player => player.user)
  players: Player[];

  @OneToMany(() => Lobby, lobby => lobby.host)
  hostedLobbies: Lobby[];
} 