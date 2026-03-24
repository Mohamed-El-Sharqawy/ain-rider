import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { NatsService } from '../shared/nats/nats.service';
import { UserRole, NATS_SUBJECTS } from '@ain-rider/shared-types';
import type { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private nats: NatsService,
  ) {}

  async register(data: RegisterDto) {
    const passwordHash = await bcrypt.hash(data.password, 10);

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

    // Publish user.created so all services can sync their shadow tables
    await this.nats.publisher.publish({
      subject: NATS_SUBJECTS.USER_CREATED,
      data: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });

    return {
      user: this.sanitize(user),
      accessToken: this.signAccessToken(user),
      refreshToken: this.signRefreshToken(user),
    };
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

  async updateUserStatus(userId: string, status: string, changedBy?: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status, updatedAt: new Date() },
    });

    await this.nats.publisher.publish({
      subject: NATS_SUBJECTS.USER_STATUS_CHANGED,
      data: {
        id: user.id,
        status: user.status,
        changedBy,
        updatedAt: user.updatedAt.toISOString(),
      },
    });

    return this.sanitize(user);
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
