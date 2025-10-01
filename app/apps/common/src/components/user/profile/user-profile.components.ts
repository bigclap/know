// apps/common/src/components/user/profile/user-profile.components.ts
import { BaseComponent } from '@common/ebca/bases/base.component';
import { Component } from '@common/ebca/decorators/component.decorator';
import { PersistentProperty } from '@common/ebca/decorators/persistent-property.decorator';
import { UserEntity } from '@common/database/entities/user.entity';

/**
 * Компонент для хранения внутриигровой валюты пользователя.
 */
@Component({ isPersistent: true })
export class UserWalletComponent extends BaseComponent {
  constructor(public readonly coins: number = 0) {
    super();
  }
}

/**
 * Компонент для хранения статистики пользователя в PvP-режиме.
 */
@Component({ isPersistent: true })
export class UserStatsComponent extends BaseComponent {
  @PersistentProperty(UserEntity, 'elo')
  public elo: number; // ELO теперь будет синхронизироваться с полем elo в UserEntity

  constructor(
    elo: number = 1000, // Значение по умолчанию используется при создании компонента, если оно не загружено из БД
    public readonly wins: number = 0,
    public readonly losses: number = 0,
  ) {
    super();
    this.elo = elo;
  }
}

/**
 * Компонент для хранения инвентаря пользователя (расходники).
 */
@Component({ isPersistent: true })
export class UserInventoryComponent extends BaseComponent {
  constructor(
    public readonly healthPotions: number = 0,
    public readonly intuitionPotions: number = 0,
    public readonly tournamentTickets: number = 0,
  ) {
    super();
  }
}

/**
 * Компонент для хранения косметических предметов пользователя.
 */
@Component({ isPersistent: true })
export class UserCosmeticsComponent extends BaseComponent {
  constructor(
    public readonly activeAvatarFrame: string | null = null,
    public readonly activeTitle: string | null = null,
  ) {
    super();
  }
}
