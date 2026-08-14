import { useState, useEffect } from "react";
import { np } from "../lib/sync";
import type { DashboardStats } from "../types";

interface TopBarProps {
  isAdmin: boolean;
  activeOperator: any;
  onLock: () => void;
}

export default function TopBar({
  activeOperator,
  onLock,
}: TopBarProps) {
  const [stats, setStats] = useState<DashboardStats>({
    linked: false,
    pendingCount: 0,
    lastSyncedAt: null,
    isSyncing: false,
  });
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      const s = await np();
      setStats(s);
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 bg-surface-base border-b border-outline-variant/60 flex items-center justify-between px-6 shrink-0 relative">
      <div className="text-sm text-on-surface-variant">
        Welcome back —{" "}
        <span className="font-semibold text-on-surface">Cervos POS</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex items-center gap-2 text-xs text-on-surface-variant">
          <span
            className={`w-2 h-2 rounded-full ${
              stats.linked ? "bg-secondary animate-pulse" : "bg-error"
            }`}
          />
          {stats.linked ? "Linked" : "Offline"}
        </span>

        {stats.pendingCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {stats.pendingCount} pending
          </span>
        )}

        {stats.lastSyncedAt && (
          <span className="text-xs text-on-surface-variant">
            Last sync: {new Date(stats.lastSyncedAt).toLocaleTimeString()}
          </span>
        )}

        {activeOperator && (
          <button
            onClick={onLock}
            title="Lock the terminal"
            className="p-2 rounded-lg hover:bg-outline-variant/50 transition-colors"
          >
            <span className="material-symbols-outlined text-xl text-on-surface-variant">
              lock
            </span>
          </button>
        )}

        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="p-2 rounded-lg hover:bg-outline-variant/50 transition-colors relative"
        >
          <span className="material-symbols-outlined text-xl text-on-surface-variant">
            notifications
          </span>
        </button>
      </div>
    </header>
  );
}
