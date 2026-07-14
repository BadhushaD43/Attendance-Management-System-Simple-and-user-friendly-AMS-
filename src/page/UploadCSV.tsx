import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { MdUploadFile, MdCheckCircle, MdClose, MdCalendarToday } from 'react-icons/md'
import type { AttendanceRecord } from '../types'

interface UploadProps {
  onUpload: (records: AttendanceRecord[], targetDate: string) => void
}

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function normalizeStatus(raw: string): AttendanceRecord['status'] {
  const v = (raw || '').trim().toLowerCase()
  if (v === 'p' || v === 'present')                     return 'Present'
  if (v === 'l' || v === 'leave')                       return 'Leave'
  if (v === 'h' || v === 'half day' || v === 'halfday') return 'Half Day'
  if (v === 'a' || v === 'absent')                      return 'Leave'
  return 'Present'
}

function formatToISODate(rawDate: string): string {
  let clean = (rawDate || '').trim()
  if (!clean) return ''
  clean = clean.split(/[ T]/)[0]
  const parts = clean.split(/[-/]/)
  if (parts.length === 3) {
    let y = parts[0], m = parts[1], d = parts[2]
    if (parts[2].length === 4) { y = parts[2]; m = parts[1]; d = parts[0] }
    const year = y.length === 2 ? `20${y}` : y
    const monthVal = Number(m), dayVal = Number(d)
    let month = String(monthVal).padStart(2, '0')
    let day   = String(dayVal).padStart(2, '0')
    if (monthVal > 12 && dayVal <= 12) { month = String(dayVal).padStart(2, '0'); day = String(monthVal).padStart(2, '0') }
    const ny = Number(year), nm = Number(month), nd = Number(day)
    if (!isNaN(ny) && !isNaN(nm) && !isNaN(nd) && nm >= 1 && nm <= 12 && nd >= 1 && nd <= 31)
      return `${year}-${month}-${day}`
  }
  return clean
}

// Convert any raw Excel value → "HH:MM" 24-hour string
function formatToTimeStr(rawTime: any): string {
  if (rawTime === null || rawTime === undefined || rawTime === '') return ''

  const num = Number(rawTime)

  // Excel raw time fraction: 0.0 = 00:00, 0.708333 = 17:00, 0.770833 = 18:30
  if (!isNaN(num) && num >= 0 && num < 1) {
    const totalMins = Math.round(num * 24 * 60)
    return `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`
  }

  // Excel combined date+time (e.g. 46207.770833) — extract time fraction only
  if (!isNaN(num) && num > 1) {
    const frac = num - Math.floor(num)
    if (frac > 0.0001) {
      const totalMins = Math.round(frac * 24 * 60)
      return `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`
    }
    return ''
  }

  // String fallback: "10:00 AM", "6:30 PM", "18:30", "10:00"
  const clean = String(rawTime).trim()
  if (!clean) return ''

  const ampm = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)/i)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = ampm[2]
    const p = ampm[3].replace(/\./g, '').toLowerCase()
    if (p === 'am') { if (h === 12) h = 0 } else { if (h !== 12) h += 12 }
    return `${String(h).padStart(2, '0')}:${m}`
  }

  const hhmm = clean.match(/^(\d{1,2}):(\d{2})/)
  if (hhmm) return `${hhmm[1].padStart(2, '0')}:${hhmm[2]}`

  return ''
}

function normalizeRow(row: Record<string, any>): AttendanceRecord | null {
  const name = row['emp_name'] || row['Emp Name'] || row['Employee Name'] || row['Name'] || ''
  if (!String(name).trim()) return null

  // Parse date — raw numeric serial or formatted string
  let date = ''
  const dateRaw = row['date'] || row['Date'] || ''
  const dateNum = Number(dateRaw)
  if (!isNaN(dateNum) && dateNum > 1) {
    // Excel serial date (e.g. 46207 = 2026-07-12) — Math.floor strips time portion
    const jsDate = XLSX.SSF.parse_date_code(Math.floor(dateNum))
    if (jsDate) date = `${jsDate.y}-${String(jsDate.m).padStart(2, '0')}-${String(jsDate.d).padStart(2, '0')}`
  } else if (dateRaw) {
    date = formatToISODate(String(dateRaw).split(/[ T]/)[0])
  }

  return {
    emp_name:       String(name).trim(),
    check_in_time:  formatToTimeStr(row['check_in_time']  ?? row['Check In']  ?? row['check_in']  ?? row['CheckIn']  ?? ''),
    check_out_time: formatToTimeStr(row['check_out_time'] ?? row['Check Out'] ?? row['check_out'] ?? row['CheckOut'] ?? ''),
    status:         normalizeStatus(String(row['today'] ?? row['Status'] ?? row['status'] ?? row['Today'] ?? '')),
    date,
  }
}

