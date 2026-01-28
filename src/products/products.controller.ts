import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('ids')
  @ApiOperation({ summary: 'Get all incisive product IDs and names' })
  @ApiResponse({
    status: 200,
    description: 'List of products with IDs and names',
    schema: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              incisive_id: { type: 'number', example: 1 },
              incisive_name: { type: 'string', example: 'Product Name' },
            },
          },
        },
      },
    },
  })
  async getProductIds() {
    return this.productsService.getProductIds();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search products by name' })
  @ApiQuery({ name: 'q', required: true, description: 'Search keyword' })
  @ApiResponse({
    status: 200,
    description: 'List of matching products with IDs and names',
    schema: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              incisive_id: { type: 'number', example: 1 },
              incisive_name: { type: 'string', example: 'Product Name' },
            },
          },
        },
      },
    },
  })
  async searchProducts(@Query('q') query: string) {
    return this.productsService.searchProducts(query || '');
  }
}
