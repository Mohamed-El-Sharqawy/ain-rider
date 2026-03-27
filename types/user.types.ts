export interface TokenPayload {
  sub: string;       // User ID
  email: string;     // User Email
  role: 'RIDER' | 'DRIVER' | 'ADMIN'; // User Role
  type: 'access' | 'refresh';
  exp: number;       // Expiration timestamp (seconds since epoch)
  iat: number;       // Issued at
}
