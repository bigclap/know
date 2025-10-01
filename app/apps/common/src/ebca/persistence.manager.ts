import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  FindOptionsSelect,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { BaseComponent } from './bases/base.component';
import { PersistentPropertyMetadata } from './decorators/persistent-property.decorator';
import { BaseEntity } from './bases/base.entity';
import { getComponentName, getEntityName } from './ebca.helpers';
import { EntityConstructor } from './types/entities';
import { ComponentConstructor } from './types/componens';
import { getRegisteredComponents } from './decorators/component.decorator';

@Injectable()
export class PersistenceManager implements OnModuleInit {
  private readonly logger = new Logger(PersistenceManager.name);

  // Маппинг имени компонента (строка из Class.name или опций) к конструктору класса компонента
  private componentConstructors: Map<
    string,
    ComponentConstructor<BaseComponent>
  > = new Map();

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit() {
    // Автоматическая регистрация компонентов для PersistenceManager
    // Это нужно для loadComponentFromJsonb, если компонент нужно будет десериализовать
    const registeredComponents = getRegisteredComponents();
    for (const ComponentClass of registeredComponents) {
      this.componentConstructors.set(
        getComponentName(ComponentClass),
        ComponentClass,
      );
      this.logger.debug(
        `Registered component in PersistenceManager: ${getComponentName(ComponentClass)}`,
      );
    }
    this.logger.log(
      'PersistenceManager initialized. Component constructors registered.',
    );
  }

