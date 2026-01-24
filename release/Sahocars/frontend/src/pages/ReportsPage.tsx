import { useEffect, useMemo, useState } from "react";
import {
  api,
  Branch,
  ReportByBranchItem,
  ReportFilters,
  ReportKpis,
  ReportVehicleRow,
  VehicleStatus,
  formatCurrency,
  formatDate,
} from "../lib/api";
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router-dom";

type LocalFilters = {
  from: Date | null;
  to: Date | null;
  branchId: string | null;
  status: VehicleStatus | null;
  vehicleId: string | null;
};

const statusLabels: Record<VehicleStatus, string> = {
  intake: "Entrada",
  prep: "Preparación",
  ready: "Listo",
  published: "Publicado",
  reserved: "Reservado",
  sold: "Vendido",
  discarded: "Descartado",
};

function formatDateInput(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

function formatPct(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<{ value: string; label: string }[]>([]);
  const [filters, setFilters] = useState<LocalFilters>({
    from: null,
    to: null,
    branchId: null,
    status: null,
    vehicleId: null,
  });
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({});
  const [kpis, setKpis] = useState<ReportKpis | null>(null);
  const [rows, setRows] = useState<ReportVehicleRow[]>([]);
  const [byBranch, setByBranch] = useState<ReportByBranchItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getBranches().then(setBranches).catch(() => setBranches([]));
    api
      .listVehicles({})
      .then((data) =>
        setVehicles(data.map((vehicle) => ({ value: vehicle.license_plate, label: vehicle.license_plate })))
      )
      .catch(() => setVehicles([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getReportKpis(appliedFilters),
      api.getReportVehicles(appliedFilters),
      api.getReportByBranch(appliedFilters),
    ])
      .then(([kpiData, vehicleRows, branchRows]) => {
        setKpis(kpiData);
        setRows(vehicleRows);
        setByBranch(branchRows);
      })
      .catch((error) => {
        notifications.show({
          title: "Error",
          message: error instanceof Error ? error.message : "Error al cargar informes",
          color: "red",
        });
      })
      .finally(() => setLoading(false));
  }, [appliedFilters]);

  const branchOptions = useMemo(
    () => branches.map((branch) => ({ value: String(branch.id), label: branch.name })),
    [branches]
  );
  const statusOptions = useMemo(
    () =>
      (Object.keys(statusLabels) as VehicleStatus[]).map((value) => ({
        value,
        label: statusLabels[value],
      })),
    []
  );

  const applyFilters = () => {
    setAppliedFilters({
      from: formatDateInput(filters.from),
      to: formatDateInput(filters.to),
      branch_id: filters.branchId ? Number(filters.branchId) : undefined,
      status: filters.status ?? undefined,
      vehicle_id: filters.vehicleId ?? undefined,
    });
  };

  const tableRows = rows.map((row) => {
    const profitValue = row.profit ?? null;
    const profitColor = profitValue === null ? "dimmed" : profitValue >= 0 ? "teal" : "red";
    return (
      <Table.Tr
        key={row.vehicle_id}
        onClick={() => navigate(`/vehiculos/${row.vehicle_id}`)}
        style={{ cursor: "pointer" }}
      >
        <Table.Td>
          <Text fw={600}>{row.title}</Text>
          <Text size="xs" c="dimmed">
            {row.vehicle_id}
          </Text>
        </Table.Td>
        <Table.Td>{row.branch ?? "-"}</Table.Td>
        <Table.Td>
          <Badge size="sm" variant="light">
            {statusLabels[row.status as VehicleStatus] ?? row.status}
          </Badge>
        </Table.Td>
        <Table.Td>{formatCurrency(row.purchase_price)}</Table.Td>
        <Table.Td>{formatCurrency(row.total_expenses)}</Table.Td>
        <Table.Td>{formatCurrency(row.sale_price ?? null)}</Table.Td>
        <Table.Td>
          <Text c={profitColor} fw={600}>
            {formatCurrency(profitValue)}
          </Text>
        </Table.Td>
        <Table.Td>{formatPct(row.margin_pct ?? null)}</Table.Td>
        <Table.Td>{row.days_in_stock ?? "-"}</Table.Td>
        <Table.Td>{formatDate(row.sold_at ?? null)}</Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Informes</Title>
          <Text c="dimmed" size="sm">
            Ventas se filtran por fecha de venta (sold_at). Gastos se filtran por fecha de gasto.
          </Text>
        </div>
        <Button variant="light" color="teal" onClick={applyFilters}>
          Aplicar filtros
        </Button>
      </Group>

      <Card withBorder padding="md">
        <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="md">
          <DateInput
            label="Desde"
            value={filters.from}
            onChange={(value) => setFilters((prev) => ({ ...prev, from: value }))}
            clearable
          />
          <DateInput
            label="Hasta"
            value={filters.to}
            onChange={(value) => setFilters((prev) => ({ ...prev, to: value }))}
            clearable
          />
          <Select
            label="Sucursal"
            placeholder="Todas"
            data={branchOptions}
            value={filters.branchId}
            onChange={(value) => setFilters((prev) => ({ ...prev, branchId: value }))}
            clearable
            searchable
          />
          <Select
            label="Estado"
            placeholder="Todos"
            data={statusOptions}
            value={filters.status}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, status: value as VehicleStatus | null }))
            }
            clearable
          />
          <Select
            label="Vehiculo"
            placeholder="Todos"
            data={vehicles}
            value={filters.vehicleId}
            onChange={(value) => setFilters((prev) => ({ ...prev, vehicleId: value }))}
            clearable
            searchable
          />
        </SimpleGrid>
      </Card>

      <Card withBorder padding="md">
        <Group justify="space-between" align="center" mb="sm">
          <Title order={4}>KPIs</Title>
          {loading && <Loader size="sm" />}
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Beneficio total
            </Text>
            <Text fw={700}>{formatCurrency(kpis?.total_profit ?? null)}</Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Ingresos
            </Text>
            <Text fw={700}>{formatCurrency(kpis?.total_income ?? null)}</Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Gastos (sin compra)
            </Text>
            <Text fw={700}>{formatCurrency(kpis?.total_expenses ?? null)}</Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Vehiculos vendidos
            </Text>
            <Text fw={700}>{kpis?.vehicles_sold ?? "-"}</Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Beneficio medio por vendido
            </Text>
            <Text fw={700}>{formatCurrency(kpis?.avg_profit_per_sold ?? null)}</Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Dias medios hasta venta
            </Text>
            <Text fw={700}>
              {kpis?.avg_days_to_sell !== null && kpis?.avg_days_to_sell !== undefined
                ? kpis.avg_days_to_sell.toFixed(1)
                : "-"}
            </Text>
          </Card>
        </SimpleGrid>
      </Card>

      <Card withBorder padding="md">
        <Title order={4} mb="sm">
          Rentabilidad por vehiculo
        </Title>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Vehiculo</Table.Th>
              <Table.Th>Sucursal</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th>Compra</Table.Th>
              <Table.Th>Gastos</Table.Th>
              <Table.Th>Venta</Table.Th>
              <Table.Th>Beneficio</Table.Th>
              <Table.Th>Margen</Table.Th>
              <Table.Th>Dias stock</Table.Th>
              <Table.Th>Vendido</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{tableRows}</Table.Tbody>
        </Table>
        {!rows.length && !loading && (
          <Text c="dimmed" size="sm" mt="sm">
            No hay vehiculos para los filtros seleccionados.
          </Text>
        )}
      </Card>

      <Card withBorder padding="md">
        <Title order={4} mb="sm">
          Resumen por sucursal
        </Title>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Sucursal</Table.Th>
              <Table.Th>Vendidos</Table.Th>
              <Table.Th>Ingresos</Table.Th>
              <Table.Th>Beneficio</Table.Th>
              <Table.Th>En stock</Table.Th>
              <Table.Th>Dias stock</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {byBranch.map((item) => (
              <Table.Tr key={item.branch_id}>
                <Table.Td>{item.branch_name || "-"}</Table.Td>
                <Table.Td>{item.sold}</Table.Td>
                <Table.Td>{formatCurrency(item.income)}</Table.Td>
                <Table.Td>{formatCurrency(item.profit)}</Table.Td>
                <Table.Td>{item.vehicles_in_stock ?? 0}</Table.Td>
                <Table.Td>
                  {item.avg_days_in_stock !== null && item.avg_days_in_stock !== undefined
                    ? item.avg_days_in_stock.toFixed(1)
                    : "-"}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {!byBranch.length && !loading && (
          <Text c="dimmed" size="sm" mt="sm">
            No hay datos por sucursal para los filtros seleccionados.
          </Text>
        )}
      </Card>
    </Stack>
  );
}
