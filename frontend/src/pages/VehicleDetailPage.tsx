import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Stack, Text, Title, Button, Grid, Loader, Center, TextInput, Table, Group, ActionIcon, Modal, Select, NumberInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconArrowLeft, IconExternalLink, IconTrash, IconPlus, IconPencil, IconDownload } from "@tabler/icons-react";
import {
  api,
  Vehicle,
  Branch,
  VehicleLink,
  VehicleFile,
  VehicleFileCategory,
  VehicleExpense,
  VehicleExpenseCategory,
  ExpenseCreateInput,
  ExpenseUpdateInput,
  VehicleVisit,
  VehicleVisitCreateInput,
  VehicleKpis,
  formatCurrency,
  formatDate,
} from "../lib/api";
import { notifications } from "@mantine/notifications";

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [links, setLinks] = useState<VehicleLink[]>([]);
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  const [files, setFiles] = useState<VehicleFile[]>([]);
  const [photos, setPhotos] = useState<VehicleFile[]>([]);
  const [visits, setVisits] = useState<VehicleVisit[]>([]);
  const [kpis, setKpis] = useState<VehicleKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [creatingLink, setCreatingLink] = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState<number | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [fileCategory, setFileCategory] = useState<VehicleFileCategory>("document");
  const [fileNotes, setFileNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<VehicleFile | null>(null);
  const [confirmFileDeleteOpen, setConfirmFileDeleteOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<VehicleExpense | null>(null);
  const [expenseAmount, setExpenseAmount] = useState<number | null>(null);
  const [expenseCurrency, setExpenseCurrency] = useState("EUR");
  const [expenseDate, setExpenseDate] = useState<Date | null>(null);
  const [expenseCategory, setExpenseCategory] = useState<VehicleExpenseCategory | null>(null);
  const [expenseVendor, setExpenseVendor] = useState("");
  const [expenseInvoiceRef, setExpenseInvoiceRef] = useState("");
  const [expensePaymentMethod, setExpensePaymentMethod] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseFileId, setExpenseFileId] = useState<number | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<VehicleExpense | null>(null);
  const [confirmExpenseDeleteOpen, setConfirmExpenseDeleteOpen] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [visitDate, setVisitDate] = useState<Date | null>(null);
  const [visitName, setVisitName] = useState("");
  const [visitPhone, setVisitPhone] = useState("");
  const [visitEmail, setVisitEmail] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [savingVisit, setSavingVisit] = useState(false);
  const [visitToDelete, setVisitToDelete] = useState<VehicleVisit | null>(null);
  const [confirmVisitDeleteOpen, setConfirmVisitDeleteOpen] = useState(false);

  const expenseCategoryLabels: Record<VehicleExpenseCategory, string> = {
    MECHANICAL: "Mecanica",
    TIRES: "Neumaticos",
    TRANSPORT: "Transporte",
    ADMIN: "Administrativo",
    CLEANING: "Limpieza",
    OTHER: "Otros",
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const refreshFiles = async (vehicleId: number) => {
    try {
      const [documents, expenses] = await Promise.all([
        api.listVehicleFiles(vehicleId, "document"),
        api.listVehicleFiles(vehicleId, "expense"),
      ]);
      const merged = [...documents, ...expenses].sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );
      setFiles(merged);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al cargar archivos",
        color: "red",
      });
    }
  };

  const refreshPhotos = async (vehicleId: number) => {
    try {
      const data = await api.listVehicleFiles(vehicleId, "photo");
      setPhotos(data);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al cargar fotos",
        color: "red",
      });
    }
  };

  const refreshExpenses = async (vehicleId: number) => {
    try {
      const data = await api.listVehicleExpenses(vehicleId);
      setExpenses(data);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al cargar gastos",
        color: "red",
      });
    }
  };

  const resetExpenseForm = (expense?: VehicleExpense) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseAmount(expense.amount);
      setExpenseCurrency(expense.currency || "EUR");
      setExpenseDate(expense.date ? new Date(expense.date) : null);
      setExpenseCategory(expense.category);
      setExpenseVendor(expense.vendor || "");
      setExpenseInvoiceRef(expense.invoice_ref || "");
      setExpensePaymentMethod(expense.payment_method || "");
      setExpenseNotes(expense.notes || "");
      setExpenseFileId(expense.linked_vehicle_file_id || null);
      return;
    }
    setEditingExpense(null);
    setExpenseAmount(null);
    setExpenseCurrency("EUR");
    setExpenseDate(null);
    setExpenseCategory(null);
    setExpenseVendor("");
    setExpenseInvoiceRef("");
    setExpensePaymentMethod("");
    setExpenseNotes("");
    setExpenseFileId(null);
  };

  const refreshVisits = async (vehicleId: number) => {
    try {
      const data = await api.listVehicleVisits(vehicleId);
      setVisits(data);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al cargar visitas",
        color: "red",
      });
    }
  };

  const resetVisitForm = () => {
    setVisitDate(null);
    setVisitName("");
    setVisitPhone("");
    setVisitEmail("");
    setVisitNotes("");
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const vehicleId = Number(id);
        const [vehicleData, branchesData, linksData, expensesData, visitsData, kpisData] = await Promise.all([
          api.getVehicle(vehicleId),
          api.getBranches(),
          api.listVehicleLinks(vehicleId),
          api.listVehicleExpenses(vehicleId),
          api.listVehicleVisits(vehicleId),
          api.getVehicleKpis(vehicleId),
        ]);
        setVehicle(vehicleData);
        setBranches(branchesData);
        setLinks(linksData);
        setExpenses(expensesData);
        setVisits(visitsData);
        setKpis(kpisData);
        await Promise.all([refreshFiles(vehicleId), refreshPhotos(vehicleId)]);
      } catch (error) {
        notifications.show({
          title: "Error",
          message: error instanceof Error ? error.message : "Error al cargar el vehiculo",
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
          <Text>Vehiculo no encontrado</Text>
        </Card>
      </Stack>
    );
  }

  const branchName = vehicle.location_id
    ? branches.find((b) => b.id === vehicle.location_id)?.name
    : "-";

  const handleCreateLink = async () => {
    if (!newLinkUrl.trim()) {
      notifications.show({
        title: "Error",
        message: "La URL es requerida",
        color: "red",
      });
      return;
    }

    try {
      setCreatingLink(true);
      const newLink = await api.createVehicleLink(Number(id), {
        title: newLinkTitle.trim() || undefined,
        url: newLinkUrl.trim(),
      });
      setLinks([newLink, ...links]);
      setNewLinkTitle("");
      setNewLinkUrl("");
      notifications.show({
        title: "Exito",
        message: "Enlace creado correctamente",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al crear el enlace",
        color: "red",
      });
    } finally {
      setCreatingLink(false);
    }
  };

  const handleDeleteLink = async (linkId: number) => {
    try {
      await api.deleteVehicleLink(Number(id), linkId);
      setLinks(links.filter((l) => l.id !== linkId));
      setConfirmDeleteOpen(false);
      setDeletingLinkId(null);
      notifications.show({
        title: "Exito",
        message: "Enlace eliminado correctamente",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al eliminar el enlace",
        color: "red",
      });
    }
  };

  const handleUploadFile = async () => {
    if (!id || !selectedFile) {
      notifications.show({
        title: "Error",
        message: "Selecciona un archivo",
        color: "red",
      });
      return;
    }

    try {
      setUploadingFile(true);
      await api.uploadVehicleFile(Number(id), {
        file: selectedFile,
        category: fileCategory,
        notes: fileNotes.trim() || undefined,
      });
      setSelectedFile(null);
      setFileNotes("");
      notifications.show({
        title: "Exito",
        message: "Archivo subido correctamente",
        color: "green",
      });
      await refreshFiles(Number(id));
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al subir archivo",
        color: "red",
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleUploadPhotos = async () => {
    if (!id || selectedPhotos.length === 0) {
      notifications.show({
        title: "Error",
        message: "Selecciona una o mas fotos",
        color: "red",
      });
      return;
    }

    try {
      setUploadingPhoto(true);
      await Promise.all(
        selectedPhotos.map((photo) =>
          api.uploadVehicleFile(Number(id), {
            file: photo,
            category: "photo",
          })
        )
      );
      setSelectedPhotos([]);
      notifications.show({
        title: "Exito",
        message: "Fotos subidas correctamente",
        color: "green",
      });
      await refreshPhotos(Number(id));
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al subir fotos",
        color: "red",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!id || !fileToDelete?.id) {
      return;
    }
    try {
      await api.deleteVehicleFile(Number(id), fileToDelete.id);
      notifications.show({
        title: "Exito",
        message: "Archivo eliminado correctamente",
        color: "green",
      });
      if (fileToDelete.category === "photo") {
        await refreshPhotos(Number(id));
      } else {
        await refreshFiles(Number(id));
      }
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al eliminar archivo",
        color: "red",
      });
    } finally {
      setConfirmFileDeleteOpen(false);
      setFileToDelete(null);
    }
  };

  const handleOpenCreateExpense = () => {
    resetExpenseForm();
    setExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (expense: VehicleExpense) => {
    resetExpenseForm(expense);
    setExpenseModalOpen(true);
  };

  const handleSaveExpense = async () => {
    if (!id) return;
    if (!expenseDate || !expenseCategory || expenseAmount === null || expenseAmount <= 0) {
      notifications.show({
        title: "Error",
        message: "Completa fecha, categoria e importe valido",
        color: "red",
      });
      return;
    }

    const payloadBase: ExpenseCreateInput = {
      amount: expenseAmount,
      currency: expenseCurrency.trim() || "EUR",
      date: expenseDate.toISOString().split("T")[0],
      category: expenseCategory,
      vendor: expenseVendor.trim() || undefined,
      invoice_ref: expenseInvoiceRef.trim() || undefined,
      payment_method: expensePaymentMethod.trim() || undefined,
      notes: expenseNotes.trim() || undefined,
      linked_vehicle_file_id: expenseFileId ?? undefined,
    };

    try {
      setSavingExpense(true);
      if (editingExpense?.id) {
        const updatePayload: ExpenseUpdateInput = payloadBase;
        await api.updateVehicleExpense(Number(id), editingExpense.id, updatePayload);
        notifications.show({
          title: "Exito",
          message: "Gasto actualizado correctamente",
          color: "green",
        });
      } else {
        await api.createVehicleExpense(Number(id), payloadBase);
        notifications.show({
          title: "Exito",
          message: "Gasto creado correctamente",
          color: "green",
        });
      }
      setExpenseModalOpen(false);
      resetExpenseForm();
      await refreshExpenses(Number(id));
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al guardar gasto",
        color: "red",
      });
    } finally {
      setSavingExpense(false);
    }
  };

  const handleConfirmDeleteExpense = (expense: VehicleExpense) => {
    setExpenseToDelete(expense);
    setConfirmExpenseDeleteOpen(true);
  };

  const handleDeleteExpense = async () => {
    if (!id || !expenseToDelete?.id) {
      return;
    }
    try {
      await api.deleteVehicleExpense(Number(id), expenseToDelete.id);
      notifications.show({
        title: "Exito",
        message: "Gasto eliminado correctamente",
        color: "green",
      });
      await refreshExpenses(Number(id));
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al eliminar gasto",
        color: "red",
      });
    } finally {
      setConfirmExpenseDeleteOpen(false);
      setExpenseToDelete(null);
    }
  };

  const handleOpenVisitModal = () => {
    resetVisitForm();
    setVisitModalOpen(true);
  };

  const handleSaveVisit = async () => {
    if (!id || !visitDate || !visitName.trim()) {
      notifications.show({
        title: "Error",
        message: "Fecha y nombre son requeridos",
        color: "red",
      });
      return;
    }
    if (!visitPhone.trim() && !visitEmail.trim()) {
      notifications.show({
        title: "Error",
        message: "Telefono o email es requerido",
        color: "red",
      });
      return;
    }

    const payload: VehicleVisitCreateInput = {
      visit_date: visitDate.toISOString().split("T")[0],
      name: visitName.trim(),
      phone: visitPhone.trim() || undefined,
      email: visitEmail.trim() || undefined,
      notes: visitNotes.trim() || undefined,
    };

    try {
      setSavingVisit(true);
      await api.createVehicleVisit(Number(id), payload);
      notifications.show({
        title: "Exito",
        message: "Visita creada correctamente",
        color: "green",
      });
      setVisitModalOpen(false);
      resetVisitForm();
      await refreshVisits(Number(id));
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al crear visita",
        color: "red",
      });
    } finally {
      setSavingVisit(false);
    }
  };

  const handleConfirmDeleteVisit = (visit: VehicleVisit) => {
    setVisitToDelete(visit);
    setConfirmVisitDeleteOpen(true);
  };

  const handleDeleteVisit = async () => {
    if (!id || !visitToDelete?.id) {
      return;
    }
    try {
      await api.deleteVehicleVisit(Number(id), visitToDelete.id);
      notifications.show({
        title: "Exito",
        message: "Visita eliminada correctamente",
        color: "green",
      });
      await refreshVisits(Number(id));
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al eliminar visita",
        color: "red",
      });
    } finally {
      setConfirmVisitDeleteOpen(false);
      setVisitToDelete(null);
    }
  };

  const formatPercent = (value?: number | null) => {
    if (value === null || value === undefined) return "-";
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Detalle del vehiculo</Title>

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
              Informacion general
            </Title>
            <Stack gap="sm">
              <div>
                <Text size="sm" c="dimmed">
                  Matricula
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
                  Version
                </Text>
                <Text fw={500}>{vehicle.version || "-"}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Ano
                </Text>
                <Text fw={500}>{vehicle.year || "-"}</Text>
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
                <Text fw={500} size="sm">
                  {vehicle.notes || "-"}
                </Text>
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
                  Kilometros
                </Text>
                <Text fw={500}>{vehicle.km ? vehicle.km.toLocaleString() : "-"}</Text>
              </div>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder shadow="xs" radius="md">
            <Title order={3} mb="md">
              Informacion financiera
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
                <Text fw={500}>{vehicle.id}</Text>
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

      <Card withBorder shadow="xs" radius="md">
        <Title order={3} mb="md">
          Indicadores
        </Title>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Gastos totales
            </Text>
            <Text fw={500}>
              {kpis ? formatCurrency(kpis.total_expenses) : "-"}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Coste total
            </Text>
            <Text fw={500}>
              {kpis?.total_cost !== undefined && kpis?.total_cost !== null
                ? formatCurrency(kpis.total_cost)
                : "-"}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Margen
            </Text>
            <Text fw={500}>
              {kpis?.gross_margin !== undefined && kpis?.gross_margin !== null
                ? formatCurrency(kpis.gross_margin)
                : "-"}
            </Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              ROI
            </Text>
            <Text fw={500}>{formatPercent(kpis?.roi)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Dias en stock
            </Text>
            <Text fw={500}>
              {kpis?.days_in_stock !== undefined && kpis?.days_in_stock !== null
                ? kpis.days_in_stock
                : "-"}
            </Text>
          </Group>
        </Stack>
      </Card>

      {/* Enlaces Section */}
      <Card withBorder shadow="xs" radius="md">
        <Title order={3} mb="md">
          Enlaces
        </Title>

        {/* Form para agregar nuevo enlace */}
        <Stack gap="sm" mb="lg">
          <TextInput
            placeholder="Titulo (ej: Milanuncios)"
            value={newLinkTitle}
            onChange={(e) => setNewLinkTitle(e.currentTarget.value)}
            disabled={creatingLink}
          />
          <TextInput
            placeholder="URL del enlace (requerido)"
            value={newLinkUrl}
            onChange={(e) => setNewLinkUrl(e.currentTarget.value)}
            disabled={creatingLink}
            error={newLinkUrl && !newLinkUrl.startsWith("http") ? "La URL debe comenzar con http/https" : ""}
          />
          <Button
            onClick={handleCreateLink}
            loading={creatingLink}
            leftSection={<IconPlus size={18} />}
            w="fit-content"
          >
            Agregar enlace
          </Button>
        </Stack>

        {/* Listado de enlaces */}
        {links.length === 0 ? (
          <Text c="dimmed" size="sm">
            Sin enlaces registrados
          </Text>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Titulo</Table.Th>
                <Table.Th>URL</Table.Th>
                <Table.Th>Fecha</Table.Th>
                <Table.Th w={100} style={{ textAlign: "center" }}>
                  Acciones
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {links.map((link) => (
                <Table.Tr key={link.id}>
                  <Table.Td>{link.title || "-"}</Table.Td>
                  <Table.Td>
                    <Text
                      size="sm"
                      component="a"
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--mantine-color-blue-6)" }}
                    >
                      {link.url.length > 50 ? link.url.substring(0, 47) + "..." : link.url}
                    </Text>
                  </Table.Td>
                  <Table.Td>{formatDate(link.created_at)}</Table.Td>
                  <Table.Td style={{ textAlign: "center" }}>
                    <Group gap={0} justify="center">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => window.open(link.url, "_blank")}
                        title="Abrir en nueva pestana"
                      >
                        <IconExternalLink size={18} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => {
                          setDeletingLinkId(link.id || null);
                          setConfirmDeleteOpen(true);
                        }}
                        title="Eliminar enlace"
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Gastos */}
      <Card withBorder shadow="xs" radius="md">
        <Group justify="space-between" mb="md">
          <Title order={3}>Gastos</Title>
          <Button onClick={handleOpenCreateExpense} leftSection={<IconPlus size={18} />}>
            Anadir gasto
          </Button>
        </Group>

        {expenses.length === 0 ? (
          <Text c="dimmed" size="sm">
            Sin gastos registrados
          </Text>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Fecha</Table.Th>
                <Table.Th>Categoria</Table.Th>
                <Table.Th>Proveedor</Table.Th>
                <Table.Th>Importe</Table.Th>
                <Table.Th w={120} style={{ textAlign: "center" }}>
                  Acciones
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {expenses.map((expense) => (
                <Table.Tr key={expense.id}>
                  <Table.Td>{formatDate(expense.date)}</Table.Td>
                  <Table.Td>{expenseCategoryLabels[expense.category]}</Table.Td>
                  <Table.Td>{expense.vendor || "-"}</Table.Td>
                  <Table.Td>
                    {formatCurrency(Number(expense.amount))} {expense.currency}
                  </Table.Td>
                  <Table.Td style={{ textAlign: "center" }}>
                    <Group gap={0} justify="center">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => handleOpenEditExpense(expense)}
                        title="Editar gasto"
                      >
                        <IconPencil size={18} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => handleConfirmDeleteExpense(expense)}
                        title="Eliminar gasto"
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Visitas / Interesados */}
      <Card withBorder shadow="xs" radius="md">
        <Group justify="space-between" mb="md">
          <Title order={3}>Visitas / Interesados</Title>
          <Button onClick={handleOpenVisitModal} leftSection={<IconPlus size={18} />}>
            Anadir visita
          </Button>
        </Group>

        {visits.length === 0 ? (
          <Text c="dimmed" size="sm">
            Sin visitas registradas
          </Text>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Fecha</Table.Th>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Telefono</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Observaciones</Table.Th>
                <Table.Th w={80} style={{ textAlign: "center" }}>
                  Acciones
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visits.map((visit) => (
                <Table.Tr key={visit.id}>
                  <Table.Td>{formatDate(visit.visit_date)}</Table.Td>
                  <Table.Td>{visit.name}</Table.Td>
                  <Table.Td>{visit.phone || "-"}</Table.Td>
                  <Table.Td>{visit.email || "-"}</Table.Td>
                  <Table.Td>{visit.notes || "-"}</Table.Td>
                  <Table.Td style={{ textAlign: "center" }}>
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => handleConfirmDeleteVisit(visit)}
                      title="Eliminar visita"
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Documentos y gastos */}
      <Card withBorder shadow="xs" radius="md">
        <Title order={3} mb="md">
          Documentos y gastos
        </Title>

        <Stack gap="sm" mb="lg">
          <Select
            label="Categoria"
            data={[
              { value: "document", label: "Documento" },
              { value: "expense", label: "Gasto" },
            ]}
            value={fileCategory}
            onChange={(value) => setFileCategory((value as VehicleFileCategory) || "document")}
          />
          <TextInput
            label="Notas"
            placeholder="Notas opcionales"
            value={fileNotes}
            onChange={(e) => setFileNotes(e.currentTarget.value)}
          />
          <input
            type="file"
            onChange={(e) => setSelectedFile(e.currentTarget.files ? e.currentTarget.files[0] : null)}
          />
          <Button onClick={handleUploadFile} loading={uploadingFile} w="fit-content">
            Subir archivo
          </Button>
        </Stack>

        {files.length === 0 ? (
          <Text c="dimmed" size="sm">
            Sin archivos
          </Text>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Categoria</Table.Th>
                <Table.Th>Tamano</Table.Th>
                <Table.Th>Fecha</Table.Th>
                <Table.Th>Notas</Table.Th>
                <Table.Th w={120} style={{ textAlign: "center" }}>
                  Acciones
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {files.map((file) => (
                <Table.Tr key={file.id}>
                  <Table.Td>{file.original_name}</Table.Td>
                  <Table.Td>{file.category === "document" ? "Documento" : "Gasto"}</Table.Td>
                  <Table.Td>{formatFileSize(file.size_bytes)}</Table.Td>
                  <Table.Td>{formatDate(file.created_at)}</Table.Td>
                  <Table.Td>{file.notes || "-"}</Table.Td>
                  <Table.Td style={{ textAlign: "center" }}>
                    <Group gap={0} justify="center">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        component="a"
                        href={api.downloadVehicleFileUrl(Number(id), file.id || 0)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir o descargar"
                      >
                        <IconExternalLink size={18} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => {
                          setFileToDelete(file);
                          setConfirmFileDeleteOpen(true);
                        }}
                        title="Eliminar archivo"
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Fotos */}
      <Card withBorder shadow="xs" radius="md">
        <Title order={3} mb="md">
          Fotos
        </Title>

        <Stack gap="sm" mb="lg">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setSelectedPhotos(e.currentTarget.files ? Array.from(e.currentTarget.files) : [])}
          />
          <Button onClick={handleUploadPhotos} loading={uploadingPhoto} w="fit-content">
            Subir fotos
          </Button>
        </Stack>

        {photos.length === 0 ? (
          <Text c="dimmed" size="sm">
            Sin fotos
          </Text>
        ) : (
          <Grid>
            {photos.map((photo) => (
              <Grid.Col key={photo.id} span={{ base: 12, md: 4, lg: 3 }}>
                <Card withBorder shadow="xs" radius="md">
                  <Stack gap="xs">
                    <img
                      src={api.downloadVehicleFileUrl(Number(id), photo.id || 0)}
                      alt={photo.original_name}
                      style={{ width: "100%", height: 180, objectFit: "cover" }}
                    />
                    <Group justify="space-between">
                      <Text size="sm" lineClamp={1}>
                        {photo.original_name}
                      </Text>
                      <Group gap={4}>
                        <ActionIcon
                          variant="light"
                          color="blue"
                          component="a"
                          href={api.downloadVehicleFileUrl(Number(id), photo.id || 0)}
                          download
                          title="Descargar foto"
                        >
                          <IconDownload size={18} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color="red"
                          onClick={() => {
                            setFileToDelete(photo);
                            setConfirmFileDeleteOpen(true);
                          }}
                          title="Eliminar foto"
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        )}
      </Card>


      <Modal
        opened={visitModalOpen}
        onClose={() => {
          setVisitModalOpen(false);
          resetVisitForm();
        }}
        title="Nueva visita"
        centered
      >
        <Stack gap="sm">
          <DateInput
            label="Fecha"
            value={visitDate}
            onChange={(value) => setVisitDate(value)}
            required
          />
          <TextInput
            label="Nombre"
            value={visitName}
            onChange={(e) => setVisitName(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Telefono"
            value={visitPhone}
            onChange={(e) => setVisitPhone(e.currentTarget.value)}
          />
          <TextInput
            label="Email"
            value={visitEmail}
            onChange={(e) => setVisitEmail(e.currentTarget.value)}
          />
          <TextInput
            label="Observaciones"
            value={visitNotes}
            onChange={(e) => setVisitNotes(e.currentTarget.value)}
          />
          <Group justify="flex-end" mt="sm">
            <Button
              variant="light"
              onClick={() => {
                setVisitModalOpen(false);
                resetVisitForm();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveVisit} loading={savingVisit}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={confirmVisitDeleteOpen}
        onClose={() => setConfirmVisitDeleteOpen(false)}
        title="Eliminar visita"
        centered
      >
        <Stack gap="md">
          <Text>Estas seguro de que deseas eliminar esta visita?</Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setConfirmVisitDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button color="red" onClick={handleDeleteVisit}>
              Eliminar
            </Button>
          </Group>
        </Stack>
      </Modal>


      <Modal
        opened={expenseModalOpen}
        onClose={() => {
          setExpenseModalOpen(false);
          resetExpenseForm();
        }}
        title={editingExpense ? "Editar gasto" : "Nuevo gasto"}
        centered
      >
        <Stack gap="sm">
          <DateInput
            label="Fecha"
            value={expenseDate}
            onChange={(value) => setExpenseDate(value)}
            required
          />
          <Select
            label="Categoria"
            data={Object.entries(expenseCategoryLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            value={expenseCategory}
            onChange={(value) => setExpenseCategory(value ? (value as VehicleExpenseCategory) : null)}
            required
          />
          <NumberInput
            label="Importe"
            value={expenseAmount ?? undefined}
            onChange={(value) => setExpenseAmount(typeof value === "number" ? value : null)}
            min={0}
            decimalScale={2}
            required
          />
          <TextInput
            label="Moneda"
            value={expenseCurrency}
            onChange={(e) => setExpenseCurrency(e.currentTarget.value)}
          />
          <TextInput
            label="Proveedor"
            value={expenseVendor}
            onChange={(e) => setExpenseVendor(e.currentTarget.value)}
          />
          <TextInput
            label="Factura"
            value={expenseInvoiceRef}
            onChange={(e) => setExpenseInvoiceRef(e.currentTarget.value)}
          />
          <TextInput
            label="Metodo de pago"
            value={expensePaymentMethod}
            onChange={(e) => setExpensePaymentMethod(e.currentTarget.value)}
          />
          <TextInput
            label="Notas"
            value={expenseNotes}
            onChange={(e) => setExpenseNotes(e.currentTarget.value)}
          />
          <Select
            label="Archivo vinculado"
            placeholder="Selecciona un archivo"
            data={files
              .filter((file) => file.id)
              .map((file) => ({
                value: String(file.id),
                label: file.original_name,
              }))}
            value={expenseFileId ? String(expenseFileId) : null}
            onChange={(value) => setExpenseFileId(value ? Number(value) : null)}
            clearable
          />
          <Group justify="flex-end" mt="sm">
            <Button
              variant="light"
              onClick={() => {
                setExpenseModalOpen(false);
                resetExpenseForm();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveExpense} loading={savingExpense}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={confirmExpenseDeleteOpen}
        onClose={() => setConfirmExpenseDeleteOpen(false)}
        title="Eliminar gasto"
        centered
      >
        <Stack gap="md">
          <Text>Estas seguro de que deseas eliminar este gasto?</Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setConfirmExpenseDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button color="red" onClick={handleDeleteExpense}>
              Eliminar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de confirmacion para eliminar */}
      <Modal
        opened={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Confirmar eliminacion"
        centered
      >
        <Stack gap="md">
          <Text>Estas seguro de que deseas eliminar este enlace?</Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setConfirmDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              color="red"
              onClick={() => deletingLinkId && handleDeleteLink(deletingLinkId)}
            >
              Eliminar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal de confirmacion para eliminar archivo */}
      <Modal
        opened={confirmFileDeleteOpen}
        onClose={() => setConfirmFileDeleteOpen(false)}
        title="Confirmar eliminacion"
        centered
      >
        <Stack gap="md">
          <Text>Estas seguro de que deseas eliminar este archivo?</Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setConfirmFileDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button color="red" onClick={handleDeleteFile}>
              Eliminar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
