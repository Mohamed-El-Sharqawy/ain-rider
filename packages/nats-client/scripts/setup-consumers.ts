/**
 * NATS JetStream Consumer Setup Script
 * 
 * Creates durable pull consumers for each service.
 * Consumers are configured with explicit ack policy and retry limits.
 * 
 * Usage: npx ts-node scripts/setup-consumers.ts
 */

import { connect, NatsConnection, JetStreamManager, AckPolicy, DeliverPolicy } from 'nats';

interface ConsumerConfig {
  stream: string;
  name: string;
  filterSubject: string;
  maxDeliver: number;
  ackWaitMs: number;
  description: string;
}

const CONSUMER_CONFIGS: ConsumerConfig[] = [
  // Trip service consumers
  {
    stream: 'AIN_RIDER_OPS',
    name: 'trip-matched-consumer',
    filterSubject: 'ain_rider.trip_matched',
    maxDeliver: 3,
    ackWaitMs: 30000,
    description: 'Trip service - handles trip_matched events',
  },
  
  // Match service consumers
  {
    stream: 'AIN_RIDER_OPS',
    name: 'trip-requested-consumer',
    filterSubject: 'ain_rider.trip_requested',
    maxDeliver: 3,
    ackWaitMs: 30000,
    description: 'Match service - handles trip_requested events for driver matching',
  },
  
  // Payment service consumers
  {
    stream: 'AIN_RIDER_FINANCIAL',
    name: 'trip-completed-consumer',
    filterSubject: 'ain_rider.trip_completed',
    maxDeliver: 3,
    ackWaitMs: 30000,
    description: 'Payment service - handles trip_completed events for payment processing',
  },
  
  // WebSocket server consumers (low latency, no retry)
  {
    stream: 'AIN_RIDER_OPS',
    name: 'ws-location-consumer',
    filterSubject: 'ain_rider.location_update',
    maxDeliver: 1,
    ackWaitMs: 5000,
    description: 'WebSocket server - fanout location updates to connected clients',
  },
  {
    stream: 'AIN_RIDER_OPS',
    name: 'ws-trip-consumer',
    filterSubject: 'ain_rider.trip_*',
    maxDeliver: 1,
    ackWaitMs: 5000,
    description: 'WebSocket server - fanout trip events to connected clients',
  },
  {
    stream: 'AIN_RIDER_FINANCIAL',
    name: 'ws-payment-consumer',
    filterSubject: 'ain_rider.payment_processed',
    maxDeliver: 1,
    ackWaitMs: 5000,
    description: 'WebSocket server - fanout payment events to connected clients',
  },
  {
    stream: 'AIN_RIDER_OPS',
    name: 'ws-sos-consumer',
    filterSubject: 'ain_rider.sos_*',
    maxDeliver: 1,
    ackWaitMs: 5000,
    description: 'WebSocket server - fanout SOS alerts to admin clients',
  },
  
  // Admin service consumers
  {
    stream: 'AIN_RIDER_OPS',
    name: 'admin-notification-consumer',
    filterSubject: 'ain_rider.notification_sent',
    maxDeliver: 3,
    ackWaitMs: 30000,
    description: 'Admin service - sync notification records',
  },
  {
    stream: 'AIN_RIDER_OPS',
    name: 'admin-complaint-consumer',
    filterSubject: 'ain_rider.complaint_*',
    maxDeliver: 3,
    ackWaitMs: 30000,
    description: 'Admin service - sync complaint records',
  },
  {
    stream: 'AIN_RIDER_FINANCIAL',
    name: 'admin-withdrawal-consumer',
    filterSubject: 'ain_rider.withdrawal_*',
    maxDeliver: 3,
    ackWaitMs: 30000,
    description: 'Admin service - sync withdrawal records',
  },
];

async function createConsumer(
  jsm: JetStreamManager,
  config: ConsumerConfig
): Promise<void> {
  try {
    // Check if consumer already exists
    await jsm.consumers.info(config.stream, config.name);
    console.log(`[SETUP] Consumer ${config.name} already exists - skipping creation`);
  } catch (err: any) {
    if (err?.api_error?.err_code === 10014) {
      // Consumer not found - create it
      await jsm.consumers.add(config.stream, {
        durable_name: config.name,
        filter_subject: config.filterSubject,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        max_deliver: config.maxDeliver,
        ack_wait: config.ackWaitMs * 1_000_000, // ms to nanoseconds
      });
      console.log(`[SETUP] Created consumer ${config.name}: ${config.description}`);
    } else {
      throw err;
    }
  }
}

async function setupConsumers(): Promise<void> {
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

  console.log('[SETUP] Creating/updating consumers...\n');

  for (const config of CONSUMER_CONFIGS) {
    await createConsumer(jsm, config);
  }

  console.log('\n[SETUP] Consumer setup complete!');
  console.log('[SETUP] Summary:');
  
  // Group by stream
  const byStream = new Map<string, ConsumerConfig[]>();
  for (const config of CONSUMER_CONFIGS) {
    const list = byStream.get(config.stream) || [];
    list.push(config);
    byStream.set(config.stream, list);
  }
  
  for (const [stream, consumers] of byStream) {
    console.log(`  ${stream}:`);
    for (const c of consumers) {
      console.log(`    - ${c.name} (${c.filterSubject})`);
    }
  }

  await nc.close();
}

// Run setup
setupConsumers().catch((error) => {
  console.error('[SETUP] Fatal error:', error);
  process.exit(1);
});
