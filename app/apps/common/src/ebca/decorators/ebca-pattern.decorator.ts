import { EventPattern } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { EntityConstructor } from '../types/entities';
import { BaseEntity } from '../bases/base.entity';
import { buildEbcaTopic, EbcaEventType } from '../ebca.helpers';
import { ComponentConstructor } from '../types/componens';
import { BaseComponent } from '../bases/base.component';
import { SystemConstructor } from '../types/systems';

const logger = new Logger('EbcaPatternDecorator');

/**
 * Параметры для декоратора @EbcaPattern.
 * Позволяет декларативно определять NATS-топики для подписки.
 */
export interface EbcaPatternParams {
  entityClass?: EntityConstructor<BaseEntity>; // Класс сущности (опционально, для wildcard)
  entityId?: string; // Конкретный ID сущности или undefined для wildcard
  eventType: EbcaEventType; // Тип события (добавление/удаление компонента)
  componentClass?: ComponentConstructor<BaseComponent>; // Класс компонента (опционально, для wildcard)
}

/**
 * Интерфейс для записи о зарегистрированной подписке.
 */
export interface EbcaPatternSubscription {
  systemClass: SystemConstructor<any>; // Класс системы, к которой относится метод
  methodName: string; // Имя метода-обработчика
  topic: string; // Сформированный NATS топик
  params: EbcaPatternParams; // Оригинальные параметры декоратора
}

// Глобальный реестр для всех EBCA_PATTERN подписок
const EBCA_PATTERN_SUBSCRIPTIONS: EbcaPatternSubscription[] = [];

/**
 * Декоратор для методов систем, позволяющий декларативно подписываться на EBCA-события NATS.
 * Генерирует NATS-топик и применяет декоратор @EventPattern из NestJS Microservices.
 * Также регистрирует подписку для централизованного логирования и обнаружения.
 *
 * @param params Параметры для формирования NATS-топика.
 * @returns Декоратор метода.
 */
export function EbcaPattern(params: EbcaPatternParams) {
  return <T>(
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    // Формируем NATS топик, используя вспомогательную функцию
    const topic = buildEbcaTopic({
      entityClass: params.entityClass,
      entityId: params.entityId || '*', // Используем '*' если entityId не указан
      eventType: params.eventType,
      componentClass: params.componentClass,
    });

    // Применяем стандартный декоратор @EventPattern от NestJS
    EventPattern(topic)(target, propertyKey, descriptor);

    // Регистрируем эту подписку
    const subscription: EbcaPatternSubscription = {
      systemClass: target.constructor as SystemConstructor<any>,
      methodName: propertyKey,
      topic: topic,
      params: params,
    };
    EBCA_PATTERN_SUBSCRIPTIONS.push(subscription);
    logger.debug(
      `Registered EBCA_PATTERN: ${target.constructor.name}.${String(propertyKey)} subscribes to topic: "${topic}"`,
    );
  };
}

/**
 * Возвращает список всех зарегистрированных EBCA_PATTERN подписок.
 */
export function getEbcaPatternSubscriptions(): EbcaPatternSubscription[] {
  return EBCA_PATTERN_SUBSCRIPTIONS;
}
