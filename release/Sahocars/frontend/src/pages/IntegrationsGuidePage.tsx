import { Card, Stack, Text, Title, List, Code } from "@mantine/core";

export default function IntegrationsGuidePage() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Guia Google Calendar</Title>
        <Text c="dimmed" size="sm">
          Pasos para conectar Sahocars con Google Calendar en local.
        </Text>
      </div>

      <Card withBorder padding="md">
        <Title order={4} mb="sm">
          1) Crear credenciales OAuth
        </Title>
        <List spacing="xs">
          <List.Item>Ir a Google Cloud Console y crear un proyecto (si no existe).</List.Item>
          <List.Item>Habilitar la API de Google Calendar.</List.Item>
          <List.Item>Crear credenciales OAuth (Aplicacion web).</List.Item>
          <List.Item>
            Configurar URI de redireccion:
            <Code>http://localhost:8000/auth/google/callback</Code>
          </List.Item>
        </List>
      </Card>

      <Card withBorder padding="md">
        <Title order={4} mb="sm">
          2) Variables de entorno backend
        </Title>
        <Text size="sm" c="dimmed" mb="xs">
          Configura estas variables antes de arrancar el backend:
        </Text>
        <List spacing="xs">
          <List.Item>
            <Code>GOOGLE_CLIENT_ID</Code>
          </List.Item>
          <List.Item>
            <Code>GOOGLE_CLIENT_SECRET</Code>
          </List.Item>
          <List.Item>
            <Code>SAHOCARS_BASE_URL</Code> (por ejemplo <Code>http://localhost:8000</Code>)
          </List.Item>
          <List.Item>
            <Code>GOOGLE_CALENDAR_ID</Code> (opcional, por defecto <Code>primary</Code>)
          </List.Item>
        </List>
      </Card>

      <Card withBorder padding="md">
        <Title order={4} mb="sm">
          3) Conectar y sincronizar
        </Title>
        <List spacing="xs">
          <List.Item>Ir a Integraciones y pulsar Conectar Google Calendar.</List.Item>
          <List.Item>Autorizar la cuenta.</List.Item>
          <List.Item>Crear una visita con fecha/hora prevista.</List.Item>
          <List.Item>Pulsar sincronizar para crear o actualizar el evento.</List.Item>
        </List>
      </Card>
    </Stack>
  );
}
