import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PracticesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all practice IDs and dental group names from the dental_practices table
   */
  async getPracticeIds(): Promise<{ practices: { practice_id: number; dental_group_name: string }[] }> {
    const practices = await this.prisma.dental_practices.findMany({
      select: { practice_id: true, dental_group_name: true },
      orderBy: { practice_id: 'asc' },
    });

    return {
      practices: practices.map((practice) => ({
        practice_id: Number(practice.practice_id),
        dental_group_name: practice.dental_group_name || '',
      })),
    };
  }

  /**
   * Search practices by dental group name
   */
  async searchPractices(query: string): Promise<{ practices: { practice_id: number; dental_group_name: string }[] }> {
    const practices = await this.prisma.dental_practices.findMany({
      where: {
        dental_group_name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      select: { practice_id: true, dental_group_name: true },
      orderBy: { practice_id: 'asc' },
      take: 15,
    });

    return {
      practices: practices.map((practice) => ({
        practice_id: Number(practice.practice_id),
        dental_group_name: practice.dental_group_name || '',
      })),
    };
  }
}
