import type { z } from 'zod'
import type { EventTypeEnum } from '../schemas/index'

export type EventType = z.infer<typeof EventTypeEnum>

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  'anime': 'Anime',
  'manga': 'Manga',
  'gaming': 'Gaming',
  'danse': 'Danse',
  'k-drama': 'K-Drama',
  'culture': 'Culture'
}

export function normalizeEventTypes(value: string): string {
  return [...new Set(value.split(/[,|\n]/).map(item => item.trim()).filter(Boolean))]
    .map((item) => {
      const normalized = item.toLowerCase() as EventType
      return EVENT_TYPE_LABELS[normalized] || item
    })
    .join(', ')
}

export function toEventTypeLabel(value: string): string {
  return normalizeEventTypes(value)
}