  /**
   * Возвращает типизированный репозиторий для указанного класса сущности TypeORM.
   * @param EntityClass Конструктор класса сущности TypeORM.
   * @returns Репозиторий для TEntity или undefined, если конструктор не найден.
   */
  public getRepositoryForEntity<TEntity extends BaseEntity>(
    EntityClass: EntityConstructor<TEntity>,
  ): Repository<TEntity> | undefined {
    try {
      return this.dataSource.getRepository(EntityClass);
    } catch (error) {
      this.logger.error(
        `Failed to get repository for entity ${EntityClass.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
  }

  /**
   * Возвращает конструктор компонента по его строковому имени.
   * @param componentName Строковое имя компонента.
   * @returns Конструктор класса компонента или undefined.
   */
  private getComponentConstructorByName(
    componentName: string,
  ): ComponentConstructor<BaseComponent> | undefined {
    const constructor = this.componentConstructors.get(componentName);
    if (!constructor) {
      this.logger.warn(
        `Component constructor for ${componentName} not registered in PersistenceManager.`,
      );
    }
    return constructor;
  }

  /**
   * Определяет правильное условие WHERE для поиска целевой сущности TypeORM,
   * предполагая, что связь осуществляется по полю 'id' главной EBCA сущности.
   *
   * @param mainEntityId ID основной сущности (нашей BaseEntity).
   * @returns Объект FindOptionsWhere.
   */
  private getWhereClauseForTargetEntity<E extends BaseEntity>(
    mainEntityId: string,
  ): FindOptionsWhere<E> {
    // Согласно договоренности, мы предполагаем, что целевая TypeORM сущность
    // связана с основной EBCA сущностью через поле 'id'.
    // Если для какой-то сущности требуется иное поле (например, 'userId'),
    // это поле должно быть либо проецировано, либо связь должна быть обработана
    // на более высоком уровне или в специализированной системе.
    return { id: mainEntityId } as FindOptionsWhere<E>;
  }

  /**
   * Сохраняет значения свойств компонента в указанные поля целевых сущностей TypeORM (проекции).
   * Если целевая сущность не существует, она будет создана (если возможно).
   *
   * @param mainEntityId ID основной EBCA сущности (BaseEntity).
   * @param component Экземпляр компонента с персистентными свойствами.
   * @param persistentProperties Метаданные персистентных свойств компонента.
   */
  public async savePersistentProperties(
    mainEntityId: string,
    component: BaseComponent,
    persistentProperties: PersistentPropertyMetadata<BaseEntity>[],
  ): Promise<void> {
    const groupedProperties =
      this.groupPropertiesByEntity(persistentProperties);

    for (const [targetEntityName, propsForTargetEntity] of Object.entries(
      groupedProperties,
    )) {
      const firstPropMeta = propsForTargetEntity[0];
      const targetEntityConstructor = firstPropMeta.entityClass;

      const repository = this.getRepositoryForEntity(targetEntityConstructor);
      if (!repository) {
        this.logger.warn(
          `No repository found for entity ${targetEntityName} during savePersistentProperties.`,
        );
        continue;
      }

      const updateData: Record<string, unknown> = {};
      for (const propMeta of propsForTargetEntity) {
        updateData[propMeta.entityProperty as string] =
          component[propMeta.componentProperty];
      }

      try {
        const whereClause = this.getWhereClauseForTargetEntity(mainEntityId);

        const select = ['id'] as FindOptionsSelect<BaseEntity>;
        let targetEntity = await repository.findOne({
          where: whereClause,
          select,
        });

        if (targetEntity) {
          await repository
            .createQueryBuilder()
            .update(targetEntityConstructor)
            .set(updateData)
            .where(whereClause)
            .execute();
          this.logger.debug(
            `Updated ${targetEntityName} for main entity ${mainEntityId}. Properties: ${Object.keys(updateData).join(', ')}.`,
          );
        } else {
          const createData: Record<string, unknown> = { ...updateData };
          // При создании новой сущности, связующее поле 'id' должно быть установлено
          createData['id'] = mainEntityId;

          targetEntity = repository.create(createData);
          await repository.save(targetEntity);
          this.logger.debug(
            `Created new ${targetEntityName} for main entity ${mainEntityId}. Properties: ${Object.keys(updateData).join(', ')}.`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to save persistent properties for ${targetEntityName} (linked to ${mainEntityId})`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  /**
   * Очищает (устанавливает в null) значения свойств компонента в указанных полях целевых сущностей TypeORM (проекции).
   *
   * @param mainEntityId ID основной EBCA сущности (BaseEntity).
   * @param persistentProperties Метаданные персистентных свойств компонента.
   */
  public async clearPersistentProperties(
    mainEntityId: string,
    persistentProperties: PersistentPropertyMetadata<BaseEntity>[],
  ): Promise<void> {
    const groupedProperties =
      this.groupPropertiesByEntity(persistentProperties);

    for (const [targetEntityName, propsForTargetEntity] of Object.entries(
      groupedProperties,
    )) {
      const firstPropMeta = propsForTargetEntity[0];
      const targetEntityConstructor = firstPropMeta.entityClass;

      const repository = this.getRepositoryForEntity(targetEntityConstructor);
      if (!repository) {
        this.logger.warn(
          `No repository found for entity ${targetEntityName} during clearPersistentProperties.`,
        );
        continue;
      }

      const updateData: Record<string, unknown> = {};
      for (const propMeta of propsForTargetEntity) {
        updateData[propMeta.entityProperty as string] = null;
      }

      try {
        const whereClause = this.getWhereClauseForTargetEntity(mainEntityId);
        await repository
          .createQueryBuilder()
          .update(targetEntityConstructor)
          .set(updateData)
          .where(whereClause as any)
          .execute();
        this.logger.debug(
          `Cleared persistent properties for ${targetEntityName} (linked to ${mainEntityId}).`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to clear persistent properties for ${targetEntityName} (linked to ${mainEntityId})`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  /**
   * Загружает значения свойств компонента из указанных полей целевых сущностей TypeORM (проекции).
   *
   * @param mainEntityId ID основной EBCA сущности (BaseEntity).
   * @param componentClass Конструктор класса компонента.
   * @param persistentProperties Метаданные персистентных свойств компонента.
   * @returns Объект с загруженными свойствами компонента или null, если данных нет.
   */
  public async loadPersistentProperties<C extends BaseComponent>(
    mainEntityId: string,
    componentClass: ComponentConstructor<C>,
    persistentProperties: PersistentPropertyMetadata<BaseEntity>[],
  ): Promise<Record<string, unknown> | null> {
    const groupedProperties =
      this.groupPropertiesByEntity(persistentProperties);
    const componentData: Record<string, unknown> = {};
    let hasData = false;

    for (const [targetEntityName, propsForTargetEntity] of Object.entries(
      groupedProperties,
    )) {
      const firstPropMeta = propsForTargetEntity[0];
      const targetEntityConstructor = firstPropMeta.entityClass;

      const repository = this.getRepositoryForEntity(targetEntityConstructor);
      if (!repository) {
        this.logger.warn(
          `No repository found for entity ${targetEntityName} during loadPersistentProperties.`,
        );
        continue;
      }

      const selectColumns = propsForTargetEntity.map((p) => p.entityProperty);
      const whereClause = this.getWhereClauseForTargetEntity(mainEntityId);

      try {
        const entity = await repository.findOne({
          where: whereClause,
          select: selectColumns,
        });

        if (entity) {
          for (const propMeta of propsForTargetEntity) {
            const value = entity[propMeta.entityProperty];
            if (value !== undefined && value !== null) {
              componentData[propMeta.componentProperty] = value;
              hasData = true;
            }
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to load persistent properties from ${targetEntityName} (linked to ${mainEntityId}) for component ${getComponentName(componentClass)}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return hasData ? componentData : null;
  }

  /**
   * Сохраняет JSON-представление компонента в поле `components` сущности `BaseEntity`.
   *
   * @param entityId ID сущности.
   * @param ebcaEntityClass Конструктор EBCA сущности (наследует от BaseEntity).
   * @param componentName Имя компонента.
   * @param componentData Объект компонента.
   */
  public async saveComponentToJsonb<
    E extends BaseEntity,
    C extends BaseComponent,
  >(
    entityId: E['id'],
    ebcaEntityClass: EntityConstructor<E>,
    componentName: string,
    componentData: C,
  ): Promise<void> {
    const repository = this.getRepositoryForEntity(ebcaEntityClass);
    if (!repository) {
      this.logger.error(
        `Repository for EBCA entity ${ebcaEntityClass.name} not found for JSONB save.`,
      );
      throw new Error(
        `Repository for EBCA entity ${ebcaEntityClass.name} not found.`,
      );
    }

    try {
      // Загружаем сущность, чтобы обновить ее components JSONB поле

      let currentEntity = await repository.findOne({
        where: this.getWhereClauseForTargetEntity<E>(entityId),
      });

      if (!currentEntity) {
        currentEntity = repository.create({
          id: entityId,
          components: {},
        } as DeepPartial<E>);
        this.logger.log(
          `Created new EBCA Entity ${ebcaEntityClass.name}:${entityId} for JSONB component persistence as it was not found.`,
        );
      }

      currentEntity.components = {
        ...currentEntity.components,
        [componentName]: componentData,
      };
      await repository.save(currentEntity);
      this.logger.debug(
        `Persisted component ${componentName} into JSONB for ${getEntityName(ebcaEntityClass)}:${entityId}.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save component ${componentName} to JSONB for ${getEntityName(ebcaEntityClass)}:${entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Загружает JSON-представление компонента из поля `components` сущности `BaseEntity`.
   *
   * @param entityId ID сущности.
   * @param ebcaEntityClass Конструктор EBCA сущности (наследует от BaseEntity).
   * @param componentClass Конструктор класса компонента.
   * @returns Экземпляр компонента или null.
   */
  public async loadComponentFromJsonb<
    E extends BaseEntity,
    C extends BaseComponent,
  >(
    entityId: E['id'],
    ebcaEntityClass: EntityConstructor<E>,
    componentClass: ComponentConstructor<C>,
  ): Promise<C | null> {
    const componentName = getComponentName(componentClass);
    const repository = this.getRepositoryForEntity(ebcaEntityClass);
    if (!repository) {
      this.logger.error(
        `Repository for EBCA entity ${ebcaEntityClass.name} not found for JSONB load.`,
      );
      return null;
    }

    try {
      const currentEntity = await repository.findOne({
        where: this.getWhereClauseForTargetEntity<E>(entityId),
        select: ['components'],
      });

      if (
        currentEntity &&
        currentEntity.components &&
        currentEntity.components[componentName]
      ) {
        this.logger.debug(
          `Found component ${componentName} in JSONB for ${getEntityName(ebcaEntityClass)}:${entityId}.`,
        );
        const plainObject = currentEntity.components[componentName];
        // Восстанавливаем экземпляр компонента
        return Object.assign(new componentClass(), plainObject);
      }
    } catch (error) {
      this.logger.error(
        `Failed to load component ${componentName} from JSONB for ${getEntityName(ebcaEntityClass)}:${entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    return null;
  }

  /**
   * Удаляет JSON-представление компонента из поля `components` сущности `BaseEntity`.
   *
   * @param entityId ID сущности.
   * @param ebcaEntityClass Конструктор EBCA сущности (наследует от BaseEntity).
   * @param componentClass Конструктор класса компонента.
   * @returns Удаленный экземпляр компонента или null, если не найден.
   */
  public async removeComponentFromJsonb<
    E extends BaseEntity,
    C extends BaseComponent,
  >(
    entityId: E['id'],
    ebcaEntityClass: EntityConstructor<E>,
    componentClass: ComponentConstructor<C>,
  ): Promise<C | null> {
    const componentName = getComponentName(componentClass);
    const repository = this.getRepositoryForEntity(ebcaEntityClass);
    if (!repository) {
      this.logger.error(
        `Repository for EBCA entity ${ebcaEntityClass.name} not found for JSONB remove.`,
      );
      return null;
    }

    try {
      const currentEntity = await repository.findOne({
        where: this.getWhereClauseForTargetEntity<E>(entityId),
      });
      if (
        currentEntity &&
        currentEntity.components &&
        currentEntity.components[componentName]
      ) {
        const removedComponentData = currentEntity.components[componentName]; // Сохраняем для возврата и лога

        const { [componentName]: removedComponent, ...restComponents } =
          currentEntity.components;
        currentEntity.components = restComponents as Record<
          ComponentConstructor<BaseComponent>['name'],
          BaseComponent
        >;
        await repository.save(currentEntity); // Приводим тип к E
        this.logger.debug(
          `Removed component ${componentName} from JSONB for ${getEntityName(ebcaEntityClass)}:${entityId}.`,
        );
        return Object.assign(new componentClass(), removedComponentData); // Возвращаем десериализованный компонент
      }
    } catch (error) {
      this.logger.error(
        `Failed to remove component ${componentName} from JSONB for ${getEntityName(ebcaEntityClass)}:${entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    return null;
  }

  private groupPropertiesByEntity(
    properties: PersistentPropertyMetadata<BaseEntity>[],
  ): Record<
    (typeof BaseEntity)['name'],
    PersistentPropertyMetadata<BaseEntity>[]
  > {
    return properties.reduce(
      (acc, prop) => {
        const entityName = getEntityName(prop.entityClass);
        if (!acc[entityName]) {
          acc[entityName] = [];
        }
        acc[entityName].push(prop);
        return acc;
      },
      {} as Record<string, PersistentPropertyMetadata<BaseEntity>[]>,
    );
  }
}
