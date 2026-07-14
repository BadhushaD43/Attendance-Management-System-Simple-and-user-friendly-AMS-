import { useState, useRef, useEffect } from 'react'
import { MdSearch, MdCalendarToday, MdMoreVert, MdSave, MdCheckCircle, MdError } from 'react-icons/md'
import EmpDetailCard from '../Components/attendance/EmpDetailCard'
import { attendanceApi } from '../api'
import type { Employee, DailyAttendance } from '../types'

interface AttendanceProps {
  employees: Employee[]
  attendance: DailyAttendance[]
  onUpdateAttendance: (records: DailyAttendance[]) => void
  onAttendanceSaved: (records: DailyAttendance[]) => void
  selectedDate: string
  onDateChange: (date: string) => void
  pendingUploads?: DailyAttendance[]
}

const STANDARD_IN  = '10:00'
const STANDARD_OUT = '18:30'

function toMinutes(t: string): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function calcHours(inT: string, outT: string): number | null {
  if (!inT || !outT) return null
  let outMins = toMinutes(outT)
  const inMins = toMinutes(inT)
  // Handle overnight shift: if checkout is before check-in, assume next day
  if (outMins <= inMins) outMins += 24 * 60
  const diff = (outMins - inMins) / 60
  return diff > 0 ? diff : null
}

function getEarlyInMinutes(inT: string): number {
  if (!inT) return 0
  const diff = toMinutes(STANDARD_IN) - toMinutes(inT)
  return diff > 0 ? diff : 0
}

function getEarlyOutMinutes(outT: string): number {
  if (!outT) return 0
  const diff = toMinutes(STANDARD_OUT) - toMinutes(outT)
  return diff > 0 ? diff : 0
}

function getOvertimeMinutes(outT: string): number {
  if (!outT) return 0
  const diff = toMinutes(outT) - toMinutes(STANDARD_OUT)
  return diff > 0 ? diff : 0
}

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

/* Auto-generate tag string: support comma-separated multiple tags */
export function autoTag(inT: string, outT: string): DailyAttendance['work_tag'] {
  const tags: string[] = []
  if (inT && toMinutes(inT) < toMinutes(STANDARD_IN)) {
    tags.push('earlycome')
  }
  if (outT) {
    if (toMinutes(outT) > toMinutes(STANDARD_OUT)) {
      tags.push('overtime')
    } else if (toMinutes(outT) < toMinutes(STANDARD_OUT)) {
      tags.push('earlyout')
    }
  }
  return (tags.length > 0 ? tags.join(',') : null) as DailyAttendance['work_tag']
}

/* ── Row-level Three-Dot Menu with a sleek premium black theme ── */
interface RowMenuProps {
  rec: DailyAttendance | undefined
  onSelectTags: (tagStr: DailyAttendance['work_tag']) => void
}

