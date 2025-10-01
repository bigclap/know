import {
  Controller,
  Inject,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { EventPattern, NatsContext, Payload, Ctx } from '@nestjs/microservices';
import { Interval } from '@nestjs/schedule';
import { EcsEventType } from '@common/ebca/ebca.helpers';
import type { ClickHouseClient } from '@clickhouse/client';
import { BaseComponent } from '@common/ebca/bases/base.component';

const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 5000;

interface EcsEvent {
  event_timestamp: string;
  event_type: EcsEventType;
  entity_name: string;
  entity_id: string;
  component_name: string;
  component_payload: string;
}

// Payload can have different shapes depending on the event type
type EcsEventPayload =
  | { component: BaseComponent; entityId: string } // for 'added' and 'updated'
  | {
      previousComponent?: BaseComponent;
      componentName: string;
      entityId: string;
    }; // for 'removed'

@Controller()
export class AnalyticsSinkSystem implements OnApplicationShutdown {
  private readonly logger = new Logger(AnalyticsSinkSystem.name);
  private eventBuffer: EcsEvent[] = [];

  constructor(
    @Inject('CLICKHOUSE_CLIENT')
    private readonly clickhouse: ClickHouseClient,
  ) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(
      `Application shutting down with signal: ${signal}. Flushing final events...`,
    );
    await this.flush();
    this.logger.log('Final events flushed.');
  }

  @Interval(FLUSH_INTERVAL_MS)
  async handleInterval(): Promise<void> {
    await this.flush();
  }

  @EventPattern('ebca.>')
  handleEcsEvent(
    @Payload()
    data: EcsEventPayload,
    @Ctx()
    context: NatsContext,
  ): void {
    const topic: string = context.getSubject();
    const parts: string[] = topic.split('.');
    if (parts.length < 5) {
      return;
    }

    const [, entity_name, entity_id, eventTypeStr, ...component_name_parts] =
      parts;
    const component_name = component_name_parts.join('.');
    const event_type = eventTypeStr as EcsEventType;

    const event_timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    let component_payload_obj: BaseComponent | undefined;

    if ('component' in data) {
      component_payload_obj = data.component;
    } else if ('previousComponent' in data) {
      component_payload_obj = data.previousComponent;
    }

    const event: EcsEvent = {
      event_timestamp,
      event_type,
      entity_name,
      entity_id,
      component_name,
      component_payload: component_payload_obj
        ? JSON.stringify(component_payload_obj)
        : '{}',
    };

    this.logger.verbose('Event captured', event);
    this.eventBuffer.push(event);

    if (this.eventBuffer.length >= BATCH_SIZE) {
      this.flush().catch((e) => this.logger.error(e));
    }
  }

  private async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const eventsToInsert = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      this.logger.log(
        `Flushing ${eventsToInsert.length} events to ClickHouse.`,
      );
      await this.clickhouse.insert({
        table: 'ecs_events',
        values: eventsToInsert,
        format: 'JSONEachRow',
      });
    } catch (error) {
      this.logger.error('Failed to flush events to ClickHouse', error);
      this.eventBuffer.unshift(...eventsToInsert);
    }
  }
}
