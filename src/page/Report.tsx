import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
  MdCalendarToday,
  MdDateRange,
  MdDownload,
  MdSearch,
  MdAssessment,
  MdPeople,
  MdAccessTime,
  MdCheckCircle,
  MdDelete,
} from 'react-icons/md'
import type { DailyAttendance, Employee, LeaveRecord } from '../types'

interface ReportProps {
  attendance: DailyAttendance[]
  employees: Employee[]
  leaves: LeaveRecord[]
  onDeleteAttendance?: (fromDate: string, toDate: string) => Promise<void>
}

type ReportMode = 'single' | 'range'
type ReportTab  = 'summary' | 'detail'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function calcHours(inT: string, outT: string): number | null {
  if (!inT || !outT) return null
  const toM = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const diff = (toM(outT) - toM(inT)) / 60
  return diff > 0 ? diff : null
}

const STATUS_CLASS: Record<string, string> = {
  'Present':  'badge-present',
  'Half Day': 'badge-halfday',
  'Leave':    'badge-absent',
}

const TAG_CLASS: Record<string, string> = {
  earlycome: 'badge-earlycome',
  earlyout:  'badge-earlyout',
  overtime:  'badge-overtime',
}

const TAG_LABEL: Record<string, string> = {
  earlycome: 'Early Come',
  earlyout:  'Early Out',
  overtime:  'Overtime',
}

