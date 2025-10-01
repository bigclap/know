import { APIMethodParams } from 'gramio';
import { TelegramMessageEntity } from '@gramio/types/objects';

import { UiData } from '@common/interfaces';

export interface EditMessageParams {
  chat_id: number;
  text: string;
  reply_markup?: APIMethodParams<'editMessageText'>['reply_markup'];
  message_id: number;
  entities?: TelegramMessageEntity[];
}

export interface SendMessageParams {
  chat_id: number;
  text: string;
  reply_markup?: APIMethodParams<'sendMessage'>['reply_markup'];
  message_id?: number;
  entities?: TelegramMessageEntity[];
}

export type SendInvoiceParams = APIMethodParams<'sendInvoice'>;

export interface SendMessagePayload {
  chatId: number;
  view: UiData;
  requestId: string;
}

export interface EditMessagePayload {
  chatId: number;
  messageId: number;
  view: UiData;
}

export interface DeleteMessagePayload {
  chatId: number;
  messageId: number;
}

interface Price {
  label: string;
  amount: number;
}

export interface InvoicePayload {
  chatId: number;
  title: string;
  description: string;
  payload: string;
  currency: string;
  prices: Price[];
}

export interface SendMessagePayload {
  recipientId: string; // UserEntity.id
  viewId: string;
  view: UiData;
}

export interface EditMessagePayload {
  viewId: string;
  view: UiData;
}

export interface DeleteMessagePayload {
  viewId: string;
}

export type PrepareInvoicePayload = Omit<
  APIMethodParams<'sendInvoice'>,
  'chat_id'
> & {
  recipientId: string;
};
