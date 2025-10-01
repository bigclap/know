import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import {
  PersistentPropertyMetadata,
  PERSISTENT_PROPERTIES_METADATA,
} from '../decorators/persistent-property.decorator';
import { BaseEntity } from './base.entity'; // Обновленный импорт на BaseEntity

/**
 * Абстрактный базовый класс для всех компонентов в EBCA-архитектуре.
 */
export abstract class BaseComponent {
  /**
   * Возвращает метаданные о свойствах компонента, которые должны быть
   * сохранены непосредственно в колонках соответствующей сущности.
   *
   * @returns Массив объектов PersistentPropertyMetadata.
   */
  public static getPersistentProperties(): PersistentPropertyMetadata<BaseEntity>[] {
    return (Reflect.getMetadata(PERSISTENT_PROPERTIES_METADATA, this) ||
      []) as PersistentPropertyMetadata<BaseEntity>[];
  }
}
