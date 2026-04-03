import { Elysia } from 'elysia';
import { RealtimeService } from './service';
import { wsMessagesTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';

export const realtime = new Elysia()
  .ws('/ws', {
    open(ws) {
      log('info', 'WebSocket connection opened', { id: ws.id });
    },
    message(ws, message: unknown) {
      try {
        // Handle both string and pre-parsed object messages
        // Handle both string and pre-parsed object or Buffer messages
        let data: any;
        if (typeof message === 'string') {
          data = JSON.parse(message);
        } else if (Buffer.isBuffer(message)) {
          data = JSON.parse(message.toString());
        } else {
          data = message;
        }

        wsMessagesTotal.inc({ type: data.type, direction: 'inbound' });

        if (data.type === 'subscribe' && data.channel && data.id) {
          const key = `${data.channel}:${data.id}`;
          RealtimeService.handleSubscribe(key, ws);
          ws.send(JSON.stringify({ type: 'subscribed', channel: data.channel, id: data.id }));
          wsMessagesTotal.inc({ type: 'subscribed', direction: 'outbound' });
        }

        if (data.type === 'unsubscribe' && data.channel && data.id) {
          const key = `${data.channel}:${data.id}`;
          RealtimeService.handleUnsubscribe(key);
          ws.send(JSON.stringify({ type: 'unsubscribed', channel: data.channel }));
        }

        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (error) {
        log('error', 'WebSocket message parse error', { error: String(error) });
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    },
    close(ws) {
      RealtimeService.handleDisconnect(ws);
      log('info', 'WebSocket connection closed', { id: ws.id });
    },
  });
