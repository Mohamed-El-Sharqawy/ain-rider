import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { UserEventPublisher } from "../events/user-event.publisher";
import { UserRole } from "@ain-rider/shared-types";
import { generateTraceId } from "@ain-rider/nats-client";
import type { RegisterDto } from "./dto/register.dto";
import { Prisma } from "../generated/prisma/client";
import { OtpService } from "./otp.service";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private userEventPublisher: UserEventPublisher,
    private otpService: OtpService,
  ) {}

  async register(data: RegisterDto) {
    const passwordHash = await bcrypt.hash(data.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          phoneNumber: data.phoneNumber,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
        },
      });

      if (data.role === UserRole.DRIVER) {
        await this.prisma.driver.create({
          data: { userId: user.id, licenseNumber: "" },
        });
      } else if (data.role === UserRole.RIDER) {
        await this.prisma.rider.create({ data: { userId: user.id } });
      }

      // Publish user_created event for downstream services
      const traceId = generateTraceId();
      await this.userEventPublisher.publishUserCreated(user, traceId);

      const family = this.generateFamilyId();
      const accessToken = this.signAccessToken(user);
      const refreshToken = this.signRefreshToken(user, family);

      await this.storeRefreshToken(user.id, refreshToken, family);

      return {
        user: this.sanitize(user),
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error as Prisma.PrismaClientKnownRequestError).code === "P2002"
      ) {
        throw new ConflictException("Email already registered");
      }
      throw error;
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    const family = this.generateFamilyId();
    const accessToken = this.signAccessToken(user);
    const refreshToken = this.signRefreshToken(user, family);

    await this.storeRefreshToken(user.id, refreshToken, family);

    return {
      user: this.sanitize(user),
      accessToken,
      refreshToken,
    };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }

  async refresh(oldRefreshToken: string) {
    const tokenData = await this.validateRefreshToken(oldRefreshToken);

    if (!tokenData) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: tokenData.userId },
    });
    if (!user) throw new UnauthorizedException("User not found");

    const accessToken = this.signAccessToken(user);
    const refreshToken = this.signRefreshToken(user, tokenData.family);

    await this.rotateRefreshToken(
      oldRefreshToken,
      refreshToken,
      tokenData.family,
    );

    return { accessToken, refreshToken };
  }

  async updateUserStatus(
    userId: string,
    status: string,
    changedBy?: string,
    reason?: string,
  ) {
    const previousUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!previousUser) throw new UnauthorizedException("User not found");

    const previousStatus = previousUser.status;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status, updatedAt: new Date() },
    });

    // Publish user_status_changed event
    const traceId = generateTraceId();
    await this.userEventPublisher.publishUserStatusChanged(
      user,
      previousStatus,
      changedBy || "SYSTEM",
      reason,
      traceId,
    );

    return this.sanitize(user);
  }

  async adminCreateUser(
    data: {
      email: string;
      phoneNumber: string;
      password: string;
      firstName: string;
      lastName: string;
      role: string;
    },
    createdBy: string,
  ) {
    const passwordHash = await bcrypt.hash(data.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          phoneNumber: data.phoneNumber,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
        },
      });

      // Publish user_created event for downstream services
      const traceId = generateTraceId();
      await this.userEventPublisher.publishUserCreated(user, traceId);

      return {
        user: this.sanitize(user),
        createdBy,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error as Prisma.PrismaClientKnownRequestError).code === "P2002"
      ) {
        throw new ConflictException("Email already registered");
      }
      throw error;
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private generateFamilyId(): string {
    return crypto.randomUUID();
  }

  private async storeRefreshToken(
    userId: string,
    token: string,
    family: string,
  ): Promise<void> {
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        family,
        expiresAt,
      },
    });
  }

  private async validateRefreshToken(
    token: string,
  ): Promise<{ userId: string; family: string } | null> {
    const tokenHash = this.hashToken(token);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken) {
      return null;
    }

    if (storedToken.revoked) {
      // Reuse detected - revoke entire family
      await this.prisma.refreshToken.updateMany({
        where: { family: storedToken.family },
        data: { revoked: true },
      });
      return null;
    }

    if (storedToken.expiresAt < new Date()) {
      return null;
    }

    return { userId: storedToken.userId, family: storedToken.family };
  }

  private async rotateRefreshToken(
    oldToken: string,
    newToken: string,
    family: string,
  ): Promise<void> {
    const oldTokenHash = this.hashToken(oldToken);

    // Mark old token as revoked
    await this.prisma.refreshToken.update({
      where: { tokenHash: oldTokenHash },
      data: { revoked: true },
    });

    // Store new token in same family
    const userId = await this.prisma.refreshToken
      .findUnique({ where: { tokenHash: oldTokenHash } })
      .then((t) => t?.userId);

    if (userId) {
      await this.storeRefreshToken(userId, newToken, family);
    }
  }

  private signAccessToken(user: { id: string; email: string; role: string }) {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role, type: "access" },
      { expiresIn: "15m" },
    );
  }

  private signRefreshToken(
    user: { id: string; email: string; role: string },
    family?: string,
  ) {
    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: "refresh",
        family: family || "",
      },
      { expiresIn: "7d" },
    );
  }

  private sanitize(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }

  /**
   * Verifies a phone number via OTP and publishes otp_verified NATS event.
   *
   * Flow:
   * 1. Verifies the ID token using OtpService (provider abstraction)
   * 2. Extracts phone_number and uid from the decoded token
   * 3. Publishes `ain_rider.otp_verified` NATS event for downstream services (fire-and-forget)
   * 4. Returns the verification result (does NOT create user account)
   *
   * Downstream services should subscribe to the NATS event to:
   * - Auto-create user accounts
   * - Link phone numbers to existing users
   * - Send welcome notifications
   *
   * @param idToken - Firebase Phone Auth ID token from client SDK
   * @param traceId - Distributed tracing correlation ID
   * @returns Object containing success status, phoneNumber (E.164), and uid (Firebase UID)
   * @throws UnauthorizedException if token is invalid or phone_number claim is missing
   */
  async verifyOtp(idToken: string, traceId: string) {
    const decodedToken = await this.otpService.verify(idToken, traceId);

    // Publish event asynchronously (fire-and-forget) - don't block response
    this.userEventPublisher
      .publishOtpVerified(decodedToken.phone_number, decodedToken.uid, traceId)
      .catch((err) => {
        console.error(
          `[AuthService] Failed to publish otp_verified event | traceId=${traceId} | error=${err.message}`,
        );
      });

    return {
      success: true,
      phoneNumber: decodedToken.phone_number,
      uid: decodedToken.uid,
    };
  }
}
