import { MdClose } from 'react-icons/md'
import type { Employee, DailyAttendance } from '../../types'

function calcHours(inT: string, outT: string): number | null {
  if (!inT || !outT) return null
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const diff = (toMin(outT) - toMin(inT)) / 60
  return diff > 0 ? diff : null
}

function statusBadgeClass(s: string) {
  if (s === 'Present') return 'badge-present'
  if (s === 'Leave')   return 'badge-leave'
  return 'badge-halfday'
}

interface EmpDetailCardProps {
  emp: Employee
  rec: DailyAttendance | undefined
  onClose: () => void
}

export default function EmpDetailCard({ emp, rec, onClose }: EmpDetailCardProps) {
  const hrs = rec ? calcHours(rec.check_in, rec.check_out) : null
  return (
    <div className="emp-detail-card">
      <div className="emp-detail-header">
        <div className="emp-avatar">{emp.name.charAt(0).toUpperCase()}</div>
        <div>
          <h3>{emp.name}</h3>
          <span className="badge badge-overtime">{emp.emp_id}</span>
        </div>
        <button className="modal-close" style={{ marginLeft: 'auto' }} onClick={onClose}>
          <MdClose size={18} />
        </button>
      </div>
      <div className="emp-detail-grid">
        <div><span>Department</span><strong>{emp.department || '—'}</strong></div>
        <div><span>Email</span><strong>{emp.email || '—'}</strong></div>
        <div><span>Phone</span><strong>{emp.phone || '—'}</strong></div>
        <div>
          <span>Status</span>
          <strong>
            {rec ? <span className={`badge ${statusBadgeClass(rec.status)}`}>{rec.status}</span> : '—'}
          </strong>
        </div>
        <div><span>Check In</span><strong>{rec?.check_in || '—'}</strong></div>
        <div><span>Check Out</span><strong>{rec?.check_out || '—'}</strong></div>
        <div><span>Hours Worked</span><strong>{hrs !== null ? `${hrs.toFixed(1)}h` : '—'}</strong></div>
        <div>
          <span>Work Tag</span>
          <strong>
            {rec?.work_tag
              ? <span className={`badge badge-${rec.work_tag}`}>{rec.work_tag}</span>
              : '—'}
          </strong>
        </div>
      </div>
    </div>
  )
}
