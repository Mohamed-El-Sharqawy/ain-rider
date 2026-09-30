/**
 * Simple JWT decoder to check for expiration without needing a full-blown library
 * or verification secret (which the client doesn't have).
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    // Decode payload (middle part)
    // In React Native, we can use atob or Buffer if available,
    // but a manual base64 decode for the payload is safest.
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      escape(atob(payloadBase64))
    );

    const payload = JSON.parse(jsonPayload);
    
    if (!payload.exp) return false;

    // Buffer of 10 seconds to account for clock skew
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < (now + 10);
  } catch (err) {
    console.error('[JWT] Failed to decode token:', err);
    return true;
  }
}
