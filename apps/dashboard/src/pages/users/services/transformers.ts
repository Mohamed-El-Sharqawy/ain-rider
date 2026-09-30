import type { UserDTO, UserStatsDTO, PaginatedUsersDTO, LegacyPaginatedUsersDTO } from './dto';

export interface User {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  status: string;
  profileImage?: string;
  createdAt: Date;
  updatedAt: Date;
  rating?: number;
  totalTrips?: number;
  isOnline?: boolean;
  licenseNumber?: string;
}

export interface UserStats {
  total: number;
  riders: number;
  drivers: number;
  admins: number;
  support: number;
  active: number;
  inactive: number;
  suspended: number;
  banned: number;
  onlineDrivers: number;
}

export interface PaginatedUsers {
  data: User[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function transformUser(dto: UserDTO): User {
  const user: User = {
    id: dto.id,
    email: dto.email,
    phoneNumber: dto.phoneNumber,
    firstName: dto.firstName,
    lastName: dto.lastName,
    fullName: `${dto.firstName} ${dto.lastName}`,
    role: dto.role,
    status: dto.status,
    profileImage: dto.profileImage,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };

  if (dto.roleData) {
    if ('licenseNumber' in dto.roleData) {
      user.rating = dto.roleData.rating;
      user.totalTrips = dto.roleData.totalTrips;
      user.isOnline = dto.roleData.isOnline;
      user.licenseNumber = dto.roleData.licenseNumber;
    } else {
      user.rating = dto.roleData.rating;
      user.totalTrips = dto.roleData.totalTrips;
    }
  }

  return user;
}

export function transformUserStats(dto: UserStatsDTO): UserStats {
  return {
    total: dto.total,
    riders: dto.byRole.RIDER ?? 0,
    drivers: dto.byRole.DRIVER ?? 0,
    admins: dto.byRole.ADMIN ?? 0,
    support: dto.byRole.SUPPORT ?? 0,
    active: dto.byStatus.ACTIVE ?? 0,
    inactive: dto.byStatus.INACTIVE ?? 0,
    suspended: dto.byStatus.SUSPENDED ?? 0,
    banned: dto.byStatus.BANNED ?? 0,
    onlineDrivers: dto.onlineDrivers,
  };
}

function isLegacyPaginatedUsers(
  dto: PaginatedUsersDTO | LegacyPaginatedUsersDTO,
): dto is LegacyPaginatedUsersDTO {
  return Array.isArray((dto as LegacyPaginatedUsersDTO).data) && (dto as LegacyPaginatedUsersDTO).meta != null;
}

export function transformPaginatedUsers(
  dto: PaginatedUsersDTO | LegacyPaginatedUsersDTO,
  filters?: { page?: number; limit?: number },
): PaginatedUsers {
  if (isLegacyPaginatedUsers(dto)) {
    return {
      data: dto.data.map(transformUser),
      meta: dto.meta,
    };
  }

  const page = dto.page ?? filters?.page ?? 1;
  const limit = dto.limit ?? filters?.limit ?? 20;
  const totalPages = Math.max(1, Math.ceil(dto.total / limit));

  return {
    data: dto.users.map(transformUser),
    meta: {
      total: dto.total,
      page,
      limit,
      totalPages,
    },
  };
}
