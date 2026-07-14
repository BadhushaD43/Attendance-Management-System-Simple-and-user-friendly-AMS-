/* ──────────────────────────────────────────
   Central API service — all calls to the FastAPI backend
   Base URL: http://localhost:8000/api/v1
────────────────────────────────────────── */

const BASE = 'http://localhost:8000/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const detailStr = typeof err.detail === 'object' ? JSON.stringify(err.detail) : err.detail
    throw new Error(detailStr || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

/* ── Employees ── */
export const employeeApi = {
  getAll: () => request<ApiEmployee[]>('/employees/'),

  create: (data: Omit<ApiEmployee, 'id'>) =>
    request<ApiEmployee>('/employees/', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Omit<ApiEmployee, 'id'>) =>
    request<ApiEmployee>(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<{ status: string }>(`/employees/${id}`, { method: 'DELETE' }),
}

/* ── Departments ── */
export const departmentApi = {
  getAll: () => request<ApiDepartment[]>('/departments/'),

  create: (name: string) =>
    request<ApiDepartment>('/departments/', { method: 'POST', body: JSON.stringify({ name }) }),

  update: (id: number, name: string) =>
    request<ApiDepartment>(`/departments/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),

  delete: (id: number) =>
    request<{ status: string }>(`/departments/${id}`, { method: 'DELETE' }),
}

/* ── Attendance ── */
export const attendanceApi = {
  getAll: () => request<ApiDailyAttendance[]>('/attendance/'),

  upsert: (data: Omit<ApiDailyAttendance, 'id'>) =>
    request<ApiDailyAttendance>('/attendance/', { method: 'POST', body: JSON.stringify(data) }),

  bulkUpsert: (records: Omit<ApiDailyAttendance, 'id'>[]) =>
    request<ApiDailyAttendance[]>('/attendance/bulk', { method: 'POST', body: JSON.stringify(records) }),

  deleteByDate: (fromDate: string, toDate: string) =>
    request<{ status: string; deleted_count: number }>(`/attendance/by-date?from_date=${fromDate}&to_date=${toDate}`, { method: 'DELETE' }),
}

/* ── Leaves ── */
export const leaveApi = {
  getAll: () => request<ApiLeaveRecord[]>('/leaves/'),

  create: (data: Omit<ApiLeaveRecord, 'id'>) =>
    request<ApiLeaveRecord>('/leaves/', { method: 'POST', body: JSON.stringify(data) }),

  bulkCreate: (data: Omit<ApiLeaveRecord, 'id'>[]) =>
    request<ApiLeaveRecord[]>('/leaves/bulk', { method: 'POST', body: JSON.stringify(data) }),

  delete: (id: number) =>
    request<{ status: string }>(`/leaves/${id}`, { method: 'DELETE' }),
}


/* ── API response types (match backend schemas) ── */
export interface ApiEmployee {
  id: number
  name: string
  emp_id: string
  email: string
  phone?: string
  department: string
  bank_account_no?: string
  bank_details?: string
  address?: string
  pan_no?: string
  pf_no?: string
}

export interface ApiDepartment {
  id: number
  name: string
}

export interface ApiDailyAttendance {
  id: number
  emp_id: string
  date: string         // 'YYYY-MM-DD'
  check_in: string
  check_out: string
  status: 'Present' | 'Half Day' | 'Leave'
  work_tag: 'overtime' | 'earlycome' | 'earlyout' | null
}

export interface ApiLeaveRecord {
  id: number
  emp_id: string
  emp_name: string
  from_date: string
  to_date: string
  leave_type: string
  reason: string
}
