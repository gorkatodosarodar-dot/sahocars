import { useEffect, useState } from "react";
import { api, Branch, DashboardSummary, formatCurrency } from "../lib/api";
import { Card, Group, Loader, SimpleGrid, Stack, Text, Title } from "@mantine/core";

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [summaries, setSummaries] = useState<Record<number, DashboardSummary>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  return (
    <Stack gap="lg">
      <Title order={2}>Sucursales</Title>
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
