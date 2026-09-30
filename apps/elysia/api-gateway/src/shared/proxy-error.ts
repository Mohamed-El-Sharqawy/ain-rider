import { log } from './logger';

export interface ProxyResponse {
  success: boolean;
  error?: { code: string; message: string };
  [key: string]: unknown;
}

export async function handleProxyResponse(
  res: Response,
  set: { status: number },
): Promise<ProxyResponse> {
  if (!res.ok) {
    set.status = res.status;
    try {
      const body = await res.json();
      log('warn', `Proxy error: ${res.status}`, { status: res.status, body });
      return body as ProxyResponse;
    } catch {
      return {
        success: false,
        error: {
          code: 'PROXY_ERROR',
          message: `Target service error: ${res.status} ${res.statusText}`,
        },
      };
    }
  }

  try {
    return await res.json();
  } catch {
    return { success: true };
  }
}
