import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ComponentManager } from './component.manager';
import { PersistenceManager } from './persistence.manager';
import { getRegisteredEntities } from './decorators/entity.decorator';

@Module({
  imports: [
    TypeOrmModule.forFeature(getRegisteredEntities()),
    ClientsModule.register([
      {
        name: 'NATS_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: ['nats://nats:4222'],
        },
      },
    ]),
  ],
  providers: [PersistenceManager, ComponentManager],
  exports: [ComponentManager],
})
export class EbcaModule {}
