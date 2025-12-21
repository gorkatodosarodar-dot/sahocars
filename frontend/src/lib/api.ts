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
  branch_id?: number | null;
  status?: string | null;
  purchase_price?: number | null;
  sale_price?: number | null;
  purchase_date?: string | null;
  sale_date?: string | null;
  notes?: string | null;
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
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Error en la petición");
  }
  return response.json() as Promise<T>;
}

export const api = {
  getBranches: () => fetchJson<Branch[]>("/branches"),
  createBranch: (payload: { name: string }) =>
    fetchJson<Branch>("/branches", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getDashboard: (params: { from?: string; to?: string; branchId?: number }) => {
    const search = new URLSearchParams();
    if (params.from) search.append("from_date", params.from);
    if (params.to) search.append("to_date", params.to);
    if (params.branchId) search.append("branch_id", String(params.branchId));
    const qs = search.toString();
    return fetchJson<DashboardSummary>(`/dashboard${qs ? `?${qs}` : ""}`);
  },
  listVehicles: (params: { status?: string; branchId?: number; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params.status) search.append("status", params.status);
    if (params.branchId) search.append("branch_id", String(params.branchId));
    if (params.from) search.append("from_date", params.from);
    if (params.to) search.append("to_date", params.to);
    const qs = search.toString();
    return fetchJson<Vehicle[]>(`/vehicles${qs ? `?${qs}` : ""}`);
  },
  createVehicle: (payload: Vehicle) =>
    fetchJson<Vehicle>("/vehicles", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
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
