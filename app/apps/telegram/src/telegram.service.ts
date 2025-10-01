import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  APIMethodParams,
  Bot,
  CallbackQueryContext,
  MessageContext,
  PreCheckoutQueryContext,
} from 'gramio';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '@common/database/entities/user.entity';
import { TelegramUserEntity } from './entities/telegram-user.entity';
import { TelegramMessageMapEntity } from './entities/telegram-message-map.entity';
import { ComponentManager } from '@common/ebca/component.manager';
import {
  NewMessageComponent,
  StartCommandComponent,
  StopCommandComponent,
  UserRegisteredComponent,
} from '@common/components/user/command.components';
import { deserializeComponent } from '@common/ebca/ebca.helpers';
import { BaseComponent } from '@common/ebca/bases/base.component';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  readonly bot: Bot;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(TelegramUserEntity)
    private readonly telegramUserRepository: Repository<TelegramUserEntity>,
    @InjectRepository(TelegramMessageMapEntity)
    private readonly messageMapRepository: Repository<TelegramMessageMapEntity>,
    private readonly componentManager: ComponentManager,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN not provided.');
    }
    this.bot = new Bot({
      token,
    });
    this.registerHandlers();
  }

  async onModuleInit() {
    await this.bot.start();
    this.logger.log('Bot started with long polling.');
  }

  private registerHandlers() {
    this.bot.command('start', (ctx) => this.onStart(ctx));
    this.bot.command('stop', (ctx) => this.onStop(ctx));
    this.bot.on('message', (ctx) => this.onMessage(ctx));
    this.bot.on('callback_query', (ctx) => this.onCallback(ctx));
  }

  private async getOrCreateTelegramUser(
    ctx:
      | MessageContext<Bot>
      | CallbackQueryContext<Bot>
      | PreCheckoutQueryContext<Bot>,
  ): Promise<{ telegramUser: TelegramUserEntity; isNew: boolean }> {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      this.logger.error('Could not get telegramId from context', ctx);
      throw new Error('Could not get telegramId from context');
    }

    let telegramUser = await this.telegramUserRepository.findOneBy({
      telegramId,
    });

    let isNewUser = false;
    if (!telegramUser) {
      isNewUser = true;
      telegramUser = this.telegramUserRepository.create({
        telegramId,
        username: ctx.from?.username,
        languageCode: ctx.from?.languageCode,
      });
    }

    await this.telegramUserRepository.save(telegramUser);

    if (isNewUser) {
      const userEntity = new UserEntity(telegramUser.userId);
      await this.componentManager.addComponent(
        userEntity,
        new UserRegisteredComponent(ctx.from?.username || `${telegramId}`),
      );
      this.logger.debug(
        `UserRegisteredComponent added for new user ${telegramUser.userId}.`,
      );
    }

    return { telegramUser, isNew: isNewUser };
  }

  private async onMessage(ctx: MessageContext<Bot>) {
    try {
      const { telegramUser } = await this.getOrCreateTelegramUser(ctx);
      const incomingText = ctx.text?.trim();

      if (incomingText) {
        const userEntity = new UserEntity(telegramUser.userId);
        await this.componentManager.addComponent(
          userEntity,
          new NewMessageComponent(incomingText),
        );
        this.logger.verbose(
          `NewMessageComponent added for user ${telegramUser.userId} with text: "${incomingText}"`,
        );
      }
    } catch (err) {
      this.logger.error(
        `onMessage error for telegramId ${ctx.from?.id}:`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async onStart(ctx: MessageContext<Bot>) {
    try {
      const { telegramUser, isNew } = await this.getOrCreateTelegramUser(ctx);

      if (isNew) {
        this.logger.verbose(
          `New user ${telegramUser.userId} issued /start, registration flow will handle the menu.`,
        );
        return;
      }

      this.logger.verbose(
        `Existing user ${telegramUser.userId} issued /start command.`,
      );
      const userEntity = new UserEntity(telegramUser.userId);
      await this.componentManager.removeComponent(
        userEntity,
        StartCommandComponent,
      );
      await this.componentManager.addComponent(
        userEntity,
        new StartCommandComponent(),
      );
      this.logger.debug(
        `StartCommandComponent added for user ${telegramUser.userId}`,
      );
    } catch (err) {
      this.logger.error(
        `onStart error for telegramId ${ctx.from?.id}:`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async onStop(ctx: MessageContext<Bot>) {
    try {
      const { telegramUser } = await this.getOrCreateTelegramUser(ctx);
      this.logger.verbose(`User ${telegramUser.userId} issued /stop command.`);
      const userEntity = new UserEntity(telegramUser.userId);
      await this.componentManager.addComponent(
        userEntity,
        new StopCommandComponent(),
      );
      this.logger.debug(
        `StopCommandComponent added for user ${telegramUser.userId}`,
      );
    } catch (err) {
      this.logger.error(
        `onStop error for telegramId ${ctx.from?.id}:`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async onCallback(ctx: CallbackQueryContext<Bot>) {
    try {
      const { telegramUser } = await this.getOrCreateTelegramUser(ctx);
      const message = ctx.message;
      if (!message) {
        this.logger.warn(
          `Callback query from ${telegramUser.userId} does not have a message.`,
          ctx,
        );
        await ctx.answerCallbackQuery({
          text: 'Ошибка: отсутствует сообщение.',
          show_alert: true,
        });
        return;
      }

      const messageMap = await this.messageMapRepository.findOneBy({
        messageId: message.id,
        chatId: message.chat.id,
      });

      if (!messageMap) {
        this.logger.warn(
          `Could not find viewId for messageId ${message.id} (user ${telegramUser.userId}). Ignoring callback.`,
        );
        await ctx.answerCallbackQuery({
          text: 'Это сообщение устарело. Пожалуйста, используйте последнее.',
          show_alert: true,
        });
        return;
      }

      const { viewId } = messageMap;
      const componentInstance = deserializeComponent(
        ctx.data,
      ) as BaseComponent & { viewId: string };
      componentInstance.viewId = viewId;
      const userEntity = new UserEntity(telegramUser.userId);

      await this.componentManager.addComponent(userEntity, componentInstance);
      this.logger.debug(
        `Dynamic component '${componentInstance.constructor.name}' added for user ${telegramUser.userId}, payload: '${ctx.data}'.`,
      );

      await ctx.answerCallbackQuery();
    } catch (err) {
      this.logger.error(
        `onCallback error for telegramId ${ctx.from?.id}:`,
        err instanceof Error ? err.stack : String(err),
      );
      await ctx.answerCallbackQuery({
        text: 'Произошла ошибка при обработке запроса.',
        show_alert: true,
      });
    }
  }

  async editMessage(params: {
    chat_id: number;
    message_id: number;
    text: string;
    reply_markup?: APIMethodParams<'editMessageText'>['reply_markup'];
    entities?: APIMethodParams<'editMessageText'>['entities'];
  }) {
    await this.bot.api.editMessageText(params);
    this.logger.debug(
      `Edited message ${params.message_id} in chat ${params.chat_id}`,
    );
  }

  async deleteMessage(chat_id: number, message_id: number) {
    try {
      await this.bot.api.deleteMessage({ chat_id, message_id });
      this.logger.debug(`Deleted message ${message_id} in chat ${chat_id}`);
    } catch (error) {
      this.logger.warn(
        `Failed to delete message ${message_id} in chat ${chat_id}. It might have been deleted already. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async reply(params: {
    chat_id: number;
    text: string;
    reply_markup?: APIMethodParams<'sendMessage'>['reply_markup'];
    entities?: APIMethodParams<'sendMessage'>['entities'];
  }): Promise<number | undefined> {
    if (!params.text || params.text.trim() === '') {
      this.logger.warn(
        `Attempted to send empty message to chat_id: ${params.chat_id}. Suppressing.`,
      );
      return;
    }
    const sentMessage = await this.bot.api.sendMessage(params);
    this.logger.debug(
      `Sent message ${sentMessage.message_id} to chat ${params.chat_id}`,
    );
    return sentMessage.message_id;
  }
}
