import React from "react"
import { 
  Inbox, 
  BarChart3, 
  Users2, 
  LogOut, 
  Building2, 
  Settings, 
  ShieldAlert,
  ChevronDown,
  Sun,
  Moon
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from "./ui/Dropdown"

interface MenuItem {
  id: string
  label: string
  icon: React.ComponentType<any>
}

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  isAdmin: boolean
  user: { name: string; department?: string; role?: string } | null
  onSignOut: () => void
  isDark: boolean
  onToggleTheme: () => void
  onOpenSettings?: () => void
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  isAdmin, 
  user, 
  onSignOut,
  isDark,
  onToggleTheme,
  onOpenSettings,
  isOpen = false,
  onClose
}: SidebarProps) {
  const adminMenu: MenuItem[] = [
    { id: "dashboard", label: "Complaints Queue", icon: Inbox },
    { id: "analytics", label: "Analytics & Reports", icon: BarChart3 },
    { id: "officers", label: "Officer Directory", icon: Users2 },
  ]


  const officerMenu: MenuItem[] = [
    { id: "dashboard", label: "My Queue", icon: Inbox },
    { id: "profile", label: "Profile & Settings", icon: Settings },
  ]

  const menuItems = isAdmin ? adminMenu : officerMenu

  return (
    <>
      {/* Sidebar overlay backdrop on mobile */}
      {isOpen && (
        <div 
          onClick={onClose} 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-in fade-in duration-200"
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-card flex flex-col h-screen shrink-0 select-none transition-all duration-300 md:translate-x-0 md:relative md:flex ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
      {/* Context/Project Switcher */}
      <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Building2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-foreground">CivicVoice</h1>
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mt-0.5">
              {isAdmin ? "Super Admin" : "Officer Hub"}
            </span>
          </div>
        </div>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Live" />
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 md:py-2.5 rounded-xl text-sm font-bold transition-all duration-200 relative border ${
                isActive
                  ? "bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/20 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/40 border-transparent"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-blue-500 dark:bg-blue-450" />
              )}
              <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? "text-blue-500 dark:text-blue-400" : "text-zinc-400 dark:text-zinc-500"}`} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Bottom Profile Settings Avatar Dropdown */}
      <div className="p-4 border-t border-border mt-auto bg-zinc-50/30 dark:bg-zinc-950/20">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-left outline-none cursor-pointer border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-800/40">
            <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-600 dark:text-zinc-300 select-none uppercase shadow-inner">
              {user?.name ? user.name.slice(0, 2) : "CV"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate leading-none mb-1">{user?.name || "Civic Officer"}</p>
              <p className="text-xs font-semibold text-zinc-500 truncate leading-none">{user?.department || user?.role || "Operations"}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 mb-2">
            <div className="px-3 py-2">
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold">Logged in as</p>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{user?.name}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => {
                if (onOpenSettings) {
                  onOpenSettings();
                } else {
                  setActiveTab(isAdmin ? "dashboard" : "profile");
                }
              }} 
              className="gap-2 font-semibold cursor-pointer"
            >
              <Settings className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleTheme} className="gap-2 font-semibold cursor-pointer">
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  Light Mode
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  Dark Mode
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10 gap-2 font-bold cursor-pointer">
              <LogOut className="w-4 h-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </aside>
    </>
  )
}
