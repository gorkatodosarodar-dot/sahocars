import { useEffect, useState } from "react";
import { api, GoogleCalendarStatus } from "../lib/api";
import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";

export default function IntegrationsPage() {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await api.getGoogleCalendarStatus();
      setStatus(data);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "No se pudo cargar el estado",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnect = () => {
    window.location.href = api.getGoogleAuthStartUrl();
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Integraciones</Title>
        <Text c="dimmed" size="sm">
          Conecta Sahocars con Google Calendar para sincronizar visitas programadas.
        </Text>
      </div>

      <Card withBorder padding="md">
        <Group justify="space-between" align="center">
          <div>
            <Text fw={600}>Google Calendar</Text>
            <Text size="sm" c="dimmed">
              {status?.connected ? "Conectado" : "No conectado"}
              {status?.expired ? " (token expirado)" : ""}
            </Text>
          </div>
          <Group>
            <Button variant="light" onClick={loadStatus} loading={loading}>
              Refrescar
            </Button>
            <Button onClick={handleConnect}>Conectar Google Calendar</Button>
          </Group>
        </Group>
      </Card>
    </Stack>
  );
}
