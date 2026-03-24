import { NatsConnection, JetStreamPublishOptions } from 'nats';
import { NatsEvent } from '@ain-rider/shared-types';
export declare class NatsPublisher {
    private nc;
    private js;
    constructor(nc: NatsConnection);
    publish<T extends NatsEvent>(event: T, options?: Partial<JetStreamPublishOptions>): Promise<void>;
    publishBatch(events: NatsEvent[]): Promise<void>;
}
export declare function createPublisher(nc: NatsConnection): NatsPublisher;
//# sourceMappingURL=publisher.d.ts.map