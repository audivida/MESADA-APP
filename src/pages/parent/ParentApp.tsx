import { useState } from 'react'
import { useStore } from '../../app/store'
import { TabBar, type Tab } from '../../components/ui'
import { Approvals } from './Approvals'
import { FamilyPage } from './FamilyPage'
import { Overview } from './Overview'
import { RewardsPage } from './RewardsPage'
import { TasksPage } from './TasksPage'

type TabId = 'home' | 'approve' | 'tasks' | 'rewards' | 'family'

export function ParentApp() {
  const { data } = useStore()
  const [tab, setTab] = useState<TabId>('home')
  if (!data) return <div className="loading">Carregando…</div>
  const pending = data.executions.filter((e) => e.status === 'pending').length
  const requests = data.redemptions.filter((r) => r.status === 'pending').length

  const tabs: Tab<TabId>[] = [
    { id: 'home', label: 'Início', icon: '🏠' },
    { id: 'approve', label: 'Aprovar', icon: '✅', badge: pending },
    { id: 'tasks', label: 'Tarefas', icon: '📋' },
    { id: 'rewards', label: 'Prêmios', icon: '🎁', badge: requests },
    { id: 'family', label: 'Família', icon: '👨‍👩‍👧' },
  ]

  return (
    <div className="shell">
      <header className="topbar">
        <span className="eyebrow">{data.family.name}</span>
      </header>
      <main className="content" key={tab}>
        {tab === 'home' && <Overview goApprove={() => setTab('approve')} goRewards={() => setTab('rewards')} goFamily={() => setTab('family')} />}
        {tab === 'approve' && <Approvals />}
        {tab === 'tasks' && <TasksPage />}
        {tab === 'rewards' && <RewardsPage />}
        {tab === 'family' && <FamilyPage />}
      </main>
      <TabBar<TabId> tabs={tabs} current={tab} onChange={setTab} />
    </div>
  )
}
