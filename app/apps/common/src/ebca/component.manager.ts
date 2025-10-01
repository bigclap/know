import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { Cache } from 'cache-manager';
import { BaseComponent } from './bases/base.component';
import {
  buildEbcaRedisKey,
  buildEbcaTopic,
  EbcaEventType,
  getComponentName,
  getEntityName,
} from './ebca.helpers';
import KeyvRedis, { RedisClientConnectionType } from '@keyv/redis';
import { BaseEntity } from './bases/base.entity';
import { PersistenceManager } from './persistence.manager';
import {
  checkComponentPermissions,
  getComponentOptions,
  getRegisteredComponents,
} from './decorators/component.decorator';
import { EntityConstructor } from './types/entities';
import { ComponentConstructor } from './types/componens';

@Injectable()
export class ComponentManager implements OnModuleInit {
  private readonly logger = new Logger(ComponentManager.name);
  private redisClient: RedisClientConnectionType;
  private componentConstructorsByName: Map<
    string,
    ComponentConstructor<BaseComponent>
  > = new Map();
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject('NATS_SERVICE') private readonly natsClient: ClientProxy,
    private readonly persistenceManager: PersistenceManager,
  ) {}

  async onModuleInit() {
    this.redisClient = await (
      this.cache.stores[0].store as KeyvRedis<unknown>
    ).getClient();

    const registeredComponents = getRegisteredComponents();
    for (const ComponentClass of registeredComponents) {
      const componentName = getComponentName(ComponentClass);
      this.componentConstructorsByName.set(componentName, ComponentClass);
    }

    this.logger.log(
      'ComponentManager initialized. Redis client ready. Entity and component constructors registered.',
    );
  }

  public async addComponent<E extends BaseEntity, C extends BaseComponent>(
    entity: E,
    component: C,
    userRoles: string[] = [],
  ): Promise<void> {
    const entityClass = entity.constructor as EntityConstructor<E>;
    const componentClass = component.constructor as ComponentConstructor<C>;
    const componentName = getComponentName(componentClass);
    const entityName = getEntityName(entityClass);

    checkComponentPermissions(
      componentClass,
      EbcaEventType.COMPONENT_ADDED,
      userRoles,
    );

    if (!componentName) {
      throw new Error(
        `Component class ${componentClass.name} is missing a valid name.`,
      );
    }

    const exists = await this.hasComponent(entity, componentClass);
    if (exists) {
      throw new ConflictException(
        `Component ${componentName} already exists for entity ${entityName}:${entity.id}. Use updateComponent instead.`,
      );
    }

    const redisKey = buildEbcaRedisKey(entityClass, entity.id);
    await this.redisClient.hSet(
      redisKey,
      componentName,
      JSON.stringify(component),
    );

    const componentOptions = getComponentOptions(componentClass);

    const persistentProperties = componentClass.getPersistentProperties();
    if (persistentProperties.length > 0) {
      await this.persistenceManager.savePersistentProperties(
        entity.id,
        component,
        persistentProperties,
      );
    }

    if (componentOptions?.isPersistent) {
      await this.persistenceManager.saveComponentToJsonb(
        entity.id,
        entityClass,
        componentName,
        component,
      );
    }

    this.natsClient.emit(
      buildEbcaTopic({
        entityClass: entityClass,
        entityId: entity.id,
        eventType: EbcaEventType.COMPONENT_ADDED,
        componentClass: componentClass,
      }),
      { entityId: entity.id, component: component },
    );
    this.logger.verbose(
      `NATS event for ${componentName} ADDED emitted for ${entityName}:${entity.id}.`,
    );
  }

  public async updateComponent<E extends BaseEntity, C extends BaseComponent>(
    entity: E,
    component: C,
    userRoles: string[] = [],
  ): Promise<void> {
    const entityClass = entity.constructor as EntityConstructor<E>;
    const componentClass = component.constructor as ComponentConstructor<C>;
    const componentName = getComponentName(componentClass);
    const entityName = getEntityName(entityClass);

    checkComponentPermissions(
      componentClass,
      EbcaEventType.COMPONENT_UPDATED,
      userRoles,
    );

    if (!componentName) {
      throw new Error(
        `Component class ${componentClass.name} is missing a valid name.`,
      );
    }

    const exists = await this.hasComponent(entity, componentClass);
    if (!exists) {
      throw new NotFoundException(
        `Component ${componentName} not found for entity ${entityName}:${entity.id}. Use addComponent instead.`,
      );
    }

    const redisKey = buildEbcaRedisKey(entityClass, entity.id);
    await this.redisClient.hSet(
      redisKey,
      componentName,
      JSON.stringify(component),
    );

    const componentOptions = getComponentOptions(componentClass);

    const persistentProperties = componentClass.getPersistentProperties();
    if (persistentProperties.length > 0) {
      await this.persistenceManager.savePersistentProperties(
        entity.id,
        component,
        persistentProperties,
      );
    }

    if (componentOptions?.isPersistent) {
      await this.persistenceManager.saveComponentToJsonb(
        entity.id,
        entityClass,
        componentName,
        component,
      );
    }

    this.natsClient.emit(
      buildEbcaTopic({
        entityClass: entityClass,
        entityId: entity.id,
        eventType: EbcaEventType.COMPONENT_UPDATED,
        componentClass: componentClass,
      }),
      { entityId: entity.id, component: component },
    );
    this.logger.verbose(
      `NATS event for ${componentName} UPDATED emitted for ${entityName}:${entity.id}.`,
    );
  }

  public async removeComponent<E extends BaseEntity, C extends BaseComponent>(
    entity: E,
    componentClass: ComponentConstructor<C>,
    userRoles: string[] = [],
  ): Promise<void> {
    const entityClass = entity.constructor as EntityConstructor<E>;
    const componentName = getComponentName(componentClass);
    const entityName = getEntityName(entityClass);

    checkComponentPermissions(
      componentClass,
      EbcaEventType.COMPONENT_REMOVED,
      userRoles,
    );

    const redisKey = buildEbcaRedisKey(entityClass, entity.id);
    const result = await this.redisClient.hDel(redisKey, componentName);
    if (result === 0) {
      this.logger.warn(
        `Attempted to remove component ${componentName} from ${entityName}:${entity.id}, but it was not found in Redis.`,
      );
    }

    const componentOptions = getComponentOptions(componentClass);

    const persistentProperties = componentClass.getPersistentProperties();
    if (persistentProperties.length > 0) {
      await this.persistenceManager.clearPersistentProperties(
        entity.id,
        persistentProperties,
      );
    }

    let removedComponentData: C | null = null;
    if (componentOptions?.isPersistent) {
      removedComponentData =
        await this.persistenceManager.removeComponentFromJsonb(
          entity.id,
          entityClass,
          componentClass,
        );
    }

    this.natsClient.emit(
      buildEbcaTopic({
        entityClass: entityClass,
        entityId: entity.id,
        eventType: EbcaEventType.COMPONENT_REMOVED,
        componentClass: componentClass,
      }),
      {
        entityId: entity.id,
        componentName,
        previousComponent: removedComponentData,
      },
    );
    this.logger.verbose(
      `NATS event for ${componentName} REMOVED emitted for ${entityName}:${entity.id}.`,
    );
  }

  public async getComponent<E extends BaseEntity, C extends BaseComponent>(
    entity: E,
    componentClass: ComponentConstructor<C>,
  ): Promise<C | null> {
    const entityClass = entity.constructor as EntityConstructor<E>;
    const componentName = getComponentName(componentClass);
    const entityName = getEntityName(entityClass);
    const redisKey = buildEbcaRedisKey(entityClass, entity.id);

    let componentInstance: C | null = null;

    const data = await this.redisClient.hGet(redisKey, componentName);
    if (data) {
      try {
        const plainObject = JSON.parse(data);
        componentInstance = Object.assign(new componentClass(), plainObject);
        return componentInstance;
      } catch (error) {
        this.logger.error(
          `Failed to parse component ${componentName} from Redis for ${entityName}:${entity.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    const componentOptions = getComponentOptions(componentClass);
    const persistentProperties = componentClass.getPersistentProperties();

    if (componentOptions?.isPersistent || persistentProperties.length > 0) {
      if (componentOptions?.isPersistent) {
        componentInstance =
          await this.persistenceManager.loadComponentFromJsonb(
            entity.id,
            entityClass,
            componentClass,
          );
      }

      if (!componentInstance && persistentProperties.length > 0) {
        const componentDataFromProjection =
          await this.persistenceManager.loadPersistentProperties(
            entity.id,
            componentClass,
            persistentProperties,
          );
        if (componentDataFromProjection) {
          componentInstance = Object.assign(
            new componentClass(),
            componentDataFromProjection,
          );
        }
      }

      if (componentInstance) {
        await this.redisClient.hSet(
          redisKey,
          componentName,
          JSON.stringify(componentInstance),
        );
        return componentInstance;
      }
    }

    return null;
  }

  public async hasComponent<E extends BaseEntity, C extends BaseComponent>(
    entity: E,
    componentClass: ComponentConstructor<C>,
  ): Promise<boolean> {
    const entityClass = entity.constructor as EntityConstructor<E>;
    const componentName = getComponentName(componentClass);
    const redisKey = buildEbcaRedisKey(entityClass, entity.id);
    const hasInRedis = await this.redisClient.hExists(redisKey, componentName);

    if (hasInRedis) {
      return true;
    }

    const componentOptions = getComponentOptions(componentClass);
    const persistentProperties = componentClass.getPersistentProperties();

    if (componentOptions?.isPersistent) {
      const componentFromJSONB =
        await this.persistenceManager.loadComponentFromJsonb(
          entity.id,
          entityClass,
          componentClass,
        );
      if (componentFromJSONB) {
        await this.redisClient.hSet(
          redisKey,
          componentName,
          JSON.stringify(componentFromJSONB),
        );
        return true;
      }
    }

    if (persistentProperties.length > 0) {
      const componentDataFromProjection =
        await this.persistenceManager.loadPersistentProperties(
          entity.id,
          componentClass,
          persistentProperties,
        );
      if (
        componentDataFromProjection &&
        Object.keys(componentDataFromProjection).length > 0
      ) {
        return true;
      }
    }

    return false;
  }
}
