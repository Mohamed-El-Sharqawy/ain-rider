import type { SettingDTO } from './dto';

export interface Setting {
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

export function transformSetting(dto: SettingDTO): Setting {
  return {
    id: dto.id,
    key: dto.key,
    value: dto.value,
    type: dto.type,
    category: dto.category,
    description: dto.description,
    isPublic: dto.isPublic,
    updatedBy: dto.updatedBy,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}
