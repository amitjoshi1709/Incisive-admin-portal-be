import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LabsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all lab IDs and names from the public labs table
   */
  async getLabIds(): Promise<{ labs: { lab_id: number; lab_name: string }[] }> {
    const labs = await this.prisma.public_labs.findMany({
      where: { is_active: true },
      select: { lab_id: true, lab_name: true },
      orderBy: { lab_id: 'asc' },
    });

    return {
      labs: labs.map((lab) => ({
        lab_id: Number(lab.lab_id),
        lab_name: lab.lab_name,
      })),
    };
  }
}
