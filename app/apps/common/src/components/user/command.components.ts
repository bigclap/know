import { BaseComponent } from '@common/ebca/bases/base.component';
import { Component } from '@common/ebca/decorators/component.decorator';
import { PersistentProperty } from '@common/ebca/decorators/persistent-property.decorator';
import { UserEntity } from '@common/database/entities/user.entity';

@Component()
export class StartCommandComponent extends BaseComponent {
  constructor() {
    super();
  }
}

@Component()
export class StopCommandComponent extends BaseComponent {
  constructor() {
    super();
  }
}

@Component()
export class NewMessageComponent extends BaseComponent {
  constructor(public readonly text: string) {
    super();
  }
}

// Удаляем OnboardingCallbackComponent, FeatureCallbackComponent

@Component({ isPersistent: true })
export class UserRegisteredComponent extends BaseComponent {
  @PersistentProperty(UserEntity, 'nickname')
  public nickname: string;
  constructor(initialNickname: string) {
    super();
    this.nickname = initialNickname;
  }
}

@Component()
export class ProfileCommandComponent extends BaseComponent {
  constructor(public readonly viewId?: string) {
    super();
  }
}

@Component()
export class SinglePlayerCommandComponent extends BaseComponent {
  constructor(public readonly viewId?: string) {
    super();
  }
}

@Component()
export class PvPCommandComponent extends BaseComponent {
  constructor(public readonly viewId?: string) {
    super();
  }
}

@Component()
export class TournamentsCommandComponent extends BaseComponent {
  constructor(public readonly viewId?: string) {
    super();
  }
}

@Component()
export class ShopCommandComponent extends BaseComponent {
  constructor(public readonly viewId?: string) {
    super();
  }
}

@Component()
export class RulesCommandComponent extends BaseComponent {
  constructor(public readonly viewId?: string) {
    super();
  }
}
