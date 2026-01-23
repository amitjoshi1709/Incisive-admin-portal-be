import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DentalGroupsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all dental group IDs and names from the dental_groups table
   */
  async getDentalGroupIds(): Promise<{ dentalGroups: { dental_group_id: number; name: string }[] }> {
    const dentalGroups = await this.prisma.dental_groups.findMany({
      where: { is_active: true },
      select: { dental_group_id: true, name: true },
      orderBy: { dental_group_id: 'asc' },
    });

    return {
      dentalGroups: dentalGroups.map((group) => ({
        dental_group_id: Number(group.dental_group_id),
        name: group.name,
      })),
    };
  }
}
