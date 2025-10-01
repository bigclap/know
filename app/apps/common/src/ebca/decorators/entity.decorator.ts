import 'reflect-metadata';
import { BaseEntity } from '../bases/base.entity';
import { Logger } from '@nestjs/common';
import { EntityConstructor, EntityOptions } from '../types/entities';

const logger = new Logger('EntityDecorator');

export const ENTITY_METADATA_KEY = Symbol('entity_metadata');

// Глобальный реестр для зарегистрированных сущностей
const REGISTERED_ENTITIES: EntityConstructor<BaseEntity>[] = [];

/**
 * Декоратор для пометки класса как EBCA-сущности.
 * Автоматически регистрирует сущность для обнаружения ComponentManager.
 *
 * @param options Опции сущности, например, для переопределения имени.
 */
export function Entity(options?: EntityOptions) {
  return <T extends EntityConstructor<BaseEntity>>(target: T) => {
    Reflect.defineMetadata(ENTITY_METADATA_KEY, options, target);
    REGISTERED_ENTITIES.push(target);
    logger.debug(
      `Registered entity: ${target.name} (Custom Name: ${options?.name || 'N/A'})`,
    );
  };
}

/**
 * Возвращает список всех автоматически зарегистрированных EBCA-сущностей.
 */
export function getRegisteredEntities(): EntityConstructor<BaseEntity>[] {
  return REGISTERED_ENTITIES;
}

/**
 * Возвращает опции сущности, определенные декоратором @Entity.
 * @param target Конструктор класса сущности.
 */
export function getEntityOptions<T extends BaseEntity>(
  target: EntityConstructor<T>,
): EntityOptions | undefined {
  return Reflect.getMetadata(ENTITY_METADATA_KEY, target) as EntityOptions;
}
