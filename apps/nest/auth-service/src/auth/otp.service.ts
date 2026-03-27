import {
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
  OnModuleInit,
} from "@nestjs/common";
import {
  OtpProvider,
  DecodedOtpToken,
  OTP_PROVIDER,
} from "./otp-providers/otp-provider.interface";
import { FirebaseProvider } from "./otp-providers/firebase.provider";
import { ConsoleProvider } from "./otp-providers/console.provider";

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
  halfOpenAttempts: number;
}

@Injectable()
export class OtpService implements OnModuleInit {
  private provider: OtpProvider;
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
    halfOpenAttempts: 0,
  };

  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT_MS = 30000;
  private readonly CIRCUIT_BREAKER_HALF_OPEN_REQUESTS = 1;

  onModuleInit() {
    const providerName = OTP_PROVIDER.toLowerCase();
    console.log(`[OtpService] Initializing with provider: ${providerName}`);

    if (providerName === "console") {
      this.provider = new ConsoleProvider();
    } else {
      this.provider = new FirebaseProvider();
    }

    if (!this.provider.isInitialized()) {
      console.warn(
        `[OtpService] Provider ${providerName} not fully initialized. OTP verification may fail.`,
      );
    }
  }

  async verify(idToken: string, traceId: string): Promise<DecodedOtpToken> {
    this.checkCircuitBreaker();

    try {
      const result = await this.provider.verify(idToken, traceId);
      this.onSuccess();
      return result;
    } catch (error) {
      return this.onFailure(error, traceId);
    }
  }

  private checkCircuitBreaker(): void {
    const now = Date.now();

    if (this.circuitBreaker.isOpen) {
      if (
        now - this.circuitBreaker.lastFailureTime >=
        this.CIRCUIT_BREAKER_TIMEOUT_MS
      ) {
        console.log("[OtpService] Circuit breaker entering half-open state");
        this.halfOpenAttempts = 0;
        return;
      }
      throw new ServiceUnavailableException(
        "OTP verification service is temporarily unavailable. Please try again later.",
      );
    }
  }

  private onSuccess(): void {
    if (this.circuitBreaker.isOpen) {
      console.log(
        "[OtpService] Circuit breaker closed after successful request",
      );
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failures = 0;
      this.halfOpenAttempts = 0;
    } else if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      console.error(
        `[OtpService] Circuit breaker opened after ${this.circuitBreaker.failures} consecutive failures`,
      );
    }
  }

  private onFailure(error: any, _traceId: string): Promise<never> {
    const now = Date.now();
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = now;

    if (this.circuitBreaker.isOpen) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.CIRCUIT_BREAKER_HALF_OPEN_REQUESTS) {
        console.log(
          "[OtpService] Circuit breaker re-opened after half-open failure",
        );
      }
    } else if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      console.error(
        `[OtpService] Circuit breaker opened after ${this.circuitBreaker.failures} consecutive failures`,
      );
    }

    console.error(
      `[OtpService] Verification failed | traceId=${_traceId} | error=${error.message}`,
    );

    if (error instanceof ServiceUnavailableException) {
      throw error;
    }

    throw new UnauthorizedException("Invalid or expired OTP token");
  }

  getProviderName(): string {
    return this.provider.getName();
  }

  isCircuitBreakerOpen(): boolean {
    return this.circuitBreaker.isOpen;
  }

  getCircuitBreakerStats(): { failures: number; isOpen: boolean } {
    return {
      failures: this.circuitBreaker.failures,
      isOpen: this.circuitBreaker.isOpen,
    };
  }
}
