// apps/telegram/src/telegram.ui.system.ts
import { Controller, Inject, Logger } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { ComponentManager } from '@common/ebca/component.manager';
import { UserEntity } from '@common/database/entities/user.entity';
import { EbcaPattern } from '@common/ebca/decorators/ebca-pattern.decorator';
import { EbcaEventType } from '@common/ebca/ebca.helpers';
import { System } from '@common/ebca/decorators/system.decorator';
import {
  SendMessageComponent,
  EditMessageComponent,
  DeleteMessageComponent,
} from '@common/components/ui/ui-actions.components';
import { InlineKeyboard, TelegramMessageEntityType } from 'gramio';
import { TelegramMessageEntity } from '@gramio/types/objects';
import { Keyboard, UiData } from '@common/interfaces';
import { TelegramService } from './telegram.service';
import { TelegramMessageMapEntity } from './entities/telegram-message-map.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TelegramUserEntity } from './entities/telegram-user.entity';

@System({ name: 'TelegramUISystem' })
@Controller()
export class TelegramUISystem {
  private logger = new Logger(TelegramUISystem.name);

  constructor(
    private readonly componentManager: ComponentManager,
    private readonly telegramService: TelegramService,
    @InjectRepository(TelegramMessageMapEntity)
    private readonly messageMapRepository: Repository<TelegramMessageMapEntity>,
    @InjectRepository(TelegramUserEntity)
    private readonly telegramUserRepository: Repository<TelegramUserEntity>,
  ) {}

  @EbcaPattern({
    entityClass: UserEntity,
    eventType: EbcaEventType.COMPONENT_ADDED,
    componentClass: SendMessageComponent,
  })
  async handleSendMessageComponent(
    @Payload() payload: { component: SendMessageComponent; entityId: string },
  ): Promise<void> {
    const {
      entityId,
      component: { viewId, view },
    } = payload;
    this.logger.log(
      `Processing SendMessageComponent for user ${entityId}, viewId ${viewId}.`,
    );

    const telegramUser = await this.telegramUserRepository.findOneBy({
      userId: entityId,
    });
    if (!telegramUser) {
      this.logger.error(
        `Cannot find telegram user for core userId ${entityId} to send message. Removing component.`,
      );
      const userEntity = new UserEntity();
      userEntity.id = entityId;
      await this.componentManager.removeComponent(
        userEntity,
        SendMessageComponent,
      );
      return;
    }

    const { text, entities } = this.buildTextAndEntities(view.text);
    const reply_markup = view.keyboard
      ? this.buildKeyboard(view.keyboard)
      : undefined;

    const messageId = await this.telegramService.reply({
      chat_id: telegramUser.telegramId,
      text,
      entities,
      reply_markup,
    });

    if (messageId) {
      const mapping = this.messageMapRepository.create({
        viewId,
        chatId: telegramUser.telegramId,
        messageId,
      });
      await this.messageMapRepository.save(mapping);
      this.logger.debug(`Mapped viewId ${viewId} to messageId ${messageId}`);
    }

    const userEntity = new UserEntity();
    userEntity.id = entityId;
    await this.componentManager.removeComponent(
      userEntity,
      SendMessageComponent,
    );
    this.logger.debug(
      `SendMessageComponent removed for user ${entityId} after processing.`,
    );
  }

  @EbcaPattern({
    entityClass: UserEntity,
    eventType: EbcaEventType.COMPONENT_ADDED,
    componentClass: EditMessageComponent,
  })
  async handleEditMessageComponent(
    @Payload() payload: { component: EditMessageComponent; entityId: string },
  ): Promise<void> {
    const {
      entityId,
      component: { viewId, view },
    } = payload;
    this.logger.log(
      `Processing EditMessageComponent for user ${entityId}, viewId ${viewId}.`,
    );

    const mapping = await this.messageMapRepository.findOneBy({ viewId });
    if (!mapping) {
      this.logger.warn(
        `Cannot find message mapping for viewId ${viewId} to edit. Skipping and trying to remove component.`,
      );
      const userEntity = new UserEntity();
      userEntity.id = entityId;
      await this.componentManager.removeComponent(
        userEntity,
        EditMessageComponent,
      );
      return;
    }

    const { text, entities } = this.buildTextAndEntities(view.text);
    const reply_markup = view.keyboard
      ? this.buildKeyboard(view.keyboard)
      : undefined;

    await this.telegramService.editMessage({
      chat_id: mapping.chatId,
      message_id: mapping.messageId,
      text,
      entities,
      reply_markup,
    });

    const userEntity = new UserEntity();
    userEntity.id = entityId;
    await this.componentManager.removeComponent(
      userEntity,
      EditMessageComponent,
    );
    this.logger.debug(
      `EditMessageComponent removed for user ${entityId} after processing.`,
    );
  }

  @EbcaPattern({
    entityClass: UserEntity,
    eventType: EbcaEventType.COMPONENT_ADDED,
    componentClass: DeleteMessageComponent,
  })
  async handleDeleteMessageComponent(
    @Payload() payload: { component: DeleteMessageComponent; entityId: string },
  ): Promise<void> {
    const {
      entityId,
      component: { viewId },
    } = payload;
    this.logger.log(
      `Processing DeleteMessageComponent for user ${entityId}, viewId ${viewId}.`,
    );

    const mapping = await this.messageMapRepository.findOneBy({ viewId });
    if (!mapping) {
      this.logger.warn(
        `Cannot find message mapping for viewId ${viewId} to delete. Skipping and trying to remove component.`,
      );
      const userEntity = new UserEntity();
      userEntity.id = entityId;
      await this.componentManager.removeComponent(
        userEntity,
        DeleteMessageComponent,
      );
      return;
    }

    await this.telegramService.deleteMessage(mapping.chatId, mapping.messageId);
    await this.messageMapRepository.remove(mapping);
    this.logger.debug(`Removed message mapping for viewId ${viewId}.`);

    const userEntity = new UserEntity();
    userEntity.id = entityId;
    await this.componentManager.removeComponent(
      userEntity,
      DeleteMessageComponent,
    );
    this.logger.debug(
      `DeleteMessageComponent removed for user ${entityId} after processing.`,
    );
  }

  private buildTextAndEntities(source: UiData['text']): {
    text: string;
    entities: TelegramMessageEntity[];
  } {
    if (typeof source === 'string') {
      return { text: source, entities: [] };
    }

    let finalText = '';
    const entities: TelegramMessageEntity[] = [];

    for (const item of source) {
      if (typeof item === 'string') {
        finalText += item;
        continue;
      }
      const entity = item;
      const offset = finalText.length;
      finalText += entity.text;
      const length = entity.text.length;

      if (entity.type !== 'text') {
        entities.push({
          type: entity.type as TelegramMessageEntityType,
          offset,
          length,
        });
      }
    }
    return { text: finalText, entities };
  }

  private buildKeyboard(keyboardData: Keyboard) {
    const keyboard = new InlineKeyboard();
    for (const row of keyboardData) {
      for (const button of row) {
        keyboard.text(button.text, button.callback_data);
      }
      keyboard.row();
    }
    return keyboard.toJSON();
  }
}
