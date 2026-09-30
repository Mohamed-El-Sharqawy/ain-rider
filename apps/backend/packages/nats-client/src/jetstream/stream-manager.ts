/**
 * JetStream Stream Manager
 * 
 * Provides utilities for idempotent stream management including:
 * - Automatic stream creation/update
 * - Subject management
 * - Retention & storage configuration
 */

import { 
  NatsConnection, 
  JetStreamManager, 
  StreamConfig, 
  DiscardPolicy, 
  RetentionPolicy, 
  StorageType 
} from 'nats';

export interface StreamOptions {
  subjects: string[];
  storage?: 'file' | 'memory';
  retention?: 'limits' | 'interest' | 'workqueue';
  maxAge?: number; // nanoseconds
  replicas?: number;
}

export class StreamManager {
  private jsm: Promise<JetStreamManager>;

  constructor(nc: NatsConnection) {
    this.jsm = nc.jetstreamManager();
  }

  /**
   * Idempotently create or update a JetStream stream
   * 
   * @param name - Stream name (e.g., 'ain_rider')
   * @param options - Stream configuration
   */
  async ensureStream(name: string, options: StreamOptions): Promise<void> {
    const manager = await this.jsm;
    
    const config: Partial<StreamConfig> = {
      name,
      subjects: options.subjects,
      storage: options.storage === 'memory' ? StorageType.Memory : StorageType.File,
      retention: options.retention === 'workqueue' 
        ? RetentionPolicy.Workqueue 
        : options.retention === 'interest' 
          ? RetentionPolicy.Interest 
          : RetentionPolicy.Limits,
      discard: DiscardPolicy.Old,
      max_age: options.maxAge ?? 31536000000000000, // Default 1 year in ns
      num_replicas: options.replicas ?? 3,
      allow_rollup_hdrs: true,
      deny_delete: false,
      deny_purge: false,
    };

    try {
      // 1. Check if stream with this EXACT name exists
      try {
        await manager.streams.info(name);
        // Update existing stream (idempotent)
        await manager.streams.update(name, config);
        console.log(`[StreamManager] Updated stream: ${name} with subjects: ${options.subjects.join(', ')}`);
        return;
      } catch (err: any) {
        if (!err.message?.includes('stream not found')) throw err;
      }

      // 2. If name doesn't exist, try to ADD it
      await manager.streams.add(config);
      console.log(`[StreamManager] Created stream: ${name} with subjects: ${options.subjects.join(', ')}`);

    } catch (err: any) {
      // 3. Handle 'subjects overlap' error (API Error Code 10065) or standard 400 with description
      const isOverlapError = err.api_error?.err_code === 10065 || 
                            err.message?.includes('subjects overlap') ||
                            err.description?.includes('subjects overlap');

      if (isOverlapError) {
        console.warn(`[StreamManager] Subjects ${options.subjects.join(', ')} overlap with another stream. Attempting resolution...`);

        // Find which stream owns these subjects
        const streamList = await manager.streams.list().next();

        // Check for direct overlap (one of our subjects is already in another stream)
        const overlappingStream = streamList.find(s =>
          (s.config.subjects ?? []).some(existingSub =>
            options.subjects.some(newSub => this.subjectsOverlap(existingSub, newSub))
          )
        );

        if (overlappingStream) {
          console.log(`[StreamManager] Found overlapping stream: ${overlappingStream.config.name}. Attempting to merge subjects.`);

          // Never pull in subjects that would collide with a different
          // stream: an update capturing a sibling stream's subjects is
          // rejected by the server, so those requests are skipped.
          const foreignSubjects = streamList
            .filter(s => s.config.name !== overlappingStream.config.name)
            .flatMap(s => s.config.subjects ?? []);
          const safeIncoming = options.subjects.filter(
            subject => !foreignSubjects.some(foreign => this.subjectsOverlap(subject, foreign))
          );

          // Merge subjects, dropping ones already covered by a broader
          // subject in the merged list: a stream cannot carry subjects that
          // overlap each other (e.g. an exact subject plus a wildcard that
          // subsumes it), otherwise the update is rejected by the server.
          // The fallback below is defensive: find() never selects a stream
          // whose subjects list is missing.
          const mergedSubjects = this.mergeSubjects(
            /* v8 ignore next */
            overlappingStream.config.subjects ?? [],
            safeIncoming
          );

          try {
            await manager.streams.update(overlappingStream.config.name, {
              ...overlappingStream.config,
              subjects: mergedSubjects
            });
            console.log(`[StreamManager] Successfully merged subjects into ${overlappingStream.config.name}`);
            return;
          } catch (updateErr: any) {
            console.error(`[StreamManager] Failed to update overlapping stream ${overlappingStream.config.name}:`, updateErr);
          }
        }
      }
      
      console.error(`[StreamManager] Failed to manage stream ${name}:`, err);
      throw err;
    }
  }

  /**
   * Helper to check if two NATS subjects overlap (handles wildcards)
   */
  private subjectsOverlap(s1: string, s2: string): boolean {
    if (s1 === s2) return true;
    if (s1 === '>' || s2 === '>') return true;

    const p1 = s1.split('.');
    const p2 = s2.split('.');

    for (let i = 0; i < Math.min(p1.length, p2.length); i++) {
      if (p1[i] === '>' || p2[i] === '>') return true;
      if (p1[i] === '*' || p2[i] === '*') continue;
      if (p1[i] !== p2[i]) return false;
    }

    return p1.length === p2.length;
  }

  /**
   * Merge two subject lists into a valid (non-self-overlapping) subject set.
   * Subjects already captured by a broader pattern in the merged list are
   * dropped; routing is preserved because the broader pattern captures the
   * same messages.
   */
  private mergeSubjects(existing: string[], incoming: string[]): string[] {
    const all = Array.from(new Set([...existing, ...incoming]));
    return all.filter(
      (subject) => !all.some(
        (other) => other !== subject && this.subjectCovers(other, subject)
      )
    );
  }

  /**
   * Check whether pattern `pattern` captures every message that `subject`
   * captures (so `subject` can be dropped from a merged subject list).
   */
  private subjectCovers(pattern: string, subject: string): boolean {
    const patternTokens = pattern.split('.');
    const subjectTokens = subject.split('.');

    if (subjectTokens.length < patternTokens.length) return false;

    for (let i = 0; i < subjectTokens.length; i++) {
      if (patternTokens[i] === '>') return true;
      if (patternTokens[i] === undefined) return false;
      if (patternTokens[i] === '*') continue;
      if (patternTokens[i] !== subjectTokens[i]) return false;
    }

    return true;
  }

  /**
   * List all streams and their subjects
   */
  async listStreams(): Promise<string[]> {
    const manager = await this.jsm;
    const streams = await manager.streams.list().next();
    return streams.map(s => s.config.name);
  }

  /**
   * Delete a stream
   */
  async deleteStream(name: string): Promise<void> {
    const manager = await this.jsm;
    await manager.streams.delete(name);
    console.log(`[StreamManager] Deleted stream: ${name}`);
  }
}

/**
 * Factory function to create a StreamManager
 */
export function createStreamManager(nc: NatsConnection): StreamManager {
  return new StreamManager(nc);
}
