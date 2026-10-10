/** Shared by Payload (payload.config.ts) and the payload-onpage proxy (proxy.ts). Set PAYLOAD_SECRET in real deployments. */
export const PAYLOAD_SECRET =
  process.env.PAYLOAD_SECRET || 'payload-onpage-example-secret-change-me'
