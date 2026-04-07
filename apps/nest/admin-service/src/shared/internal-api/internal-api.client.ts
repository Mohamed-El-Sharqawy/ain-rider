import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { fetchInternal } from '@ain-rider/internal-api';

@Injectable()
export class InternalApiClient {
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService
  ) {}

  async fetchInternal(url: string, method: string = 'GET', body?: any): Promise<any> {
    const secret = this.configService.get<string>('INTERNAL_SERVICE_SECRET');

    const token = await this.jwtService.signAsync(
      { service: 'admin-service', internal: true },
      { secret, expiresIn: '60s' }
    );

    const response = await fetchInternal(url, method, body, {
      targetService: 'internal',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      let errorMessage = `Internal API call failed: ${response.status}`;
      try {
        const errorData = await response.json() as any;
        errorMessage = errorData.message || errorMessage;
      } catch {
        // Fallback if response is not JSON
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }
}
