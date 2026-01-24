const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type Branch = { id: number; name: string };

export type Vehicle = {
  vin?: string | null;
  license_plate: string;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  year?: number | null;
  km?: number | null;
  color?: string | null;
  location_id?: number | null;
  branch_id?: number | null;
  status?: VehicleStatus | null;
  status_changed_at?: string | null;
  status_reason?: string | null;
  reserved_until?: string | null;
  sold_at?: string | null;
  sale_notes?: string | null;
  total_expenses?: number | null;
  profit?: number | null;
  margin_pct?: number | null;
  state?: VehicleStatus | null;
  sale_price?: number | null;
  purchase_date?: string | null;
  sale_date?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type VehicleLink = {
  id?: number;
  vehicle_id: string;
  title?: string | null;
  url: string;
  created_at?: string | null;
};

export type VehicleFileCategory = "document" | "expense" | "photo";

export type VehicleFile = {
  id?: number;
  vehicle_id: string;
  category: VehicleFileCategory;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type VehicleVisit = {
  id?: number;
  vehicle_id: string;
  visit_date: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  calendar_event_id?: string | null;
  calendar_event_html_link?: string | null;
  calendar_status?: string | null;
  calendar_last_error?: string | null;
  calendar_last_synced_at?: string | null;
  timezone?: string | null;
  created_at?: string | null;
};

export type VehicleVisitCreateInput = {
  visit_date: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  timezone?: string | null;
};

export type VehicleVisitUpdateInput = Partial<VehicleVisitCreateInput>;

export type VehicleStatus =
  | "intake"
  | "prep"
  | "ready"
  | "published"
  | "reserved"
  | "sold"
  | "discarded";

export type ChangeStatusInput = {
  to_status: VehicleStatus;
  note?: string | null;
  reserved_until?: string | null;
  sold_at?: string | null;
};

export type SaleCloseInput = {
  sale_price: number;
  sold_at: string;
  sale_notes?: string | null;
};

export type VehicleKpis = {
  vehicle_id: string;
  total_expenses: number;
  total_cost?: number | null;
  sale_price?: number | null;
  gross_margin?: number | null;
  roi?: number | null;
  days_in_stock?: number | null;
};

export type VehicleExpenseCategory =
  | "PURCHASE"
  | "MECHANICAL"
  | "TIRES"
  | "TRANSPORT"
  | "ADMIN"
  | "CLEANING"
  | "OTHER";

export type VehicleExpense = {
  id?: number;
  vehicle_id: string;
  amount: number;
  currency: string;
  date: string;
  category: VehicleExpenseCategory;
  vendor?: string | null;
  invoice_ref?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  linked_vehicle_file_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ExpenseCreateInput = {
  amount: number;
  currency?: string;
  date: string;
  category: VehicleExpenseCategory;
  vendor?: string | null;
  invoice_ref?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  linked_vehicle_file_id?: number | null;
};

export type ExpenseUpdateInput = Partial<ExpenseCreateInput>;

export type VehicleEventType =
  | "STATUS_CHANGE"
  | "EXPENSE_CREATED"
  | "EXPENSE_UPDATED"
  | "EXPENSE_DELETED"
  | "VISIT_CREATED"
  | "VISIT_DELETED"
  | "FILE_UPLOADED"
  | "FILE_DELETED"
  | "NOTE_CREATED"
  | "NOTE_DELETED"
  | "VEHICLE_UPDATED"
  | "BRANCH_MOVED";

export type VehicleEvent = {
  id: number;
  type: VehicleEventType;
  created_at: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type VehicleStatusEvent = {
  id: number;
  vehicle_id: string;
  from_status: VehicleStatus;
  to_status: VehicleStatus;
  changed_at: string;
  note?: string | null;
  actor?: string | null;
};

export type Expense = {
  id?: number;
  vehicle_id: string;
  concept: string;
  amount: number;
  expense_date: string;
  notes?: string | null;
};

export type Sale = {
  id?: number;
  vehicle_id: string;
  sale_price: number;
  sale_date: string;
  notes?: string | null;
  client_name?: string | null;
  client_tax_id?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  client_address?: string | null;
};

export type SaleCreateInput = {
  sale_price: number;
  sale_date: string;
  notes?: string | null;
  client_name?: string | null;
  client_tax_id?: string | null;
  client_phone?: string | null;
  client_email?: string | null;
  client_address?: string | null;
};

export type SaleDocument = {
  id?: number;
  vehicle_id: string;
  sale_id?: number | null;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  notes?: string | null;
  created_at?: string | null;
};

export type DashboardSummary = {
  vehicles: number;
  income: number;
  expenses: number;
  margin: number;
};

export type GoogleCalendarStatus = {
  connected: boolean;
  expired?: boolean;
  scopes?: string[];
  updated_at?: string | null;
};

export type AppVersionInfo = {
  app_version: string;
  branch?: string | null;
  commit?: string | null;
  env?: string | null;
  schema_version?: string | null;
};

export type ReportFilters = {
  from?: string;
  to?: string;
  branch_id?: number;
  status?: VehicleStatus;
  vehicle_id?: string;
};

export type ReportKpis = {
  filters: {
    from?: string | null;
    to?: string | null;
    branch_id?: number | null;
    status?: VehicleStatus | null;
    vehicle_id?: string | null;
  };
  vehicles_total: number;
  vehicles_sold: number;
  vehicles_published: number;
  vehicles_in_stock: number;
  total_income: number;
  total_purchase: number;
  total_expenses: number;
  total_profit: number;
  avg_profit_per_sold: number | null;
  avg_margin_pct: number | null;
  avg_days_to_sell: number | null;
  avg_days_in_stock: number | null;
};

export type ReportVehicleRow = {
  vehicle_id: string;
  title: string;
  branch_id?: number | null;
  branch?: string | null;
  status: VehicleStatus | string;
  purchase_price: number;
  total_expenses: number;
  sale_price?: number | null;
  sold_at?: string | null;
  profit?: number | null;
  margin_pct?: number | null;
  days_in_stock?: number | null;
};

export type ReportByBranchItem = {
  branch_id: number;
  branch_name: string;
  sold: number;
  income: number;
  profit: number;
  vehicles_in_stock: number;
  avg_days_in_stock?: number | null;
};

export type BackupInfo = {
  id: string;
  filename: string;
  created_at: string;
  size_bytes: number;
  sha256: string;
  manifest?: Record<string, unknown>;
  files_included?: boolean;
  files_filename?: string | null;
  files_size_bytes?: number | null;
  files_sha256?: string | null;
  warnings?: string[];
};

export type BackupListItem = BackupInfo & {
  incomplete?: boolean;
};

export type BackupRestoreResult = {
  ok: boolean;
  dry_run: boolean;
  restored: boolean;
  requires_restart: boolean;
  message: string;
  safety_backup_id?: string | null;
  warnings?: string[];
};

export type WipeResult = {
  ok: boolean;
  message: string;
};

export type VehicleTransferResult = {
  ok: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  id_map: Record<string, Record<string, string>>;
};

async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    
    const detail = await response.text();
    
    if (!response.ok) {
      console.error(`API Error [${response.status}]:`, detail);
      throw new Error(detail || `Error ${response.status}: ${response.statusText}`);
    }
    
    return JSON.parse(detail) as Promise<T>;
  } catch (error) {
    if (error instanceof Error) {
      console.error("Fetch error:", error.message);
      throw error;
    }
    console.error("Unknown error:", error);
    throw new Error("Error desconocido en la petición");
  }
}

async function fetchText(path: string, options: RequestInit = {}): Promise<string> {
  const response = await fetch(`${API_URL}${path}`, options);
  const detail = await response.text();
  if (!response.ok) {
    throw buildError(response.status, response.statusText, detail);
  }
  return detail;
}

function mapVehicle(vehicle: any): Vehicle {
  const status = (vehicle.status ?? vehicle.state ?? "intake") as VehicleStatus;
  return {
    ...vehicle,
    branch_id: vehicle.branch_id ?? vehicle.location_id ?? null,
    location_id: vehicle.branch_id ?? vehicle.location_id,
    status,
    state: status,
  };
}

function encodePlate(licensePlate: string) {
  return encodeURIComponent(licensePlate);
}

function buildReportQuery(filters: ReportFilters) {
  const search = new URLSearchParams();
  if (filters.from) search.append("from", filters.from);
  if (filters.to) search.append("to", filters.to);
  if (filters.branch_id) search.append("branch_id", String(filters.branch_id));
  if (filters.status) search.append("status", filters.status);
  if (filters.vehicle_id) search.append("vehicle_id", filters.vehicle_id);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function buildError(status: number, statusText: string, detail: string) {
  return new Error(detail || `Error ${status}: ${statusText}`);
}

async function fetchOptionalLinks(path: string): Promise<VehicleLink[]> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  const detail = await response.text();
  if (response.status === 404 && detail.includes("Not Found")) {
    return [];
  }
  if (!response.ok) {
    throw buildError(response.status, response.statusText, detail);
  }
  return JSON.parse(detail) as VehicleLink[];
}

export const api = {
  getBranches: () => fetchJson<Branch[]>("/branches"),
  getVehicle: (licensePlate: string) => fetchJson<Vehicle>(`/vehicles/${encodePlate(licensePlate)}`).then(mapVehicle),
  getDashboard: (params: { from?: string; to?: string; branchId?: number }) => {
    const search = new URLSearchParams();
    if (params.from) search.append("from_date", params.from);
    if (params.to) search.append("to_date", params.to);
    if (params.branchId) search.append("branch_id", String(params.branchId));
    const qs = search.toString();
    return fetchJson<DashboardSummary>(`/dashboard${qs ? `?${qs}` : ""}`);
  },
  getReportKpis: (filters: ReportFilters) =>
    fetchJson<ReportKpis>(`/reports/kpis${buildReportQuery(filters)}`),
  getReportVehicles: (filters: ReportFilters) =>
    fetchJson<ReportVehicleRow[]>(`/reports/vehicles${buildReportQuery(filters)}`),
  getReportByBranch: (filters: ReportFilters) =>
    fetchJson<ReportByBranchItem[]>(`/reports/by-branch${buildReportQuery(filters)}`),
  listVehicles: (params: { status?: VehicleStatus; branchId?: number; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params.status) search.append("state", params.status);
    if (params.branchId) search.append("branch_id", String(params.branchId));
    if (params.from) search.append("from_date", params.from);
    if (params.to) search.append("to_date", params.to);
    const qs = search.toString();
    return fetchJson<any[]>(`/vehicles${qs ? `?${qs}` : ""}`).then((res) => res.map(mapVehicle));
  },
  createVehicle: (payload: Vehicle) => {
    // Mapear nombres de campos frontend a backend
    const today = new Date().toISOString().split("T")[0];
    const mapped = {
      vin: payload.vin?.trim() || `VIN-${Date.now()}`,
      license_plate: payload.license_plate?.trim().toUpperCase() || "",
      brand: payload.brand?.trim() || "",
      model: payload.model?.trim() || "",
      year: payload.year || new Date().getFullYear(),
      km: payload.km || 0,
      version: payload.version?.trim() || null,
      color: payload.color?.trim() || null,
      branch_id: payload.branch_id ?? payload.location_id,
      status: payload.status || payload.state || "intake",
      purchase_date: payload.purchase_date || today,
      sale_price: payload.sale_price || null,
      sale_date: payload.sale_date || null,
      notes: payload.notes?.trim() || null,
    };
    
    console.log("Sending to backend:", mapped);
    
    return fetchJson<any>("/vehicles", {
      method: "POST",
      body: JSON.stringify(mapped),
    }).then(mapVehicle);
  },
  updateVehicle: (licensePlate: string, payload: Partial<Vehicle>) => {
    const mapped = {
      vin: payload.vin,
      brand: payload.brand,
      model: payload.model,
      year: payload.year,
      km: payload.km,
      version: payload.version,
      color: payload.color,
      branch_id: payload.location_id,
      purchase_date: payload.purchase_date,
      sale_price: payload.sale_price,
      sale_date: payload.sale_date,
      notes: payload.notes,
    };
    return fetchJson<Vehicle>(`/vehicles/${encodePlate(licensePlate)}`, {
      method: "PATCH",
      body: JSON.stringify(mapped),
    }).then(mapVehicle);
  },
  deleteVehicle: async (licensePlate: string) => {
    const response = await fetch(`${API_URL}/vehicles/${encodePlate(licensePlate)}`, {
      method: "DELETE",
    });
    const detail = await response.text();
    if (!response.ok) {
      throw buildError(response.status, response.statusText, detail);
    }
  },
  listVehicleLinks: (licensePlate: string) => fetchOptionalLinks(`/vehicles/${encodePlate(licensePlate)}/links`),
  createVehicleLink: async (licensePlate: string, payload: { title?: string; url: string }) => {
    const response = await fetch(`${API_URL}/vehicles/${encodePlate(licensePlate)}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const detail = await response.text();
    if (response.status === 404 && detail.includes("Not Found")) {
      throw new Error("El backend no tiene el endpoint de enlaces para vehiculos.");
    }
    if (!response.ok) {
      throw buildError(response.status, response.statusText, detail);
    }
    return JSON.parse(detail) as VehicleLink;
  },
  deleteVehicleLink: async (licensePlate: string, linkId: number) => {
    const response = await fetch(`${API_URL}/vehicles/${encodePlate(licensePlate)}/links/${linkId}`, {
      method: "DELETE",
    });
    const detail = await response.text();
    if (response.status === 404 && detail.includes("Not Found")) {
      throw new Error("El backend no tiene el endpoint de enlaces para vehiculos.");
    }
    if (!response.ok) {
      throw buildError(response.status, response.statusText, detail);
    }
  },
  listVehicleVisits: (licensePlate: string) =>
    fetchJson<VehicleVisit[]>(`/vehicles/${encodePlate(licensePlate)}/visits`),
  createVehicleVisit: (licensePlate: string, payload: VehicleVisitCreateInput) =>
    fetchJson<VehicleVisit>(`/vehicles/${encodePlate(licensePlate)}/visits`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateVehicleVisit: (licensePlate: string, visitId: number, payload: VehicleVisitUpdateInput) =>
    fetchJson<VehicleVisit>(`/vehicles/${encodePlate(licensePlate)}/visits/${visitId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteVehicleVisit: async (licensePlate: string, visitId: number) => {
    const response = await fetch(`${API_URL}/vehicles/${encodePlate(licensePlate)}/visits/${visitId}`, {
      method: "DELETE",
    });
    const detail = await response.text();
    if (!response.ok) {
      throw buildError(response.status, response.statusText, detail);
    }
  },
  syncVisitCalendar: (visitId: number) =>
    fetchJson<VehicleVisit>(`/visits/${visitId}/calendar/sync`, {
      method: "POST",
    }),
  getGoogleCalendarStatus: () => fetchJson<GoogleCalendarStatus>("/auth/google/status"),
  getGoogleAuthStartUrl: () => `${API_URL}/auth/google/start`,
  getAppVersionInfo: () => fetchJson<AppVersionInfo>("/version"),
  listVehicleExpenses: (licensePlate: string) =>
    fetchJson<VehicleExpense[]>(`/vehicles/${encodePlate(licensePlate)}/expenses`),
  createVehicleExpense: (licensePlate: string, payload: ExpenseCreateInput) =>
    fetchJson<VehicleExpense>(`/vehicles/${encodePlate(licensePlate)}/expenses`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateVehicleExpense: (licensePlate: string, expenseId: number, payload: ExpenseUpdateInput) =>
    fetchJson<VehicleExpense>(`/vehicles/${encodePlate(licensePlate)}/expenses/${expenseId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteVehicleExpense: async (licensePlate: string, expenseId: number) => {
    const response = await fetch(`${API_URL}/vehicles/${encodePlate(licensePlate)}/expenses/${expenseId}`, {
      method: "DELETE",
    });
    const detail = await response.text();
    if (!response.ok) {
      throw buildError(response.status, response.statusText, detail);
    }
  },
  getVehicleKpis: (licensePlate: string) =>
    fetchJson<VehicleKpis>(`/vehicles/${encodePlate(licensePlate)}/kpis`),
  changeVehicleStatus: (licensePlate: string, payload: ChangeStatusInput) =>
    fetchJson<Vehicle>(`/vehicles/${encodePlate(licensePlate)}/status`, {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(mapVehicle),
  listVehicleStatusEvents: (licensePlate: string, params?: { limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.limit) search.append("limit", String(params.limit));
    const qs = search.toString();
    return fetchJson<VehicleStatusEvent[]>(
      `/vehicles/${encodePlate(licensePlate)}/status/events${qs ? `?${qs}` : ""}`
    );
  },
  moveVehicleBranch: (licensePlate: string, payload: { to_branch_id: number; note?: string }) =>
    fetchJson<Vehicle>(`/vehicles/${encodePlate(licensePlate)}/move-branch`, {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(mapVehicle),
  closeVehicleSale: (licensePlate: string, payload: SaleCloseInput) =>
    fetchJson<Vehicle>(`/vehicles/${encodePlate(licensePlate)}/sale`, {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(mapVehicle),
  getVehicleSale: (licensePlate: string) =>
    fetchJson<Sale>(`/vehicles/${encodePlate(licensePlate)}/sale`),
  updateVehicleSale: (licensePlate: string, payload: Partial<SaleCreateInput>) =>
    fetchJson<Sale>(`/vehicles/${encodePlate(licensePlate)}/sale`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getVehicleTimeline: (licensePlate: string, params?: { limit?: number; types?: VehicleEventType[] }) => {
    const search = new URLSearchParams();
    if (params?.limit) search.append("limit", String(params.limit));
    params?.types?.forEach((type) => search.append("type", type));
    const qs = search.toString();
    return fetchJson<VehicleEvent[]>(`/vehicles/${encodePlate(licensePlate)}/timeline${qs ? `?${qs}` : ""}`);
  },
  listVehicleFiles: (licensePlate: string, category?: VehicleFileCategory) => {
    const qs = category ? `?category=${encodeURIComponent(category)}` : "";
    return fetchJson<VehicleFile[]>(`/vehicles/${encodePlate(licensePlate)}/files${qs}`);
  },
  uploadVehicleFile: async (
    licensePlate: string,
    payload: { file: File; category: VehicleFileCategory; notes?: string }
  ) => {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("category", payload.category);
    if (payload.notes) {
      form.append("notes", payload.notes);
    }
    const response = await fetch(`${API_URL}/vehicles/${encodePlate(licensePlate)}/files`, {
      method: "POST",
      body: form,
    });
    const detail = await response.text();
    if (!response.ok) {
      throw buildError(response.status, response.statusText, detail);
    }
    return JSON.parse(detail) as VehicleFile;
  },
  deleteVehicleFile: async (licensePlate: string, fileId: number) => {
    const response = await fetch(`${API_URL}/vehicles/${encodePlate(licensePlate)}/files/${fileId}`, {
      method: "DELETE",
    });
    const detail = await response.text();
    if (!response.ok) {
      throw buildError(response.status, response.statusText, detail);
    }
  },
  downloadVehicleFileUrl: (licensePlate: string, fileId: number) =>
    `${API_URL}/vehicles/${encodePlate(licensePlate)}/files/${fileId}/download`,
  listVehicleSaleDocuments: (licensePlate: string) =>
    fetchJson<SaleDocument[]>(`/vehicles/${encodePlate(licensePlate)}/sale-documents`),
  uploadVehicleSaleDocument: async (
    licensePlate: string,
    payload: { file: File; notes?: string; saleId?: number }
  ) => {
    const form = new FormData();
    form.append("file", payload.file);
    if (payload.notes) {
      form.append("notes", payload.notes);
    }
    if (payload.saleId) {
      form.append("sale_id", String(payload.saleId));
    }
    const response = await fetch(`${API_URL}/vehicles/${encodePlate(licensePlate)}/sale-documents`, {
      method: "POST",
      body: form,
    });
    const detail = await response.text();
    if (!response.ok) {
      throw buildError(response.status, response.statusText, detail);
    }
    return JSON.parse(detail) as SaleDocument;
  },
  deleteVehicleSaleDocument: async (licensePlate: string, documentId: number) => {
    const response = await fetch(`${API_URL}/vehicles/${encodePlate(licensePlate)}/sale-documents/${documentId}`, {
      method: "DELETE",
    });
    const detail = await response.text();
    if (!response.ok) {
      throw buildError(response.status, response.statusText, detail);
    }
  },
  downloadVehicleSaleDocumentUrl: (licensePlate: string, documentId: number) =>
    `${API_URL}/vehicles/${encodePlate(licensePlate)}/sale-documents/${documentId}/download`,
  createBackup: (includeFiles = true) =>
    fetchJson<BackupInfo>("/admin/backups", {
      method: "POST",
      body: JSON.stringify({ include_files: includeFiles }),
    }),
  listBackups: () => fetchJson<BackupListItem[]>("/admin/backups"),
  restoreBackup: (
    backupId: string,
    options: { dryRun?: boolean; wipeBeforeRestore?: boolean; confirmWipe?: boolean } = {}
  ) =>
    fetchJson<BackupRestoreResult>(`/admin/backups/${encodeURIComponent(backupId)}/restore`, {
      method: "POST",
      body: JSON.stringify({
        dry_run: options.dryRun ?? false,
        wipe_before_restore: options.wipeBeforeRestore ?? false,
        confirm_wipe: options.confirmWipe ?? false,
      }),
    }),
  wipeSystem: (confirmWipe: boolean) =>
    fetchJson<WipeResult>("/admin/wipe", {
      method: "POST",
      body: JSON.stringify({ confirm_wipe: confirmWipe }),
    }),
  exportVehiclesPackage: async (vehicleIds: string[], includeFiles = true) => {
    const response = await fetch(`${API_URL}/admin/vehicles/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicle_ids: vehicleIds, include_files: includeFiles }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw buildError(response.status, response.statusText, detail);
    }
    return response.blob();
  },
  importVehiclesPackage: async (payload: { file: File; mode: "skip" | "overwrite" | "new_copy" }) => {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("mode", payload.mode);
    const response = await fetch(`${API_URL}/admin/vehicles/import`, {
      method: "POST",
      body: form,
    });
    const detail = await response.text();
    if (!response.ok) {
      throw buildError(response.status, response.statusText, detail);
    }
    return JSON.parse(detail) as VehicleTransferResult;
  },
  exportCsv: (resource: "vehicles" | "expenses" | "sales") =>
    fetch(`${API_URL}/export/${resource}`),
  getReadme: () => fetchText("/docs/readme"),
};

export function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-ES").format(new Date(value));
}

export const vehicleStates: VehicleStatus[] = [
  "intake",
  "prep",
  "ready",
  "published",
  "reserved",
  "sold",
  "discarded",
];
