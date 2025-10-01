import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EbcaModule } from '@common/ebca/ebca.module';
import { UserEntity } from '@common/database/entities/user.entity';
import { SchedulerService } from './scheduler.service';
import { CoreModule } from '@common/core.module';
import { QuestionEntity } from '@common/database/entities/question.entity';
import { UserAnsweredQuestionEntity } from '@common/database/entities/user-answered-question.entity';

@Module({
  imports: [
    CoreModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      UserEntity,
      QuestionEntity,
      UserAnsweredQuestionEntity,
    ]),
    EbcaModule, // Импортируем EbcaModule, чтобы получить доступ к ComponentManager
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
