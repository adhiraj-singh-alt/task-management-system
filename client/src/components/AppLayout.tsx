import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, CheckSquare, ListTodo, LogOut } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "Tasks", icon: ListTodo, end: true },
  { to: "/reports", label: "Reports", icon: BarChart3, end: false },
];

/** Authenticated app shell: top bar with branding, nav, user, and sign-out. */
export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="bg-muted/30 min-h-svh">
      <header className="bg-background sticky top-0 z-10 border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <CheckSquare className="text-primary size-5" />
              <span>TaskFlow</span>
            </div>
            <nav className="flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    )
                  }
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden text-right sm:block">
              <div className="font-medium leading-tight">{user?.name}</div>
              <div className="text-muted-foreground text-xs">{user?.role}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
