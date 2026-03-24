import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  findAll(category?: string) {
    return this.prisma.setting.findMany({
      where: category ? { category } : undefined,
    });
  }

  findByKey(key: string) {
    return this.prisma.setting.findUnique({ where: { key } });
  }

  upsert(key: string, value: unknown, type?: string, category?: string, description?: string, updatedBy?: string, isPublic?: boolean) {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    
    return this.prisma.setting.upsert({
      where: { key },
      update: { 
        value: valueStr, 
        type: type || undefined,
        category: category || undefined,
        description: description || undefined,
        isPublic: isPublic ?? undefined,
        updatedBy 
      },
      create: { 
        key, 
        value: valueStr, 
        type: type || 'STRING', 
        category: category || 'GENERAL', 
        description: description || '', 
        updatedBy: updatedBy || 'system', 
        isPublic: isPublic ?? false 
      },
    });
  }

  async batchUpsert(settings: Array<{ key: string; value: unknown; type?: string; category?: string; description?: string; isPublic?: boolean }>, updatedBy: string) {
    const results = await Promise.all(
      settings.map((setting) =>
        this.upsert(
          setting.key,
          setting.value,
          setting.type,
          setting.category,
          setting.description,
          updatedBy,
          setting.isPublic
        )
      )
    );
    
    return { count: results.length, settings: results };
  }
}
