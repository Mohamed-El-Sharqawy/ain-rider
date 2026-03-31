import { proxyRequestsTotal } from '../../shared/metrics';
import { log } from '../../shared/logger';
import type { LoginBody, RegisterBody } from './model';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';
console.log(`[Proxy] Auth service base URL: ${AUTH_SERVICE_URL}`);

export abstract class AuthProxyService {
  static async login(body: LoginBody): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'auth-service', status: 'attempt' });
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      proxyRequestsTotal.inc({ service: 'auth-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'auth-service', status: 'failed' });
      log('error', 'Auth service login proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async register(body: RegisterBody): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'auth-service', status: 'attempt' });
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      proxyRequestsTotal.inc({ service: 'auth-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'auth-service', status: 'failed' });
      log('error', 'Auth service register proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async refresh(token: string): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'auth-service', status: 'attempt' });
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      proxyRequestsTotal.inc({ service: 'auth-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'auth-service', status: 'failed' });
      log('error', 'Auth service refresh proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async requestOtp(body: { phone: string }): Promise<Response> {
    console.log(`[Proxy] Forwarding to: ${AUTH_SERVICE_URL}/auth/request-otp`);
    proxyRequestsTotal.inc({ service: 'auth-service', status: 'attempt' });
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      proxyRequestsTotal.inc({ service: 'auth-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'auth-service', status: 'failed' });
      log('error', 'Auth service requestOtp proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async verifyOtp(body: { phone: string; code: string }): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'auth-service', status: 'attempt' });
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      proxyRequestsTotal.inc({ service: 'auth-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'auth-service', status: 'failed' });
      log('error', 'Auth service verifyOtp proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async getMe(token: string): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'auth-service', status: 'attempt' });
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      proxyRequestsTotal.inc({ service: 'auth-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'auth-service', status: 'failed' });
      log('error', 'Auth service getMe proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async adminCreateUser(token: string, body: unknown): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'auth-service', status: 'attempt' });
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/admin/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      proxyRequestsTotal.inc({ service: 'auth-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'auth-service', status: 'failed' });
      log('error', 'Auth service adminCreateUser proxy failed', { error: String(error) });
      throw error;
    }
  }

  static async uploadRiderIdentity(token: string, formData: FormData): Promise<Response> {
    proxyRequestsTotal.inc({ service: 'auth-service', status: 'attempt' });
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/rider/documents/identity`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      proxyRequestsTotal.inc({ service: 'auth-service', status: res.ok ? 'success' : 'error' });
      return res;
    } catch (error) {
      proxyRequestsTotal.inc({ service: 'auth-service', status: 'failed' });
      log('error', 'Auth service uploadRiderIdentity proxy failed', { error: String(error) });
      throw error;
    }
  }
}
