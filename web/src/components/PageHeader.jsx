import { Title, Text, Group, Divider, Box } from "@mantine/core";

export function PageHeader({ title, subtitle, right }) {
  return (
    <Box mb="lg">
      <Group justify="space-between" align="flex-end" wrap="nowrap">
        <div>
          <Title order={2} fw={700} style={{ letterSpacing: "-0.02em" }}>{title}</Title>
          {subtitle && <Text c="dimmed" size="sm" mt={4}>{subtitle}</Text>}
        </div>
        {right}
      </Group>
      <Divider mt="md" />
    </Box>
  );
}
