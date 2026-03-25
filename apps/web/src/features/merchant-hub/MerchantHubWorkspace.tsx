import { useMemo, useState } from 'react'
import type {
  MerchantHubActionsScreenProps,
  MerchantHubHomeScreenProps,
  MerchantHubRoute,
  MerchantHubReviewsScreenProps,
  MerchantHubSettingsScreenProps,
  MerchantHubShellContext,
} from './merchantHubTypes'
import { MerchantHubShell } from './MerchantHubShell'
import { MerchantHubHomeScreen } from './MerchantHubHomeScreen'
import { MerchantHubReviewsScreen } from './MerchantHubReviewsScreen'
import { MerchantHubActionsScreen } from './MerchantHubActionsScreen'
import { MerchantHubSettingsScreen } from './MerchantHubSettingsScreen'

export interface MerchantHubWorkspaceProps {
  shell: Omit<MerchantHubShellContext, 'children' | 'onNavigate'>
  home: MerchantHubHomeScreenProps
  reviews: MerchantHubReviewsScreenProps
  actions: MerchantHubActionsScreenProps
  settings: MerchantHubSettingsScreenProps
  initialView?: MerchantHubRoute
}

export function MerchantHubWorkspace({
  shell,
  home,
  reviews,
  actions,
  settings,
  initialView = 'home',
}: MerchantHubWorkspaceProps) {
  const [activeView, setActiveView] = useState<MerchantHubRoute>(initialView)

  const content = useMemo(() => {
    if (activeView === 'reviews') {
      return <MerchantHubReviewsScreen {...reviews} />
    }

    if (activeView === 'actions') {
      return <MerchantHubActionsScreen {...actions} />
    }

    if (activeView === 'settings') {
      return <MerchantHubSettingsScreen {...settings} />
    }

    return <MerchantHubHomeScreen {...home} />
  }, [actions, activeView, home, reviews, settings])

  return (
    <MerchantHubShell
      {...shell}
      activeView={activeView}
      onNavigate={setActiveView}
    >
      {content}
    </MerchantHubShell>
  )
}
