import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class InternalApiClient {
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  /**
   * Makes an authenticated internal HTTP request to another service.
   * 
   * @param url - The full URL of the internal endpoint
   * @param method - HTTP Method (GET, POST, etc.)
   * @param body - Optional request body
   * @returns The parsed JSON response
   */
  async fetchInternal(url: string, method: string = 'GET', body?: any) {
    const secret = this.configService.get<string>('INTERNAL_SERVICE_SECRET');
    
    // Generate an internal service token
    const token = await this.jwtService.signAsync(
      { service: 'admin-service', internal: true },
      { secret, expiresIn: '60s' }
    );

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let errorMessage = `Internal API call failed: ${response.status}`;
      try {
        const errorData = await response.json() as any;
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        // Fallback if response is not JSON
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }
}
