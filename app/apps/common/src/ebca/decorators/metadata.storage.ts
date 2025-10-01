import 'reflect-metadata';

/**
 * Типизированный интерфейс для работы с метаданными.
 * Инкапсулирует вызовы Reflect и обеспечивает безопасность типов.
 */
export class MetadataStorage {
  /**
   * Устанавливает метаданные для конструктора класса.
   * @param metadataKey Уникальный ключ метаданных.
   * @param metadataValue Значение метаданных.
   * @param target Конструктор класса, к которому привязываются метаданные.
   */
  public static defineMetadata<T>(
    metadataKey: any,
    metadataValue: T,
    target: Function,
  ): void {
    Reflect.defineMetadata(metadataKey, metadataValue, target);
  }

  /**
   * Получает метаданные для конструктора класса.
   * Если метаданные отсутствуют, возвращает значение по умолчанию.
   * @param metadataKey Уникальный ключ метаданных.
   * @param target Конструктор класса.
   * @param defaultValue Значение по умолчанию, если метаданные не найдены.
   * @returns Значение метаданных или значение по умолчанию.
   */
  public static getMetadata<T>(
    metadataKey: any,
    target: Function,
    defaultValue: T,
  ): T {
    return Reflect.getMetadata(metadataKey, target) ?? defaultValue;
  }

  /**
   * Получает метаданные для конструктора класса.
   * Если метаданные отсутствуют, возвращает undefined.
   * @param metadataKey Уникальный ключ метаданных.
   * @param target Конструктор класса.
   * @returns Значение метаданных или undefined.
   */
  public static getMetadataOrNull<T>(
    metadataKey: any,
    target: Function,
  ): T | undefined {
    return Reflect.getMetadata(metadataKey, target) ?? undefined;
  }
}
