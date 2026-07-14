interface StatusBadgeProps {
  status: string
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cls =
    status === 'Present'  ? 'badge-present'  :
    status === 'Leave'    ? 'badge-leave'    :
    'badge-halfday'
  return <span className={`badge ${cls}`}>{status}</span>
}
