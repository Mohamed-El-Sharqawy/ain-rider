import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  findAllTypes() {
    return this.prisma.vehicleType.findMany({ where: { isActive: true } });
  }

  createType(data: any) {
    return this.prisma.vehicleType.create({ data });
  }

  updateType(id: string, data: any) {
    return this.prisma.vehicleType.update({ where: { id }, data });
  }

  findAllVehicles(driverId?: string) {
    return this.prisma.vehicle.findMany({
      where: driverId ? { driverId } : undefined,
      include: { vehicleType: true },
    });
  }

  createVehicle(data: any) {
    return this.prisma.vehicle.create({ data, include: { vehicleType: true } });
  }

  updateVehicle(id: string, data: any) {
    return this.prisma.vehicle.update({ where: { id }, data });
  }
}
