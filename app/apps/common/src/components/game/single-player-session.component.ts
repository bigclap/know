import { BaseComponent } from '@common/ebca/bases/base.component';
import { Component } from '@common/ebca/decorators/component.decorator';

export enum SinglePlayerStatus {
  ACTIVE = 'ACTIVE',
  WON = 'WON',
  LOST = 'LOST',
}

@Component()
export class SinglePlayerSessionComponent extends BaseComponent {
  constructor(
    public readonly status: SinglePlayerStatus = SinglePlayerStatus.ACTIVE,
    public readonly currentQuestionIndex: number = 0,
    public readonly currentWinnings: number = 0,
    public readonly isFiftyFiftyUsed: boolean = false,
    public readonly isAudienceHelpUsed: boolean = false,
    public readonly isPhoneAFriendUsed: boolean = false,
    public readonly viewId?: string,
  ) {
    super();
  }
}

@Component()
export class SinglePlayerAnswerCommandComponent extends BaseComponent {
  constructor(
    public readonly answerIndex: number,
    public readonly viewId?: string,
  ) {
    super();
  }
}

@Component()
export class FiftyFiftyCommandComponent extends BaseComponent {
  constructor(public readonly viewId?: string) {
    super();
  }
}

@Component()
export class AudienceHelpCommandComponent extends BaseComponent {
  constructor(public readonly viewId?: string) {
    super();
  }
}

@Component()
export class PhoneAFriendCommandComponent extends BaseComponent {
  constructor(public readonly viewId?: string) {
    super();
  }
}
