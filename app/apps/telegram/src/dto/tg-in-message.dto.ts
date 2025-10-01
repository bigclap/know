import * as z from 'zod';

export const TgInMessageDtoSchema = z.object({
  chatId: z.number(),
  text: z.string().optional(),
  payload: z.string().optional(),
  userId: z.number(),
  username: z.string().optional(),
  languageCode: z.string().optional(),
  chatType: z.string(),
  title: z.string().optional(),
});
export type TgInMessageDto = z.infer<typeof TgInMessageDtoSchema>;
