// apps/common/src/components/ui/ui-actions.components.ts
import { BaseComponent } from '@common/ebca/bases/base.component';
import { Component } from '@common/ebca/decorators/component.decorator';
import type { UiData } from '@common/interfaces';

@Component()
export class SendMessageComponent extends BaseComponent {
  constructor(
    public readonly viewId: string,
    public readonly view: UiData,
  ) {
    super();
  }
}

@Component()
export class EditMessageComponent extends BaseComponent {
  constructor(
    public readonly viewId: string,
    public readonly view: UiData,
  ) {
    super();
  }
}

@Component()
export class DeleteMessageComponent extends BaseComponent {
  constructor(public readonly viewId: string) {
    super();
  }
}
