import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComponentManager } from '@common/ebca/component.manager';
import { UserEntity } from '@common/database/entities/user.entity';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly componentManager: ComponentManager,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDailyTriggers() {}
}
