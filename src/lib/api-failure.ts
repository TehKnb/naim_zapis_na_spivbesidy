import type { ApiErrorBody } from './types';

/** Очікувана помилка API: HTTP-статус, машинний код і повідомлення для адміністратора. */
export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message, ...this.extra } };
  }
}
