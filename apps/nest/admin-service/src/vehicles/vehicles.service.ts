import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  findAllTypes() {
    return this.prisma.vehicleType.findMany({ 
      where: { isActive: true },
      include: { models: { include: { make: true } } } 
    });
  }

  createType(data: any) {
    return this.prisma.vehicleType.create({ data });
  }

  updateType(id: string, data: any) {
    return this.prisma.vehicleType.update({ where: { id }, data });
  }

  // --- Makes ---
  findAllMakes(activeOnly = false) {
    return this.prisma.vehicleMake.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: { _count: { select: { models: true } } },
      orderBy: { name: 'asc' }
    });
  }

  createMake(data: any) {
    return this.prisma.vehicleMake.create({ data });
  }

  updateMake(id: string, data: any) {
    return this.prisma.vehicleMake.update({ where: { id }, data });
  }

  // --- Models ---
  findAllModels(makeId?: string) {
    return this.prisma.vehicleModel.findMany({
      where: makeId ? { makeId } : undefined,
      include: { make: true, vehicleType: true },
      orderBy: [{ make: { name: 'asc' } }, { name: 'asc' }]
    });
  }

  createModel(data: any) {
    return this.prisma.vehicleModel.create({ data });
  }

  updateModel(id: string, data: any) {
    return this.prisma.vehicleModel.update({ where: { id }, data });
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
