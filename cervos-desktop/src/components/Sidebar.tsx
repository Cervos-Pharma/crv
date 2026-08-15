import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../lib/store'

const baseNavItems = [
  { path: '/', icon: 'dashboard', label: 'Dashboard' },
  { path: '/pos', icon: 'point_of_sale', label: 'POS' },
  { path: '/inventory', icon: 'inventory_2', label: 'Inventory' },
  { path: '/settings', icon: 'settings', label: 'Settings' },
]

const adminNavItems = [
  { path: '/reports', icon: 'analytics', label: 'Reports' },
  { path: '/users', icon: 'group', label: 'Users' },
  { path: '/marketplace', icon: 'store', label: 'Marketplace' },
  { path: '/subscription', icon: 'credit_card', label: 'Subscription' },
]

export default function Sidebar() {
  const { currentOperator } = useAuthStore()
  const isAdmin = currentOperator?.role === 'admin'

  return (
    <aside className="w-56 bg-surface-base border-r border-outline-variant flex flex-col shrink-0">
      <div className="h-14 flex items-center px-4 border-b border-outline-variant">
        <span className="material-symbols-outlined text-primary text-2xl mr-2">
          pharmacy
        </span>
        <span className="font-headline font-black text-lg text-on-surface">
          Cervos
        </span>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {baseNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-outline-variant/50'
              }`
            }
          >
            <span className="material-symbols-outlined text-xl">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="my-3 border-t border-outline-variant" />
            {adminNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-outline-variant/50'
                  }`
                }
              >
                <span className="material-symbols-outlined text-xl">
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {currentOperator && (
        <div className="p-3 border-t border-outline-variant">
          <div className="bg-primary/10 rounded-lg p-3">
            <p className="text-xs font-semibold text-primary truncate">{currentOperator.name}</p>
            <p className="text-xs text-on-surface-variant mt-0.5 capitalize">{currentOperator.role}</p>
          </div>
        </div>
      )}
    </aside>
  )
}
