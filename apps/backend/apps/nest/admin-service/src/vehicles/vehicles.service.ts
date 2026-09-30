import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto';
import { UpdateVehicleTypeDto } from './dto/update-vehicle-type.dto';
import { CreateVehicleMakeDto, UpdateVehicleMakeDto } from './dto/vehicle-make.dto';
import { CreateVehicleModelDto, UpdateVehicleModelDto } from './dto/vehicle-model.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  findAllTypes() {
    return this.prisma.vehicleType.findMany({ 
      where: { isActive: true },
      include: { models: { include: { make: true } } } 
    });
  }

  createType(data: CreateVehicleTypeDto) {
    return this.prisma.vehicleType.create({ data });
  }

  updateType(id: string, data: UpdateVehicleTypeDto) {
    return this.prisma.vehicleType.update({ where: { id }, data });
  }

  findAllMakes(activeOnly = false) {
    return this.prisma.vehicleMake.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: { _count: { select: { models: true } } },
      orderBy: { name: 'asc' }
    });
  }

  createMake(data: CreateVehicleMakeDto) {
    return this.prisma.vehicleMake.create({ data });
  }

  updateMake(id: string, data: UpdateVehicleMakeDto) {
    return this.prisma.vehicleMake.update({ where: { id }, data });
  }

  findAllModels(makeId?: string) {
    return this.prisma.vehicleModel.findMany({
      where: makeId ? { makeId } : undefined,
      include: { make: true, vehicleType: true },
      orderBy: [{ make: { name: 'asc' } }, { name: 'asc' }]
    });
  }

  createModel(data: CreateVehicleModelDto) {
    return this.prisma.vehicleModel.create({ data });
  }

  updateModel(id: string, data: UpdateVehicleModelDto) {
    return this.prisma.vehicleModel.update({ where: { id }, data });
  }

  findAllVehicles(driverId?: string) {
    return this.prisma.vehicle.findMany({
      where: driverId ? { driverId } : undefined,
      include: { vehicleType: true },
    });
  }

  createVehicle(data: CreateVehicleDto) {
    return this.prisma.vehicle.create({ data: data as any, include: { vehicleType: true } });
  }

  updateVehicle(id: string, data: UpdateVehicleDto) {
    return this.prisma.vehicle.update({ where: { id }, data: data as any });
  }
}
