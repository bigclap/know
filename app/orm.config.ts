import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

const configService = new ConfigService();

const entitiesPath = './**/*.entity{.ts,.js}';

export default new DataSource({
  type: 'cockroachdb',
  host: configService.get<string>('COCKROACH_HOST'),
  port: configService.get<number>('COCKROACH_PORT'),
  username: configService.get<string>('COCKROACH_USER'),
  password: configService.get<string>('COCKROACH_PASSWORD'),
  database: configService.get<string>('COCKROACH_DATABASE'),
  entities: [entitiesPath],
  migrations: ['./migrations/*{.ts,.js}'],
  synchronize: false,
  ssl: false,
  logging:
    configService.get<string>('NODE_ENV') !== 'production'
      ? ['log', 'warn', 'error']
      : ['error'],
  timeTravelQueries: false,
  migrationsTableName: 'migrations',
});
