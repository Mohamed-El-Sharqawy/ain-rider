/**
 * Notification Event Payloads
 * 
 * Events for notification delivery
 */

// ─────────────────────────────────────────────────────────────────────────────
// Notification Sent - Published after notification is delivered
// ─────────────────────────────────────────────────────────────────────────────

export interface NotificationSentPayload {
  notificationId: string;
  userId: string;
  title: string;
  body: string;
  type: 'TRIP_UPDATE' | 'PAYMENT' | 'PROMOTIONAL' | 'SYSTEM' | 'SOS';
  channels: ('PUSH' | 'SMS' | 'EMAIL' | 'IN_APP')[];
  data?: Record<string, unknown>;
  sentAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Type Aliases
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationSentEvent = NotificationSentPayload;
