import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service.js';
class CatalogResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['CATEGORY', 'LOCATION'] }) kind!: string;
  @ApiProperty() label!: string;
  @ApiProperty() active!: boolean;
}
@ApiTags('core-catalogs')
@Controller('core/catalogs')
export class CatalogsController {
  constructor(private catalogs: CatalogsService) {}
  @Get('categories') @ApiOkResponse({ type: [CatalogResponseDto] }) categories() {
    return this.catalogs.list('CATEGORY');
  }
  @Get('locations') @ApiOkResponse({ type: [CatalogResponseDto] }) locations() {
    return this.catalogs.list('LOCATION');
  }
}
