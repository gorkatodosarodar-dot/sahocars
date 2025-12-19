import { useEffect, useState } from "react";
import { api, Branch, DashboardSummary, formatCurrency } from "../lib/api";
import { Button, Card, Group, Loader, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [summaries, setSummaries] = useState<Record<number, DashboardSummary>>({});
  const [loading, setLoading] = useState(true);
  const [newBranch, setNewBranch] = useState("");

  const loadBranches = () =>
    api.getBranches().then((items) => {
      setBranches(items);
      Promise.all(items.map((b) => api.getDashboard({ branchId: b.id }))).then((results) => {
        const byBranch: Record<number, DashboardSummary> = {};
        results.forEach((summary, index) => {
          const branchId = items[index].id;
          if (branchId) {
            byBranch[branchId] = summary;
          }
        });
        setSummaries(byBranch);
        setLoading(false);
      });
    });

  useEffect(() => {
    loadBranches();
  }, []);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <Title order={2}>Sucursales</Title>
        <Group gap="sm" wrap="wrap" align="flex-end">
          <TextInput
            label="Nueva sucursal"
            placeholder="Nombre"
            value={newBranch}
            onChange={(e) => setNewBranch(e.target.value)}
          />
          <Button
            onClick={async () => {
              if (!newBranch.trim()) {
                notifications.show({ title: "Nombre requerido", message: "Introduce un nombre para la sucursal", color: "yellow" });
                return;
              }
              try {
                const created = await api.createBranch({ name: newBranch.trim() });
                setBranches((prev) => [...prev, created]);
                setNewBranch("");
                notifications.show({ title: "Sucursal creada", message: `Se añadió ${created.name}`, color: "teal" });
                loadBranches();
              } catch (error) {
                notifications.show({ title: "Error", message: (error as Error).message, color: "red" });
              }
            }}
          >
            Crear sucursal
          </Button>
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 1, md: 2, lg: 3 }} spacing="md">
        {branches.map((branch) => {
          const summary = branch.id ? summaries[branch.id] : undefined;
          return (
            <Card key={branch.id} withBorder shadow="xs" radius="md">
              <Stack gap="xs">
                <Text fw={700}>{branch.name}</Text>
                {loading || !summary ? (
                  <Loader size="sm" />
                ) : (
                  <Group gap="xl">
                    <Stat label="Vehículos" value={summary.vehicles} />
                    <Stat label="Ingresos" value={formatCurrency(summary.income)} />
                    <Stat label="Gastos" value={formatCurrency(summary.expenses)} />
                    <Stat label="Margen" value={formatCurrency(summary.margin)} />
                  </Group>
                )}
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Stack gap={2}>
      <Text c="dimmed" size="sm">
        {label}
      </Text>
      <Text fw={700}>{value}</Text>
    </Stack>
  );
}
