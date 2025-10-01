// apps/analytics-sink/src/analytics-sink.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CoreModule } from '@common/core.module';
import { ConfigService } from '@nestjs/config';
import { createClient, ClickHouseClient } from '@clickhouse/client';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsSinkSystem } from './analytics-sink.system';

@Module({
  imports: [
    CoreModule.forRoot(), // CoreModule теперь предоставляет NATS_SERVICE
    ScheduleModule.forRoot(),
    // ClientsModule.register удален, так как NATS_SERVICE предоставляется CoreModule
    // Если этому микросервису нужен специфичный клиент NATS для других целей, его можно добавить здесь.
  ],
  controllers: [AnalyticsSinkSystem],
  providers: [
    {
      provide: 'CLICKHOUSE_CLIENT',
      useFactory: (configService: ConfigService): ClickHouseClient => {
        return createClient({
          url: configService.get<string>('CLICKHOUSE_HOST'),
          username: configService.get<string>('CLICKHOUSE_USER'),
          password: configService.get<string>('CLICKHOUSE_PASSWORD'),
          database: configService.get<string>('CLICKHOUSE_DATABASE'),
        });
      },
      inject: [ConfigService],
    },
  ],
})
export class AnalyticsSinkModule {}
