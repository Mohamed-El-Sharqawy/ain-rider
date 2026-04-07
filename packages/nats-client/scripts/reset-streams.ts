/**
 * NATS JetStream Stream Reset Script
 * 
 * Deletes all ain-rider streams and recreates them with correct configuration.
 * Use this when migrating from old AIN_RIDER stream to new AIN_RIDER_OPS/FINANCIAL streams.
 * 
 * Usage: npx ts-node scripts/reset-streams.ts
 */

import { connect, NatsConnection, RetentionPolicy, StorageType } from 'nats';

const STREAMS_TO_DELETE = ['AIN_RIDER', 'ain_rider', 'AIN_RIDER_OPS', 'AIN_RIDER_FINANCIAL', 'AIN_RIDER_DLQ', 'AIN_RIDER_LOCATION'];

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
    maxAgeDays: 1,
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

async function resetStreams(): Promise<void> {
  const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
  
  console.log(`[RESET] Connecting to NATS at ${natsUrl}...`);
  
  let nc: NatsConnection;
  try {
    nc = await connect({ servers: natsUrl });
  } catch (error) {
    console.error('[RESET] Failed to connect to NATS:', error);
    process.exit(1);
  }

  const jsm = await nc.jetstreamManager();

  // Delete existing streams
  console.log('\n[RESET] Deleting existing streams...');
  for (const streamName of STREAMS_TO_DELETE) {
    try {
      await jsm.streams.delete(streamName);
      console.log(`[RESET] Deleted stream: ${streamName}`);
    } catch (err: any) {
      if (err?.api_error?.err_code === 10059 || err.message?.includes('stream not found') || err.code === '404' || err.code === 404) {
        console.log(`[RESET] Stream ${streamName} does not exist - skipping`);
      } else {
        console.log(`[RESET] Could not delete ${streamName}:`, err);
      }
    }
  }

  // Create new streams
  console.log('\n[RESET] Creating new streams...');
  for (const config of STREAM_CONFIGS) {
    try {
      await jsm.streams.add({
        name: config.name,
        subjects: config.subjects,
        retention: RetentionPolicy.Limits,
        max_age: config.maxAgeDays * 24 * 60 * 60 * 1_000_000_000, // days to nanoseconds
        storage: StorageType.File,
        num_replicas: parseInt(process.env.NATS_REPLICAS || '1', 10),
        discard: 'old' as any,
      });
      console.log(`[RESET] Created stream ${config.name}: ${config.description}`);
    } catch (err: any) {
      console.error(`[RESET] Failed to create ${config.name}:`, err.message);
    }
  }

  // Verify
  console.log('\n[RESET] Stream reset complete!');
  console.log('[RESET] Summary:');
  
  const streams = await jsm.streams.list().next();
  for (const info of streams) {
    console.log(`  - ${info.config.name}: ${info.state.messages} messages, ${info.config.subjects?.join(', ')}`);
  }

  await nc.close();
}

// Run reset
resetStreams().catch((error) => {
  console.error('[RESET] Fatal error:', error);
  process.exit(1);
});
