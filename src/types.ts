export interface AttendanceRecord {
  emp_name: string
  check_in_time: string
  check_out_time: string
  status: 'Present' | 'Half Day' | 'Leave'
  date?: string
}

export interface Employee {
  id: string
  name: string
  emp_id: string
  phone: string
  email: string
  department: string
}

export interface Department {
  id: string
  name: string
}

export interface LeaveRecord {
  emp_id: string
  emp_name: string
  from_date: string
  to_date: string
  leave_type: string
  reason: string
}

export interface DailyAttendance {
  emp_id: string
  date: string
  check_in: string
  check_out: string
  status: 'Present' | 'Half Day' | 'Leave'
  work_tag: 'overtime' | 'earlycome' | 'earlyout' | null
}
