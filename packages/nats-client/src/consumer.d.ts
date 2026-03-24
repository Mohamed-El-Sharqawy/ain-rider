import { NatsConnection, JsMsg } from "nats";
export interface ConsumerOptions {
    stream: string;
    consumer: string;
    filterSubject?: string;
    deliverPolicy?: "all" | "last" | "new";
    ackWait?: number;
    maxDeliver?: number;
}
export type MessageHandler<T = any> = (data: T, msg: JsMsg) => Promise<void>;
export declare class NatsConsumer {
    private nc;
    private js;
    constructor(nc: NatsConnection);
    subscribe<T = any>(subject: string, handler: MessageHandler<T>, options?: Partial<ConsumerOptions>): Promise<void>;
    ensureStream(streamName: string, _subjects: string[]): Promise<void>;
    ensureConsumer(streamName: string, consumerName: string, filterSubject: string): Promise<void>;
}
export declare function createConsumer(nc: NatsConnection): NatsConsumer;
//# sourceMappingURL=consumer.d.ts.map