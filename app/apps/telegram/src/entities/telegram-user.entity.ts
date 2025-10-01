import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('telegram_users')
export class TelegramUserEntity {
  @PrimaryColumn({ type: 'bigint' })
  telegramId: number;

  @Column({ type: 'uuid', unique: true, generated: 'uuid' })
  userId: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  languageCode: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
