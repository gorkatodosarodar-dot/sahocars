import { useEffect, useMemo, useState } from "react";
import { api, Branch, formatCurrency, formatDate, vehicleStates, Vehicle } from "../lib/api";
import {
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  NumberInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<{ status?: string; branchId?: number; from?: string; to?: string }>({});
  const [form, setForm] = useState<Vehicle>({
    status: "pendiente recepcion",
    purchase_date: new Date().toISOString().split("T")[0],
  });

  const fetchVehicles = () => {
    setLoading(true);
    api
      .listVehicles(filters)
      .then(setVehicles)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.getBranches().then(setBranches);
  }, []);

  useEffect(() => {
    fetchVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleCreate = async () => {
    try {
      await api.createVehicle(form);
      notifications.show({ title: "Vehículo creado", message: "Se ha dado de alta el vehículo", color: "teal" });
      setForm({ status: "pendiente recepcion", purchase_date: new Date().toISOString().split("T")[0] });
      fetchVehicles();
    } catch (error) {
      notifications.show({ title: "Error", message: (error as Error).message, color: "red" });
    }
  };

  const rows = useMemo(
    () =>
      vehicles.map((vehicle) => (
        <Table.Tr key={vehicle.id}>
          <Table.Td>{vehicle.license_plate || "-"}</Table.Td>
          <Table.Td>{vehicle.brand || "-"}</Table.Td>
          <Table.Td>{vehicle.model || "-"}</Table.Td>
          <Table.Td>{vehicle.status || "-"}</Table.Td>
          <Table.Td>{vehicle.branch_id ? branches.find((b) => b.id === vehicle.branch_id)?.name : "-"}</Table.Td>
          <Table.Td>{formatCurrency(vehicle.purchase_price)}</Table.Td>
          <Table.Td>{formatCurrency(vehicle.sale_price)}</Table.Td>
          <Table.Td>{formatDate(vehicle.sale_date)}</Table.Td>
        </Table.Tr>
      )),
    [vehicles, branches]
  );

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Vehículos</Title>
          <Text c="dimmed">Listado con filtros y alta rápida</Text>
        </div>
        <Group>
          <Button variant="light" loading={loading} onClick={fetchVehicles}>
            Refrescar
          </Button>
          <Button variant="outline" component="a" href="#" onClick={async (e) => {
            e.preventDefault();
            const response = await api.exportCsv("vehicles");
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "vehiculos.csv";
            link.click();
            window.URL.revokeObjectURL(url);
          }}>
            Exportar CSV
          </Button>
        </Group>
      </Group>

      <Card withBorder shadow="xs" radius="md">
        <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
          <Select
            label="Estado"
            placeholder="Todos"
            data={vehicleStates.map((state) => ({ value: state, label: state }))}
            value={filters.status || null}
            clearable
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value || undefined }))}
          />
          <Select
            label="Sucursal"
            placeholder="Todas"
            data={branches.map((b) => ({ value: String(b.id), label: b.name }))}
            value={filters.branchId ? String(filters.branchId) : null}
            clearable
            onChange={(value) => setFilters((prev) => ({ ...prev, branchId: value ? Number(value) : undefined }))}
          />
          <DateInput
            label="Desde"
            value={filters.from ? new Date(filters.from) : null}
            onChange={(value) => setFilters((prev) => ({ ...prev, from: value ? value.toISOString().split("T")[0] : undefined }))}
          />
          <DateInput
            label="Hasta"
            value={filters.to ? new Date(filters.to) : null}
            onChange={(value) => setFilters((prev) => ({ ...prev, to: value ? value.toISOString().split("T")[0] : undefined }))}
          />
        </SimpleGrid>
      </Card>

      <Card withBorder shadow="xs" radius="md">
        <Title order={4} mb="sm">
          Alta rápida
        </Title>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          <TextInput
            label="Matrícula"
            value={form.license_plate ?? ""}
            onChange={(e) => setForm((prev) => ({ ...prev, license_plate: e.target.value }))}
          />
          <TextInput label="VIN" value={form.vin ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, vin: e.target.value }))} />
          <TextInput label="Marca" value={form.brand ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))} />
          <TextInput label="Modelo" value={form.model ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))} />
          <NumberInput
            label="Año"
            value={form.year ?? undefined}
            onChange={(value) => setForm((prev) => ({ ...prev, year: typeof value === "number" ? value : null }))}
            min={1900}
            max={new Date().getFullYear() + 1}
          />
          <NumberInput
            label="Kilometraje"
            value={form.km ?? undefined}
            onChange={(value) => setForm((prev) => ({ ...prev, km: typeof value === "number" ? value : null }))}
            min={0}
            step={1000}
          />
          <NumberInput
            label="Precio compra"
            value={form.purchase_price ?? undefined}
            onChange={(value) => setForm((prev) => ({ ...prev, purchase_price: typeof value === "number" ? value : null }))}
            min={0}
            step={100}
          />
          <DateInput
            label="Fecha de compra"
            value={form.purchase_date ? new Date(form.purchase_date) : null}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, purchase_date: value ? value.toISOString().split("T")[0] : undefined }))
            }
          />
          <Select
            label="Sucursal"
            placeholder="Selecciona"
            data={branches.map((b) => ({ value: String(b.id), label: b.name }))}
            value={form.branch_id ? String(form.branch_id) : null}
            onChange={(value) => setForm((prev) => ({ ...prev, branch_id: value ? Number(value) : null }))}
          />
          <Select
            label="Estado"
            data={vehicleStates.map((state) => ({ value: state, label: state }))}
            value={form.status || "pendiente recepcion"}
            onChange={(value) => setForm((prev) => ({ ...prev, status: value || undefined }))}
          />
        </SimpleGrid>
        <Group justify="flex-end" mt="md">
          <Button onClick={handleCreate}>Crear</Button>
        </Group>
      </Card>

      <Card withBorder shadow="xs" radius="md">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Matrícula</Table.Th>
              <Table.Th>Marca</Table.Th>
              <Table.Th>Modelo</Table.Th>
              <Table.Th>Estado</Table.Th>
              <Table.Th>Sucursal</Table.Th>
              <Table.Th>Compra</Table.Th>
              <Table.Th>Venta</Table.Th>
              <Table.Th>Fecha venta</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length ? (
              rows
            ) : (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text c="dimmed">No hay vehículos</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
