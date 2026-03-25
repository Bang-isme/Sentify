import {
  getAdminHubDomainFromView,
  type AdminHubViewKey,
} from '../adminHub.data'
import { AdminHubDomainScreen } from '../screens/AdminHubDomainScreen'
import { AdminHubHomeScreen } from '../screens/AdminHubHomeScreen'

interface AdminHubViewProps {
  activeView: AdminHubViewKey
  onNavigate?: (view: AdminHubViewKey) => void
}

export function AdminHubView({ activeView, onNavigate }: AdminHubViewProps) {
  if (activeView === 'home') {
    return <AdminHubHomeScreen activeView={activeView} onNavigate={onNavigate} />
  }

  return (
    <AdminHubDomainScreen
      domainKey={getAdminHubDomainFromView(activeView)}
      activeView={activeView}
      onNavigate={onNavigate}
    />
  )
}
