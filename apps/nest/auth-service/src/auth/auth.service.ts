import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserEventPublisher } from '../events/user-event.publisher';
import { UserRole } from '@ain-rider/shared-types';
import { generateTraceId } from '@ain-rider/nats-client';
import type { RegisterDto } from './dto/register.dto';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private userEventPublisher: UserEventPublisher,
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
          data: { userId: user.id, licenseNumber: '' },
        });
      } else if (data.role === UserRole.RIDER) {
        await this.prisma.rider.create({ data: { userId: user.id } });
      }

      // Publish user_created event for downstream services
      const traceId = generateTraceId();
      await this.userEventPublisher.publishUserCreated(user, traceId);

      return {
        user: this.sanitize(user),
        accessToken: this.signAccessToken(user),
        refreshToken: this.signRefreshToken(user),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return {
      user: this.sanitize(user),
      accessToken: this.signAccessToken(user),
      refreshToken: this.signRefreshToken(user),
    };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refresh(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    return { accessToken: this.signAccessToken(user) };
  }

  async updateUserStatus(userId: string, status: string, changedBy?: string, reason?: string) {
    const previousUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!previousUser) throw new UnauthorizedException('User not found');
    
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
      changedBy || 'SYSTEM',
      reason,
      traceId,
    );

    return this.sanitize(user);
  }

  async adminCreateUser(data: { email: string; phoneNumber: string; password: string; firstName: string; lastName: string; role: string }, createdBy: string) {
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
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  private signAccessToken(user: { id: string; email: string; role: string }) {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role, type: 'access' },
      { expiresIn: '15m' },
    );
  }

  private signRefreshToken(user: { id: string; email: string; role: string }) {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role, type: 'refresh' },
      { expiresIn: '7d' },
    );
  }

  private sanitize(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
