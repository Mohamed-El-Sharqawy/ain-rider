import { UserRole } from '../lib/api/types';

export interface TokenPayload {
  sub: string;       // User ID
  email: string;     // User Email
  role: UserRole;    // User Role
  type: 'access' | 'refresh';
  exp: number;       // Expiration timestamp (seconds since epoch)
  iat: number;       // Issued at
}
