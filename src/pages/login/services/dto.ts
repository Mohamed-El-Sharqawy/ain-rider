export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthUserDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: 'ADMIN' | 'SUPPORT';
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponseDTO {
  user: AuthUserDTO;
  success: boolean;
}
