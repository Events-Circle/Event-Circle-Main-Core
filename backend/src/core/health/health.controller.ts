import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import { Database } from '../../common/database.js';
import { RUNTIME, type Runtime } from '../../config/runtime.js';
class HealthDto {
  @ApiProperty() status!: string;
  @ApiProperty() edition!: string;
}
@Controller('core/health')
export class HealthController {
  constructor(
    private db: Database,
    @Inject(RUNTIME) private config: Runtime,
  ) {}
  @Get() @ApiOkResponse({ type: HealthDto }) live() {
    return { status: 'ok', edition: this.config.edition };
  }
  @Get('ready') async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
