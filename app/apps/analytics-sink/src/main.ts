import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestApplicationOptions } from '@nestjs/common/interfaces/nest-application-options.interface';
import { ConsoleLogger } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';
import { AnalyticsSinkModule } from './analytics-sink.module';

async function bootstrap() {
  const options: NestApplicationOptions = {};
  if (process.env.NODE_ENV === 'production') {
    options.logger = new ConsoleLogger({
      timestamp: true,
      json: true,
    });
  }
  const app = await NestFactory.create<NestExpressApplication>(
    AnalyticsSinkModule,
    options,
  );

  app.connectMicroservice({
    transport: Transport.NATS,
    options: {
      servers: ['nats://nats:4222'],
      queue: 'ebca-queue',
    },
  });
  await app.startAllMicroservices();

  app.setGlobalPrefix('/api');
  const conf = app.get(ConfigService);
  await app.listen(conf.get('PORT', 3000));
}

bootstrap().catch((err) => {
  console.error('Error during application bootstrap:', err);
});
