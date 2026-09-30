/**
 * DLQ Message Type
 * 
 * Message structure for Dead Letter Queue entries
 */

export interface DLQMessage {
  /** Original NATS subject */
  originalSubject: string;
  
  /** Original message payload (JSON string) */
  originalPayload: string;
  
  /** Original message headers */
  originalHeaders: Record<string, string>;
  
  /** Event ID from original envelope */
  originalEventId: string;
  
  /** Trace ID from original envelope */
  traceId: string;
  
  /** Reason for failure */
  errorReason: string;
  
  /** Error stack trace */
  errorStack?: string;
  
  /** Number of retry attempts before DLQ */
  retryCount: number;
  
  /** Consumer that failed to process */
  consumerName: string;
  
  /** Timestamp when moved to DLQ */
  failedAt: string;
  
  /** Stream the message came from */
  sourceStream: string;
}

/**
 * Create a DLQ message from a failed JetStream message
 */
export function createDLQMessage(
  originalSubject: string,
  originalPayload: string,
  originalHeaders: Record<string, string>,
  originalEventId: string,
  traceId: string,
  error: Error,
  retryCount: number,
  consumerName: string,
  sourceStream: string
): DLQMessage {
  return {
    originalSubject,
    originalPayload,
    originalHeaders,
    originalEventId,
    traceId,
    errorReason: error.message,
    errorStack: error.stack,
    retryCount,
    consumerName,
    failedAt: new Date().toISOString(),
    sourceStream,
  };
}
