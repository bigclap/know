import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { TelegramModule } from './telegram.module';
import { NestApplicationOptions } from '@nestjs/common/interfaces/nest-application-options.interface';
import * as process from 'node:process';
import { ConsoleLogger } from '@nestjs/common';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  const options: NestApplicationOptions = {};
  if (process.env.NODE_ENV === 'production') {
    options.logger = new ConsoleLogger({
      timestamp: true,
      json: true,
    });
  }
  const app = await NestFactory.create<NestExpressApplication>(
    TelegramModule,
    options,
  );

  app.connectMicroservice({
    transport: Transport.NATS,
    options: {
      servers: ['nats://nats:4222'],
    },
  });
  await app.startAllMicroservices();

  app.setGlobalPrefix('/api');
  const conf = app.get(ConfigService);
  await app.listen(conf.get('PORT', 3000));
}

bootstrap().catch((err) => {
  console.error('Error during application bootstrap:', err);
  process.exit(1);
});
