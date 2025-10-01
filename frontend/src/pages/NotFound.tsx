import { Center, Stack, Text, Title } from '@mantine/core';

export const NotFound = () => (
  <Center h="100%">
    <Stack gap="sm" align="center">
      <Title order={2}>Page not found</Title>
      <Text c="dimmed">The requested view is not available yet.</Text>
    </Stack>
  </Center>
);
