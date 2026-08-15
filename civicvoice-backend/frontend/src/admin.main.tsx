import React, { useState, useEffect } from "react"
import ReactDOM from "react-dom/client"
import { motion, AnimatePresence } from "framer-motion"
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react"

import "./index.css"
import Sidebar from "./components/Sidebar"
import Header from "./components/Header"
import StatsGrid from "./components/StatsGrid"
import QueueView from "./components/QueueView"
import AnalyticsView from "./components/AnalyticsView"
import OfficersView from "./components/OfficersView"
import SettingsDialog from "./components/SettingsDialog"

// Read credentials from URL
const params = new URLSearchParams(window.location.search)
const token = params.get("token") || ""
const initialRole = params.get("role") || "admin"

if (!token) {
  window.location.replace("/index.html?openLogin=true")
}

// Decode JWT payload helper
function decodeJwtPayload(tokenVal: string) {
  if (!tokenVal) return null
  try {
    const payload = tokenVal.split(".")[1]
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch (e) {
    return null
  }
}

const decoded = decodeJwtPayload(token)
const currentUser = decoded
  ? { name: decoded.name || "Administrator", role: decoded.role || "admin" }
  : { name: "Administrator", role: "admin" }

export default function AdminApp() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [statusFilter, setStatusFilter] = useState("")
  const [viewFilter, setViewFilter] = useState("active")
  const [activeWardFilter, setActiveWardFilter] = useState<{ id: string; name: string } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("theme") === "dark"
  })

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
    localStorage.setItem("theme", isDark ? "dark" : "light")
  }, [isDark])

  // Data States
  const [complaints, setComplaints] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, received: 0, inProgress: 0, resolved: 0 })
  const [cachedWards, setCachedWards] = useState<any[]>([])
  const [cachedOfficers, setCachedOfficers] = useState<any[]>([])
  const [analytics, setAnalytics] = useState<any>(null)

  // Loading States
  const [loadingComplaints, setLoadingComplaints] = useState(true)
  const [loadingOfficers, setLoadingOfficers] = useState(false)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  // Modal / Feedback State
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [toasts, setToasts] = useState<{ id: string; text: string; type: "success" | "error" }[]>([])

  const [showSettings, setShowSettings] = useState(false)

  // Show toast notification helper
  const showToast = (text: string, type: "success" | "error" = "success") => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, text, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  // Load Wards
  useEffect(() => {
    async function loadWards() {
      try {
        const res = await fetch("/api/admin/wards", {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setCachedWards(data.wards || [])
        } else if (res.status === 401) {
          window.location.replace("/index.html?openLogin=true")
        }
      } catch (err) {
        console.error("Error loading wards:", err)
      }
    }
    if (token) {
      loadWards()
    }
  }, [token])

  // Load Officers helper
  const loadOfficers = async () => {
    setLoadingOfficers(true)
    try {
      const res = await fetch("/api/admin/officers", {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setCachedOfficers(data.officers || [])
      } else if (res.status === 401) {
        window.location.replace("/index.html?openLogin=true")
      }
    } catch (err) {
      console.error("Error loading officers:", err)
    } finally {
      setLoadingOfficers(false)
    }
  }

  useEffect(() => {
    if (token) {
      loadOfficers()
    }
  }, [token])

  // Load Complaints Queue
  const loadComplaints = async () => {
    setLoadingComplaints(true)
    let queryParams: string[] = []
    if (statusFilter) queryParams.push(`status=${encodeURIComponent(statusFilter)}`)
    if (viewFilter === "deleted") queryParams.push("showDeleted=true")
    if (activeWardFilter) queryParams.push(`wardId=${encodeURIComponent(activeWardFilter.id)}`)
    
    const query = queryParams.length ? `?${queryParams.join("&")}` : ""
    try {
      const response = await fetch(`/api/complaints${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        const fetched = data.complaints || []
        setComplaints(fetched)

        // Compile KPI Stats
        setStats({
          total: data.total || fetched.length,
          received: fetched.filter((c: any) => c.status === "received").length,
          inProgress: fetched.filter((c: any) => c.status === "in_progress").length,
          resolved: fetched.filter((c: any) => c.status === "resolved").length
        })
      } else if (response.status === 401) {
        window.location.replace("/index.html?openLogin=true")
      } else {
        showToast("Failed to fetch complaints queue", "error")
      }
    } catch (err) {
      console.error(err)
      showToast("Network error reading complaints", "error")
    } finally {
      setLoadingComplaints(false)
    }
  }

  useEffect(() => {
    if (token) {
      loadComplaints()
    }
  }, [statusFilter, viewFilter, activeWardFilter])

  // Load Analytics
  const loadAnalytics = async () => {
    setLoadingAnalytics(true)
    try {
      const res = await fetch("/api/admin/analytics", {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setAnalytics(data)
      }
    } catch (err) {
      console.error("Error loading analytics:", err)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  useEffect(() => {
    if (activeTab === "analytics" && token) {
      loadAnalytics()
    }
  }, [activeTab])

  // Action Operations
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/complaints/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        showToast(`Complaint status updated to ${newStatus}`)
        loadComplaints()
      } else {
        const err = await res.json().catch(() => ({}))
        showToast(err.message || "Failed to update status", "error")
      }
    } catch (err) {
      showToast("Network error updating status", "error")
    }
  }

  const handleCorrectWard = async (id: string, wardId: string | null) => {
    try {
      const res = await fetch(`/api/complaints/${id}/ward`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ wardId })
      })
      if (res.ok) {
        showToast("Ward corrected successfully")
        loadComplaints()
      } else {
        const err = await res.json().catch(() => ({}))
        showToast(err.message || "Failed to correct ward", "error")
      }
    } catch (err) {
      showToast("Network error correcting ward", "error")
    }
  }

  const handleAssignOfficer = async (id: string, officerId: string | null) => {
    try {
      const res = await fetch(`/api/complaints/${id}/assign`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ officerId })
      })
      if (res.ok) {
        showToast("Officer assigned successfully")
        loadComplaints()
      } else {
        const err = await res.json().catch(() => ({}))
        showToast(err.message || "Failed to assign officer", "error")
      }
    } catch (err) {
      showToast("Network error assigning officer", "error")
    }
  }

  const handleDeleteComplaint = async (id: string) => {
    try {
      const res = await fetch(`/api/complaints/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        showToast("Complaint deleted successfully")
        loadComplaints()
      } else {
        const err = await res.json().catch(() => ({}))
        showToast(err.message || "Failed to delete complaint", "error")
      }
    } catch (err) {
      showToast("Network error deleting complaint", "error")
    }
  }

  const handleAddOfficer = async (data: any) => {
    const res = await fetch("/api/admin/officers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || "Failed to create officer")
    }
    const result = await res.json()
    showToast(`Officer registered successfully!`)
    loadOfficers()
    return result.password
  }

  const handleToggleOfficerStatus = async (officerId: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/officers/${officerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ active: !currentActive })
      })
      if (res.ok) {
        showToast("Officer status updated successfully")
        loadOfficers()
      } else {
        const err = await res.json().catch(() => ({}))
        showToast(err.message || "Failed to update officer status", "error")
      }
    } catch (err) {
      showToast("Network error updating status", "error")
    }
  }

  const handleDeleteOfficer = async (officerId: string) => {
    try {
      const res = await fetch(`/api/officers/${officerId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        showToast("Officer deleted successfully")
        loadOfficers()
      } else {
        const err = await res.json().catch(() => ({}))
        showToast(err.message || "Failed to delete officer", "error")
      }
    } catch (err) {
      showToast("Network error deleting officer", "error")
    }
  }


  const handleChangePassword = async (officerId: string, newPass: string) => {
    const res = await fetch(`/api/admin/officers/${officerId}/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || "Failed to reset password")
    }
    const data = await res.json()
    showToast(`Password reset successful! Temp: ${data.password}`)
    return data.password // Return plaintext generated password to caller
  }

  const handleFilterByWard = (wardId: string, wardName: string) => {
    setActiveWardFilter({ id: wardId, name: wardName })
    setActiveTab("dashboard")
  }

  const handleSignOut = () => {
    window.location.replace("/index.html")
  }

  return (
    <div className="flex bg-background text-foreground min-h-screen">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab)
          setSidebarOpen(false)
        }}
        isAdmin={true}
        user={currentUser}
        onSignOut={handleSignOut}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onOpenSettings={() => setShowSettings(true)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header Bar */}
        <Header
          activeTab={activeTab}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          viewFilter={viewFilter}
          setViewFilter={setViewFilter}
          activeWardFilter={activeWardFilter}
          clearWardFilter={() => setActiveWardFilter(null)}
          isAdmin={true}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Content Container */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
          
          {/* Dashboard specific overview KPI statistics */}
          {activeTab === "dashboard" && (
            <StatsGrid stats={stats} />
          )}

          {/* Subviews switcher */}
          <div className="mt-4">
            {activeTab === "dashboard" && (
              <QueueView
                complaints={complaints}
                isAdmin={true}
                cachedWards={cachedWards}
                cachedOfficers={cachedOfficers}
                onUpdateStatus={handleUpdateStatus}
                onCorrectWard={handleCorrectWard}
                onAssignOfficer={handleAssignOfficer}
                onDeleteComplaint={handleDeleteComplaint}
                onShowLightbox={setLightboxUrl}
                loading={loadingComplaints}
              />
            )}

            {activeTab === "analytics" && (
              <AnalyticsView
                analytics={analytics}
                onFilterByWard={handleFilterByWard}
                loading={loadingAnalytics}
                token={token}
              />
            )}

            {activeTab === "officers" && (
              <OfficersView
                officers={cachedOfficers}
                wards={cachedWards}
                onAddOfficer={handleAddOfficer}
                onChangePassword={handleChangePassword}
                onToggleStatus={handleToggleOfficerStatus}
                onDeleteOfficer={handleDeleteOfficer}
                token={token}
                loading={loadingOfficers}
              />
            )}
          </div>
        </main>
      </div>

      {/* Global Image Lightbox Modal */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="relative max-w-4xl max-h-[80vh] overflow-hidden rounded-xl border border-zinc-800 shadow-2xl"
            >
              <img src={lightboxUrl} alt="Enlarged preview" className="object-contain max-w-full max-h-[80vh]" />
            </motion.div>
            <button 
              onClick={() => setLightboxUrl(null)} 
              className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-sm font-bold text-zinc-300 rounded-lg hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors"
            >
              Close Preview <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        isAdmin={true}
        user={currentUser}
        token={token}
        onShowToast={showToast}
      />

      {/* Global Action Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              className={`p-3.5 rounded-xl border flex items-center gap-2.5 shadow-xl text-sm font-bold pointer-events-auto min-w-[200px] ${
                t.type === "success" 
                  ? "bg-zinc-900 border-zinc-800 text-zinc-200" 
                  : "bg-red-500/10 border-red-500/25 text-red-400"
              }`}
            >
              {t.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span className="flex-1">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Render the application
const rootEl = document.getElementById("root")
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <AdminApp />
    </React.StrictMode>
  )
}
