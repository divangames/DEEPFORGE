// Общая ошибка ядра: транзакция откатывается, код безопасно передаётся клиенту.
export class RiftError extends Error {
  constructor(public readonly code: string, public readonly httpStatus = 409) { super(code); }
}
