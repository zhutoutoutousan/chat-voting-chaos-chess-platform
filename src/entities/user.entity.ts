import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Lobby } from './lobby.entity';
import { Player } from './player.entity';
import { Game } from './game.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ default: 1500 })
  rating: number;

  @OneToMany(() => Lobby, lobby => lobby.host)
  hostedLobbies: Lobby[];

  @OneToMany(() => Game, game => game.user)
  games: Game[];

  @OneToMany(() => Player, player => player.user)
  players: Player[];
} 