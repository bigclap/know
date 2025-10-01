import { Body, Controller, Post } from '@nestjs/common';
import type { TelegramUpdate } from 'gramio';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  webhook(@Body() body: TelegramUpdate) {
    return this.telegramService.bot.updates.handleUpdate(body);
  }
}
