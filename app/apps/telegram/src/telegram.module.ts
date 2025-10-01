import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreModule } from '@common/core.module';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramUserEntity } from './entities/telegram-user.entity';
import { TelegramMessageMapEntity } from './entities/telegram-message-map.entity';
import { EbcaModule } from '@common/ebca/ebca.module';
import { TelegramUISystem } from './telegram.ui.system';

@Module({
  imports: [
    CoreModule.forRoot(),
    ConfigModule,
    TypeOrmModule.forFeature([TelegramUserEntity, TelegramMessageMapEntity]),
    EbcaModule,
  ],
  controllers: [TelegramController, TelegramUISystem],
  providers: [TelegramService],
})
export class TelegramModule {}
