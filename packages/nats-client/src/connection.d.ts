import { NatsConnection } from 'nats';
export interface NatsConfig {
    url: string;
    name?: string;
    maxReconnectAttempts?: number;
    reconnectTimeWait?: number;
}
export declare function createNatsConnection(config: NatsConfig): Promise<NatsConnection>;
//# sourceMappingURL=connection.d.ts.map