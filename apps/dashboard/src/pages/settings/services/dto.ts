export interface SettingDTO {
  id: string;
  key: string;
  value: string;
  type: string;
  category: string;
  description?: string;
  isPublic: boolean;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSettingDTO {
  value: unknown;
  type: string;
  category: string;
  description?: string;
  isPublic?: boolean;
}
