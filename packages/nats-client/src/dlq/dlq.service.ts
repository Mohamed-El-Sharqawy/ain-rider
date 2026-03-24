/**
 * DLQ Service
 * 
 * Sends failed messages to the Dead Letter Queue for ops review
 */

import { JetStreamClient } from 'nats';
import { DLQMessage, createDLQMessage } from '../types/dlq-message';

export interface SendToDLQOptions {
  originalSubject: string;
  originalPayload: string;
  originalHeaders: Record<string, string>;
  originalEventId: string;
  traceId: string;
  error: Error;
  retryCount: number;
  consumerName: string;
  sourceStream: string;
}

export class DLQService {
  private js: JetStreamClient;

  constructor(js: JetStreamClient) {
    this.js = js;
  }

  /**
   * Send a failed message to the DLQ
   * 
   * @param options - DLQ message details
   */
  async sendToDLQ(options: SendToDLQOptions): Promise<void> {
    const dlqSubject = this.buildDLQSubject(options.originalSubject);

    const dlqMessage: DLQMessage = createDLQMessage(
      options.originalSubject,
      options.originalPayload,
      options.originalHeaders,
      options.originalEventId,
      options.traceId,
      options.error,
      options.retryCount,
      options.consumerName,
      options.sourceStream
    );

    try {
      const payload = JSON.stringify(dlqMessage);
      await this.js.publish(dlqSubject, new TextEncoder().encode(payload));

      console.error(
        `[DLQ] Message sent to ${dlqSubject} | consumer=${options.consumerName} | eventId=${options.originalEventId} | traceId=${options.traceId} | error=${options.error.message}`
      );
    } catch (error) {
      console.error(
        `[DLQ] Failed to send to DLQ | subject=${dlqSubject} | traceId=${options.traceId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Build DLQ subject from original subject
   * ain_rider.trip_matched -> ain_rider.dlq.trip_matched
   */
  private buildDLQSubject(originalSubject: string): string {
    const prefix = 'ain_rider.';
    if (originalSubject.startsWith(prefix)) {
      const suffix = originalSubject.slice(prefix.length);
      return `ain_rider.dlq.${suffix}`;
    }
    return `ain_rider.dlq.${originalSubject}`;
  }
}

/**
 * Factory function to create a DLQService
 */
export function createDLQService(js: JetStreamClient): DLQService {
  return new DLQService(js);
}
