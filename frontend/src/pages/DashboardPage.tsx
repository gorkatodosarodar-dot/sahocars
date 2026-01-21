import { useEffect, useState } from "react";
import { api, BackupListItem, Branch, DashboardSummary } from "../lib/api";
import { Alert, Anchor, Button, Card, Checkbox, Group, Loader, Modal, MultiSelect, Select, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { formatCurrency } from "../lib/api";
import { notifications } from "@mantine/notifications";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filters, setFilters] = useState<{ from?: string; to?: string; branchId?: number }>({});
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<BackupListItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [wipingSystem, setWipingSystem] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [dryRunRestore, setDryRunRestore] = useState(false);
  const [wipeBeforeRestore, setWipeBeforeRestore] = useState(false);
  const [vehicles, setVehicles] = useState<{ value: string; label: string }[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [exportingVehicles, setExportingVehicles] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"skip" | "overwrite" | "new_copy">("new_copy");
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [restoreResult, setRestoreResult] = useState<{
    ok: boolean;
    message: string;
    requiresRestart: boolean;
    backupId: string;
    safetyBackupId?: string | null;
  } | null>(null);
  const [manifestModalOpen, setManifestModalOpen] = useState(false);

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
    api
      .getDashboard(filters)
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [filters]);

  const loadBackups = async () => {
    try {
      setLoadingBackups(true);
      const data = await api.listBackups();
      setBackups(data);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al cargar backups",
        color: "red",
      });
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setCreatingBackup(true);
      const backup = await api.createBackup(true);
      notifications.show({
        title: "Backup creado",
        message: `Backup ${backup.id} creado`,
        color: "green",
      });
      await loadBackups();
      setSelectedBackupId(backup.id);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al crear backup",
        color: "red",
      });
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackupId) {
      notifications.show({
        title: "Selecciona un backup",
        message: "Elige un backup para restaurar",
        color: "red",
      });
      return;
    }
    const proceed = window.confirm("Se va a restaurar el backup seleccionado. Continuar?");
    if (!proceed) return;

    let wipeConfirmed = false;
    let shouldWipe = false;
    if (wipeBeforeRestore) {
      const first = window.confirm("Se va a vaciar el sistema antes de restaurar. Continuar?");
      if (first) {
        const second = window.confirm("Estas seguro? Esta accion elimina todos los datos actuales.");
        if (second) {
          wipeConfirmed = true;
          shouldWipe = true;
        }
      }
    }

    try {
      setRestoringBackup(true);
      const result = await api.restoreBackup(selectedBackupId, {
        dryRun: dryRunRestore,
        wipeBeforeRestore: shouldWipe,
        confirmWipe: wipeConfirmed,
      });
      setRestoreResult({
        ok: result.ok,
        message: result.message,
        requiresRestart: result.requires_restart,
        backupId: selectedBackupId,
        safetyBackupId: result.safety_backup_id ?? null,
      });
      notifications.show({
        title: "Restore",
        message: result.message,
        color: result.ok ? "green" : "red",
      });
      await loadBackups();
    } catch (error) {
      setRestoreResult({
        ok: false,
        message: error instanceof Error ? error.message : "Error al restaurar backup",
        requiresRestart: false,
        backupId: selectedBackupId,
      });
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al restaurar backup",
        color: "red",
      });
    } finally {
      setRestoringBackup(false);
    }
  };

  const handleWipeSystem = async () => {
    const first = window.confirm("Se va a vaciar el sistema completo. Continuar?");
    if (!first) return;
    const second = window.confirm("Estas seguro? Esta accion elimina datos y archivos.");
    if (!second) return;
    try {
      setWipingSystem(true);
      const result = await api.wipeSystem(true);
      notifications.show({
        title: "Sistema vaciado",
        message: result.message,
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al vaciar sistema",
        color: "red",
      });
    } finally {
      setWipingSystem(false);
    }
  };

  const selectedBackup = selectedBackupId
    ? backups.find((item) => item.id === selectedBackupId)
    : null;

  const handleExportVehicles = async () => {
    if (!selectedVehicles.length) {
      notifications.show({
        title: "Selecciona vehiculos",
        message: "Elige al menos un vehiculo para exportar",
        color: "red",
      });
      return;
    }
    try {
      setExportingVehicles(true);
      const blob = await api.exportVehiclesPackage(selectedVehicles, includeFiles);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vehiculos_export_${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al exportar vehiculos",
        color: "red",
      });
    } finally {
      setExportingVehicles(false);
    }
  };

  const handleImportVehicles = async () => {
    if (!importFile) {
      notifications.show({
        title: "Archivo requerido",
        message: "Selecciona un archivo zip para importar",
        color: "red",
      });
      return;
    }
    try {
      const result = await api.importVehiclesPackage({ file: importFile, mode: importMode });
      setImportResult({
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
      });
      notifications.show({
        title: "Import completado",
        message: "Revisa el resultado en pantalla",
        color: "green",
      });
    } catch (error) {
      setImportResult(null);
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Error al importar vehiculos",
        color: "red",
      });
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Dashboard</Title>
          <Text c="dimmed">Gastos, ingresos y margen por fechas y sucursal</Text>
        </div>
      </Group>

      <Card withBorder radius="md" shadow="sm">
        <Group align="flex-end" gap="md">
          <DateInput
            label="Desde"
            placeholder="Fecha inicio"
            value={filters.from ? new Date(filters.from) : null}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, from: value ? value.toISOString().split("T")[0] : undefined }))
            }
          />
          <DateInput
            label="Hasta"
            placeholder="Fecha fin"
            value={filters.to ? new Date(filters.to) : null}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, to: value ? value.toISOString().split("T")[0] : undefined }))
            }
          />
          <Select
            label="Sucursal"
            placeholder="Todas"
            clearable
            data={branches.map((b) => ({ label: b.name, value: String(b.id) }))}
            value={filters.branchId ? String(filters.branchId) : null}
            onChange={(value) => setFilters((prev) => ({ ...prev, branchId: value ? Number(value) : undefined }))}
          />
          <Button variant="light" onClick={() => setFilters({})}>
            Limpiar filtros
          </Button>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        <StatCard label="Vehículos" value={summary?.vehicles ?? 0} color="#2b2b2b" loading={loading} />
        <StatCard label="Ingresos" value={formatCurrency(summary?.income)} color="#45c2c4" loading={loading} />
        <StatCard label="Gastos" value={formatCurrency(summary?.expenses)} color="#f3b63a" loading={loading} />
        <StatCard label="Margen" value={formatCurrency(summary?.margin)} color="#111" loading={loading} />
      </SimpleGrid>

      <Group>
        <ExportButton resource="vehicles" label="Exportar vehículos" />
        <ExportButton resource="expenses" label="Exportar gastos" />
        <ExportButton resource="sales" label="Exportar ventas" />
      </Group>

      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Title order={4}>Backup y restauracion</Title>
          <Alert color="blue" variant="light">
            <Stack gap={4}>
              <Text fw={600}>🔒 Restauración segura</Text>
              <Text size="sm">
                Las restauraciones en Sahocars son atómicas.
              </Text>
              <Text size="sm">
                Si una restauración falla, el estado actual no se modifica.
              </Text>
              <Text size="sm">
                Tras una restauración correcta, será necesario reiniciar la aplicación.
              </Text>
            </Stack>
          </Alert>
          <Text size="sm" c="dimmed">
            Backup completo (BD + archivos) y restauracion del sistema
          </Text>
          <Group>
            <Button variant="light" onClick={loadBackups} loading={loadingBackups}>
              Cargar backups
            </Button>
            <Button onClick={handleCreateBackup} loading={creatingBackup}>
              Crear backup
            </Button>
          </Group>
          <Select
            label="Backup disponible"
            placeholder="Selecciona un backup"
            data={backups.map((item) => ({
              value: item.id,
              label: `${item.id} - ${new Date(item.created_at).toLocaleString("es-ES")}`,
            }))}
            value={selectedBackupId}
            onChange={setSelectedBackupId}
            searchable
          />
          <Group>
            <Checkbox
              label="Comprobacion integridad backup"
              checked={dryRunRestore}
              onChange={(event) => setDryRunRestore(event.currentTarget.checked)}
            />
            <Checkbox
              label="Vaciar antes de restaurar"
              checked={wipeBeforeRestore}
              onChange={(event) => setWipeBeforeRestore(event.currentTarget.checked)}
            />
          </Group>
          <Group>
            <Button color="orange" onClick={handleRestoreBackup} loading={restoringBackup}>
              Restaurar backup
            </Button>
            <Button color="red" variant="outline" onClick={handleWipeSystem} loading={wipingSystem}>
              Vaciar sistema
            </Button>
          </Group>
          {restoreResult && (
            <Card withBorder radius="md" padding="md">
              <Stack gap={6}>
                <Text fw={600} c={restoreResult.ok ? "green" : "red"}>
                  {restoreResult.ok ? "Restore completado" : "Restore con error"}
                </Text>
                <Text size="sm">{restoreResult.message}</Text>
                <Text size="sm">Backup usado: {restoreResult.backupId}</Text>
                {restoreResult.ok ? (
                  <Text size="sm" c={restoreResult.requiresRestart ? "orange" : "dimmed"}>
                    {restoreResult.requiresRestart
                      ? "Reinicio requerido para aplicar la restauración."
                      : "No se requiere reinicio."}
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    El estado actual no se ha modificado.
                  </Text>
                )}
                {restoreResult.safetyBackupId ? (
                  <Text size="sm" c="dimmed">
                    Backup de seguridad: {restoreResult.safetyBackupId}
                  </Text>
                ) : null}
                {restoreResult.ok && (
                  <Group>
                    <Button
                      variant="light"
                      onClick={() => setManifestModalOpen(true)}
                      disabled={!selectedBackup?.manifest}
                    >
                      Ver manifest
                    </Button>
                  </Group>
                )}
              </Stack>
            </Card>
          )}
        </Stack>
      </Card>

      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Title order={4}>Export / Import vehiculos</Title>
          <MultiSelect
            label="Vehiculos a exportar"
            data={vehicles}
            value={selectedVehicles}
            onChange={setSelectedVehicles}
            searchable
            placeholder="Selecciona uno o varios"
          />
          <Checkbox
            label="Incluir archivos"
            checked={includeFiles}
            onChange={(event) => setIncludeFiles(event.currentTarget.checked)}
          />
          <Group>
            <Button onClick={handleExportVehicles} loading={exportingVehicles}>
              Exportar vehiculos
            </Button>
          </Group>
          <Select
            label="Modo de importacion"
            value={importMode}
            onChange={(value) => setImportMode((value as "skip" | "overwrite" | "new_copy") || "new_copy")}
            data={[
              { value: "skip", label: "skip" },
              { value: "overwrite", label: "overwrite" },
              { value: "new_copy", label: "new_copy" },
            ]}
          />
          <input
            type="file"
            accept=".zip"
            onChange={(event) => setImportFile(event.currentTarget.files?.[0] ?? null)}
          />
          <Group>
            <Button variant="outline" onClick={handleImportVehicles}>
              Importar vehiculos
            </Button>
          </Group>
          {importResult && (
            <Stack gap={4}>
              <Text size="sm" c="dimmed">
                Importados: {importResult.imported} | Omitidos: {importResult.skipped} | Errores:{" "}
                {importResult.errors.length}
              </Text>
              {importResult.errors.length ? (
                <Text size="sm" c="red">
                  {importResult.errors.join(" | ")}
                </Text>
              ) : null}
            </Stack>
          )}
        </Stack>
      </Card>
      <BackupManifestModal
        opened={manifestModalOpen}
        onClose={() => setManifestModalOpen(false)}
        manifest={(selectedBackup?.manifest as Record<string, unknown>) ?? null}
      />
    </Stack>
  );
}

function BackupManifestModal({
  opened,
  onClose,
  manifest,
}: {
  opened: boolean;
  onClose: () => void;
  manifest: Record<string, unknown> | null;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Manifest del backup" centered size="lg">
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
        {manifest ? JSON.stringify(manifest, null, 2) : "No hay manifest disponible"}
      </pre>
    </Modal>
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
