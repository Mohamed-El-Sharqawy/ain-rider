/**
 * NATS JetStream Stream Setup Script
 * 
 * Creates the three streams required for ain-rider:
 * - AIN_RIDER_OPS: Operational events (7-day retention)
 * - AIN_RIDER_FINANCIAL: Financial events (30-day retention)
 * - AIN_RIDER_DLQ: Dead letter queue (30-day retention)
 * 
 * Usage: npx ts-node scripts/setup-streams.ts
 */

import { connect, NatsConnection, JetStreamManager, RetentionPolicy, StorageType } from 'nats';

interface StreamConfig {
  name: string;
  subjects: string[];
  maxAgeDays: number;
  description: string;
}

const STREAM_CONFIGS: StreamConfig[] = [
  {
    name: 'AIN_RIDER_OPS',
    subjects: [
      'ain_rider.trip_requested',
      'ain_rider.trip_assigned',
      'ain_rider.trip_matched',
      'ain_rider.trip_started',
      'ain_rider.trip_completed',
      'ain_rider.trip_cancelled',
      'ain_rider.trip_rejected',
      'ain_rider.trip_no_match',
      'ain_rider.sos_created',
      'ain_rider.sos_resolved',
      'ain_rider.user_created',
      'ain_rider.user_updated',
      'ain_rider.user_status_changed',
      'ain_rider.user_deleted',
      'ain_rider.notification_sent',
      'ain_rider.complaint_created',
      'ain_rider.complaint_updated',
    ],
    maxAgeDays: 7,
    description: 'Operational events with 7-day retention',
  },
  {
    name: 'AIN_RIDER_LOCATION',
    subjects: [
      'ain_rider.location_update',
      'ain_rider.location_updated',
    ],
    maxAgeDays: 1, // Only 1 day for location history in hot stream
    description: 'High-volume location updates',
  },
  {
    name: 'AIN_RIDER_FINANCIAL',
    subjects: [
      'ain_rider.payment_processed',
      'ain_rider.wallet_updated',
      'ain_rider.withdrawal_requested',
      'ain_rider.withdrawal_processed',
    ],
    maxAgeDays: 30,
    description: 'Financial events with 30-day retention for audit compliance',
  },
  {
    name: 'AIN_RIDER_DLQ',
    subjects: ['ain_rider.dlq.*'],
    maxAgeDays: 30,
    description: 'Dead letter queue for failed message handling',
  },
];

async function createStream(
  jsm: JetStreamManager,
  config: StreamConfig
): Promise<void> {
  const streamConfig = {
    name: config.name,
    subjects: config.subjects,
    retention: RetentionPolicy.Limits,
    max_age: config.maxAgeDays * 24 * 60 * 60 * 1_000_000_000, // days to nanoseconds
    storage: StorageType.File,
    num_replicas: parseInt(process.env.NATS_REPLICAS || '1', 10),
    discard: 'old' as any,
  };

  try {
    // Check if stream already exists
    const existing = await jsm.streams.info(config.name);
    // Always update to ensure subjects are in sync
    const existingSubjects = existing.config.subjects.sort().join(',');
    const desiredSubjects = config.subjects.sort().join(',');
    if (existingSubjects !== desiredSubjects) {
      await jsm.streams.update(config.name, { ...existing.config, subjects: config.subjects });
      console.log(`[SETUP] Updated stream ${config.name} subjects: ${config.subjects.join(', ')}`);
    } else {
      console.log(`[SETUP] Stream ${config.name} already up-to-date`);
    }
  } catch (err: any) {
    if (err?.api_error?.err_code === 10059 || err.message?.includes('stream not found') || err.code === '404') {
      // Stream not found - create it
      await jsm.streams.add(streamConfig);
      console.log(`[SETUP] Created stream ${config.name}: ${config.description}`);
    } else {
      throw err;
    }
  }
}

async function setupStreams(): Promise<void> {
  const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
  
  console.log(`[SETUP] Connecting to NATS at ${natsUrl}...`);
  
  let nc: NatsConnection;
  try {
    nc = await connect({ servers: natsUrl });
  } catch (error) {
    console.error('[SETUP] Failed to connect to NATS:', error);
    process.exit(1);
  }

  const jsm = await nc.jetstreamManager();

  console.log('[SETUP] Creating/updating streams...\n');

  for (const config of STREAM_CONFIGS) {
    await createStream(jsm, config);
  }

  console.log('\n[SETUP] Stream setup complete!');
  console.log('[SETUP] Summary:');
  
  for (const config of STREAM_CONFIGS) {
    const info = await jsm.streams.info(config.name);
    console.log(`  - ${config.name}: ${info.state.messages} messages, ${info.state.bytes} bytes`);
  }

  await nc.close();
}

// Run setup
setupStreams().catch((error) => {
  console.error('[SETUP] Fatal error:', error);
  process.exit(1);
});
