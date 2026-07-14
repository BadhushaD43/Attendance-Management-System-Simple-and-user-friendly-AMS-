import type { ReactNode } from 'react'
import {
  MdDashboard,
  MdPeople,
  MdAccessTime,
  MdUpload,
  MdApartment,
  MdEventNote,
  MdLogout,
  MdAssessment,
} from 'react-icons/md'

type Page = 'dashboard' | 'employees' | 'attendance' | 'upload' | 'departments' | 'leaves' | 'report'

interface LayoutProps {
  children: ReactNode
  currentPage: Page
  onNavigate: (page: Page) => void
  onLogout: () => void
}

const navItems: { id: Page; icon: ReactNode; label: string }[] = [
  { id: 'dashboard', icon: <MdDashboard size={20} />, label: 'Dashboard' },
  { id: 'employees', icon: <MdPeople size={20} />, label: 'Employee List' },
  { id: 'attendance', icon: <MdAccessTime size={20} />, label: 'Attendance' },
  { id: 'departments', icon: <MdApartment size={20} />, label: 'Departments' },
  { id: 'leaves', icon: <MdEventNote size={20} />, label: 'Leave List' },
  { id: 'report', icon: <MdAssessment size={20} />, label: 'Reports' },
  { id: 'upload', icon: <MdUpload size={20} />, label: 'Upload' },
]

export type { Page }

export default function Layout({ children, currentPage, onNavigate, onLogout }: LayoutProps) {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon"><MdAccessTime size={22} /></div>
          <div>
            <h3>Attendance Management System</h3>
            <span>Admin Control</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>
            <MdLogout size={18} /> Logout
          </button>
        </div>
      </aside>
      <div className="main-content">{children}</div>
    </div>
  )
}
