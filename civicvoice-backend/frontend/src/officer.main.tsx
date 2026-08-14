import React, { useState, useEffect } from "react"
import ReactDOM from "react-dom/client"
import { motion, AnimatePresence } from "framer-motion"
import { AlertCircle, CheckCircle2, Loader2, X, Eye, EyeOff, KeyRound } from "lucide-react"

import "./index.css"
import Sidebar from "./components/Sidebar"
import Header from "./components/Header"
import StatsGrid from "./components/StatsGrid"
import QueueView from "./components/QueueView"
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/Card"
import { Button } from "./components/ui/Button"
import SettingsDialog from "./components/SettingsDialog"

// Read credentials from URL
const params = new URLSearchParams(window.location.search)
const token = params.get("token") || ""

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
  ? { name: decoded.name || "Civic Officer", department: decoded.department || "Operations", role: "officer" }
  : { name: "Civic Officer", department: "Operations", role: "officer" }

export default function OfficerApp() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [statusFilter, setStatusFilter] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("theme") !== "light"
  })

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
    localStorage.setItem("theme", isDark ? "dark" : "light")
  }, [isDark])

  // Data States
  const [complaints, setComplaints] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, received: 0, inProgress: 0, resolved: 0 })
  const [cachedWards, setCachedWards] = useState<any[]>([])

  // Loading States
  const [loadingComplaints, setLoadingComplaints] = useState(true)

  // Profile Password Form State
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showOldPass, setShowOldPass] = useState(false)
  const [showNewPass, setShowNewPass] = useState(false)
  const [isUpdatingPass, setIsUpdatingPass] = useState(false)
  const [passFeedback, setPassFeedback] = useState<{ text: string; isError: boolean } | null>(null)

  // Modal / Feedback State
  const [showSettings, setShowSettings] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [toasts, setToasts] = useState<{ id: string; text: string; type: "success" | "error" }[]>([])

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
        const res = await fetch("/api/officer/wards", {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setCachedWards(data.wards || [])
        }
      } catch (err) {
        console.error("Error loading officer wards:", err)
      }
    }
    loadWards()
  }, [])

  // Load Assigned Complaints
  const loadComplaints = async () => {
    setLoadingComplaints(true)
    const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ""
    try {
      const response = await fetch(`/api/officer/complaints${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        const fetched = data.complaints || []
        setComplaints(fetched)

        // Compile KPI Stats
        setStats({
          total: fetched.length,
          received: fetched.filter((c: any) => c.status === "received").length,
          inProgress: fetched.filter((c: any) => c.status === "in_progress").length,
          resolved: fetched.filter((c: any) => c.status === "resolved").length
        })
      } else {
        showToast("Failed to fetch assigned complaints", "error")
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
  }, [statusFilter])

  // Action Operations
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/officer/complaints/${id}/status`, {
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
      const res = await fetch(`/api/officer/complaints/${id}/ward`, {
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!oldPassword || !newPassword) {
      setPassFeedback({ text: "Please enter current and new passwords", isError: true })
      return
    }
    setIsUpdatingPass(true)
    setPassFeedback(null)
    try {
      const res = await fetch("/api/officer/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      })
      if (res.ok) {
        setPassFeedback({ text: "Password updated successfully!", isError: false })
        setOldPassword("")
        setNewPassword("")
      } else {
        const err = await res.json().catch(() => ({}))
        setPassFeedback({ text: err.message || "Failed to update password", isError: true })
      }
    } catch (err) {
      setPassFeedback({ text: "Network error resetting password", isError: true })
    } finally {
      setIsUpdatingPass(false)
    }
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
        isAdmin={false}
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
          activeWardFilter={null}
          clearWardFilter={() => {}}
          isAdmin={false}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Content Container */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
          
          {/* Stats Overview */}
          {activeTab === "dashboard" && (
            <StatsGrid stats={stats} />
          )}

          {/* Subviews switcher */}
          <div className="mt-4">
            {activeTab === "dashboard" && (
              <QueueView
                complaints={complaints}
                isAdmin={false}
                cachedWards={cachedWards}
                cachedOfficers={[]}
                onUpdateStatus={handleUpdateStatus}
                onCorrectWard={handleCorrectWard}
                onShowLightbox={setLightboxUrl}
                loading={loadingComplaints}
              />
            )}

            {activeTab === "profile" && (
              <div className="max-w-xl mx-auto mt-6">
                <Card className="bg-zinc-900 border-zinc-800/80">
                  <CardHeader className="border-b border-zinc-800/60 pb-4">
                    <CardTitle className="text-base font-extrabold flex items-center gap-2 text-zinc-200">
                      <KeyRound className="w-4 h-4 text-blue-500" /> Password settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <form onSubmit={handlePasswordReset} className="space-y-4">
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Current Password</label>
                        <div className="relative">
                          <input
                            type={showOldPass ? "text" : "password"}
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-10 py-2.5 text-sm font-semibold text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-700 placeholder:text-zinc-600"
                            placeholder="Enter current security key"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOldPass(!showOldPass)}
                            className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            {showOldPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">New Password</label>
                        <div className="relative">
                          <input
                            type={showNewPass ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-10 py-2.5 text-sm font-semibold text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-700 placeholder:text-zinc-600"
                            placeholder="Enter new security key"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPass(!showNewPass)}
                            className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {passFeedback && (
                        <p className={`text-xs font-bold ${passFeedback.isError ? "text-red-400" : "text-emerald-400"}`}>
                          {passFeedback.text}
                        </p>
                      )}

                      <Button type="submit" className="w-full text-sm font-bold gap-2" disabled={isUpdatingPass}>
                        {isUpdatingPass ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Update Password
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
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
        isAdmin={false}
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
      <OfficerApp />
    </React.StrictMode>
  )
}
