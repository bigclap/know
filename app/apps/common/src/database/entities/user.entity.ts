import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '@common/ebca/bases/base.entity';
import { Entity as EbcaEntity } from '@common/ebca/decorators/entity.decorator';
import { UserAnsweredQuestionEntity } from './user-answered-question.entity';

@EbcaEntity()
@Entity('users')
export class UserEntity extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  declare id: string;

  @Column({ type: 'int', default: 1000, nullable: false })
  elo: number;

  @Column({
    type: 'varchar',
    length: 255,
    default: 'Новый Игрок',
    nullable: false,
  })
  nickname: string;

  @OneToMany(
    () => UserAnsweredQuestionEntity,
    (answeredQuestion: UserAnsweredQuestionEntity) => answeredQuestion.user,
  )
  answeredQuestions: UserAnsweredQuestionEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  constructor(id?: string) {
    super();
    if (id) {
      this.id = id;
    }
  }
}
