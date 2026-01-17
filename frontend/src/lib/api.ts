const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type Branch = { id: number; name: string };

export type Vehicle = {
  id?: number;
  vin?: string | null;
  license_plate?: string | null;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  year?: number | null;
  km?: number | null;
  color?: string | null;
  location_id?: number | null;
  state?: string | null;
  purchase_price?: number | null;
  sale_price?: number | null;
  purchase_date?: string | null;
  sale_date?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type VehicleLink = {
  id?: number;
  vehicle_id: number;
  title?: string | null;
  url: string;
  created_at?: string | null;
};

export type VehicleFileCategory = "document" | "expense" | "photo";

export type VehicleFile = {
  id?: number;
  vehicle_id: number;
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
  vehicle_id: number;
  visit_date: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

export type VehicleVisitCreateInput = {
  visit_date: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

export type VehicleStatus =
  | "pendiente recepcion"
  | "en revision"
  | "en exposicion"
  | "reservado"
  | "vendido"
  | "descartado"
  | "devuelto";

export type ChangeStatusInput = {
  status: VehicleStatus;
  note?: string | null;
};

export type VehicleKpis = {
  vehicle_id: number;
  total_expenses: number;
  total_cost?: number | null;
  sale_price?: number | null;
  gross_margin?: number | null;
  roi?: number | null;
  days_in_stock?: number | null;
};

export type VehicleExpenseCategory =
  | "MECHANICAL"
  | "TIRES"
  | "TRANSPORT"
  | "ADMIN"
  | "CLEANING"
  | "OTHER";

export type VehicleExpense = {
  id?: number;
  vehicle_id: number;
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
  | "VEHICLE_UPDATED";

export type VehicleEvent = {
  id: number;
  type: VehicleEventType;
  created_at: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type Expense = {
  id?: number;
  vehicle_id: number;
  concept: string;
  amount: number;
  expense_date: string;
  notes?: string | null;
};

export type Sale = {
  id?: number;
  vehicle_id: number;
  sale_price: number;
  sale_date: string;
  notes?: string | null;
  client_name?: string | null;
  client_tax_id?: string | null;
};

export type DashboardSummary = {
  vehicles: number;
  income: number;
  expenses: number;
  margin: number;
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

function mapVehicle(vehicle: any): Vehicle {
  return {
    ...vehicle,
    location_id: vehicle.branch_id ?? vehicle.location_id,
    state: vehicle.status ?? vehicle.state,
  };
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
  getVehicle: (vehicleId: number) => fetchJson<Vehicle>(`/vehicles/${vehicleId}`).then(mapVehicle),
  getDashboard: (params: { from?: string; to?: string; branchId?: number }) => {
    const search = new URLSearchParams();
    if (params.from) search.append("from_date", params.from);
    if (params.to) search.append("to_date", params.to);
    if (params.branchId) search.append("branch_id", String(params.branchId));
    const qs = search.toString();
    return fetchJson<DashboardSummary>(`/dashboard${qs ? `?${qs}` : ""}`);
  },
  listVehicles: (params: { state?: string; branchId?: number; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params.state) search.append("state", params.state);
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
      license_plate: payload.license_plate?.trim() || "",
      brand: payload.brand?.trim() || "",
      model: payload.model?.trim() || "",
      year: payload.year || new Date().getFullYear(),
      km: payload.km || 0,
      version: payload.version?.trim() || null,
      color: payload.color?.trim() || null,
      branch_id: payload.location_id,
      status: payload.state || "pendiente recepcion",
      purchase_price: payload.purchase_price || 0,
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
  listVehicleLinks: (vehicleId: number) => fetchOptionalLinks(`/vehicles/${vehicleId}/links`),
  createVehicleLink: async (vehicleId: number, payload: { title?: string; url: string }) => {
    const response = await fetch(`${API_URL}/vehicles/${vehicleId}/links`, {
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
  deleteVehicleLink: async (vehicleId: number, linkId: number) => {
    const response = await fetch(`${API_URL}/vehicles/${vehicleId}/links/${linkId}`, {
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
  listVehicleVisits: (vehicleId: number) =>
    fetchJson<VehicleVisit[]>(`/vehicles/${vehicleId}/visits`),
  createVehicleVisit: (vehicleId: number, payload: VehicleVisitCreateInput) =>
    fetchJson<VehicleVisit>(`/vehicles/${vehicleId}/visits`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteVehicleVisit: async (vehicleId: number, visitId: number) => {
    const response = await fetch(`${API_URL}/vehicles/${vehicleId}/visits/${visitId}`, {
      method: "DELETE",
    });
    const detail = await response.text();
    if (!response.ok) {
      throw buildError(response.status, response.statusText, detail);
    }
  },
  listVehicleExpenses: (vehicleId: number) =>
    fetchJson<VehicleExpense[]>(`/vehicles/${vehicleId}/expenses`),
  createVehicleExpense: (vehicleId: number, payload: ExpenseCreateInput) =>
    fetchJson<VehicleExpense>(`/vehicles/${vehicleId}/expenses`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateVehicleExpense: (vehicleId: number, expenseId: number, payload: ExpenseUpdateInput) =>
    fetchJson<VehicleExpense>(`/vehicles/${vehicleId}/expenses/${expenseId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteVehicleExpense: async (vehicleId: number, expenseId: number) => {
    const response = await fetch(`${API_URL}/vehicles/${vehicleId}/expenses/${expenseId}`, {
      method: "DELETE",
    });
    const detail = await response.text();
    if (!response.ok) {
      throw buildError(response.status, response.statusText, detail);
    }
  },
  getVehicleKpis: (vehicleId: number) =>
    fetchJson<VehicleKpis>(`/vehicles/${vehicleId}/kpis`),
  changeVehicleStatus: (vehicleId: number, payload: ChangeStatusInput) =>
    fetchJson<Vehicle>(`/vehicles/${vehicleId}/status`, {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(mapVehicle),
  getVehicleTimeline: (vehicleId: number, params?: { limit?: number; types?: VehicleEventType[] }) => {
    const search = new URLSearchParams();
    if (params?.limit) search.append("limit", String(params.limit));
    params?.types?.forEach((type) => search.append("type", type));
    const qs = search.toString();
    return fetchJson<VehicleEvent[]>(`/vehicles/${vehicleId}/timeline${qs ? `?${qs}` : ""}`);
  },
  listVehicleFiles: (vehicleId: number, category?: VehicleFileCategory) => {
    const qs = category ? `?category=${encodeURIComponent(category)}` : "";
    return fetchJson<VehicleFile[]>(`/vehicles/${vehicleId}/files${qs}`);
  },
  uploadVehicleFile: async (
    vehicleId: number,
    payload: { file: File; category: VehicleFileCategory; notes?: string }
  ) => {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("category", payload.category);
    if (payload.notes) {
      form.append("notes", payload.notes);
    }
    const response = await fetch(`${API_URL}/vehicles/${vehicleId}/files`, {
      method: "POST",
      body: form,
    });
    const detail = await response.text();
    if (!response.ok) {
      throw buildError(response.status, response.statusText, detail);
    }
    return JSON.parse(detail) as VehicleFile;
  },
  deleteVehicleFile: async (vehicleId: number, fileId: number) => {
    const response = await fetch(`${API_URL}/vehicles/${vehicleId}/files/${fileId}`, {
      method: "DELETE",
    });
    const detail = await response.text();
    if (!response.ok) {
      throw buildError(response.status, response.statusText, detail);
    }
  },
  downloadVehicleFileUrl: (vehicleId: number, fileId: number) =>
    `${API_URL}/vehicles/${vehicleId}/files/${fileId}/download`,
  exportCsv: (resource: "vehicles" | "expenses" | "sales") =>
    fetch(`${API_URL}/export/${resource}`),
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

export const vehicleStates = [
  "pendiente recepcion",
  "en revision",
  "en exposicion",
  "reservado",
  "vendido",
  "descartado",
  "devuelto",
];