export default function Report({ attendance, employees, leaves, onDeleteAttendance }: ReportProps) {
  const [mode,       setMode]       = useState<ReportMode>('single')
  const [activeTab,  setActiveTab]  = useState<ReportTab>('summary')
  const [singleDate, setSingleDate] = useState(todayStr())
  const [fromDate,   setFromDate]   = useState(todayStr())
  const [toDate,     setToDate]     = useState(todayStr())
  const [search,     setSearch]     = useState('')

  /* ── Filtered attendance records based on mode ── */
  const filtered = useMemo(() => {
    return attendance.filter(a => {
      if (mode === 'single') return a.date === singleDate
      return a.date >= fromDate && a.date <= toDate
    })
  }, [attendance, mode, singleDate, fromDate, toDate])

  /* ── Manual leaves that fall in range but aren't in attendance ── */
  const manualLeaveRecords = useMemo(() => {
    const attSet = new Set(filtered.map(a => `${a.emp_id}_${a.date}`))
    const result: DailyAttendance[] = []
    leaves.forEach(l => {
      // Expand each leave record into daily records within the selected range
      const startDate = mode === 'single' ? singleDate : fromDate
      const endDate   = mode === 'single' ? singleDate : toDate
      // Get the overlapping date range
      const overlapStart = l.from_date > startDate ? l.from_date : startDate
      const overlapEnd   = l.to_date   < endDate   ? l.to_date   : endDate
      if (overlapStart > overlapEnd) return
      // Add daily entries for each day in the overlap
      let cursor = new Date(overlapStart)
      const endD  = new Date(overlapEnd)
      while (cursor <= endD) {
        const dateStr = cursor.toISOString().split('T')[0]
        const key = `${l.emp_id}_${dateStr}`
        if (!attSet.has(key)) {
          result.push({
            emp_id:    l.emp_id,
            date:      dateStr,
            check_in:  '',
            check_out: '',
            status:    'Leave',
            work_tag:  null,
          })
          attSet.add(key) // prevent duplicates
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    })
    return result
  }, [leaves, filtered, mode, singleDate, fromDate, toDate])

  /* ── Status sort order: Present → Leave → Half Day ── */
  const STATUS_ORDER: Record<string, number> = { 'Present': 0, 'Leave': 1, 'Half Day': 2 }

  /* ── Enrich records with employee name (include manual leaves) ── */
  const enriched = useMemo(() => {
    return [...filtered, ...manualLeaveRecords].map(a => {
      const emp = employees.find(e => e.emp_id === a.emp_id || e.name === a.emp_id)
      // For leave records from leaves table, try to get emp_name from leaves list
      const leaveRec = leaves.find(l => l.emp_id === a.emp_id)
      return {
        ...a,
        emp_name: emp?.name || leaveRec?.emp_name || a.emp_id,
        department: emp?.department || '—'
      }
    }).filter(a => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        a.emp_id.toLowerCase().includes(q) ||
        a.emp_name.toLowerCase().includes(q) ||
        a.department.toLowerCase().includes(q)
      )
    }).sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 99
      const sb = STATUS_ORDER[b.status] ?? 99
      return sa - sb
    })
  }, [filtered, manualLeaveRecords, employees, leaves, search])

  /* ── Group enriched by date (for range mode) ── */
  const groupedByDate = useMemo(() => {
    const map = new Map<string, typeof enriched>()
    enriched.forEach(a => {
      const list = map.get(a.date) || []
      list.push(a)
      map.set(a.date, list)
    })
    // Sort dates ascending
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [enriched])

  /* ── Summary stats ── */
  const stats = useMemo(() => ({
    total:    enriched.length,
    present:  enriched.filter(a => a.status === 'Present').length,
    halfday:  enriched.filter(a => a.status === 'Half Day').length,
    leave:    enriched.filter(a => a.status === 'Leave').length,
    overtime: enriched.filter(a => a.work_tag === 'overtime').length,
  }), [enriched])

  /* ── Date label for display ── */
  const dateLabel = mode === 'single'
    ? singleDate
    : `${fromDate} → ${toDate}`

  /* ── Export to Excel ── */
  const handleDownload = () => {
    if (enriched.length === 0) return

    const wb = XLSX.utils.book_new()
    const fileName = mode === 'single'
      ? `Report_${singleDate}.xlsx`
      : `Report_${fromDate}_to_${toDate}.xlsx`

    const allSheetRows: any[] = []

    groupedByDate.forEach(([, rows]) => {
      rows.forEach((a, i) => {
        allSheetRows.push({
          'Date':       a.date,
          '#':          i + 1,
          'Employee ID': a.emp_id,
          'Name':       a.emp_name,
          'Department': a.department,
          'Check In':   a.check_in  || '—',
          'Check Out':  a.check_out || '—',
          'Hours':      calcHours(a.check_in, a.check_out)?.toFixed(1) ?? '—',
          'Status':     a.status,
          'Work Tag':   a.work_tag ? TAG_LABEL[a.work_tag] : '—',
        })
      })
    })

    const ws = XLSX.utils.json_to_sheet(allSheetRows)

    /* Auto column width */
    if (allSheetRows.length > 0) {
      const cols = Object.keys(allSheetRows[0]).map(k => ({ wch: Math.max(k.length, 12) }))
      ws['!cols'] = cols
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report')
    XLSX.writeFile(wb, fileName)
  }

  const handleDelete = () => {
    if (!onDeleteAttendance) return
    const start = mode === 'single' ? singleDate : fromDate
    const end = mode === 'single' ? singleDate : toDate
    if (!start || !end) return

    const confirmMsg = mode === 'single'
      ? `Are you sure you want to delete all attendance records for ${singleDate}? This action cannot be undone.`
      : `Are you sure you want to delete all attendance records from ${fromDate} to ${toDate}? This action cannot be undone.`

    if (window.confirm(confirmMsg)) {
      onDeleteAttendance(start, end)
    }
  }

  return (
    <div className="report-page">

      {/* ── Page Header ── */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <h1>Attendance Report</h1>
        <p>Generate and export attendance reports by date or date range</p>
      </div>

      {/* ── Navbar Tabs ── */}
      <div className="report-navbar">
        <div className="report-nav-tabs">
          <button
            className={`report-nav-tab ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            <MdAssessment size={16} />
            Summary
          </button>
          <button
            className={`report-nav-tab ${activeTab === 'detail' ? 'active' : ''}`}
            onClick={() => setActiveTab('detail')}
          >
            <MdPeople size={16} />
            Detailed View
          </button>
        </div>

        {/* ── Mode Toggle ── */}
        <div className="report-mode-toggle">
          <button
            className={`mode-btn ${mode === 'single' ? 'active' : ''}`}
            onClick={() => setMode('single')}
          >
            <MdCalendarToday size={14} />
            Single Date
          </button>
          <button
            className={`mode-btn ${mode === 'range' ? 'active' : ''}`}
            onClick={() => setMode('range')}
          >
            <MdDateRange size={14} />
            Date Range
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="report-filter-bar">
        <div className="report-filter-left">
          {mode === 'single' ? (
            <div className="report-date-group">
              <label><MdCalendarToday size={13} /> Date</label>
              <input
                type="date"
                className="date-input"
                value={singleDate}
                onChange={e => setSingleDate(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="report-date-group">
                <label>From</label>
                <input
                  type="date"
                  className="date-input"
                  value={fromDate}
                  max={toDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </div>
              <span className="date-sep">→</span>
              <div className="report-date-group">
                <label>To</label>
                <input
                  type="date"
                  className="date-input"
                  value={toDate}
                  min={fromDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="search-wrap" style={{ marginLeft: 8 }}>
            <MdSearch size={16} className="search-icon" />
            <input
              className="search-input"
              placeholder="Search employee..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {onDeleteAttendance && (
            <button
              className={`btn-delete-report ${enriched.length === 0 ? 'disabled' : ''}`}
              onClick={handleDelete}
              disabled={enriched.length === 0}
              title={enriched.length === 0 ? 'No data to delete' : `Delete records for ${dateLabel}`}
            >
              <MdDelete size={17} />
              Delete Records
            </button>
          )}

          <button
            className={`btn-download ${enriched.length === 0 ? 'disabled' : ''}`}
            onClick={handleDownload}
            disabled={enriched.length === 0}
            title={enriched.length === 0 ? 'No data to export' : `Download Excel for ${dateLabel}`}
          >
            <MdDownload size={17} />
            Download Excel
            {enriched.length > 0 && (
              <span className="dl-count">{enriched.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Summary Tab ── */}
      {activeTab === 'summary' && (
        <>
          <div className="report-stats-grid">
            <div className="report-stat-card blue">
              <div className="rsc-icon"><MdPeople size={22} /></div>
              <div>
                <h3>{stats.total}</h3>
                <p>Total Records</p>
              </div>
            </div>
            <div className="report-stat-card green">
              <div className="rsc-icon"><MdCheckCircle size={22} /></div>
              <div>
                <h3>{stats.present}</h3>
                <p>Present</p>
              </div>
            </div>
            <div className="report-stat-card yellow">
              <div className="rsc-icon"><MdAccessTime size={22} /></div>
              <div>
                <h3>{stats.halfday}</h3>
                <p>Half Day</p>
              </div>
            </div>
            <div className="report-stat-card red">
              <div className="rsc-icon"><MdCalendarToday size={22} /></div>
              <div>
                <h3>{stats.leave}</h3>
                <p>On Leave</p>
              </div>
            </div>
            <div className="report-stat-card indigo">
              <div className="rsc-icon"><MdAssessment size={22} /></div>
              <div>
                <h3>{stats.overtime}</h3>
                <p>Overtime</p>
              </div>
            </div>
          </div>

          {/* Summary Table — grouped by date in range mode */}
          {enriched.length === 0 ? (
            <div className="table-card">
              <div className="empty-state">
                No attendance records found for <strong>{dateLabel}</strong>.
              </div>
            </div>
          ) : mode === 'single' ? (
            <div className="table-card">
              <div className="table-card-header">
                <h2>Summary &nbsp;·&nbsp; {dateLabel}</h2>
                <span className="record-count">{enriched.length} record{enriched.length !== 1 ? 's' : ''}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Emp ID</th><th>Name</th><th>Department</th>
                    <th>Status</th><th>Work Tag</th><th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((a, i) => (
                    <tr key={`${a.emp_id}-${a.date}`}>
                      <td>{i + 1}</td>
                      <td><span className="badge badge-overtime">{a.emp_id}</span></td>
                      <td>{a.emp_name}</td>
                      <td>{a.department}</td>
                      <td><span className={`badge ${STATUS_CLASS[a.status] || 'badge-present'}`}>{a.status}</span></td>
                      <td>{a.work_tag ? <span className={`badge ${TAG_CLASS[a.work_tag]}`}>{TAG_LABEL[a.work_tag]}</span> : <span style={{ color: '#bdc3c7' }}>—</span>}</td>
                      <td>{calcHours(a.check_in, a.check_out) !== null ? `${calcHours(a.check_in, a.check_out)!.toFixed(1)}h` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Range mode — one table block per date */
            <>
              {groupedByDate.map(([date, rows]) => (
                <div className="table-card" key={date} style={{ marginBottom: 20 }}>
                  <div className="table-card-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#7f8c8d' }}>📅</span>
                      {date}
                    </h2>
                    <span className="record-count">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th><th>Emp ID</th><th>Name</th><th>Department</th>
                        <th>Status</th><th>Work Tag</th><th>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((a, i) => (
                        <tr key={`${a.emp_id}-${a.date}-${i}`}>
                          <td>{i + 1}</td>
                          <td><span className="badge badge-overtime">{a.emp_id}</span></td>
                          <td>{a.emp_name}</td>
                          <td>{a.department}</td>
                          <td><span className={`badge ${STATUS_CLASS[a.status] || 'badge-present'}`}>{a.status}</span></td>
                          <td>{a.work_tag ? <span className={`badge ${TAG_CLASS[a.work_tag]}`}>{TAG_LABEL[a.work_tag]}</span> : <span style={{ color: '#bdc3c7' }}>—</span>}</td>
                          <td>{calcHours(a.check_in, a.check_out) !== null ? `${calcHours(a.check_in, a.check_out)!.toFixed(1)}h` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* ── Detail Tab ── */}
      {activeTab === 'detail' && (
        enriched.length === 0 ? (
          <div className="table-card">
            <div className="empty-state">
              No attendance records found for <strong>{dateLabel}</strong>.
            </div>
          </div>
        ) : mode === 'single' ? (
          <div className="table-card">
            <div className="table-card-header">
              <h2>Detailed Report &nbsp;·&nbsp; {dateLabel}</h2>
              <span className="record-count">{enriched.length} record{enriched.length !== 1 ? 's' : ''}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Emp ID</th><th>Name</th><th>Department</th>
                  <th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th><th>Work Tag</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((a, i) => {
                  const hrs = calcHours(a.check_in, a.check_out)
                  return (
                    <tr key={`${a.emp_id}-${a.date}-${i}`}>
                      <td>{i + 1}</td>
                      <td><span className="badge badge-overtime">{a.emp_id}</span></td>
                      <td>{a.emp_name}</td>
                      <td>{a.department}</td>
                      <td>{a.check_in  || '—'}</td>
                      <td>{a.check_out || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{hrs !== null ? `${hrs.toFixed(1)}h` : '—'}</td>
                      <td><span className={`badge ${STATUS_CLASS[a.status] || 'badge-present'}`}>{a.status}</span></td>
                      <td>{a.work_tag ? <span className={`badge ${TAG_CLASS[a.work_tag]}`}>{TAG_LABEL[a.work_tag]}</span> : <span style={{ color: '#bdc3c7' }}>—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Range mode — one table block per date */
          <>
            {groupedByDate.map(([date, rows]) => (
              <div className="table-card" key={date} style={{ marginBottom: 20 }}>
                <div className="table-card-header">
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#7f8c8d' }}>📅</span>
                    {date}
                  </h2>
                  <span className="record-count">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>Emp ID</th><th>Name</th><th>Department</th>
                      <th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th><th>Work Tag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a, i) => {
                      const hrs = calcHours(a.check_in, a.check_out)
                      return (
                        <tr key={`${a.emp_id}-${a.date}-${i}`}>
                          <td>{i + 1}</td>
                          <td><span className="badge badge-overtime">{a.emp_id}</span></td>
                          <td>{a.emp_name}</td>
                          <td>{a.department}</td>
                          <td>{a.check_in  || '—'}</td>
                          <td>{a.check_out || '—'}</td>
                          <td style={{ fontWeight: 600 }}>{hrs !== null ? `${hrs.toFixed(1)}h` : '—'}</td>
                          <td><span className={`badge ${STATUS_CLASS[a.status] || 'badge-present'}`}>{a.status}</span></td>
                          <td>{a.work_tag ? <span className={`badge ${TAG_CLASS[a.work_tag]}`}>{TAG_LABEL[a.work_tag]}</span> : <span style={{ color: '#bdc3c7' }}>—</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )
      )}
    </div>
  )
}
