import { Card, Stack, ThemeIcon, Text } from "@mantine/core";
import { IconTool } from "@tabler/icons-react";

export function ComingSoon({ label }) {
  return (
    <Card>
      <Stack align="center" py={48} gap="sm">
        <ThemeIcon size={52} radius="xl" variant="light">
          <IconTool size={26} stroke={1.5} />
        </ThemeIcon>
        <Text c="dimmed">{label}</Text>
      </Stack>
    </Card>
  );
}
