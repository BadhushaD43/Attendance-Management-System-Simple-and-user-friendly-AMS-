import { useState, useRef, useEffect } from 'react'
import { MdMoreVert } from 'react-icons/md'

export type TagFilter = 'overtime' | 'earlycome' | 'earlyout'

interface ThreeDotMenuProps {
  selectedTags: TagFilter[]
  onChange: (tags: TagFilter[]) => void
}

const options: { id: TagFilter; label: string }[] = [
  { id: 'overtime',  label: 'Overtime' },
  { id: 'earlycome', label: 'Early Come' },
  { id: 'earlyout',  label: 'Early Out' },
]

export default function ThreeDotMenu({ selectedTags, onChange }: ThreeDotMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleToggle = (id: TagFilter) => {
    if (selectedTags.includes(id)) {
      onChange(selectedTags.filter(t => t !== id))
    } else {
      onChange([...selectedTags, id])
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className={`three-dot-btn ${selectedTags.length > 0 ? 'active' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Filter by work tags"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          border: '1.5px solid #dce1e7',
          borderRadius: '8px',
          background: selectedTags.length > 0 ? '#eef2ff' : '#fff',
          borderColor: selectedTags.length > 0 ? 'var(--blue-mid)' : '#dce1e7',
          color: selectedTags.length > 0 ? 'var(--blue-mid)' : 'var(--grey-mid)',
          cursor: 'pointer',
          height: '38px',
          width: '38px',
        }}
      >
        <MdMoreVert size={20} />
      </button>
      {open && (
        <div
          className="three-dot-menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            background: '#fff',
            border: '1.5px solid #dce1e7',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: '160px',
            zIndex: 150,
            overflow: 'hidden',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {options.map(o => {
            const checked = selectedTags.includes(o.id)
            return (
              <label
                key={o.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: 'var(--grey-dark)',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  transition: 'background 0.15s',
                  fontWeight: 500,
                  userSelect: 'none',
                }}
                className="three-dot-option-label"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggle(o.id)}
                  style={{
                    cursor: 'pointer',
                    width: '15px',
                    height: '15px',
                  }}
                />
                <span>{o.label}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
