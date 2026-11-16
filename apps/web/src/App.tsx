import { useState } from 'react'
import { Route, Routes } from 'react-router'
import { BootScreen } from './components/brand/BootScreen'
import { AppShell } from './components/layout/AppShell'
import { PageHeader } from './components/ui/PageHeader'
import { PLANNED_ITEMS } from './config/nav'
import { Dashboard } from './pages/Dashboard'
import { PlannedPage } from './pages/PlannedPage'

export default function App() {
  const [booted, setBooted] = useState(() => sessionStorage.getItem('meridian-booted') === '1')

  return (
    <>
      {!booted && (
        <BootScreen
          onFinish={() => {
            sessionStorage.setItem('meridian-booted', '1')
            setBooted(true)
          }}
        />
      )}
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          {PLANNED_ITEMS.map((item) => (
            <Route key={item.path} path={item.path} element={<PlannedPage item={item} />} />
          ))}
          <Route
            path="*"
            element={
              <div className="mx-auto max-w-4xl p-6 lg:p-8">
                <PageHeader title="Page not found" description="That address doesn't exist in Meridian." />
              </div>
            }
          />
        </Route>
      </Routes>
    </>
  )
}