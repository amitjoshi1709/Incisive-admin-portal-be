import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all incisive IDs and names from the incisive_product_catalog table
   */
  async getProductIds(): Promise<{ products: { incisive_id: number; incisive_name: string }[] }> {
    const products = await this.prisma.incisive_product_catalog.findMany({
      where: { is_active: true },
      select: { incisive_id: true, incisive_name: true },
      orderBy: { incisive_id: 'asc' },
    });

    return {
      products: products.map((product) => ({
        incisive_id: product.incisive_id,
        incisive_name: product.incisive_name,
      })),
    };
  }

  /**
   * Search products by incisive name
   */
  async searchProducts(query: string): Promise<{ products: { incisive_id: number; incisive_name: string }[] }> {
    const products = await this.prisma.incisive_product_catalog.findMany({
      where: {
        is_active: true,
        incisive_name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      select: { incisive_id: true, incisive_name: true },
      orderBy: { incisive_id: 'asc' },
      take: 15,
    });

    return {
      products: products.map((product) => ({
        incisive_id: product.incisive_id,
        incisive_name: product.incisive_name,
      })),
    };
  }
}
