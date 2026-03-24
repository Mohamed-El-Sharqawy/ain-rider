/**
 * DLQ Alerting Service
 * 
 * Monitors DLQ messages and provides alerting capabilities
 */

import { NatsConnection, JetStreamClient } from 'nats';

export interface DLQAlertConfig {
  /** Alert callback - called when DLQ message is received */
  onAlert?: (alert: DLQAlert) => void;
  
  /** Log DLQ messages to console (default: true) */
  logToConsole?: boolean;
  
  /** Consumer name for DLQ monitoring */
  consumerName?: string;
}

export interface DLQAlert {
  originalSubject: string;
  originalEventId: string;
  consumerName: string;
  error: string;
  retryCount: number;
  timestamp: string;
  traceId?: string;
}

export class DLQAlertingService {
  private js: JetStreamClient;
  private config: DLQAlertConfig;

  constructor(js: JetStreamClient, config?: DLQAlertConfig) {
    this.js = js;
    this.config = {
      logToConsole: true,
      ...config,
    };
  }

  /**
   * Create an alert from a DLQ message
   */
  createAlert(dlqMessage: {
    originalSubject: string;
    originalEventId: string;
    consumerName: string;
    error: { message: string };
    retryCount: number;
    traceId?: string;
  }): DLQAlert {
    return {
      originalSubject: dlqMessage.originalSubject,
      originalEventId: dlqMessage.originalEventId,
      consumerName: dlqMessage.consumerName,
      error: dlqMessage.error.message,
      retryCount: dlqMessage.retryCount,
      timestamp: new Date().toISOString(),
      traceId: dlqMessage.traceId,
    };
  }

  /**
   * Process a DLQ message and trigger alert
   */
  async processDLQMessage(dlqMessage: {
    originalSubject: string;
    originalEventId: string;
    consumerName: string;
    error: { message: string };
    retryCount: number;
    traceId?: string;
  }): Promise<void> {
    const alert = this.createAlert(dlqMessage);

    // Log to console
    if (this.config.logToConsole) {
      console.error(
        JSON.stringify({
          level: 'error',
          type: 'dlq_alert',
          ...alert,
        })
      );
    }

    // Call custom alert handler
    if (this.config.onAlert) {
      try {
        await this.config.onAlert(alert);
      } catch (err) {
        console.error('[DLQAlerting] Alert handler error:', err);
      }
    }
  }

  /**
   * Start monitoring DLQ subjects
   * This creates a consumer that processes DLQ messages
   */
  async startMonitoring(nc: NatsConnection): Promise<void> {
    const jsm = await nc.jetstreamManager();
    
    // Ensure DLQ stream exists
    try {
      await jsm.streams.info('AIN_RIDER_DLQ');
    } catch {
      await jsm.streams.add({
        name: 'AIN_RIDER_DLQ',
        subjects: ['ain_rider.dlq.>'],
        retention: 'limits' as any,
        max_msgs: 10000,
        max_bytes: 50 * 1024 * 1024, // 50MB
        storage: 'file' as any,
      });
      console.log('[DLQAlerting] Created AIN_RIDER_DLQ stream');
    }

    // Create consumer for DLQ monitoring
    const consumerName = this.config.consumerName || 'dlq-monitor';
    try {
      await jsm.consumers.info('AIN_RIDER_DLQ', consumerName);
    } catch {
      await jsm.consumers.add('AIN_RIDER_DLQ', {
        name: consumerName,
        durable_name: consumerName,
        filter_subject: 'ain_rider.dlq.>',
        ack_policy: 'explicit' as any,
        deliver_policy: 'all' as any,
      });
      console.log(`[DLQAlerting] Created consumer ${consumerName}`);
    }

    // Start consuming
    const consumer = await this.js.consumers.get('AIN_RIDER_DLQ', consumerName);
    const messages = await consumer.consume();

    (async () => {
      for await (const msg of messages) {
        try {
          const payload = JSON.parse(new TextDecoder().decode(msg.data));
          await this.processDLQMessage(payload);
          msg.ack();
        } catch (err) {
          console.error('[DLQAlerting] Error processing DLQ message:', err);
          msg.nak();
        }
      }
    })();

    console.log('[DLQAlerting] Started monitoring DLQ');
  }
}

/**
 * Factory function to create a DLQAlertingService
 */
export function createDLQAlerting(
  js: JetStreamClient,
  config?: DLQAlertConfig
): DLQAlertingService {
  return new DLQAlertingService(js, config);
}
