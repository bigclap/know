import 'reflect-metadata';
import { BaseComponent } from '../bases/base.component';
import { ForbiddenException, Logger } from '@nestjs/common';
import { EbcaEventType } from '../ebca.helpers';
import {
  ComponentConstructor,
  ComponentOptions,
  ComponentPermissions,
} from '../types/componens';

const logger = new Logger('ComponentDecorator');

export const COMPONENT_METADATA_KEY = Symbol('component_metadata');

// Глобальный реестр для зарегистрированных компонентов
const REGISTERED_COMPONENTS: ComponentConstructor<BaseComponent>[] = [];

/**
 * Декоратор для пометки класса как EBCA-компонента.
 * Автоматически регистрирует компонент для обнаружения ComponentManager.
 *
 * @param options Опции компонента, такие как персистентность и права доступа.
 */
export function Component(options?: ComponentOptions) {
  return <T extends ComponentConstructor<BaseComponent>>(target: T) => {
    if (!options) {
      options = {};
    }
    if (options?.isPersistent === undefined) {
      options.isPersistent = false;
    }
    Reflect.defineMetadata(COMPONENT_METADATA_KEY, options, target);
    REGISTERED_COMPONENTS.push(target);
    logger.debug(
      `Registered component: ${target.name} (Persistent: ${options?.isPersistent || false}, Custom Name: ${options?.name || 'N/A'})`,
    );
  };
}

/**
 * Возвращает список всех автоматически зарегистрированных EBCA-компонентов.
 */
export function getRegisteredComponents(): ComponentConstructor<BaseComponent>[] {
  return REGISTERED_COMPONENTS;
}

/**
 * Возвращает опции компонента, определенные декоратором @Component.
 * @param target Конструктор класса компонента.
 */
export function getComponentOptions<T extends BaseComponent>(
  target: ComponentConstructor<T>,
): ComponentOptions | undefined {
  return Reflect.getMetadata(COMPONENT_METADATA_KEY, target);
}

/**
 * Проверяет права доступа для выполнения операции над компонентом.
 * @param componentClass Класс компонента.
 * @param operation Тип операции ('add' или 'remove').
 * @param userRoles Массив ролей текущего пользователя.
 * @throws ForbiddenException если у пользователя нет необходимых прав.
 */
export function checkComponentPermissions<T extends BaseComponent>(
  componentClass: ComponentConstructor<T>,
  operation: EbcaEventType,
  userRoles: string[],
): void {
  const options = getComponentOptions(componentClass);
  const requiredRoles = options?.permissions?.[operation];

  if (requiredRoles && requiredRoles.length > 0) {
    const hasPermission = userRoles.some((role) =>
      requiredRoles.includes(role),
    );
    if (!hasPermission) {
      logger.warn(
        `User tried to ${operation} component ${componentClass.name} without required roles. Required: ${requiredRoles.join(', ')}, User has: ${userRoles.join(', ')}`,
      );
      throw new ForbiddenException(
        `Insufficient permissions to ${operation} component ${componentClass.name}. Required roles: ${requiredRoles.join(', ')}.`,
      );
    }
  }
}

export function getComponentConstructorByName(
  componentName: string,
): ComponentConstructor<BaseComponent> {
  const constructor = REGISTERED_COMPONENTS.find(
    (e) => e.name == componentName,
  );
  if (!constructor) {
    this.logger.warn(
      `Component constructor for ${componentName} not registered in ComponentManager.`,
    );
    throw new Error(
      `Component constructor ${componentName} not registered in ComponentManager.`,
    );
  }
  return constructor;
}
