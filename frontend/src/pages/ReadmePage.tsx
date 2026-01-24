import { useEffect, useState } from "react";
import { Alert, Group, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import { IconAlertCircle, IconFileText } from "@tabler/icons-react";
import { api } from "../lib/api";

export default function ReadmePage() {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getReadme()
      .then((data) => {
        setContent(data);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message || "No se pudo cargar el README.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <Stack gap="md">
      <Group gap="sm">
        <IconFileText size={20} />
        <Title order={3}>README</Title>
      </Group>
      {loading ? (
        <Group>
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Cargando README...
          </Text>
        </Group>
      ) : null}
      {error ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="No disponible">
          {error}
        </Alert>
      ) : null}
      {!loading && !error ? (
        <Paper withBorder p="md">
          <Text
            size="sm"
            style={{
              whiteSpace: "pre-wrap",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            }}
          >
            {content}
          </Text>
        </Paper>
      ) : null}
    </Stack>
  );
}
