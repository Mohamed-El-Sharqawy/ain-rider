import { connect } from 'nats';
export async function createNatsConnection(config) {
    const options = {
        servers: config.url,
        name: config.name || 'ain-rider-service',
        maxReconnectAttempts: config.maxReconnectAttempts || -1,
        reconnectTimeWait: config.reconnectTimeWait || 2000,
    };
    try {
        const nc = await connect(options);
        console.log(`[NATS] Connected to ${nc.getServer()}`);
        (async () => {
            for await (const status of nc.status()) {
                console.log(`[NATS] Status: ${status.type}: ${status.data}`);
            }
        })().catch((err) => {
            console.error('[NATS] Status error:', err);
        });
        return nc;
    }
    catch (error) {
        console.error('[NATS] Connection failed:', error);
        throw error;
    }
}
//# sourceMappingURL=connection.js.map