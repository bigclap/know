import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('telegram_message_map')
export class TelegramMessageMapEntity {
  @PrimaryColumn('uuid')
  viewId: string;

  @Column({ type: 'bigint' })
  chatId: number;

  @Column({ type: 'bigint' })
  messageId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