function RowThreeDotMenu({ rec, onSelectTags }: RowMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const checkIn = rec?.check_in || ''
  const checkOut = rec?.check_out || ''

  const earlyInMins  = checkIn ? getEarlyInMinutes(checkIn) : 0
  const earlyOutMins = checkOut ? getEarlyOutMinutes(checkOut) : 0
  const overtimeMins = checkOut ? getOvertimeMinutes(checkOut) : 0

  // Split comma-separated tags
  const activeTags = rec?.work_tag ? rec.work_tag.split(',') : []

  const handleToggle = (tag: string) => {
    let nextTags: string[]
    if (activeTags.includes(tag)) {
      nextTags = activeTags.filter(t => t !== tag)
    } else {
      nextTags = [...activeTags, tag]
    }
    onSelectTags(nextTags.length > 0 ? nextTags.join(',') as DailyAttendance['work_tag'] : null)
  }

  const overtimeLabel = overtimeMins > 0 ? `Overtime (${formatMins(overtimeMins)})` : 'Overtime'
  const earlyInLabel  = earlyInMins > 0  ? `Early Come (${formatMins(earlyInMins)})` : 'Early Come'
  const earlyOutLabel = earlyOutMins > 0 ? `Early Out (${formatMins(earlyOutMins)})` : 'Early Out'

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="three-dot-btn"
        onClick={() => setOpen(!open)}
        title="Actions"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          padding: '0',
          border: '1.5px solid #dce1e7',
          borderRadius: '6px',
          background: '#fff',
          cursor: 'pointer',
          color: 'var(--grey-mid)',
        }}
      >
        <MdMoreVert size={18} />
      </button>

      {open && (
        <div
          className="three-dot-menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            background: '#1f2937', // Sleek black dropdown background
            border: '1.5px solid #374151',
            borderRadius: '8px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
            minWidth: '190px',
            zIndex: 150,
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          {/* Overtime option */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              fontSize: '12px',
              color: '#ffffff',
              cursor: 'pointer',
              borderRadius: '6px',
              background: activeTags.includes('overtime') ? '#374151' : 'none',
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={activeTags.includes('overtime')}
              onChange={() => handleToggle('overtime')}
              style={{ cursor: 'pointer' }}
            />
            <span>{overtimeLabel}</span>
          </label>

          {/* Early Come option */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              fontSize: '12px',
              color: '#ffffff',
              cursor: 'pointer',
              borderRadius: '6px',
              background: activeTags.includes('earlycome') ? '#374151' : 'none',
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={activeTags.includes('earlycome')}
              onChange={() => handleToggle('earlycome')}
              style={{ cursor: 'pointer' }}
            />
            <span>{earlyInLabel}</span>
          </label>

          {/* Early Out option */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              fontSize: '12px',
              color: '#ffffff',
              cursor: 'pointer',
              borderRadius: '6px',
              background: activeTags.includes('earlyout') ? '#374151' : 'none',
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={activeTags.includes('earlyout')}
              onChange={() => handleToggle('earlyout')}
              style={{ cursor: 'pointer' }}
            />
            <span>{earlyOutLabel}</span>
          </label>
        </div>
      )}
    </div>
  )
}

export default function Attendance({
  employees,
  attendance,          // DB-confirmed records from App.tsx (read-only here)
  onUpdateAttendance: _onUpdateAttendance,  // kept in interface but not used for every keystroke
  onAttendanceSaved,
  selectedDate,
  onDateChange,
  pendingUploads,
}: AttendanceProps) {
  const [search, setSearch]       = useState('')
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMsg, setSaveMsg]       = useState('')

  // Local editing state — changes here do NOT flow to Dashboard/Report/LeaveList
  const [localRecords, setLocalRecords] = useState<DailyAttendance[]>(attendance)

  // Sync local state when the confirmed DB data changes (loadAll, save, upload)
  // OR when the user switches to a different date
  useEffect(() => {
    // 1. Start with the DB confirmed data for this date
    const merged = [...attendance]
    
    // 2. If there are pending uploads, merge them into the view
    if (pendingUploads && pendingUploads.length > 0) {
      pendingUploads.forEach(r => {
        // Only merge if the upload is meant for the currently viewed date
        if (r.date === selectedDate) {
          const idx = merged.findIndex(a => a.emp_id === r.emp_id && a.date === r.date)
          if (idx >= 0) merged[idx] = r
          else merged.push(r)
        }
      })
    }
    
    setLocalRecords(merged)
  }, [attendance, selectedDate, pendingUploads])

  const getRecord = (empId: string) =>
    localRecords.find(a => a.emp_id === empId && a.date === selectedDate)

  const updateField = (empId: string, field: 'check_in' | 'check_out' | 'status', value: string) => {
    const existing = getRecord(empId)
    const updated: DailyAttendance = existing
      ? { ...existing, [field]: value }
      : { emp_id: empId, date: selectedDate, check_in: '', check_out: '', status: 'Present', work_tag: null, [field]: value }

    const newIn  = field === 'check_in'  ? value : updated.check_in
    const newOut = field === 'check_out' ? value : updated.check_out
    updated.work_tag = autoTag(newIn, newOut)

    // Update LOCAL state only — Dashboard is NOT affected
    setLocalRecords(prev => [
      ...prev.filter(a => !(a.emp_id === empId && a.date === selectedDate)),
      updated,
    ])
  }

  const handleSelectTags = (empId: string, tagStr: DailyAttendance['work_tag']) => {
    const existing = getRecord(empId)
    const updated: DailyAttendance = existing
      ? { ...existing, work_tag: tagStr }
      : { emp_id: empId, date: selectedDate, check_in: '', check_out: '', status: 'Present', work_tag: tagStr }

    setLocalRecords(prev => [
      ...prev.filter(a => !(a.emp_id === empId && a.date === selectedDate)),
      updated,
    ])
  }

  const filteredEmps = employees.filter(e => {
    const matchSearch = !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.emp_id.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })

  // ── Save: persist localRecords to DB, then notify App.tsx to update confirmed state ──
  const handleSave = async () => {
    // Include all records for this date that have been touched:
    // - Present/Half Day: must have check_in
    // - Leave: no check_in required — status alone is enough
    const dayRecords = localRecords.filter(a =>
      a.date === selectedDate && (a.check_in || a.status === 'Leave')
    )
    if (dayRecords.length === 0) {
      setSaveMsg('No records to save. Set status or enter check-in times first.')
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
      return
    }
    setSaveStatus('saving')
    try {
      const payload = dayRecords.map(r => ({
        emp_id:    r.emp_id,
        date:      r.date,
        check_in:  r.check_in  || '',
        check_out: r.check_out || '',
        status:    r.status    || 'Present',
        work_tag:  r.work_tag  || null,
      }))
      await attendanceApi.bulkUpsert(payload as any)
      setSaveMsg(`Saved ${dayRecords.length} record${dayRecords.length !== 1 ? 's' : ''} for ${selectedDate}`)
      setSaveStatus('saved')
      // ✅ Only NOW does Dashboard / Report / LeaveList get updated
      onAttendanceSaved(dayRecords)
    } catch (err: any) {
      setSaveMsg(err.message || 'Save failed')
      setSaveStatus('error')
    } finally {
      setTimeout(() => setSaveStatus('idle'), 3500)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Attendance</h1>
          <p>Track daily check-in, check-out and work hours</p>
        </div>
        <div className="att-date-picker">
          <MdCalendarToday size={16} color="#1e5799" />
          <input
            type="date"
            className="date-input"
            value={selectedDate}
            onChange={e => onDateChange(e.target.value)}
          />
        </div>
      </div>

      {detailEmp && (
        <EmpDetailCard
          emp={detailEmp}
          rec={getRecord(detailEmp.emp_id)}
          onClose={() => setDetailEmp(null)}
        />
      )}

      {/* Table Card */}
      <div className="table-card">
        <div className="table-card-header">
          <h2>
            {selectedDate}&nbsp;·&nbsp;{filteredEmps.length} employee{filteredEmps.length !== 1 ? 's' : ''}
          </h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="search-wrap">
              <MdSearch size={16} className="search-icon" />
              <input
                className="search-input"
                placeholder="Search name or ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
              className="btn-save-att"
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? (
                <span className="btn-save-spinner" />
              ) : (
                <MdSave size={16} />
              )}
              {saveStatus === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Save toast */}
        {saveStatus !== 'idle' && saveStatus !== 'saving' && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 18px',
              background: saveStatus === 'saved' ? '#d5f5e3' : '#fadbd8',
              color:      saveStatus === 'saved' ? '#1e8449'  : '#c0392b',
              fontSize: 13, fontWeight: 600,
              borderBottom: '1px solid',
              borderColor: saveStatus === 'saved' ? '#a9dfbf' : '#f5b7b1',
            }}
          >
            {saveStatus === 'saved'
              ? <MdCheckCircle size={16} />
              : <MdError size={16} />}
            {saveMsg}
          </div>
        )}

        {employees.length === 0 ? (
          <div className="empty-state">No employees found. Add employees from the Employee List page first.</div>
        ) : filteredEmps.length === 0 ? (
          <div className="empty-state">No records match the current filter.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Hours</th>
                {filteredEmps.some(e => getRecord(e.emp_id)?.work_tag?.split(',').includes('overtime')) && <th>Overtime</th>}
                {filteredEmps.some(e => getRecord(e.emp_id)?.work_tag?.split(',').includes('earlycome')) && <th>Early In</th>}
                {filteredEmps.some(e => getRecord(e.emp_id)?.work_tag?.split(',').includes('earlyout')) && <th>Early Out</th>}
                <th>More</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmps.map((emp, i) => {
                const rec           = getRecord(emp.emp_id)
                const currentStatus = rec?.status || 'Present'
                const isLeave       = currentStatus === 'Leave'
                const isDetail      = detailEmp?.id === emp.id

                // Split multiple tags
                const tagsList = rec?.work_tag ? rec.work_tag.split(',') : []

                // Offsets & Hours — always compute when times exist
                const earlyInMins  = !isLeave && rec?.check_in  ? getEarlyInMinutes(rec.check_in)   : 0
                const earlyOutMins = !isLeave && rec?.check_out ? getEarlyOutMinutes(rec.check_out) : 0
                const overtimeMins = !isLeave && rec?.check_out ? getOvertimeMinutes(rec.check_out) : 0
                const hrs          = !isLeave && rec?.check_in && rec?.check_out ? calcHours(rec.check_in, rec.check_out) : null

                return (
                  <tr key={emp.id} style={isDetail ? { background: '#eaf4fb' } : undefined}>
                    <td>{i + 1}</td>
                    <td>
                      <button className="emp-id-link" onClick={() => setDetailEmp(isDetail ? null : emp)}>
                        {emp.emp_id}
                      </button>
                    </td>
                    <td>
                      <button className="emp-id-link" onClick={() => setDetailEmp(isDetail ? null : emp)}>
                        {emp.name}
                      </button>
                    </td>
                    <td>
                      <select
                        className={`att-select att-select-${currentStatus.toLowerCase().replace(' ', '')}`}
                        value={currentStatus}
                        onChange={e => updateField(emp.emp_id, 'status', e.target.value)}
                      >
                        <option value="Present">Present</option>
                        <option value="Half Day">Half Day</option>
                        <option value="Leave">Leave</option>
                      </select>
                    </td>
                    <td>
                      {isLeave ? (
                        <span className="att-leave-dash">—</span>
                      ) : (
                        <input
                          type="time"
                          className="att-time-input"
                          value={rec?.check_in || ''}
                          onChange={e => updateField(emp.emp_id, 'check_in', e.target.value)}
                        />
                      )}
                    </td>
                    <td>
                      {isLeave ? (
                        <span className="att-leave-dash">—</span>
                      ) : (
                        <input
                          type="time"
                          className="att-time-input"
                          value={rec?.check_out || ''}
                          onChange={e => updateField(emp.emp_id, 'check_out', e.target.value)}
                        />
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--grey-dark)' }}>
                        {hrs !== null ? `${hrs.toFixed(1)}h` : '—'}
                      </span>
                    </td>

                    {/* Overtime column — only render when column is visible */}
                    {filteredEmps.some(e => getRecord(e.emp_id)?.work_tag?.split(',').includes('overtime')) && (
                      <td>
                        {!isLeave && tagsList.includes('overtime') ? (
                          <span
                            className="badge badge-overtime"
                            style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '5px', whiteSpace: 'nowrap', fontWeight: 700 }}
                          >
                            {overtimeMins > 0 ? formatMins(overtimeMins) : '—'}
                          </span>
                        ) : (
                          <span style={{ color: '#ccc' }}>—</span>
                        )}
                      </td>
                    )}

                    {/* Early In column — only render when column is visible */}
                    {filteredEmps.some(e => getRecord(e.emp_id)?.work_tag?.split(',').includes('earlycome')) && (
                      <td>
                        {!isLeave && tagsList.includes('earlycome') ? (
                          <span
                            style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '5px', whiteSpace: 'nowrap', background: '#d5f5e3', color: '#1e8449', fontWeight: 700, display: 'inline-block' }}
                          >
                            {earlyInMins > 0 ? formatMins(earlyInMins) : '—'}
                          </span>
                        ) : (
                          <span style={{ color: '#ccc' }}>—</span>
                        )}
                      </td>
                    )}

                    {/* Early Out column — only render when column is visible */}
                    {filteredEmps.some(e => getRecord(e.emp_id)?.work_tag?.split(',').includes('earlyout')) && (
                      <td>
                        {!isLeave && tagsList.includes('earlyout') ? (
                          <span
                            className="badge badge-earlyout"
                            style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '5px', whiteSpace: 'nowrap', fontWeight: 700 }}
                          >
                            {earlyOutMins > 0 ? formatMins(earlyOutMins) : '—'}
                          </span>
                        ) : (
                          <span style={{ color: '#ccc' }}>—</span>
                        )}
                      </td>
                    )}
                    <td>
                      {isLeave ? (
                        <span className="att-leave-dash">—</span>
                      ) : (
                        <RowThreeDotMenu
                          rec={rec}
                          onSelectTags={(tagStr) => handleSelectTags(emp.emp_id, tagStr)}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
