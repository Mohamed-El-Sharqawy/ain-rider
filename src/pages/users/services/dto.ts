export interface UserDTO {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: 'RIDER' | 'DRIVER' | 'ADMIN' | 'SUPPORT';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BANNED';
  profileImage?: string | null;
  createdAt: string;
  updatedAt: string;
  roleData?: DriverData | RiderData;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  dateOfBirth?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export interface DriverData {
  id: string;
  userId: string;
  vehicleId?: string;
  licenseNumber: string;
  rating: number;
  totalTrips: number;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RiderData {
  id: string;
  userId: string;
  rating: number;
  totalTrips: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserStatsDTO {
  total: number;
  byRole: Record<string, number>;
  byStatus: Record<string, number>;
  onlineDrivers: number;
}

/** Gateway list shape: `{ users, total }` (+ optional page/limit). */
export interface PaginatedUsersDTO {
  users: UserDTO[];
  total: number;
  page?: number;
  limit?: number;
}

/** Alternate shape some gateways use — normalized in `transformPaginatedUsers`. */
export interface LegacyPaginatedUsersDTO {
  data: UserDTO[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UpdateUserStatusDTO {
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BANNED';
  reason?: string;
}

export interface CreateUserDTO {
  email: string;
  phoneNumber: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'RIDER' | 'DRIVER' | 'ADMIN' | 'SUPPORT';
}
