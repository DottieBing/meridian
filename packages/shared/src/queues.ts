import { z } from 'zod'

export const QUEUES = {
  systemPing: 'system-ping',
  discoverySearch: 'discovery-search',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

export const pingPayload = z.object({
  message: z.string().max(200).default('ping'),
  delayMs: z.number().int().min(0).max(30_000).default(0),
})
export type PingPayload = z.infer<typeof pingPayload>

const discoverySearchBase = z.object({
  preset: z.string().min(1).max(40),
  countryCode: z.string().length(2).optional(),
  city: z.string().min(1).max(100).optional(),
  useCache: z.boolean().default(true),
})
const needsArea = (v: { countryCode?: string | undefined; city?: string | undefined }) =>
  Boolean(v.countryCode || v.city)
const areaMessage = { message: 'Provide countryCode, city, or both' }

/** What the API accepts. The workspace is optional and defaults to the first one. */
export const discoverySearchRequest = discoverySearchBase
  .extend({ workspaceId: z.string().uuid().optional() })
  .refine(needsArea, areaMessage)

/** What goes on the queue. The workspace is always resolved. */
export const discoverySearchPayload = discoverySearchBase
  .extend({ workspaceId: z.string().uuid(), runId: z.string().uuid() })
  .refine(needsArea, areaMessage)

export type DiscoverySearchPayload = z.infer<typeof discoverySearchPayload>