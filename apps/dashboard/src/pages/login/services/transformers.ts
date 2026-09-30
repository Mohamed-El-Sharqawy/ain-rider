import type { AuthUserDTO } from './dto';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber: string;
  role: 'ADMIN' | 'SUPPORT';
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function transformAuthUser(dto: AuthUserDTO): AdminUser {
  return {
    id: dto.id,
    email: dto.email,
    firstName: dto.firstName,
    lastName: dto.lastName,
    fullName: `${dto.firstName} ${dto.lastName}`.trim(),
    phoneNumber: dto.phoneNumber,
    role: dto.role,
    status: dto.status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}
