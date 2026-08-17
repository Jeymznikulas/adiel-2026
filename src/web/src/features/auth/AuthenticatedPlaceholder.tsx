import type { Session } from '@supabase/supabase-js'
import { useState } from 'react'
import { AppShell } from '../../components/layout/AppShell'
import { ArchivePage } from '../archive/ArchivePage'
import { ClientsPage } from '../clients/ClientsPage'
import { CollectionsPage } from '../collections/CollectionsPage'
import { ExpensesPage } from '../expenses/ExpensesPage'
import { ItemsPage } from '../items/ItemsPage'
import { LogsPage } from '../logs/LogsPage'
import { PurchaseOrdersPage } from '../purchase-orders/PurchaseOrdersPage'
import { QuotationsPage } from '../quotations/QuotationsPage'
import { SalesTrackerPage } from '../sales/SalesTrackerPage'
import { SettingsPage } from '../settings/SettingsPage'
import { StatementOfAccountPage } from '../statement-of-account/StatementOfAccountPage'
import { SupplierPage } from '../suppliers/SupplierPage'
import { TasksPage } from '../tasks/TasksPage'
import { signOut } from './auth'
import { DashboardPage } from '../dashboard/DashboardPage'

type AuthenticatedPlaceholderProps = {
  session: Session
}

export function AuthenticatedPlaceholder({ session }: AuthenticatedPlaceholderProps) {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const username = session.user.email?.split('@')[0] ?? 'user'

  async function handleSignOut() {
    setIsSigningOut(true)

    try {
      await signOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <AppShell
      username={username}
      isSigningOut={isSigningOut}
      onSignOut={() => void handleSignOut()}
      sectionContent={{
        Tasks: <TasksPage currentUsername={username} />,
        Items: <ItemsPage currentUsername={username} />,
        Quotations: <QuotationsPage currentUsername={username} />,
        'Purchase Orders': <PurchaseOrdersPage currentUsername={username} />,
        'Statements of Account': <StatementOfAccountPage currentUsername={username} />,
        Sales: <SalesTrackerPage />,
        Collections: <CollectionsPage />,
        Expenses: <ExpensesPage currentUsername={username} />,
        Clients: <ClientsPage currentUsername={username} />,
        Suppliers: <SupplierPage currentUsername={username} />,
        Settings: <SettingsPage />,
        Archive: <ArchivePage currentUsername={username} />,
        'Activity Log': <LogsPage />,
      }}
    >
      <DashboardPage username={username} />
    </AppShell>
  )
}

