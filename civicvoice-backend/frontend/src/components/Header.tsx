import React from "react"
import { 
  ChevronRight, 
  ChevronDown,
  Filter, 
  MapPin, 
  X,
  SlidersHorizontal,
  FolderOpen,
  Menu
} from "lucide-react"

interface HeaderProps {
  activeTab: string
  statusFilter: string
  setStatusFilter: (status: string) => void
  viewFilter?: string
  setViewFilter?: (view: string) => void
  activeWardFilter: { id: string; name: string } | null
  clearWardFilter: () => void
  isAdmin: boolean
  onMenuClick?: () => void
}

export default function Header({
  activeTab,
  statusFilter,
  setStatusFilter,
  viewFilter,
  setViewFilter,
  activeWardFilter,
  clearWardFilter,
  isAdmin,
  onMenuClick
}: HeaderProps) {

  const getBreadcrumb = () => {
    switch (activeTab) {
      case "dashboard":
        return "Complaints Queue"
      case "analytics":
        return "Analytics & Reports"
      case "officers":
        return "Officer Directory"
      case "profile":
        return "Profile Settings"
      default:
        return "Overview"
    }
  }

  return (
    <header className="h-16 border-b border-border bg-card/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none transition-colors duration-200">
      {/* Breadcrumb Navigation - Desktop */}
      <div className="hidden sm:flex items-center gap-2 text-sm">
        <button 
          onClick={onMenuClick}
          className="p-1.5 rounded-lg border border-border bg-card hover:bg-zinc-100 dark:hover:bg-zinc-900 text-foreground md:hidden mr-1 shadow-sm h-10 w-10 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-zinc-550 font-semibold hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer">Console</span>
        <ChevronRight className="w-4 h-4 text-zinc-650" />
        <span className="text-foreground font-bold tracking-tight">{getBreadcrumb()}</span>
      </div>

      {/* Breadcrumb Navigation - Mobile */}
      <div className="flex sm:hidden items-center gap-2 text-sm min-w-0 flex-1 mr-2">
        <button 
          onClick={onMenuClick}
          className="p-1.5 rounded-lg border border-border bg-card hover:bg-zinc-100 dark:hover:bg-zinc-900 text-foreground shadow-sm h-10 w-10 flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-foreground font-bold tracking-tight truncate text-sm">{getBreadcrumb()}</span>
      </div>

      {/* Ward Filter Active Pill */}
      {activeWardFilter && (
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1.5 rounded-full text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-150 shrink-0 mr-2 max-w-[150px] sm:max-w-none truncate">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Ward: {activeWardFilter.name}</span>
          <button onClick={clearWardFilter} className="hover:text-blue-200 transition-colors ml-1 focus:outline-none shrink-0 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Global Actions Panel */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {activeTab === "dashboard" && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <SlidersHorizontal className="w-4 h-4 text-zinc-550 mr-1 hidden xs:inline" />
            
            {/* View Filter (Admin only) */}
            {isAdmin && setViewFilter && (
              <div className="relative flex items-center shrink-0">
                <select
                  value={viewFilter}
                  onChange={(e) => setViewFilter(e.target.value)}
                  className="bg-card border border-border rounded-lg text-xs sm:text-sm font-bold text-foreground pl-3 pr-7 sm:pr-8 py-2.5 sm:py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-all cursor-pointer appearance-none bg-zinc-50/20 dark:bg-zinc-900/10 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 h-10"
                >
                  <option className="bg-card text-foreground py-2 font-semibold" value="active">Active Complaints</option>
                  <option className="bg-card text-foreground py-2 font-semibold" value="deleted">Deleted Complaints</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 pointer-events-none" />
              </div>
            )}

            {/* Status Filter */}
            <div className="relative flex items-center shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-card border border-border rounded-lg text-xs sm:text-sm font-bold text-foreground pl-3 pr-7 sm:pr-8 py-2.5 sm:py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-all cursor-pointer appearance-none bg-zinc-50/20 dark:bg-zinc-900/10 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 h-10"
              >
                <option className="bg-card text-foreground py-2 font-semibold" value="">All Statuses</option>
                <option className="bg-card text-foreground py-2 font-semibold" value="received">Received</option>
                <option className="bg-card text-foreground py-2 font-semibold" value="in_progress">In Progress</option>
                <option className="bg-card text-foreground py-2 font-semibold" value="resolved">Resolved</option>
                <option className="bg-card text-foreground py-2 font-semibold" value="needsClarification">Needs Details</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2.5 pointer-events-none" />
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
