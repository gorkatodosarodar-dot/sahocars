import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Stack, Text, Title, Button, Grid, Loader, Center } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { api, Vehicle, Branch, formatCurrency, formatDate } from "../lib/api";
import { notifications } from "@mantine/notifications";

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [vehicleData, branchesData] = await Promise.all([
          api.getVehicle(Number(id)),
          api.getBranches(),
        ]);
        setVehicle(vehicleData);
        setBranches(branchesData);
      } catch (error) {
        notifications.show({
          title: "Error",
          message: error instanceof Error ? error.message : "Error al cargar el vehículo",
          color: "red",
          autoClose: false,
        });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  if (loading) {
    return (
      <Center h={400}>
        <Loader />
      </Center>
    );
  }

  if (!vehicle) {
    return (
      <Stack gap="lg">
        <Button
          leftSection={<IconArrowLeft size={20} />}
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/vehiculos"))}
          size="md"
          color="gray"
        >
          Volver
        </Button>
        <Card withBorder shadow="xs" radius="md">
          <Text>Vehículo no encontrado</Text>
        </Card>
      </Stack>
    );
  }

  const branchName = vehicle.location_id
    ? branches.find((b) => b.id === vehicle.location_id)?.name
    : "-";

  return (
    <Stack gap="lg">
      <Title order={2}>Detalle del vehículo</Title>

      <Button
        leftSection={<IconArrowLeft size={20} />}
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/vehiculos"))}
        size="md"
        color="gray"
        w="fit-content"
        mb="md"
      >
        Volver
      </Button>
        <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder shadow="xs" radius="md">
            <Title order={3} mb="md">
              Información general
            </Title>
            <Stack gap="sm">
              <div>
                <Text size="sm" c="dimmed">
                  Matrícula
                </Text>
                <Text fw={500}>{vehicle.license_plate || "-"}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  VIN
                </Text>
                <Text fw={500}>{vehicle.vin || "-"}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Marca
                </Text>
                <Text fw={500}>{vehicle.brand || "-"}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Modelo
                </Text>
                <Text fw={500}>{vehicle.model || "-"}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Versión
                </Text>
                <Text fw={500}>{vehicle.version || "-"}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Año
                </Text>
                <Text fw={500}>{vehicle.year || "-"}</Text>
              </div>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder shadow="xs" radius="md">
            <Title order={3} mb="md">
              Especificaciones
            </Title>
            <Stack gap="sm">
              <div>
                <Text size="sm" c="dimmed">
                  Color
                </Text>
                <Text fw={500}>{vehicle.color || "-"}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Kilómetros
                </Text>
                <Text fw={500}>{vehicle.km || "-"}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Sucursal
                </Text>
                <Text fw={500}>{branchName}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Estado
                </Text>
                <Text fw={500}>{vehicle.state || "-"}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Notas
                </Text>
                <Text fw={500}>{vehicle.notes || "-"}</Text>
              </div>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder shadow="xs" radius="md">
            <Title order={3} mb="md">
              Información financiera
            </Title>
            <Stack gap="sm">
              <div>
                <Text size="sm" c="dimmed">
                  Precio de compra
                </Text>
                <Text fw={500}>{formatCurrency(vehicle.purchase_price)}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Fecha de compra
                </Text>
                <Text fw={500}>{formatDate(vehicle.purchase_date)}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Precio de venta
                </Text>
                <Text fw={500}>{formatCurrency(vehicle.sale_price)}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Fecha de venta
                </Text>
                <Text fw={500}>{formatDate(vehicle.sale_date)}</Text>
              </div>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder shadow="xs" radius="md">
            <Title order={3} mb="md">
              Metadatos
            </Title>
            <Stack gap="sm">
              <div>
                <Text size="sm" c="dimmed">
                  ID
                </Text>
                <Text fw={500}>{vehicle.id || "-"}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Creado
                </Text>
                <Text fw={500} size="sm">
                  {formatDate(vehicle.created_at)}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Actualizado
                </Text>
                <Text fw={500} size="sm">
                  {formatDate(vehicle.updated_at)}
                </Text>
              </div>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
