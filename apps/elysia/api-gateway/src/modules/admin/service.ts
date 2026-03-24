import { proxyRequestsTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';

const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL || 'http://admin-service:4003';

export abstract class AdminProxyService {
  static async proxy(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'admin-service', status: 'attempt' });
    
    try {
      const url = `${ADMIN_SERVICE_URL}${path}`;
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
        options.body = JSON.stringify(body ?? {});
      }

      const res = await fetch(url, options);
      proxyRequestsTotal.inc({ service: 'admin-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'admin-service', status: 'failed' });
      log('error', 'Admin service proxy failed', { method, path, error: String(error) });
      throw error;
    }
  }
}
