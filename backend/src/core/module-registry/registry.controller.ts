import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { RUNTIME, type Runtime, availableModules, moduleCatalog } from '../../config/runtime.js';
class ModuleDto {
  @ApiProperty() id!: string;
  @ApiProperty() implemented!: boolean;
  @ApiProperty() enabled!: boolean;
}
@Controller('core/modules')
export class RegistryController {
  constructor(@Inject(RUNTIME) private config: Runtime) {}
  @Get() @ApiOkResponse({ type: [ModuleDto] }) catalog() {
    return moduleCatalog.map((id) => ({
      id,
      implemented: (availableModules as readonly string[]).includes(id),
      enabled: this.config.enabled.includes(id),
    }));
  }
}
