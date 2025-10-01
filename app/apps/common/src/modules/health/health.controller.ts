import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  constructor() {}

  @Get()
  ok() {
    return { status: 'ok' }; // всегда 200 + {status:"ok"}
  }
}
