import { fetchInternal } from '@ain-rider/internal-api';

export abstract class AdminProxyService {
  private static detectServiceName(serviceUrl: string): string {
    if (serviceUrl.includes('4003')) return 'admin-service';
    if (serviceUrl.includes('4000')) return 'auth-service';
    if (serviceUrl.includes('4001')) return 'trip-service';
    if (serviceUrl.includes('3002')) return 'location-service';
    if (serviceUrl.includes('3003')) return 'match-service';
    return 'unknown';
  }

  static async proxyTo(
    serviceUrl: string,
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<Response> {
    const serviceName = this.detectServiceName(serviceUrl);
    return fetchInternal(`${serviceUrl}${path}`, method, body, {
      targetService: serviceName,
      headers,
    });
  }
}
