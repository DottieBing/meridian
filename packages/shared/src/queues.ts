import { z } from 'zod'

export const QUEUES = {
  systemPing: 'system-ping',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

export const pingPayload = z.object({
  message: z.string().max(200).default('ping'),
  delayMs: z.number().int().min(0).max(30_000).default(0),
})

export type PingPayload = z.infer<typeof pingPayload>