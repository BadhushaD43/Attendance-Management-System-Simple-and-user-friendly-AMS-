import { useMemo } from 'react'
import type { DailyAttendance, Employee, LeaveRecord } from '../types'
import { MdPeople, MdCheckCircle, MdEventNote, MdAccessTime } from 'react-icons/md'

interface DashboardProps {
  attendance: DailyAttendance[]
  employees: Employee[]
  leaves: LeaveRecord[]
}

// Use local date (not UTC) so it always matches Excel-uploaded dates
function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Dashboard({ attendance, employees, leaves }: DashboardProps) {
  const today       = todayStr()
  const todayRecords = attendance.filter(a => a.date === today)

  // Build a set of emp_ids already on leave via attendance (status='Leave')
  const attLeaveIds = new Set(todayRecords.filter(r => r.status === 'Leave').map(r => r.emp_id))

  // Manual leaves from leaves table that cover today but aren't already in attendance
  const manualLeavesToday = useMemo(() => {
    return leaves.filter(l => l.from_date <= today && l.to_date >= today && !attLeaveIds.has(l.emp_id))
  }, [leaves, today, attLeaveIds])

  const present  = todayRecords.filter(r => r.status === 'Present').length
  const attLeave = todayRecords.filter(r => r.status === 'Leave').length
  const halfday  = todayRecords.filter(r => r.status === 'Half Day').length
  const onLeave  = attLeave + manualLeavesToday.length  // Combined leave count

  const total = employees.length || 1
  const remaining = Math.max(0, total - (present + onLeave + halfday))

  const r = 50
  const circ = 2 * Math.PI * r // ~314.16

  const pctPresent = (present / total) * 100
  const pctLeave = (onLeave / total) * 100
  const pctHalfDay = (halfday / total) * 100
  const pctRemaining = (remaining / total) * 100

  const valPresent = (present / total) * circ
  const valLeave = (onLeave / total) * circ
  const valHalfDay = (halfday / total) * circ

  const offsetPresent = 0
  const offsetHalfDay = -valPresent
  const offsetLeave = -(valPresent + valHalfDay)

  // Build the combined today's table: attendance records + manual leave records not in attendance
  const combinedToday = useMemo(() => {
    const rows: Array<{
      emp_id: string; emp_name: string; date: string;
      check_in: string; check_out: string; status: string
    }> = todayRecords.map(r => {
      const emp = employees.find(e => e.emp_id === r.emp_id)
      return {
        emp_id: r.emp_id,
        emp_name: emp?.name || r.emp_id,
        date: r.date,
        check_in: r.check_in,
        check_out: r.check_out,
        status: r.status,
      }
    })
    // Append manual leave persons not already in attendance
    manualLeavesToday.forEach(l => {
      const emp = employees.find(e => e.emp_id === l.emp_id)
      rows.push({
        emp_id: l.emp_id,
        emp_name: l.emp_name || emp?.name || l.emp_id,
        date: today,
        check_in: '—',
        check_out: '—',
        status: 'Leave',
      })
    })
    return rows
  }, [todayRecords, manualLeavesToday, employees, today])

  // Helper to format date label
  const formatDateLabel = (dateStr: string) => {
    const parts = dateStr.split('-')
    if (parts.length < 3) return dateStr
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthIdx = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${months[monthIdx]}`
    }
    return dateStr
  }

  // Get chronological last 5 days that have attendance records
  const last5Days = useMemo(() => {
    const datesSet = new Set(attendance.map(a => a.date))
    const dates = Array.from(datesSet)
    dates.sort() // chronological asc
    
    // If we have fewer than 5 active days, pad with calendar days leading to today
    if (dates.length < 5) {
      const todayObj = new Date()
      for (let i = 4; i >= 0; i--) {
        const d = new Date()
        d.setDate(todayObj.getDate() - i)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const dateStr = `${y}-${m}-${day}`
        if (!dates.includes(dateStr)) {
          dates.push(dateStr)
        }
      }
      dates.sort()
    }
    return dates.slice(-5) // last 5 days
  }, [attendance])

  const barChartData = useMemo(() => {
    const totalCount = employees.length || 1
    return last5Days.map(dateStr => {
      const dayRecords = attendance.filter(a => a.date === dateStr)
      const presCount = dayRecords.filter(r => r.status === 'Present').length
      const hdCount = dayRecords.filter(r => r.status === 'Half Day').length
      const presentTotal = presCount + hdCount
      return {
        date: dateStr,
        present: presentTotal,
        percent: Math.min(100, Math.round((presentTotal / totalCount) * 100)),
        dateLabel: formatDateLabel(dateStr)
      }
    })
  }, [last5Days, attendance, employees])

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of today's attendance — {todayStr()}</p>
      </div>

      {/* Top row stats summary */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div>
            <h3>{employees.length}</h3>
            <p>Total Employees</p>
          </div>
          <div className="stat-icon total"><MdPeople size={24} /></div>
        </div>
        <div className="stat-card present">
          <div>
            <h3>{present}</h3>
            <p>Present Today</p>
          </div>
          <div className="stat-icon present"><MdCheckCircle size={24} /></div>
        </div>
        <div className="stat-card absent">
          <div>
            <h3>{onLeave}</h3>
            <p>On Leave</p>
          </div>
          <div className="stat-icon absent"><MdEventNote size={24} /></div>
        </div>
        <div className="stat-card halfday">
          <div>
            <h3>{halfday}</h3>
            <p>Half Day</p>
          </div>
          <div className="stat-icon halfday"><MdAccessTime size={24} /></div>
        </div>
      </div>

      <div className="dashboard-top-section">
        {/* Left Column: Today's Breakdown Donut Chart */}
        <div className="chart-card" style={{ flex: 1 }}>
          <div className="chart-card-header">
            <h2>Today's Breakdown</h2>
          </div>
          <div className="chart-card-body">
            <div className="chart-container">
              <svg width="140" height="140" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background Ring (Not Checked In) */}
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="transparent"
                  stroke="#f2efe9"
                  strokeWidth="10"
                />
                
                {/* Present segment */}
                {present > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="transparent"
                    stroke="#10b981"
                    strokeWidth="10"
                    strokeDasharray={`${valPresent} ${circ}`}
                    strokeDashoffset={offsetPresent}
                  />
                )}
                
                {/* Half Day segment */}
                {halfday > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="transparent"
                    stroke="#eab308"
                    strokeWidth="10"
                    strokeDasharray={`${valHalfDay} ${circ}`}
                    strokeDashoffset={offsetHalfDay}
                  />
                )}

                {/* On Leave segment */}
                {onLeave > 0 && (
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="transparent"
                    stroke="#f97316"
                    strokeWidth="10"
                    strokeDasharray={`${valLeave} ${circ}`}
                    strokeDashoffset={offsetLeave}
                  />
                )}
              </svg>
              
              <div className="chart-center-label">
                <h3>{Math.round(pctPresent)}%</h3>
                <p>Present</p>
              </div>
            </div>

            <div className="chart-legend">
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#10b981' }}></span>
                <span className="legend-label">Present</span>
                <span className="legend-value">{present} ({Math.round(pctPresent)}%)</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#eab308' }}></span>
                <span className="legend-label">Half Day</span>
                <span className="legend-value">{halfday} ({Math.round(pctHalfDay)}%)</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#f97316' }}></span>
                <span className="legend-label">On Leave</span>
                <span className="legend-value">{onLeave} ({Math.round(pctLeave)}%)</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: '#cbd5e1' }}></span>
                <span className="legend-label">Not In Yet</span>
                <span className="legend-value">{remaining} ({Math.round(pctRemaining)}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Attendance Trends Bar Chart */}
        <div className="chart-card" style={{ flex: 1 }}>
          <div className="chart-card-header">
            <h2>Presence Trends (Last 5 Days)</h2>
          </div>
          <div className="chart-card-body" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '140px', padding: '0 10px', marginTop: 10 }}>
              {barChartData.map((d, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--blue-mid)', fontWeight: 700 }}>{d.percent}%</span>
                  <div style={{ position: 'relative', width: '28px', height: '100px', background: 'var(--grey-light)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: `${d.percent}%`,
                      background: 'linear-gradient(to top, var(--blue-mid), var(--blue-light))',
                      borderRadius: 0,
                      transition: 'height 0.6s ease-in-out'
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--grey-dark)', fontWeight: 600 }}>{d.present} Pres</span>
                  <span style={{ fontSize: 11, color: 'var(--grey-mid)' }}>{d.dateLabel}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-card-header">
          <h2>Today's Attendance &mdash; {today}</h2>
          {combinedToday.length > 0 && (
            <span className="record-count">{combinedToday.length} records</span>
          )}
        </div>
        {combinedToday.length === 0 ? (
          <div className="empty-state">No attendance data. Upload a file or add records to get started.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {combinedToday.map((r, i) => (
                <tr key={i}>
                  <td><span className="badge badge-overtime">{r.emp_id}</span></td>
                  <td>{r.emp_name}</td>
                  <td>{r.date}</td>
                  <td>{r.check_in || '—'}</td>
                  <td>{r.check_out || '—'}</td>
                  <td>
                    <span className={`badge badge-${r.status === 'Present' ? 'present' : r.status === 'Leave' ? 'leave' : 'halfday'}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

