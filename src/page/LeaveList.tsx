import { useState, useMemo } from 'react'
import { MdSearch } from 'react-icons/md'
import type { LeaveRecord, Employee, DailyAttendance } from '../types'

interface LeaveListProps {
  leaves: LeaveRecord[]
  attendance: DailyAttendance[]
  employees: Employee[]
  onAddLeave?: (leave: LeaveRecord) => void
}

type DateMode = 'range' | 'single'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function LeaveList({ leaves, attendance, employees }: LeaveListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [dateMode, setDateMode] = useState<DateMode>('single')
  const [fromDate, setFromDate] = useState(todayStr())
  const [toDate, setToDate] = useState(todayStr())
  const [singleDate, setSingleDate] = useState(todayStr())

  // Derive attendance-based leave rows (status='Leave' in attendance records)
  const attLeaves = useMemo(() => {
    return attendance
      .filter(a => a.status === 'Leave')
      .map(a => {
        const emp = employees.find(e => e.emp_id === a.emp_id)
        return {
          emp_id:     a.emp_id,
          emp_name:   emp?.name || a.emp_id,
          from_date:  a.date,
          to_date:    a.date,
          leave_type: 'Attendance Leave',
          reason:     'Auto-synced from attendance',
          _source:    'attendance' as const,
        }
      })
  }, [attendance, employees])

  // Merge manual leaves + attendance leaves (deduplicated by emp_id+date)
  const allLeaves = useMemo(() => {
    const manual = leaves.map(l => {
      const emp = employees.find(e => e.emp_id === l.emp_id)
      return {
        ...l,
        emp_name: l.emp_name || emp?.name || l.emp_id,
        _source: 'manual' as const,
      }
    })
    // Don't double-show if a record already exists for same emp+date
    const attOnly = attLeaves.filter(al =>
      !manual.some(ml => ml.emp_id === al.emp_id && ml.from_date <= al.from_date && ml.to_date >= al.to_date)
    )
    return [...manual, ...attOnly].sort((a, b) => b.from_date.localeCompare(a.from_date))
  }, [leaves, attLeaves, employees])

  // Filter by search and date
  const filtered = useMemo(() => {
    return allLeaves.filter(l => {
      const q = searchQuery.trim().toLowerCase()
      const matchSearch = !q ||
        l.emp_id.toLowerCase().includes(q) ||
        l.emp_name.toLowerCase().includes(q)

      let matchDate = true
      if (dateMode === 'single' && singleDate) {
        matchDate = l.from_date <= singleDate && l.to_date >= singleDate
      } else if (dateMode === 'range' && fromDate && toDate) {
        matchDate = l.from_date <= toDate && l.to_date >= fromDate
      } else if (dateMode === 'range' && fromDate && !toDate) {
        matchDate = l.to_date >= fromDate
      } else if (dateMode === 'range' && !fromDate && toDate) {
        matchDate = l.from_date <= toDate
      }
      return matchSearch && matchDate
    })
  }, [allLeaves, searchQuery, dateMode, singleDate, fromDate, toDate])

  // Only show "Clear" if the user has changed from the default "today" view or added a search query
  const hasFilter =
    searchQuery !== '' ||
    (dateMode === 'single' && singleDate !== todayStr()) ||
    (dateMode === 'range' && (fromDate !== todayStr() || toDate !== todayStr()))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Leave List</h1>
          <p>Track and manage employee leaves</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="leave-filter-bar">
        <div className="search-wrap" style={{ flex: 1, maxWidth: 300 }}>
          <MdSearch size={16} className="search-icon" />
          <input
            className="search-input"
            style={{ width: '100%' }}
            placeholder="Search by Emp ID or Name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="date-mode-toggle">
          <button className={`toggle-btn ${dateMode === 'range' ? 'active' : ''}`} onClick={() => setDateMode('range')}>Date Range</button>
          <button className={`toggle-btn ${dateMode === 'single' ? 'active' : ''}`} onClick={() => setDateMode('single')}>Single Date</button>
        </div>

        {dateMode === 'range' ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" className="date-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <span style={{ color: '#7f8c8d', fontSize: 13 }}>to</span>
            <input type="date" className="date-input" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        ) : (
          <input type="date" className="date-input" value={singleDate} onChange={e => setSingleDate(e.target.value)} />
        )}

        {hasFilter && (
          <button className="clear-btn" onClick={() => { setFromDate(todayStr()); setToDate(todayStr()); setSingleDate(todayStr()); setSearchQuery('') }}>Clear</button>
        )}
      </div>

      <div className="table-card">
        <div className="table-card-header">
          <h2>Leave Records ({filtered.length})</h2>
          {allLeaves.length > 0 && (
            <span className="record-count">{allLeaves.length} total</span>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            {allLeaves.length === 0
              ? 'No leave records found. Mark employees as "Leave" in the Attendance page and save to track them here.'
              : 'No leave records match your search/filter criteria.'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Emp ID &amp; Name</th>
                <th>Leave Type</th>
                <th>From</th>
                <th>To</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="badge badge-overtime" style={{ width: 'fit-content' }}>{l.emp_id}</span>
                      {l.emp_name && <span style={{ fontSize: 12, color: '#7f8c8d' }}>{l.emp_name}</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${l._source === 'attendance' ? 'badge-halfday' : 'badge-leave'}`}>
                      {l.leave_type}
                    </span>
                  </td>
                  <td>{l.from_date}</td>
                  <td>{l.to_date}</td>
                  <td style={{ color: '#7f8c8d', fontSize: 13 }}>
                    {l.reason || '—'}
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
