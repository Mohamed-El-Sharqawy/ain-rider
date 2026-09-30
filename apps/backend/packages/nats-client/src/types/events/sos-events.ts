/**
 * SOS Event Payloads
 * 
 * Events for emergency SOS handling
 */

// ─────────────────────────────────────────────────────────────────────────────
// SOS Created - Published when SOS is triggered
// ─────────────────────────────────────────────────────────────────────────────

export interface SOSCreatedPayload {
  sosId: string;
  tripId?: string | null;
  userId: string;
  userType: 'RIDER' | 'DRIVER';
  location: {
    lat: number;
    lng: number;
  };
  reason?: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOS Resolved - Published when SOS is resolved
// ─────────────────────────────────────────────────────────────────────────────

export interface SOSResolvedPayload {
  sosId: string;
  resolvedBy: string;
  resolution: 'FALSE_ALARM' | 'RESOLVED' | 'ESCALATED_TO_AUTHORITIES';
  notes?: string | null;
  resolvedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Type Aliases
// ─────────────────────────────────────────────────────────────────────────────

export type SOSCreatedEvent = SOSCreatedPayload;
export type SOSResolvedEvent = SOSResolvedPayload;
