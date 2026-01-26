import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Branch, formatCurrency, formatDate, vehicleStates, Vehicle, VehicleStatus } from "../lib/api";
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
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";

const INITIAL_FORM: Vehicle = { license_plate: "", status: "intake" };

export default function VehiclesPage() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState<{ status?: VehicleStatus; branchId?: number; from?: string; to?: string }>({});
  const [form, setForm] = useState<Vehicle>(INITIAL_FORM);

  const statusLabels: Record<VehicleStatus, string> = {
    intake: "Entrada",
    prep: "Preparacion",
    ready: "Listo",
    published: "Publicado",
    reserved: "Reservado",
    sold: "Vendido",
    discarded: "Descartado",
  };

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

  const canCreate = form.license_plate?.trim() && form.brand?.trim() && form.model?.trim() && form.location_id;

  const handleCreate = async () => {
    try {
      setCreating(true);
      const newVehicle = await api.createVehicle(form);
      notifications.show({ title: "Vehículo creado", message: "Se ha dado de alta el vehículo", color: "teal" });
      setForm(INITIAL_FORM);
      
      // Actualizar la lista con el nuevo vehículo (sin duplicados)
      setVehicles((prev) => {
        const exists = prev.some((v) => v.license_plate === newVehicle.license_plate);
        if (exists) {
          return prev;
        }
        return [newVehicle, ...prev];
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      console.error("Error al crear vehículo:", errorMessage);
      notifications.show({ 
        title: "Error al crear vehículo", 
        message: errorMessage, 
        color: "red",
        autoClose: false 
      });
    } finally {
      setCreating(false);
    }
  };

  const rows = useMemo(
    () =>
      vehicles.map((vehicle) => {
        const routeId = vehicle.id != null ? String(vehicle.id) : vehicle.license_plate;
        const totalExpenses = vehicle.total_expenses ?? null;
        const targetMargin = vehicle.target_margin_pct ?? null;
        const suggestedPrice =
          totalExpenses !== null && targetMargin !== null
            ? totalExpenses * (1 + targetMargin / 100)
            : null;
        return (
          <Table.Tr
            key={vehicle.license_plate}
            style={{ cursor: "pointer" }}
            onClick={() => navigate(`/vehiculos/${encodeURIComponent(routeId)}`)}
            className="vehicles-table-row"
          >
            <Table.Td>{vehicle.license_plate || "-"}</Table.Td>
            <Table.Td>{vehicle.brand || "-"}</Table.Td>
            <Table.Td>{vehicle.model || "-"}</Table.Td>
            <Table.Td>
              {vehicle.status ? statusLabels[vehicle.status] : vehicle.state || "-"}
            </Table.Td>
            <Table.Td>{vehicle.location_id ? branches.find((b) => b.id === vehicle.location_id)?.name : "-"}</Table.Td>
            <Table.Td>{suggestedPrice !== null ? formatCurrency(suggestedPrice) : "-"}</Table.Td>
            <Table.Td>{formatCurrency(vehicle.published_price)}</Table.Td>
            <Table.Td>{formatCurrency(vehicle.sale_price)}</Table.Td>
            <Table.Td>{formatDate(vehicle.sale_date)}</Table.Td>
          </Table.Tr>
        );
      }),
    [vehicles, branches, navigate]
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
            data={vehicleStates.map((state) => ({ value: state, label: statusLabels[state] }))}
            value={filters.status || null}
            clearable
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, status: (value as VehicleStatus) || undefined }))
            }
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
          <TextInput label="Marca" value={form.brand ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))} />
          <TextInput label="Modelo" value={form.model ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))} />
          <Select
            label="Sucursal"
            placeholder="Selecciona"
            data={branches.map((b) => ({ value: String(b.id), label: b.name }))}
            value={form.location_id ? String(form.location_id) : null}
            onChange={(value) => setForm((prev) => ({ ...prev, location_id: value ? Number(value) : null }))}
          />
          <Select
            label="Estado"
            data={vehicleStates.map((state) => ({ value: state, label: statusLabels[state] }))}
            value={form.status || "intake"}
            onChange={(value) => setForm((prev) => ({ ...prev, status: value as VehicleStatus }))}
          />
        </SimpleGrid>
        <Group justify="flex-end" mt="md">
          <Button onClick={handleCreate} disabled={!canCreate} loading={creating}>
            Crear
          </Button>
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
              <Table.Th>Precio sugerido</Table.Th>
              <Table.Th>Precio publicado</Table.Th>
              <Table.Th>Venta</Table.Th>
              <Table.Th>Fecha venta</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length ? (
              rows
            ) : (
              <Table.Tr>
                <Table.Td colSpan={9}>
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
