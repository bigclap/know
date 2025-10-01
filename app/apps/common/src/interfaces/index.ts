interface Button {
  text: string;
  callback_data: string;
}
export type KeyboardRow = Button[];
export type Keyboard = KeyboardRow[];
export type TextEntityType =
  | 'text'
  | 'blockquote'
  | 'mention'
  | 'text_mention'
  | 'bold'
  | 'italic';

export interface TextEntity {
  type: TextEntityType;
  text: string;
}

export interface UiData {
  text: string | (string | TextEntity)[];
  keyboard?: { text: string; callback_data: string }[][];
}

export interface ViewUpdatePayload {
  chatId: number;
  messageId: number;
  view: UiData;
}

export interface NewMessagePayload {
  recipientId: string; // This is UserEntity.id
  text: string;
}

export interface CallbackPayload {
  recipientId: string; // This is UserEntity.id
  payload: string;
  viewId: string; // The ID of the message/view that was interacted with
}
