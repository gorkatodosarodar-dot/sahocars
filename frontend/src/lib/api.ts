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
  created_at?: string;
  updated_at?: string;
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

export const api = {
  getBranches: () => fetchJson<Branch[]>("/branches"),
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
    return fetchJson<any[]>(`/vehicles${qs ? `?${qs}` : ""}`).then((res) =>
      res.map((v) => ({
        ...v,
        location_id: v.branch_id,
        state: v.status,
      }))
    );
  },
  getVehicle: (id: number) =>
    fetchJson<any>(`/vehicles/${id}`).then((res) => ({
      ...res,
      location_id: res.branch_id,
      state: res.status,
    })),
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
    }).then((res) => ({
      ...res,
      location_id: res.branch_id,
      state: res.status,
    }));
  },
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
];
