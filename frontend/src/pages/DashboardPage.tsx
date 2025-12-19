import { useEffect, useState } from "react";
import { api, Branch, DashboardSummary } from "../lib/api";
import { Anchor, Button, Card, Group, Loader, Select, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { formatCurrency } from "../lib/api";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filters, setFilters] = useState<{ from?: string; to?: string; branchId?: number }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBranches().then(setBranches).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .getDashboard(filters)
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <div>
          <Title order={2}>Dashboard</Title>
          <Text c="dimmed">Gastos, ingresos y margen por fechas y sucursal</Text>
        </div>
      </Group>

      <Card withBorder radius="md" shadow="sm">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <DateInput
            label="Desde"
            placeholder="Fecha inicio"
            value={filters.from ? new Date(filters.from) : null}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, from: value ? value.toISOString().split("T")[0] : undefined }))
            }
            w="100%"
          />
          <DateInput
            label="Hasta"
            placeholder="Fecha fin"
            value={filters.to ? new Date(filters.to) : null}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, to: value ? value.toISOString().split("T")[0] : undefined }))
            }
            w="100%"
          />
          <Select
            label="Sucursal"
            placeholder="Todas"
            clearable
            data={branches.map((b) => ({ label: b.name, value: String(b.id) }))}
            value={filters.branchId ? String(filters.branchId) : null}
            onChange={(value) => setFilters((prev) => ({ ...prev, branchId: value ? Number(value) : undefined }))}
            w="100%"
          />
          <Group align="flex-end">
            <Button variant="light" onClick={() => setFilters({})}>
              Limpiar filtros
            </Button>
          </Group>
        </SimpleGrid>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <StatCard label="Vehículos" value={summary?.vehicles ?? 0} color="#2b2b2b" loading={loading} />
        <StatCard label="Ingresos" value={formatCurrency(summary?.income)} color="#45c2c4" loading={loading} />
        <StatCard label="Gastos" value={formatCurrency(summary?.expenses)} color="#f3b63a" loading={loading} />
        <StatCard label="Margen" value={formatCurrency(summary?.margin)} color="#111" loading={loading} />
      </SimpleGrid>

      <Group gap="md" wrap="wrap">
        <ExportButton resource="vehicles" label="Exportar vehículos" />
        <ExportButton resource="expenses" label="Exportar gastos" />
        <ExportButton resource="sales" label="Exportar ventas" />
      </Group>
    </Stack>
  );
}

function StatCard({
  label,
  value,
  color,
  loading,
}: {
  label: string;
  value: string | number;
  color: string;
  loading: boolean;
}) {
  return (
    <Card withBorder shadow="xs" radius="md" padding="lg">
      <Stack gap={6}>
        <Text c="dimmed" size="sm">
          {label}
        </Text>
        {loading ? (
          <Loader size="sm" />
        ) : (
          <Text size="xl" fw={700} c={color}>
            {value}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

function ExportButton({ resource, label }: { resource: "vehicles" | "expenses" | "sales"; label: string }) {
  return (
    <Anchor
      component="button"
      variant="light"
      onClick={async () => {
        const response = await api.exportCsv(resource);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${resource}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
      }}
    >
      {label}
    </Anchor>
  );
}
