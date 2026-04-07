import { fetchInternal } from '@ain-rider/internal-api';
import type { LoginBody, RegisterBody } from './model';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';
console.log(`[Proxy] Auth service base URL: ${AUTH_SERVICE_URL}`);

export abstract class AuthProxyService {
  static async login(body: LoginBody): Promise<Response> {
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/login`, 'POST', body, {
      targetService: 'auth-service',
    });
  }

  static async register(body: RegisterBody): Promise<Response> {
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/register`, 'POST', body, {
      targetService: 'auth-service',
    });
  }

  static async refresh(token: string): Promise<Response> {
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/refresh`, 'POST', {}, {
      targetService: 'auth-service',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  }

  static async requestOtp(body: { phone: string }): Promise<Response> {
    console.log(`[Proxy] Forwarding to: ${AUTH_SERVICE_URL}/auth/request-otp`);
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/request-otp`, 'POST', body, {
      targetService: 'auth-service',
    });
  }

  static async verifyOtp(body: { phone: string; code: string }): Promise<Response> {
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/verify-otp`, 'POST', body, {
      targetService: 'auth-service',
    });
  }

  static async getMe(token: string): Promise<Response> {
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/me`, 'GET', undefined, {
      targetService: 'auth-service',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  }

  static async adminCreateUser(token: string, body: unknown): Promise<Response> {
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/admin/create-user`, 'POST', body, {
      targetService: 'auth-service',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  }

  static async uploadRiderIdentity(token: string, formData: FormData): Promise<Response> {
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/rider/documents/identity`, 'POST', formData, {
      targetService: 'auth-service',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  }

  static async proxyDriverGet(token: string, path: string): Promise<Response> {
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/driver/${path}`, 'GET', undefined, {
      targetService: 'auth-service',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  }

  static async proxyDriverPatch(token: string, path: string, body: unknown): Promise<Response> {
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/driver/${path}`, 'PATCH', body, {
      targetService: 'auth-service',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  }

  static async proxyDriverMultipart(token: string, path: string, contentType: string, rawBody: ArrayBuffer): Promise<Response> {
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/driver/${path}`, 'POST', rawBody, {
      targetService: 'auth-service',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': contentType },
    });
  }

  static async proxyDriverPatchMultipart(token: string, path: string, contentType: string, rawBody: ArrayBuffer): Promise<Response> {
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/driver/${path}`, 'PATCH', rawBody, {
      targetService: 'auth-service',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': contentType },
    });
  }

  static async proxyRiderMultipart(token: string, path: string, contentType: string, rawBody: ArrayBuffer): Promise<Response> {
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/rider/${path}`, 'POST', rawBody, {
      targetService: 'auth-service',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': contentType },
    });
  }

  static async proxyRiderIdentityUpload(token: string, contentType: string, rawBody: ArrayBuffer): Promise<Response> {
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/rider/documents/identity`, 'POST', rawBody, {
      targetService: 'auth-service',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': contentType },
    });
  }

  static async proxyRiderProfileImage(token: string, contentType: string, rawBody: ArrayBuffer): Promise<Response> {
    return fetchInternal(`${AUTH_SERVICE_URL}/auth/rider/profile/image`, 'PATCH', rawBody, {
      targetService: 'auth-service',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': contentType },
    });
  }
}
