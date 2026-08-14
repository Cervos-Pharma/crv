import { clsx } from "clsx";

interface SidebarProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
}

const navItems = [
  { route: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { route: "/pos", icon: "point_of_sale", label: "POS" },
  { route: "/inventory", icon: "inventory_2", label: "Inventory" },
  { route: "/settings", icon: "settings", label: "Settings" },
];

export default function Sidebar({ currentRoute, onNavigate }: SidebarProps) {
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
        {navItems.map((item) => (
          <button
            key={item.route}
            onClick={() => onNavigate(item.route)}
            className={clsx(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              currentRoute === item.route
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-outline-variant/50"
            )}
          >
            <span className="material-symbols-outlined text-xl">
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-outline-variant">
        <div className="bg-primary/10 rounded-lg p-3">
          <p className="text-xs font-semibold text-primary">Cervos Pharmacy OS</p>
          <p className="text-xs text-on-surface-variant mt-0.5">v0.1.0</p>
        </div>
      </div>
    </aside>
  );
}
