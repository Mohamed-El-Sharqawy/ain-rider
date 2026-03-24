export class NatsPublisher {
    nc;
    js;
    constructor(nc) {
        this.nc = nc;
        this.js = this.nc.jetstream();
    }
    async publish(event, options) {
        try {
            const payload = JSON.stringify(event.data);
            await this.js.publish(event.subject, new TextEncoder().encode(payload), options);
            console.log(`[NATS Publisher] Published to ${event.subject}`);
        }
        catch (error) {
            console.error(`[NATS Publisher] Failed to publish to ${event.subject}:`, error);
            throw error;
        }
    }
    async publishBatch(events) {
        const promises = events.map((event) => this.publish(event));
        await Promise.all(promises);
    }
}
export function createPublisher(nc) {
    return new NatsPublisher(nc);
}
//# sourceMappingURL=publisher.js.map