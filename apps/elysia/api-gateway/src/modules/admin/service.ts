import { proxyRequestsTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';

export abstract class AdminProxyService {
  /**
   * Proxies a request to a specified backend service.
   * 
   * @param serviceUrl - The base URL of the target service
   * @param method - HTTP Method
   * @param path - The path relative to the service base URL
   * @param body - Optional request body
   * @param headers - Optional extra headers (e.g., Internal Authorization)
   * @returns The fetch Response
   */
  static async proxyTo(
    serviceUrl: string,
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<Response> {
    const serviceName = serviceUrl.includes('4003') ? 'admin-service' : 
                       serviceUrl.includes('4000') ? 'auth-service' : 'trip-service';
    
    proxyRequestsTotal.inc({ service: serviceName, status: 'attempt' });
    
    try {
      const url = `${serviceUrl}${path}`;
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (method !== 'GET' && method !== 'HEAD' && body) {
        options.body = JSON.stringify(body);
      }

      const res = await fetch(url, options);
      proxyRequestsTotal.inc({ service: serviceName, status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: serviceName, status: 'failed' });
      log('error', `Proxy to ${serviceName} failed`, { method, path, error: String(error) });
      throw error;
    }
  }
}
