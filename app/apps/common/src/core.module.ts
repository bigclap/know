// apps/common/src/core.module.ts
import KeyvRedis from '@keyv/redis';
import { HealthModule } from './modules/health/health.module';
import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as Joi from 'joi';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UserEntity } from '@common/database/entities/user.entity';
import { QuestionEntity } from '@common/database/entities/question.entity';
import { UserAnsweredQuestionEntity } from '@common/database/entities/user-answered-question.entity'; // Импортируем ClientsModule и Transport

@Module({})
@Global()
export class CoreModule {
  static forRoot() {
    return {
      module: CoreModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: Joi.object({
            NODE_ENV: Joi.string()
              .valid('development', 'production', 'test', 'provision')
              .default('development'),
            PORT: Joi.number().port().default(3000),
            MONTHLY_MESSAGE_LIMIT: Joi.number().default(60),
            MONTHLY_TOKEN_LIMIT: Joi.number().default(200000),
            // Telegram Bot
            TELEGRAM_BOT_TOKEN: Joi.string().required(),
            GEMINI_API_KEY: Joi.string().required(),
            OPENAI_PROXY: Joi.string().uri().optional(), // Прокси

            // Redis
            REDIS_HOST: Joi.string().default('localhost'),
            REDIS_PORT: Joi.number().port().default(6379),
            REDIS_PASSWORD: Joi.string().optional(), // Добавил Redis пароль

            //Yookassa
            YOOKASSA_SHOP_ID: Joi.string().required(),
            YOOKASSA_SECRET_KEY: Joi.string().required(),
            YOOKASSA_RETURN_URL: Joi.string().required(),

            //Web
            WEB_APP_URL: Joi.string().required(),
            WEB_APP_HOST: Joi.string().required(),

            COCKROACH_HOST: Joi.string().required(),
            COCKROACH_PORT: Joi.number().default(26257),
            COCKROACH_USER: Joi.string().required(),
            COCKROACH_PASSWORD: Joi.string().required(),
            COCKROACH_DATABASE: Joi.string().required(),
            COCKROACH_SSL: Joi.boolean().default(false), // Добавил COCKROACH_SSL

            // ClickHouse
            CLICKHOUSE_HOST: Joi.string().required(),
            CLICKHOUSE_USER: Joi.string().required(),
            CLICKHOUSE_PASSWORD: Joi.string().required(),
            CLICKHOUSE_DATABASE: Joi.string().required(),
          }),
          ignoreEnvFile: true, // Игнорировать .env файл, использовать только переменные окружения
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
            type: 'cockroachdb',
            host: configService.get<string>('COCKROACH_HOST'),
            port: configService.get<number>('COCKROACH_PORT'),
            username: configService.get<string>('COCKROACH_USER'),
            password: configService.get<string>('COCKROACH_PASSWORD'),
            database: configService.get<string>('COCKROACH_DATABASE'),
            autoLoadEntities: true,
            entities: [UserEntity, QuestionEntity, UserAnsweredQuestionEntity],
            ssl: configService.get<boolean>('COCKROACH_SSL', false)
              ? { rejectUnauthorized: false }
              : false,
            extra: {
              application_name: 'challenge_app',
            },
            synchronize: !!configService.get('MIGRATE'),
            retryAttempts: 3,
            retryDelay: 1000,
            logging:
              configService.get<string>('NODE_ENV') !== 'production'
                ? ['log', 'warn', 'error']
                : ['error'],
            cache: {
              type: 'redis',
              duration: 5000,
              options: {
                socket: {
                  host: configService.get<string>('REDIS_HOST'),
                  port: configService.get<number>('REDIS_PORT'),
                  password: configService.get<string>('REDIS_PASSWORD'),
                  db: 2,
                  ttl: 3600_000,
                },
              },
            },
          }),
        }),
        ScheduleModule.forRoot(),
        CacheModule.registerAsync({
          isGlobal: true,
          inject: [ConfigService],
          useFactory: (config: ConfigService) => {
            const url = `redis://${config.get('REDIS_HOST')}:${config.get('REDIS_PORT')}`;
            return {
              stores: [
                new KeyvRedis({
                  url,
                  database: 1,
                  // Redis пароль теперь может быть передан, если он есть
                  password: config.get<string>('REDIS_PASSWORD') || undefined,
                }),
              ],
              ttl: 3600_000, // default TTL in milliseconds
            };
          },
        }),
        ClientsModule.register([
          {
            name: 'NATS_SERVICE',
            transport: Transport.NATS,
            options: {
              servers: ['nats://nats:4222'],
              // Здесь не указываем 'queue', так как этот ClientProxy используется для публикации/отправки запросов,
              // а не для потребления из очереди. Потребление из очереди настраивается в main.ts каждого микросервиса.
            },
          },
        ]),
        HealthModule,
      ],
      exports: [
        ConfigModule,
        ScheduleModule,
        CacheModule,
        ClientsModule,
        HealthModule,
      ],
    };
  }
}
