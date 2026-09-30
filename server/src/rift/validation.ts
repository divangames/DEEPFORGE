import { RiftError, RIFT_FACILITIES, TECHS } from './engine.js';
import { RIFT_OPERATORS, REACTOR_UPGRADES } from './reactor.js';
import type { RiftAction } from './protocol.js';
function object(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new RiftError('INVALID_REQUEST', 400);
  return input as Record<string, unknown>;
}
function exactKeys(input: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(input).some((k) => !allowed.includes(k))) throw new RiftError('INVALID_REQUEST', 400);
}
export function parseNickname(input: unknown): string {
  const value = object(input);
  exactKeys(value, ['nickname']);
  if (typeof value.nickname !== 'string') throw new RiftError('INVALID_REQUEST', 400);
  const nickname = value.nickname.trim();
  if (nickname.length < 1 || nickname.length > 28 || /[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(nickname)) throw new RiftError('INVALID_REQUEST', 400);
  return nickname;
}
export function parseEvent(input: unknown): string {
  const value = object(input);
  exactKeys(value, ['eventId']);
  if (typeof value.eventId !== 'string' || !/^rift-\d{4}-\d{2}-\d{2}$/.test(value.eventId)) throw new RiftError('INVALID_REQUEST', 400);
  return value.eventId;
}
export function parseAction(input: unknown): RiftAction {
  const value = object(input);
  exactKeys(value, ['requestId', 'eventId', 'revision', 'kind', 'target', 'count', 'slot']);
  if (typeof value.requestId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.requestId)
    || typeof value.eventId !== 'string' || !/^rift-\d{4}-\d{2}-\d{2}$/.test(value.eventId)
    || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0) throw new RiftError('INVALID_REQUEST', 400);
  const { kind, target, count, slot } = value;
  if (kind !== 'operator-assign' && slot !== undefined) throw new RiftError('INVALID_REQUEST', 400);
  const valid = kind === 'upgrade' ? RIFT_FACILITIES.some((f) => f === target) && (count === 1 || count === 10)
    : kind === 'research' ? TECHS.some((t) => t.id === target) && count === undefined
    : kind === 'complete' ? target === undefined && count === undefined
    : kind === 'claim' ? typeof target === 'string' && /^[a-z]+-(half|complete)$/.test(target) && count === undefined
    : kind === 'reactor-upgrade' ? REACTOR_UPGRADES.some(t => t === target) && count === undefined
    : kind === 'operator-activate' ? RIFT_OPERATORS.some(o => o.id === target) && count === undefined
    : kind === 'operator-assign' ? (target === 'none' || RIFT_OPERATORS.some(o => o.id === target)) && count === undefined && Number.isInteger(slot) && (slot as number) >= 0 && (slot as number) <= 2
    : false;
  if (!valid) throw new RiftError('INVALID_REQUEST', 400);
  return value as unknown as RiftAction;
}
