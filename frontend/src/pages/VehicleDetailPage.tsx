import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Badge, Card, Stack, Text, Title, Button, Grid, Loader, Center, TextInput, Table, Group, ActionIcon, Modal, Select, NumberInput, Tabs } from "@mantine/core";
import { DateInput, DateTimePicker } from "@mantine/dates";
import { IconArrowLeft, IconExternalLink, IconTrash, IconPlus, IconPencil, IconDownload, IconCalendarEvent } from "@tabler/icons-react";
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
  VehicleStatus,
  ChangeStatusInput,
  VehicleStatusEvent,
  VehicleVisit,
  VehicleVisitCreateInput,
  VehicleKpis,
  VehicleEvent,
  VehicleEventType,
  SaleCloseInput,
  SaleDocument,
  formatCurrency,
  formatDate,
} from "../lib/api";
import { notifications } from "@mantine/notifications";

export default function VehicleDetailPage() {
  const { licensePlate } = useParams<{ licensePlate: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [links, setLinks] = useState<VehicleLink[]>([]);
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  const [files, setFiles] = useState<VehicleFile[]>([]);
  const [photos, setPhotos] = useState<VehicleFile[]>([]);
  const [visits, setVisits] = useState<VehicleVisit[]>([]);
  const [kpis, setKpis] = useState<VehicleKpis | null>(null);
  const [timeline, setTimeline] = useState<VehicleEvent[]>([]);
  const [timelineType, setTimelineType] = useState<VehicleEventType | null>(null);
  const [moveBranchId, setMoveBranchId] = useState<string | null>(null);
  const [moveBranchNote, setMoveBranchNote] = useState("");
  const [movingBranch, setMovingBranch] = useState(false);
  const [statusEvents, setStatusEvents] = useState<VehicleStatusEvent[]>([]);
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
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusValue, setStatusValue] = useState<VehicleStatus | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [statusReservedUntil, setStatusReservedUntil] = useState<Date | null>(null);
  const [statusSoldAt, setStatusSoldAt] = useState<Date | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [visitDate, setVisitDate] = useState<Date | null>(null);
  const [visitScheduledAt, setVisitScheduledAt] = useState<Date | null>(null);
  const [visitDuration, setVisitDuration] = useState<number | null>(30);
  const [visitTimezone, setVisitTimezone] = useState("Europe/Madrid");
  const [visitName, setVisitName] = useState("");
  const [visitPhone, setVisitPhone] = useState("");
  const [visitEmail, setVisitEmail] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [savingVisit, setSavingVisit] = useState(false);
  const [visitToDelete, setVisitToDelete] = useState<VehicleVisit | null>(null);
  const [confirmVisitDeleteOpen, setConfirmVisitDeleteOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<VehicleVisit | null>(null);
  const [syncingVisitId, setSyncingVisitId] = useState<number | null>(null);
  const [vehicleKm, setVehicleKm] = useState<number | null>(null);
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleLicensePlate, setVehicleLicensePlate] = useState("");
  const [vehicleVin, setVehicleVin] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleVersion, setVehicleVersion] = useState("");
  const [vehicleYear, setVehicleYear] = useState<number | null>(null);
  const [vehicleNotes, setVehicleNotes] = useState("");
  const [savingVehicleDetails, setSavingVehicleDetails] = useState(false);
  const [deletingVehicle, setDeletingVehicle] = useState(false);
  const [salePrice, setSalePrice] = useState<number | null>(null);
  const [saleDate, setSaleDate] = useState<Date | null>(null);
  const [saleNotes, setSaleNotes] = useState("");
  const [saleId, setSaleId] = useState<number | null>(null);
  const [savingSale, setSavingSale] = useState(false);
  const [saleDocuments, setSaleDocuments] = useState<SaleDocument[]>([]);
  const [saleDocumentNotes, setSaleDocumentNotes] = useState("");
  const [selectedSaleDocument, setSelectedSaleDocument] = useState<File | null>(null);
  const [uploadingSaleDocument, setUploadingSaleDocument] = useState(false);
  const [saleDocumentToDelete, setSaleDocumentToDelete] = useState<SaleDocument | null>(null);
  const [confirmSaleDocumentDeleteOpen, setConfirmSaleDocumentDeleteOpen] = useState(false);

  const tabKeys = ["resumen", "trabajo", "publicacion", "venta", "timeline"] as const;
  type TabKey = (typeof tabKeys)[number];
  const normalizeTab = (value: string | null): TabKey => {
    if (value && (tabKeys as readonly string[]).includes(value)) {
      return value as TabKey;
    }
    return "resumen";
  };
  const [activeTab, setActiveTab] = useState<TabKey>(() => normalizeTab(searchParams.get("tab")));

  const expenseCategoryLabels: Record<VehicleExpenseCategory, string> = {
    PURCHASE: "Compra",
    MECHANICAL: "Mecanica",
    TIRES: "Neumaticos",
    TRANSPORT: "Transporte",
    ADMIN: "Administrativo",
    CLEANING: "Limpieza",
    OTHER: "Otros",
  };

  const statusLabels: Record<VehicleStatus, string> = {
    intake: "Entrada",
    prep: "Preparacion",
    ready: "Listo",
    published: "Publicado",
    reserved: "Reservado",
    sold: "Vendido",
    discarded: "Descartado",
  };

  const statusColors: Record<VehicleStatus, string> = {
    intake: "gray",
    prep: "yellow",
    ready: "teal",
    published: "blue",
    reserved: "orange",
    sold: "green",
    discarded: "red",
  };

  const statusTransitions: Record<VehicleStatus, VehicleStatus[]> = {
    intake: ["prep", "ready", "discarded"],
    prep: ["ready", "discarded"],
    ready: ["published", "discarded"],
    published: ["reserved", "sold", "discarded", "ready"],
    reserved: ["sold", "published", "discarded"],
    sold: [],
    discarded: [],
  };

  const timelineTypeOptions: { value: VehicleEventType; label: string }[] = [
    { value: "STATUS_CHANGE", label: "Cambio de estado" },
    { value: "EXPENSE_CREATED", label: "Gasto creado" },
    { value: "EXPENSE_UPDATED", label: "Gasto actualizado" },
    { value: "EXPENSE_DELETED", label: "Gasto eliminado" },
    { value: "VISIT_CREATED", label: "Visita creada" },
    { value: "VISIT_DELETED", label: "Visita eliminada" },
    { value: "FILE_UPLOADED", label: "Archivo subido" },
    { value: "FILE_DELETED", label: "Archivo eliminado" },
    { value: "BRANCH_MOVED", label: "Cambio de sucursal" },
  ];

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(value)
    );
  };

  const refreshFiles = async (licensePlateValue: string) => {
    try {
      const [documents, expenses] = await Promise.all([
        api.listVehicleFiles(licensePlateValue, "document"),
        api.listVehicleFiles(licensePlateValue, "expense"),
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

  const refreshPhotos = async (licensePlateValue: string) => {
    try {
      const data = await api.listVehicleFiles(licensePlateValue, "photo");
      setPhotos(data);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al cargar fotos",
        color: "red",
      });
    }
  };

  const refreshSaleDocuments = async (licensePlateValue: string) => {
    try {
      const data = await api.listVehicleSaleDocuments(licensePlateValue);
      setSaleDocuments(data);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al cargar documentos de venta",
        color: "red",
      });
    }
  };

  const refreshExpenses = async (licensePlateValue: string) => {
    try {
      const data = await api.listVehicleExpenses(licensePlateValue);
      setExpenses(data);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al cargar gastos",
        color: "red",
      });
    }
  };

  const refreshTimeline = async (licensePlateValue: string, type?: VehicleEventType | null) => {
    try {
      const data = await api.getVehicleTimeline(licensePlateValue, {
        types: type ? [type] : undefined,
      });
      setTimeline(data);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al cargar timeline",
        color: "red",
      });
    }
  };

  const refreshStatusEvents = async (licensePlateValue: string) => {
    try {
      const data = await api.listVehicleStatusEvents(licensePlateValue, { limit: 50 });
      setStatusEvents(data);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al cargar historial de estado",
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

  const refreshVisits = async (licensePlateValue: string) => {
    try {
      const data = await api.listVehicleVisits(licensePlateValue);
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
    setVisitScheduledAt(null);
    setVisitDuration(30);
    setVisitTimezone("Europe/Madrid");
    setVisitName("");
    setVisitPhone("");
    setVisitEmail("");
    setVisitNotes("");
    setEditingVisit(null);
  };

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const nextTab = normalizeTab(tabParam);
    setActiveTab(nextTab);
    if (tabParam !== nextTab) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", nextTab);
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!licensePlate) {
          throw new Error("Matricula no encontrada en la URL");
        }
        const [
          vehicleData,
          branchesData,
          linksData,
          expensesData,
          visitsData,
          kpisData,
          timelineData,
          statusEventsData,
          saleData,
        ] = await Promise.all([
          api.getVehicle(licensePlate),
          api.getBranches(),
          api.listVehicleLinks(licensePlate),
          api.listVehicleExpenses(licensePlate),
          api.listVehicleVisits(licensePlate),
          api.getVehicleKpis(licensePlate),
          api.getVehicleTimeline(licensePlate),
          api.listVehicleStatusEvents(licensePlate),
          api.getVehicleSale(licensePlate).catch(() => null),
        ]);
        setVehicle(vehicleData);
        setBranches(branchesData);
        setLinks(linksData);
        setExpenses(expensesData);
        setVisits(visitsData);
        setKpis(kpisData);
        setTimeline(timelineData);
        setStatusEvents(statusEventsData);
        setStatusValue((vehicleData.status ?? vehicleData.state ?? "intake") as VehicleStatus);
        setStatusReservedUntil(
          vehicleData.reserved_until ? new Date(vehicleData.reserved_until) : null
        );
        setStatusSoldAt(vehicleData.sold_at ? new Date(vehicleData.sold_at) : null);
        setVehicleKm(vehicleData.km ?? null);
        setVehicleColor(vehicleData.color ?? "");
        setVehicleLicensePlate(vehicleData.license_plate ?? "");
        setVehicleVin(vehicleData.vin ?? "");
        setVehicleBrand(vehicleData.brand ?? "");
        setVehicleModel(vehicleData.model ?? "");
        setVehicleVersion(vehicleData.version ?? "");
        setVehicleYear(vehicleData.year ?? null);
        setVehicleNotes(vehicleData.notes ?? "");
        setSaleId(saleData?.id ?? null);
        setSalePrice(vehicleData.sale_price ?? null);
        setSaleDate(
          vehicleData.sold_at
            ? new Date(vehicleData.sold_at)
            : vehicleData.sale_date
            ? new Date(vehicleData.sale_date)
            : null
        );
        setSaleNotes(vehicleData.sale_notes ?? saleData?.notes ?? "");
        setMoveBranchId(
          vehicleData.branch_id
            ? String(vehicleData.branch_id)
            : vehicleData.location_id
            ? String(vehicleData.location_id)
            : null
        );
        await Promise.all([
          refreshFiles(licensePlate),
          refreshPhotos(licensePlate),
          refreshSaleDocuments(licensePlate),
        ]);
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

    if (licensePlate) {
      fetchData();
    }
  }, [licensePlate]);

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

  const currentBranchId = vehicle.branch_id ?? vehicle.location_id ?? null;
  const branchName = currentBranchId ? branches.find((b) => b.id === currentBranchId)?.name : "-";
  const currentStatus = (vehicle.status ?? vehicle.state ?? "intake") as VehicleStatus;
  const statusOptions = statusTransitions[currentStatus] || [];

  const handleCreateLink = async () => {
    if (!licensePlate) return;
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
      const newLink = await api.createVehicleLink(licensePlate ?? "", {
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
    if (!licensePlate) return;
    try {
      await api.deleteVehicleLink(licensePlate ?? "", linkId);
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
    if (!licensePlate || !selectedFile) {
      notifications.show({
        title: "Error",
        message: "Selecciona un archivo",
        color: "red",
      });
      return;
    }

    try {
      setUploadingFile(true);
      await api.uploadVehicleFile(licensePlate ?? "", {
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
      await refreshFiles(licensePlate ?? "");
      await refreshTimeline(licensePlate ?? "", timelineType);
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
    if (!licensePlate || selectedPhotos.length === 0) {
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
          api.uploadVehicleFile(licensePlate ?? "", {
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
      await refreshPhotos(licensePlate ?? "");
      await refreshTimeline(licensePlate ?? "", timelineType);
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
    if (!licensePlate || !fileToDelete?.id) {
      return;
    }
    try {
      await api.deleteVehicleFile(licensePlate ?? "", fileToDelete.id);
      notifications.show({
        title: "Exito",
        message: "Archivo eliminado correctamente",
        color: "green",
      });
      if (fileToDelete.category === "photo") {
        await refreshPhotos(licensePlate ?? "");
      } else {
        await refreshFiles(licensePlate ?? "");
      }
      await refreshTimeline(licensePlate ?? "", timelineType);
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

  const handleSaveVehicleDetails = async () => {
    if (!licensePlate) return;
    try {
      setSavingVehicleDetails(true);
      const updated = await api.updateVehicle(licensePlate ?? "", {
        vin: vehicleVin.trim() || undefined,
        brand: vehicleBrand.trim() || undefined,
        model: vehicleModel.trim() || undefined,
        version: vehicleVersion.trim() || undefined,
        year: vehicleYear ?? undefined,
        km: vehicleKm ?? undefined,
        color: vehicleColor.trim() || undefined,
        notes: vehicleNotes.trim() || undefined,
      });
      setVehicle(updated);
      setVehicleKm(updated.km ?? null);
      setVehicleColor(updated.color ?? "");
      setVehicleLicensePlate(updated.license_plate ?? "");
      setVehicleVin(updated.vin ?? "");
      setVehicleBrand(updated.brand ?? "");
      setVehicleModel(updated.model ?? "");
      setVehicleVersion(updated.version ?? "");
      setVehicleYear(updated.year ?? null);
      setVehicleNotes(updated.notes ?? "");
      notifications.show({
        title: "Exito",
        message: "Datos actualizados correctamente",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al actualizar datos",
        color: "red",
      });
    } finally {
      setSavingVehicleDetails(false);
    }
  };

  const handleMoveBranch = async () => {
    if (!licensePlate) return;
    if (!moveBranchId) {
      notifications.show({
        title: "Error",
        message: "Selecciona una sucursal",
        color: "red",
      });
      return;
    }
    const targetId = Number(moveBranchId);
    const currentId = vehicle?.branch_id ?? vehicle?.location_id ?? null;
    if (currentId === targetId) {
      notifications.show({
        title: "Sin cambios",
        message: "El vehiculo ya esta en esa sucursal",
        color: "yellow",
      });
      return;
    }
    try {
      setMovingBranch(true);
      const updated = await api.moveVehicleBranch(licensePlate, {
        to_branch_id: targetId,
        note: moveBranchNote.trim() || undefined,
      });
      setVehicle(updated);
      setMoveBranchId(updated.branch_id ? String(updated.branch_id) : String(targetId));
      setMoveBranchNote("");
      await refreshTimeline(licensePlate, timelineType);
      notifications.show({
        title: "Sucursal actualizada",
        message: "El vehiculo se movio correctamente",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al mover el vehiculo",
        color: "red",
      });
    } finally {
      setMovingBranch(false);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!licensePlate) return;
    const firstConfirm = window.confirm("Se va a eliminar el vehiculo y todo su historial. Continuar?");
    if (!firstConfirm) return;
    const secondConfirm = window.confirm("Estas seguro? Esta accion no se puede deshacer.");
    if (!secondConfirm) return;
    try {
      setDeletingVehicle(true);
      await api.deleteVehicle(licensePlate);
      notifications.show({
        title: "Vehiculo eliminado",
        message: "El vehiculo y sus archivos se han eliminado",
        color: "green",
      });
      navigate("/vehiculos");
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al eliminar vehiculo",
        color: "red",
      });
    } finally {
      setDeletingVehicle(false);
    }
  };

  const handleSaveSale = async () => {
    if (!licensePlate || salePrice === null || salePrice <= 0 || !saleDate) {
      notifications.show({
        title: "Error",
        message: "Completa fecha e importe de venta (mayor que 0)",
        color: "red",
      });
      return;
    }

    const payload: SaleCloseInput = {
      sale_price: salePrice,
      sold_at: saleDate.toISOString().split("T")[0],
      sale_notes: saleNotes.trim() || undefined,
    };

    try {
      setSavingSale(true);
      const updatedVehicle = await api.closeVehicleSale(licensePlate ?? "", payload);
      setVehicle(updatedVehicle);
      setSalePrice(updatedVehicle.sale_price ?? null);
      setSaleDate(updatedVehicle.sold_at ? new Date(updatedVehicle.sold_at) : null);
      setSaleNotes(updatedVehicle.sale_notes ?? "");

      const saleRecord = await api.getVehicleSale(licensePlate ?? "").catch(() => null);
      setSaleId(saleRecord?.id ?? null);

      await refreshSaleDocuments(licensePlate ?? "");
      await refreshTimeline(licensePlate ?? "", timelineType);
      await refreshStatusEvents(licensePlate ?? "");
      notifications.show({
        title: "Exito",
        message: "Venta guardada correctamente",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al guardar venta",
        color: "red",
      });
    } finally {
      setSavingSale(false);
    }
  };

  const handleUploadSaleDocument = async () => {
    if (!licensePlate || !selectedSaleDocument) {
      notifications.show({
        title: "Error",
        message: "Selecciona un documento",
        color: "red",
      });
      return;
    }
    try {
      setUploadingSaleDocument(true);
      await api.uploadVehicleSaleDocument(licensePlate ?? "", {
        file: selectedSaleDocument,
        notes: saleDocumentNotes.trim() || undefined,
        saleId: saleId ?? undefined,
      });
      setSelectedSaleDocument(null);
      setSaleDocumentNotes("");
      notifications.show({
        title: "Exito",
        message: "Documento de venta subido correctamente",
        color: "green",
      });
      await refreshSaleDocuments(licensePlate ?? "");
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al subir documento de venta",
        color: "red",
      });
    } finally {
      setUploadingSaleDocument(false);
    }
  };

  const handleDeleteSaleDocument = async () => {
    if (!licensePlate || !saleDocumentToDelete?.id) {
      return;
    }
    try {
      await api.deleteVehicleSaleDocument(licensePlate ?? "", saleDocumentToDelete.id);
      notifications.show({
        title: "Exito",
        message: "Documento de venta eliminado",
        color: "green",
      });
      await refreshSaleDocuments(licensePlate ?? "");
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al eliminar documento de venta",
        color: "red",
      });
    } finally {
      setConfirmSaleDocumentDeleteOpen(false);
      setSaleDocumentToDelete(null);
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
    if (!licensePlate) return;
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
        await api.updateVehicleExpense(licensePlate ?? "", editingExpense.id, updatePayload);
        notifications.show({
          title: "Exito",
          message: "Gasto actualizado correctamente",
          color: "green",
        });
      } else {
        await api.createVehicleExpense(licensePlate ?? "", payloadBase);
        notifications.show({
          title: "Exito",
          message: "Gasto creado correctamente",
          color: "green",
        });
      }
      setExpenseModalOpen(false);
      resetExpenseForm();
      await refreshExpenses(licensePlate ?? "");
      await refreshTimeline(licensePlate ?? "", timelineType);
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
    if (!licensePlate || !expenseToDelete?.id) {
      return;
    }
    try {
      await api.deleteVehicleExpense(licensePlate ?? "", expenseToDelete.id);
      notifications.show({
        title: "Exito",
        message: "Gasto eliminado correctamente",
        color: "green",
      });
      await refreshExpenses(licensePlate ?? "");
      await refreshTimeline(licensePlate ?? "", timelineType);
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

  const handleOpenStatusModal = () => {
    setStatusValue(statusOptions[0] ?? null);
    setStatusNote("");
    setStatusReservedUntil(null);
    setStatusSoldAt(null);
    setStatusModalOpen(true);
  };

  const handleSaveStatus = async () => {
    if (!licensePlate || !statusValue) {
      notifications.show({
        title: "Error",
        message: "Selecciona un estado",
        color: "red",
      });
      return;
    }
    if (statusValue === "sold" && !statusSoldAt) {
      notifications.show({
        title: "Error",
        message: "Indica la fecha de venta",
        color: "red",
      });
      return;
    }
    const payload: ChangeStatusInput = {
      to_status: statusValue,
      note: statusNote.trim() || undefined,
      reserved_until:
        statusValue === "reserved" && statusReservedUntil
          ? statusReservedUntil.toISOString().split("T")[0]
          : undefined,
      sold_at:
        statusValue === "sold" && statusSoldAt
          ? statusSoldAt.toISOString().split("T")[0]
          : undefined,
    };
    try {
      setSavingStatus(true);
      const updated = await api.changeVehicleStatus(licensePlate ?? "", payload);
      setVehicle(updated);
      setStatusValue(updated.status ?? updated.state ?? null);
      setStatusReservedUntil(updated.reserved_until ? new Date(updated.reserved_until) : null);
      setStatusSoldAt(updated.sold_at ? new Date(updated.sold_at) : null);
      setStatusModalOpen(false);
      await refreshTimeline(licensePlate ?? "", timelineType);
      await refreshStatusEvents(licensePlate ?? "");
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al cambiar estado",
        color: "red",
      });
    } finally {
      setSavingStatus(false);
    }
  };

  const handleTimelineFilter = (value: string | null) => {
    const nextType = value ? (value as VehicleEventType) : null;
    setTimelineType(nextType);
    if (id) {
      refreshTimeline(licensePlate ?? "", nextType);
    }
  };

  const handleTabChange = (value: string | null) => {
    const nextTab = normalizeTab(value);
    setActiveTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", nextTab);
    setSearchParams(nextParams, { replace: true });
  };

  const handleOpenVisitModal = () => {
    resetVisitForm();
    setVisitModalOpen(true);
  };

  const handleEditVisit = (visit: VehicleVisit) => {
    setEditingVisit(visit);
    setVisitDate(visit.visit_date ? new Date(visit.visit_date) : null);
    setVisitScheduledAt(visit.scheduled_at ? new Date(visit.scheduled_at) : null);
    setVisitDuration(visit.duration_minutes ?? 30);
    setVisitTimezone(visit.timezone ?? "Europe/Madrid");
    setVisitName(visit.name ?? "");
    setVisitPhone(visit.phone ?? "");
    setVisitEmail(visit.email ?? "");
    setVisitNotes(visit.notes ?? "");
    setVisitModalOpen(true);
  };

  const handleSaveVisit = async () => {
    if (!licensePlate || !visitDate || !visitName.trim()) {
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
      scheduled_at: visitScheduledAt ? visitScheduledAt.toISOString() : undefined,
      duration_minutes: visitDuration ?? undefined,
      timezone: visitTimezone.trim() || undefined,
    };

    try {
      setSavingVisit(true);
      if (editingVisit?.id) {
        await api.updateVehicleVisit(licensePlate ?? "", editingVisit.id, payload);
      } else {
        await api.createVehicleVisit(licensePlate ?? "", payload);
      }
      notifications.show({
        title: "Exito",
        message: editingVisit ? "Visita actualizada correctamente" : "Visita creada correctamente",
        color: "green",
      });
      setVisitModalOpen(false);
      resetVisitForm();
      await refreshVisits(licensePlate ?? "");
      await refreshTimeline(licensePlate ?? "", timelineType);
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

  const handleSyncVisit = async (visit: VehicleVisit) => {
    if (!visit.id) return;
    if (!visit.scheduled_at) {
      notifications.show({
        title: "Agenda incompleta",
        message: "Define fecha y hora prevista para sincronizar",
        color: "red",
      });
      return;
    }
    try {
      setSyncingVisitId(visit.id);
      const updated = await api.syncVisitCalendar(visit.id);
      setVisits(visits.map((item) => (item.id === updated.id ? updated : item)));
      notifications.show({
        title: "Calendario",
        message:
          updated.calendar_status === "failed"
            ? updated.calendar_last_error || "Error al sincronizar"
            : "Evento sincronizado correctamente",
        color: updated.calendar_status === "failed" ? "red" : "green",
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al sincronizar calendario",
        color: "red",
      });
    } finally {
      setSyncingVisitId(null);
    }
  };

  const handleConfirmDeleteVisit = (visit: VehicleVisit) => {
    setVisitToDelete(visit);
    setConfirmVisitDeleteOpen(true);
  };

  const handleDeleteVisit = async () => {
    if (!licensePlate || !visitToDelete?.id) {
      return;
    }
    try {
      await api.deleteVehicleVisit(licensePlate ?? "", visitToDelete.id);
      notifications.show({
        title: "Exito",
        message: "Visita eliminada correctamente",
        color: "green",
      });
      await refreshVisits(licensePlate ?? "");
      await refreshTimeline(licensePlate ?? "", timelineType);
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

  const purchaseTotal = expenses.reduce((sum, expense) => {
    if (expense.category === "PURCHASE") {
      return sum + Number(expense.amount);
    }
    return sum;
  }, 0);
  const otherExpensesTotal = expenses.reduce((sum, expense) => {
    if (expense.category !== "PURCHASE") {
      return sum + Number(expense.amount);
    }
    return sum;
  }, 0);
  const totalExpenses = vehicle?.total_expenses ?? purchaseTotal + otherExpensesTotal;
  const salePriceValue = salePrice ?? vehicle?.sale_price ?? null;
  const profitValue =
    vehicle?.profit ?? (salePriceValue !== null ? salePriceValue - totalExpenses : null);
  const marginPctValue =
    vehicle?.margin_pct ??
    (salePriceValue && salePriceValue > 0 && profitValue !== null ? profitValue / salePriceValue : null);
  const profitColor = profitValue !== null && profitValue < 0 ? "red" : "green";

  return (
    <Stack gap="lg">
      <Title order={2}>Detalle del vehiculo</Title>

      <Group justify="space-between" mb="md">
        <Button
          leftSection={<IconArrowLeft size={20} />}
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/vehiculos"))}
          size="md"
          color="gray"
        >
          Volver
        </Button>
        <Button color="red" variant="outline" loading={deletingVehicle} onClick={handleDeleteVehicle}>
          Eliminar vehiculo
        </Button>
      </Group>


      <Tabs value={activeTab} onChange={handleTabChange} variant="outline">
        <Tabs.List>
          <Tabs.Tab value="resumen">Resumen</Tabs.Tab>
          <Tabs.Tab value="trabajo">Trabajo</Tabs.Tab>
          <Tabs.Tab value="publicacion">Publicacion</Tabs.Tab>
          <Tabs.Tab value="venta">Venta</Tabs.Tab>
          <Tabs.Tab value="timeline">Timeline</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="resumen" pt="md">
          <Stack gap="lg">
            <Card withBorder shadow="xs" radius="md">
              <Group justify="space-between" align="center">
                <Group gap="sm">
                  <Text fw={500}>Estado</Text>
                  <Badge color={statusColors[currentStatus] || "gray"} variant="light">
                    {statusLabels[currentStatus] || currentStatus}
                  </Badge>
                </Group>
                <Button
                  variant="light"
                  onClick={handleOpenStatusModal}
                  leftSection={<IconPencil size={18} />}
                  disabled={statusOptions.length === 0}
                >
                  Cambiar estado
                </Button>
              </Group>
            </Card>
            <Card withBorder shadow="xs" radius="md">
              <Title order={3} mb="md">
                Informacion general
              </Title>
              <Stack gap="sm">
                <Group grow>
                  <TextInput
                    label="Matricula"
                    value={vehicleLicensePlate}
                    readOnly
                  />
                  <TextInput
                    label="Bastidor (VIN)"
                    value={vehicleVin}
                    onChange={(e) => setVehicleVin(e.currentTarget.value)}
                  />
                </Group>
                <Group grow>
                  <TextInput
                    label="Marca"
                    value={vehicleBrand}
                    onChange={(e) => setVehicleBrand(e.currentTarget.value)}
                  />
                  <TextInput
                    label="Modelo"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.currentTarget.value)}
                  />
                  <TextInput
                    label="Version"
                    value={vehicleVersion}
                    onChange={(e) => setVehicleVersion(e.currentTarget.value)}
                  />
                </Group>
                <Group grow>
                  <NumberInput
                    label="Ano"
                    value={vehicleYear ?? undefined}
                    onChange={(value) => setVehicleYear(typeof value === "number" ? value : null)}
                    min={0}
                    decimalScale={0}
                    decimalSeparator=","
                    thousandSeparator="."
                  />
                  <TextInput
                    label="Color"
                    value={vehicleColor}
                    onChange={(e) => setVehicleColor(e.currentTarget.value)}
                  />
                  <NumberInput
                    label="Kilometros"
                    value={vehicleKm ?? undefined}
                    onChange={(value) => setVehicleKm(typeof value === "number" ? value : null)}
                    min={0}
                    decimalScale={0}
                    decimalSeparator=","
                    thousandSeparator="."
                  />
                </Group>
                <Group grow align="flex-start">
                  <TextInput label="Sucursal" value={branchName} readOnly />
                  <TextInput
                    label="Notas"
                    value={vehicleNotes}
                    onChange={(e) => setVehicleNotes(e.currentTarget.value)}
                  />
                </Group>
                <Group grow>
                  <TextInput label="Fecha de compra" value={formatDate(vehicle.purchase_date)} readOnly />
                  <TextInput label="Creado" value={formatDate(vehicle.created_at)} readOnly />
                  <TextInput label="Actualizado" value={formatDate(vehicle.updated_at)} readOnly />
                </Group>
                <Group justify="flex-end">
                  <Button variant="light" onClick={handleSaveVehicleDetails} loading={savingVehicleDetails}>
                    Guardar cambios
                  </Button>
                </Group>
              </Stack>
            </Card>

            <Card withBorder shadow="xs" radius="md">
              <Title order={3} mb="md">
                Sucursal
              </Title>
              <Stack gap="md">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Sucursal actual
                  </Text>
                  <Badge variant="light" color="blue">
                    {branchName}
                  </Badge>
                </Group>
                <Group grow align="flex-end">
                  <Select
                    label="Mover a"
                    placeholder="Selecciona sucursal"
                    data={branches.map((branch) => ({ value: String(branch.id), label: branch.name }))}
                    value={moveBranchId}
                    onChange={setMoveBranchId}
                    searchable
                  />
                  <TextInput
                    label="Nota"
                    placeholder="Traslado a exposicion"
                    value={moveBranchNote}
                    onChange={(e) => setMoveBranchNote(e.currentTarget.value)}
                  />
                </Group>
                <Group justify="flex-end">
                  <Button variant="light" onClick={handleMoveBranch} loading={movingBranch}>
                    Mover sucursal
                  </Button>
                </Group>
              </Stack>
            </Card>

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

          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="trabajo" pt="md">
          <Stack gap="lg">
            <Card withBorder shadow="xs" radius="md">
              <Title order={3} mb="md">
                Finanzas
              </Title>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Precio de compra
                  </Text>
                  <Text fw={500}>{formatCurrency(purchaseTotal)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Total gastos
                  </Text>
                  <Text fw={500}>{formatCurrency(totalExpenses)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Precio de venta
                  </Text>
                  <Text fw={500}>{salePriceValue !== null ? formatCurrency(salePriceValue) : "-"}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Beneficio
                  </Text>
                  <Text fw={500} c={profitColor}>
                    {profitValue !== null ? formatCurrency(profitValue) : "-"}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Margen %
                  </Text>
                  <Text fw={500} c={profitColor}>
                    {formatPercent(marginPctValue)}
                  </Text>
                </Group>
              </Stack>
            </Card>
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
                      <Table.Th>Notas</Table.Th>
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
                        <Table.Td>{expense.notes || "-"}</Table.Td>
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
                              href={api.downloadVehicleFileUrl(licensePlate ?? "", file.id || 0)}
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
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="publicacion" pt="md">
          <Stack gap="lg">
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
                            src={api.downloadVehicleFileUrl(licensePlate ?? "", photo.id || 0)}
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
                                href={api.downloadVehicleFileUrl(licensePlate ?? "", photo.id || 0)}
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

            <Card withBorder shadow="xs" radius="md">
              <Title order={3} mb="md">
                Enlaces
              </Title>

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
                      <Table.Th>Agenda</Table.Th>
                      <Table.Th>Estado</Table.Th>
                      <Table.Th>Observaciones</Table.Th>
                      <Table.Th w={140} style={{ textAlign: "center" }}>
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
                        <Table.Td>
                          {visit.scheduled_at ? formatDateTime(visit.scheduled_at) : "Sin agenda"}
                          {visit.duration_minutes ? ` (${visit.duration_minutes}m)` : ""}
                        </Table.Td>
                        <Table.Td>{visit.calendar_status || "-"}</Table.Td>
                        <Table.Td>
                          {visit.notes || "-"}
                          {visit.calendar_event_html_link && (
                            <Text
                              size="xs"
                              component="a"
                              href={visit.calendar_event_html_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--mantine-color-blue-6)" }}
                            >
                              Abrir evento
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td style={{ textAlign: "center" }}>
                          <Group gap={6} justify="center">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              onClick={() => handleEditVisit(visit)}
                              title="Editar visita"
                            >
                              <IconPencil size={18} />
                            </ActionIcon>
                            <ActionIcon
                              variant="light"
                              color="teal"
                              onClick={() => handleSyncVisit(visit)}
                              loading={syncingVisitId === visit.id}
                              title="Sincronizar con Google Calendar"
                              disabled={!visit.scheduled_at}
                            >
                              <IconCalendarEvent size={18} />
                            </ActionIcon>
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() => handleConfirmDeleteVisit(visit)}
                              title="Eliminar visita"
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
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="venta" pt="md">
          <Stack gap="lg">
            <Card withBorder shadow="xs" radius="md">
              <Title order={3} mb="md">
                Datos de venta
              </Title>
              <Stack gap="sm">
                <DateInput
                  label="Fecha de venta"
                  value={saleDate}
                  onChange={(value) => setSaleDate(value)}
                  required
                />
                <NumberInput
                  label="Precio de venta"
                  value={salePrice ?? undefined}
                  onChange={(value) => setSalePrice(typeof value === "number" ? value : null)}
                  min={0}
                  decimalScale={2}
                  decimalSeparator=","
                  thousandSeparator="."
                  required
                />
                <TextInput
                  label="Notas de venta"
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.currentTarget.value)}
                />
                <Group justify="flex-end">
                  <Button onClick={handleSaveSale} loading={savingSale}>
                    {currentStatus === "sold" ? "Actualizar venta" : "Cerrar venta"}
                  </Button>
                </Group>
              </Stack>
            </Card>

            <Card withBorder shadow="xs" radius="md">
              <Title order={3} mb="md">
                Documentos de venta
              </Title>
              <Stack gap="sm" mb="lg">
                <TextInput
                  label="Notas"
                  placeholder="Notas opcionales"
                  value={saleDocumentNotes}
                  onChange={(e) => setSaleDocumentNotes(e.currentTarget.value)}
                />
                <input
                  type="file"
                  onChange={(e) =>
                    setSelectedSaleDocument(e.currentTarget.files ? e.currentTarget.files[0] : null)
                  }
                />
                <Button onClick={handleUploadSaleDocument} loading={uploadingSaleDocument} w="fit-content">
                  Subir documento
                </Button>
              </Stack>

              {saleDocuments.length === 0 ? (
                <Text c="dimmed" size="sm">
                  Sin documentos de venta
                </Text>
              ) : (
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Nombre</Table.Th>
                      <Table.Th>Tamano</Table.Th>
                      <Table.Th>Fecha</Table.Th>
                      <Table.Th>Notas</Table.Th>
                      <Table.Th w={120} style={{ textAlign: "center" }}>
                        Acciones
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {saleDocuments.map((doc) => (
                      <Table.Tr key={doc.id}>
                        <Table.Td>{doc.original_name}</Table.Td>
                        <Table.Td>{formatFileSize(doc.size_bytes)}</Table.Td>
                        <Table.Td>{formatDate(doc.created_at)}</Table.Td>
                        <Table.Td>{doc.notes || "-"}</Table.Td>
                        <Table.Td style={{ textAlign: "center" }}>
                          <Group gap={0} justify="center">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              component="a"
                              href={api.downloadVehicleSaleDocumentUrl(licensePlate ?? "", doc.id || 0)}
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
                                setSaleDocumentToDelete(doc);
                                setConfirmSaleDocumentDeleteOpen(true);
                              }}
                              title="Eliminar documento"
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
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="timeline" pt="md">
          <Stack gap="lg">
            <Card withBorder shadow="xs" radius="md">
              <Group justify="space-between" mb="md">
                <Title order={3}>Historial de estado</Title>
              </Group>

              {statusEvents.length === 0 ? (
                <Text c="dimmed" size="sm">
                  Sin cambios de estado registrados
                </Text>
              ) : (
                <Stack gap="xs">
                  {statusEvents.map((event) => (
                    <Card key={event.id} withBorder shadow="xs" radius="sm">
                      <Group justify="space-between">
                        <Stack gap={2}>
                          <Text fw={500}>
                            {statusLabels[event.from_status]} → {statusLabels[event.to_status]}
                          </Text>
                          {event.note && (
                            <Text size="xs" c="dimmed">
                              {event.note}
                            </Text>
                          )}
                        </Stack>
                        <Text size="sm" c="dimmed">
                          {formatDateTime(event.changed_at)}
                        </Text>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              )}
            </Card>
            <Card withBorder shadow="xs" radius="md">
              <Group justify="space-between" mb="md">
                <Title order={3}>Timeline</Title>
                <Select
                  placeholder="Todos"
                  data={timelineTypeOptions}
                  value={timelineType}
                  onChange={handleTimelineFilter}
                  clearable
                />
              </Group>

              {timeline.length === 0 ? (
                <Text c="dimmed" size="sm">
                  Sin eventos registrados
                </Text>
              ) : (
                <Stack gap="xs">
                  {timeline.map((event) => (
                    <Card key={event.id} withBorder shadow="xs" radius="sm">
                      <Group justify="space-between">
                        <Stack gap={2}>
                          <Text fw={500}>{event.summary}</Text>
                          <Text size="xs" c="dimmed">
                            {event.type}
                          </Text>
                        </Stack>
                        <Text size="sm" c="dimmed">
                          {formatDate(event.created_at)}
                        </Text>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              )}
            </Card>
          </Stack>
        </Tabs.Panel>
      </Tabs>


      <Modal
        opened={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Cambiar estado"
        centered
      >
        <Stack gap="sm">
          <Select
            label="Estado"
            data={statusOptions.map((value) => ({
              value,
              label: statusLabels[value],
            }))}
            value={statusValue}
            onChange={(value) => {
              const nextValue = value ? (value as VehicleStatus) : null;
              setStatusValue(nextValue);
              if (nextValue !== "reserved") {
                setStatusReservedUntil(null);
              }
              if (nextValue !== "sold") {
                setStatusSoldAt(null);
              }
            }}
            placeholder={statusOptions.length === 0 ? "Sin transiciones disponibles" : undefined}
            disabled={statusOptions.length === 0}
          />
          <TextInput
            label="Nota"
            value={statusNote}
            onChange={(e) => setStatusNote(e.currentTarget.value)}
          />
          {statusValue === "reserved" && (
            <DateInput
              label="Reserva hasta"
              value={statusReservedUntil}
              onChange={(value) => setStatusReservedUntil(value)}
              clearable
            />
          )}
          {statusValue === "sold" && (
            <DateInput
              label="Fecha de venta"
              value={statusSoldAt}
              onChange={(value) => setStatusSoldAt(value)}
              required
            />
          )}
          <Group justify="flex-end" mt="sm">
            <Button variant="light" onClick={() => setStatusModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveStatus} loading={savingStatus}>
              Guardar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={visitModalOpen}
        onClose={() => {
          setVisitModalOpen(false);
          resetVisitForm();
        }}
        title={editingVisit ? "Editar visita" : "Nueva visita"}
        centered
      >
        <Stack gap="sm">
          <DateInput
            label="Fecha"
            value={visitDate}
            onChange={(value) => setVisitDate(value)}
            required
          />
          <DateTimePicker
            label="Fecha/hora prevista"
            value={visitScheduledAt}
            onChange={setVisitScheduledAt}
            clearable
          />
          <Group grow>
            <NumberInput
              label="Duracion (min)"
              value={visitDuration ?? undefined}
              onChange={(value) => setVisitDuration(typeof value === "number" ? value : null)}
              min={5}
            />
            <TextInput
              label="Zona horaria"
              value={visitTimezone}
              onChange={(e) => setVisitTimezone(e.currentTarget.value)}
            />
          </Group>
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
              {editingVisit ? "Actualizar" : "Guardar"}
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
            decimalSeparator=","
            thousandSeparator="."
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

      <Modal
        opened={confirmSaleDocumentDeleteOpen}
        onClose={() => setConfirmSaleDocumentDeleteOpen(false)}
        title="Confirmar eliminacion"
        centered
      >
        <Stack gap="md">
          <Text>Estas seguro de que deseas eliminar este documento de venta?</Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setConfirmSaleDocumentDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button color="red" onClick={handleDeleteSaleDocument}>
              Eliminar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
