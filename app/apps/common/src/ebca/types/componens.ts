import { EbcaEventType } from '../ebca.helpers';
import { BaseComponent } from '../bases/base.component';
import { PersistentPropertyMetadata } from '../decorators/persistent-property.decorator';
import { BaseEntity } from '../bases/base.entity';

/**
 * Тип для конструктора класса, который расширяет `BaseComponent`.
 */
export type ComponentConstructor<T extends BaseComponent> = {
  new (...args: any[]): T;
  name: string;
  getPersistentProperties(): PersistentPropertyMetadata<BaseEntity>[];
};

/**
 * Интерфейс для прав доступа к компоненту.
 * Определяет, какие роли могут добавлять или удалять этот компонент.
 */
export interface ComponentPermissions {
  [EbcaEventType.COMPONENT_ADDED]?: string[]; // Список ролей, которым разрешено добавлять компонент
  [EbcaEventType.COMPONENT_REMOVED]?: string[]; // Список ролей, которым разрешено удалять компонент
  [EbcaEventType.COMPONENT_UPDATED]?: string[]; // Список ролей, которым разрешено обновлять компонент
}

/**
 * Интерфейс для опций декоратора @Component.
 */
export interface ComponentOptions {
  isPersistent?: boolean; // Определяет, должен ли компонент сохраняться в долговременное хранилище (JSON в БД). По умолчанию false.
  permissions?: ComponentPermissions; // Права доступа к компоненту.
  name?: string; // Позволяет переопределить имя компонента, если this.constructor.name меняется при минификации.
}
