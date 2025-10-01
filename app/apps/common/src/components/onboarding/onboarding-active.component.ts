import { BaseComponent } from '@common/ebca/bases/base.component';
import { Component } from '@common/ebca/decorators/component.decorator';

export enum OnboardingStep {
  MAIN_MENU = 'MAIN_MENU',
}

@Component()
export class OnboardingActiveComponent extends BaseComponent {
  constructor(
    public readonly step: OnboardingStep,
    public readonly viewId?: string,
  ) {
    super();
  }
}
