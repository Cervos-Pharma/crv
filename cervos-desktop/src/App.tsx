import { useState, useEffect } from "react";
import { initDb } from "./lib/database";
import { zf } from "./lib/sync";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Pos from "./pages/Pos";
import Inventory from "./pages/Inventory";
import Settings from "./pages/Settings";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";

type Route =
  | "/onboarding"
  | "/dashboard"
  | "/pos"
  | "/inventory"
  | "/settings";

function Gs(route: Route) {
  window.location.hash = route;
}

function Gu(): Route {
  const hash = window.location.hash.replace(/^#/, "") || "/dashboard";
  const routes: Route[] = [
    "/onboarding",
    "/dashboard",
    "/pos",
    "/inventory",
    "/settings",
  ];
  return routes.includes(hash as Route)
    ? (hash as Route)
    : "/dashboard";
}

function App() {
  const [route, setRoute] = useState<Route>(Gu);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const [activeOperator] = useState<any>(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const init = async () => {
      await initDb();
      const onboarded = await zf();
      setIsOnboarded(onboarded);
      if (!onboarded) {
        setRoute("/onboarding");
      }
    };
    init();

    const handleHashChange = () => {
      setRoute(Gu());
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (isOnboarded === null) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  if (route === "/onboarding" || !isOnboarded) {
    return (
      <Onboarding
        onComplete={() => {
          setIsOnboarded(true);
          setRoute("/dashboard");
        }}
      />
    );
  }

  const showSidebar = ["/dashboard", "/pos", "/inventory", "/settings"].includes(
    route
  );

  return (
    <div className="min-h-screen bg-surface flex">
      {showSidebar && !isLocked && (
        <Sidebar
          currentRoute={route}
          onNavigate={(r) => {
            Gs(r as Route);
            setRoute(r as Route);
          }}
        />
      )}
      <div className="flex-1 flex flex-col">
        <TopBar
          isAdmin={activeOperator?.role === "admin"}
          activeOperator={activeOperator}
          onLock={() => setIsLocked(true)}
        />
        <main className="flex-1 overflow-auto">
          {route === "/dashboard" && <Dashboard />}
          {route === "/pos" && (
            <Pos
              activeOperator={activeOperator}
              onSaleComplete={() => {}}
            />
          )}
          {route === "/inventory" && <Inventory />}
          {route === "/settings" && (
            <Settings
              onLogout={() => {
                setIsOnboarded(false);
                setRoute("/onboarding");
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
