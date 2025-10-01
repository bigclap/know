import { BaseComponent } from './bases/base.component';
import { BaseEntity } from './bases/base.entity';
import { getEntityOptions } from './decorators/entity.decorator';
import {
  getComponentConstructorByName,
  getComponentOptions,
  getRegisteredComponents,
} from './decorators/component.decorator';
import { ComponentConstructor } from './types/componens';
import { EntityConstructor } from './types/entities';

export enum EbcaEventType {
  COMPONENT_ADDED = 'added',
  COMPONENT_REMOVED = 'removed',
  COMPONENT_UPDATED = 'updated',
}

// Обновлен интерфейс EbcaTopicParams для поддержки опциональных классов и wildcard entityId
interface EbcaTopicParams<
  E extends BaseEntity = BaseEntity,
  C extends BaseComponent = BaseComponent,
> {
  entityClass?: EntityConstructor<E>; // Сделано опциональным для wildcard
  eventType: EbcaEventType;
  componentClass?: ComponentConstructor<C>; // Сделано опциональным для wildcard
  entityId: E['id'] | '*'; // Теперь может быть конкретным ID или '*'
}

/**
 * Возвращает фактическое имя сущности, учитывая возможное переопределение через декоратор @Entity.
 * Если класс сущности не предоставлен, возвращает wildcard '*'.
 * @param entityClass Конструктор класса сущности (опционально).
 * @returns Строковое имя сущности или '*'.
 */
export function getEntityName<E extends BaseEntity>(
  entityClass?: EntityConstructor<E>,
): string {
  if (!entityClass) {
    return '*';
  }
  const options = getEntityOptions(entityClass);
  return options?.name || entityClass.name;
}

/**
 * Возвращает фактическое имя компонента, учитывая возможное переопределение через декоратор @Component.
 * Если класс компонента не предоставлен, возвращает wildcard '*'.
 * @param componentClass Конструктор класса компонента (опционально).
 * @returns Строковое имя компонента или '*'.
 */
export function getComponentName<C extends BaseComponent>(
  componentClass?: ComponentConstructor<C>,
): string {
  if (!componentClass) {
    return '*';
  }
  const options = getComponentOptions(componentClass);
  return options?.name || componentClass.name;
}

/**
 * Генерирует стандартизированный топик для NATS.
 * Позволяет подписываться на события как для конкретной сущности, так и для всех сущностей определенного типа.
 * @example
 * // Топик для события добавления компонента 'InChatComponent' для User '123'
 * buildEbcaTopic({ entityClass: UserEntity, eventType: EbcaEventType.COMPONENT_ADDED, componentClass: InChatComponent, entityId: '123' })
 * // => 'ebca.UserEntity.123.added.InChatComponent'
 *
 * // Топик для подписки на добавление компонента 'InChatComponent' к ЛЮБОМУ User (wildcard entityId)
 * buildEbcaTopic({ entityClass: UserEntity, eventType: EbcaEventType.COMPONENT_ADDED, componentClass: InChatComponent, entityId: '*' })
 * // => 'ebca.UserEntity.*.added.InChatComponent'
 *
 * // Топик для подписки на все события добавления компонентов для ЛЮБОЙ сущности и ЛЮБОГО компонента
 * buildEbcaTopic({ eventType: EbcaEventType.COMPONENT_ADDED, entityId: '*' })
 * // => 'ebca.*.*.added.*'
 */
export function buildEbcaTopic<E extends BaseEntity, C extends BaseComponent>({
  entityClass,
  eventType,
  componentClass,
  entityId,
}: EbcaTopicParams<E, C>): string {
  // Используем getEntityName и getComponentName для получения строкового имени класса
  return `ebca.${getEntityName(entityClass)}.${entityId}.${eventType}.${getComponentName(componentClass)}`;
}

/**
 * Генерирует стандартизированный ключ для хранения компонентов сущности в Redis.
 * Все компоненты одной сущности хранятся в одном Redis Hash.
 * @param entityClass - Класс сущности (e.g., typeof UserEntity).
 * @param entityId - UUID сущности.
 * @returns Строка ключа, например: 'ebca:UserEntity:a1b2-c3d4'
 */
export function buildEbcaRedisKey(
  entityClass: EntityConstructor<BaseEntity>,
  entityId: string,
): string {
  return `ebca:${getEntityName(entityClass)}:${entityId}`;
}

export function serializeComponent(component: BaseComponent): string {
  return `${component.constructor.name}:${JSON.stringify(component)}`;
}

export function deserializeComponent(data: string): BaseComponent {
  const [name, componentJson] = data.split(':');
  const Component = getComponentConstructorByName(name);
  if (componentJson) {
    return new Component(JSON.parse(componentJson));
  } else {
    return new Component();
  }
}