export default function UploadCSV({ onUpload }: UploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview]       = useState<AttendanceRecord[]>([])
  const [error, setError]           = useState('')
  const [fileName, setFileName]     = useState('')
  const [uploaded, setUploaded]     = useState(false)
  const [targetDate, setTargetDate] = useState(todayLocal)  // default = today

  const parseFile = (file: File) => {
    setError('')
    setUploaded(false)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array', cellDates: false })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        // raw: true → actual numeric values (time fractions & date serials), not display strings
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: true })
        const records = rows.map(r => normalizeRow(r)).filter(Boolean) as AttendanceRecord[]
        if (records.length === 0) {
          setError('No valid records found. Ensure columns: emp_name, check_in_time, check_out_time, today')
          setPreview([])
          return
        }

        // Strictly enforce that if the Excel file contains a date, it matches the Target Date
        const mismatched = records.find(r => r.date && r.date !== targetDate)
        if (mismatched) {
          setError(`Date mismatch! The Excel file has data for ${mismatched.date}, but the target date is ${targetDate}. Please change the target date first, then upload the file again.`)
          setPreview([])
          if (inputRef.current) inputRef.current.value = ''
          return
        }

        setFileName(file.name)
        setPreview(records)
      } catch {
        setError('Failed to read file. Please upload a valid Excel or CSV file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleCommit = () => {
    if (!targetDate) { setError('Please select a target date before uploading.'); return }
    onUpload(preview, targetDate)
    setUploaded(true)
  }

  const handleClear = () => {
    setPreview([])
    setFileName('')
    setError('')
    setUploaded(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const isToday = targetDate === todayLocal()

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Upload Attendance</h1>
          <p>Import attendance data via Excel (.xlsx, .xls) or CSV (.csv)</p>
        </div>
        {preview.length === 0 && (
          <div>
            <button className="btn-add" onClick={() => inputRef.current?.click()}>
              <MdUploadFile size={18} /> Select Excel / CSV File
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && parseFile(e.target.files[0])}
            />
          </div>
        )}
      </div>

      {/* ── Target Date Picker ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: '#fff', border: '1.5px solid #dce1e7', borderRadius: 10,
        padding: '14px 20px', marginBottom: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}>
        <MdCalendarToday size={20} color="#4f46e5" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>Upload Target Date</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            All records will be saved under this date — change to upload old attendance data
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {isToday && (
            <span style={{ fontSize: 11, fontWeight: 700, background: '#d5f5e3', color: '#1e8449', padding: '3px 10px', borderRadius: 20 }}>
              Today
            </span>
          )}
          <input
            type="date"
            className="date-input"
            value={targetDate}
            max={todayLocal()}
            onChange={e => {
              setTargetDate(e.target.value)
              handleClear()
            }}
            style={{ fontWeight: 600 }}
          />
        </div>
      </div>

      <div className="upload-hint-box">
        <strong>Short-code support in <code>today</code> column:</strong>
        <div className="upload-hint-codes">
          <span className="badge badge-present">P = Present</span>
          <span className="badge badge-leave">L = Leave</span>
          <span className="badge badge-halfday">H = Half Day</span>
        </div>
        <p style={{ marginTop: 8, fontSize: 12, color: '#7f8c8d' }}>
          Required columns: <code>emp_name</code>, <code>check_in_time</code>, <code>check_out_time</code>, <code>today</code>
          &nbsp;— the <em>date picker above</em> sets the upload date (no date column needed in Excel).
        </p>
      </div>

      {error && <p className="error-msg" style={{ marginTop: 16 }}>{error}</p>}

      {preview.length > 0 && (
        <div className="table-card" style={{ marginTop: 20 }}>
          <div className="table-card-header" style={{ borderBottom: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MdCheckCircle color="#27ae60" size={18} />
              <h2>
                {fileName} — {preview.length} record{preview.length !== 1 ? 's' : ''} ready
                &nbsp;for <strong>{targetDate}</strong>
                {isToday && <span style={{ fontSize: 11, fontWeight: 700, background: '#d5f5e3', color: '#1e8449', padding: '2px 8px', borderRadius: 20, marginLeft: 8 }}>Today</span>}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {uploaded ? (
                <span className="badge badge-present" style={{ padding: '6px 14px', fontSize: 13 }}>
                  ✓ Saved to Attendance
                </span>
              ) : (
                <button className="btn-add" style={{ background: '#27ae60' }} onClick={handleCommit}>
                  <MdUploadFile size={16} /> Upload to Attendance
                </button>
              )}
              <button
                className="modal-close"
                style={{ border: '1.5px solid #dce1e7', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={handleClear}
                title="Clear and upload another file"
              >
                <MdClose size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
