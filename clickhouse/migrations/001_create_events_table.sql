
      CREATE TABLE IF NOT EXISTS ecs_events (
        event_timestamp   DateTime64(3, 'UTC'),
        event_type        String,
        entity_name       String,
        entity_id         String,
        component_name    String,
        component_payload String
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMM(event_timestamp)
      ORDER BY (entity_name, entity_id, event_timestamp);
