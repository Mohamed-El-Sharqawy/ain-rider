import { RetentionPolicy, StorageType, AckPolicy, DeliverPolicy, } from "nats";
export class NatsConsumer {
    nc;
    js;
    constructor(nc) {
        this.nc = nc;
        this.js = nc.jetstream();
    }
    async subscribe(subject, handler, options) {
        const streamName = options?.stream || "AIN_RIDER";
        await this.ensureStream(streamName, [subject]);
        await this.ensureConsumer(streamName, options?.consumer || `${subject}-consumer`, subject);
        try {
            const consumer = await this.js.consumers.get(options?.stream || "AIN_RIDER", options?.consumer || `${subject}-consumer`);
            const messages = await consumer.consume();
            console.log(`[NATS Consumer] Subscribed to ${subject}`);
            for await (const msg of messages) {
                try {
                    const data = JSON.parse(new TextDecoder().decode(msg.data));
                    await handler(data, msg);
                    msg.ack();
                }
                catch (error) {
                    console.error(`[NATS Consumer] Error processing message:`, error);
                    msg.nak();
                }
            }
        }
        catch (error) {
            console.error(`[NATS Consumer] Subscription failed for ${subject}:`, error);
            throw error;
        }
    }
    async ensureStream(streamName, _subjects) {
        const jsm = await this.nc.jetstreamManager();
        try {
            await jsm.streams.info(streamName);
            console.log(`[NATS] Stream ${streamName} already exists`);
        }
        catch (err) {
            if (err?.api_error?.err_code === 10059) {
                await jsm.streams.add({
                    name: streamName,
                    subjects: ["ain_rider.>"],
                    retention: RetentionPolicy.Limits,
                    max_age: 7 * 24 * 60 * 60 * 1_000_000_000,
                    storage: StorageType.File,
                });
                console.log(`[NATS] Stream ${streamName} created`);
            }
            else {
                throw err;
            }
        }
    }
    async ensureConsumer(streamName, consumerName, filterSubject) {
        const jsm = await this.nc.jetstreamManager();
        try {
            await jsm.consumers.info(streamName, consumerName);
            console.log(`[NATS] Consumer ${consumerName} already exists`);
        }
        catch (err) {
            if (err?.api_error?.err_code === 10014) {
                await jsm.consumers.add(streamName, {
                    durable_name: consumerName,
                    filter_subject: filterSubject,
                    ack_policy: AckPolicy.Explicit,
                    deliver_policy: DeliverPolicy.All,
                });
                console.log(`[NATS] Consumer ${consumerName} created for ${filterSubject}`);
            }
            else {
                throw err;
            }
        }
    }
}
export function createConsumer(nc) {
    return new NatsConsumer(nc);
}
//# sourceMappingURL=consumer.js.map