import React, { useState, useEffect } from "react"
import ReactDOM from "react-dom/client"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Building2, 
  Moon, 
  Sun, 
  LogOut, 
  AlertCircle, 
  CheckCircle2, 
  PlusCircle, 
  FileText, 
  MapPin, 
  Check, 
  Loader2,
  ShieldCheck,
  MessageCircle,
  Clock,
  Activity,
  ArrowLeft,
  Camera,
  CornerDownRight
} from "lucide-react"

import "./index.css"
import { Button } from "./components/ui/Button"
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/Card"
import { Badge } from "./components/ui/Badge"

const params = new URLSearchParams(window.location.search)
const token = params.get("token") || localStorage.getItem("citizen-token") || ""
const urlPhone = params.get("phone") || ""
const urlComplaintId = params.get("complaintId") || ""
const isLookupMode = Boolean(urlPhone && urlComplaintId)

if (!token && !isLookupMode) {
  window.location.replace("/index.html?openLogin=true")
} else if (token) {
  localStorage.setItem("citizen-token", token)
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
const currentPhone = decoded ? decoded.citizenId || "" : (urlPhone || "Citizen")

export default function CitizenApp() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("theme") === "dark"
  })

  const [complaints, setComplaints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<{ id: string; text: string; type: "success" | "error" }[]>([])
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Form states (available only if logged in via JWT, i.e. not in lookup mode)
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("general")
  const [locationText, setLocationText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync dark class
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
    localStorage.setItem("theme", isDark ? "dark" : "light")
  }, [isDark])

  // Fetch Citizen complaints
  const loadComplaints = async () => {
    setLoading(true)
    try {
      if (isLookupMode) {
        // Query public status lookup using phone and complaintId
        const res = await fetch("/api/citizen/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: urlPhone, complaintId: urlComplaintId })
        })
        if (res.ok) {
          const data = await res.json()
          setComplaints(data.complaints || [])
        } else {
          showToast("Failed to retrieve lookup complaint", "error")
        }
      } else {
        // Fetch JWT complaints list
        const res = await fetch("/api/citizen/complaints", {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.status === 401) {
          localStorage.removeItem("citizen-token")
          window.location.replace("/index.html?openLogin=true")
          return
        }
        if (res.ok) {
          const data = await res.json()
          setComplaints(data.complaints || data || [])
        }
      }
    } catch (err) {
      console.error("Error loading complaints:", err)
      showToast("Network error reading records", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadComplaints()
  }, [])

  const showToast = (text: string, type: "success" | "error" = "success") => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, text, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description || !locationText) {
      showToast("Please fill in description and location fields", "error")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/citizen/complaints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ description, category, location: locationText })
      })
      if (!res.ok) {
        throw new Error("Failed to submit grievance")
      }
      showToast("Grievance filed successfully!")
      setDescription("")
      setLocationText("")
      loadComplaints() // Reload queue
    } catch (err: any) {
      showToast(err.message || "Failed to submit", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = () => {
    localStorage.removeItem("citizen-token")
    window.location.replace("/index.html")
  }

  const getStatusStep = (status: string) => {
    const s = (status || "").toLowerCase()
    if (s === "resolved") return 3
    if (s === "in_progress" || s === "assigned") return 2
    return 1 // received
  }

  return (
    <div className={`min-h-screen flex flex-col font-outfit ${isDark ? "bg-background text-foreground" : "bg-background text-foreground"}`}>
      
      {/* Header Bar */}
      <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-soft border border-primary/30 flex items-center justify-center text-primary">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight">CivicVoice</h1>
            <span className="text-xs font-bold text-zinc-550 uppercase tracking-widest block leading-none">Citizen Portal</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Light/Dark Toggle */}
          <Button variant="ghost" size="icon" onClick={() => setIsDark(!isDark)} className="text-zinc-500 hover:text-foreground">
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          {isLookupMode ? (
            <Button variant="outline" size="sm" onClick={() => window.location.replace("/index.html")} className="text-sm font-bold gap-1.5 border-border text-zinc-650 hover:bg-card-muted">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleSignOut} className="text-sm font-bold gap-1.5 border-border text-zinc-650 hover:bg-card-muted">
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </Button>
          )}
        </div>
      </header>

      {/* Content wrapper */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Submit Form (Only if logged in) */}
        <div className="space-y-6">
          {isLookupMode ? (
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base font-black uppercase tracking-wider text-zinc-500 flex items-center gap-2 font-outfit">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Reference Lookup
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                <p className="text-sm text-zinc-550 leading-relaxed font-semibold">
                  You are viewing a read-only query for Complaint ID:
                </p>
                <div className="bg-card-muted/80 p-3 rounded-lg border border-border font-mono text-xs break-all font-bold">
                  {urlComplaintId}
                </div>
                <p className="text-sm text-zinc-550 leading-relaxed font-semibold">
                  To report new grievances or view multiple records, configure an account and sign in.
                </p>
                <Button 
                  onClick={() => window.location.replace("/index.html?openLogin=true")} 
                  className="w-full text-sm font-bold py-2.5 mt-2 bg-primary hover:bg-primary/95 text-primary-foreground"
                >
                  Create Account passcode
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-base font-black uppercase tracking-wider text-zinc-500 flex items-center gap-2 font-outfit">
                  <PlusCircle className="w-4 h-4 text-primary" /> Report New Grievance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handleSubmit} className="space-y-4 text-sm font-semibold">
                  
                  <div className="space-y-1">
                    <label className="text-zinc-500 block uppercase tracking-wide text-xs font-bold">Category</label>
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-card border border-border rounded-lg px-3 py-3 sm:py-2.5 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-colors h-11 sm:h-10"
                    >
                      <option className="bg-card text-foreground py-2 font-semibold" value="roads">Roads & Infrastructure</option>
                      <option className="bg-card text-foreground py-2 font-semibold" value="water_supply">Water Supply</option>
                      <option className="bg-card text-foreground py-2 font-semibold" value="sanitation">Sanitation & Garbage</option>
                      <option className="bg-card text-foreground py-2 font-semibold" value="electricity">Street Lights & Electricity</option>
                      <option className="bg-card text-foreground py-2 font-semibold" value="drainage">Drainage & Sewage</option>
                      <option className="bg-card text-foreground py-2 font-semibold" value="general">Other / General</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-500 block uppercase tracking-wide text-xs font-bold">Describe the issue</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="w-full bg-background border border-border rounded-lg px-3 py-3 sm:py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-zinc-400"
                      placeholder="e.g. Broken pipe leaking water onto the road..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-500 block uppercase tracking-wide text-xs font-bold">Location Address / Area</label>
                    <input
                      type="text"
                      value={locationText}
                      onChange={(e) => setLocationText(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-3 sm:py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-zinc-400 h-11 sm:h-10"
                      placeholder="e.g. MG Road, Near Metro Station"
                    />
                  </div>

                  <Button type="submit" className="w-full text-sm font-bold gap-2 h-11 sm:h-10" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    File Grievance
                  </Button>

                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Side: Grievance feed */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-black uppercase tracking-wider text-zinc-500 flex items-center gap-2 font-outfit">
                <FileText className="w-4 h-4 text-emerald-500" /> 
                {isLookupMode ? "Queried Grievance Status" : "My Filed Grievances"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {loading ? (
                <div className="p-12 text-center text-zinc-500 font-bold animate-pulse">
                  Retrieving municipal grievance logs...
                </div>
              ) : complaints.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 font-semibold border border-dashed border-border rounded-xl bg-card-muted/10">
                  No grievances found matching this account / reference.
                </div>
              ) : (
                <div className="space-y-6">
                  {complaints.map((item) => {
                    const currentStep = getStatusStep(item.status)
                    const hasAttachment = item.attachments && item.attachments.length > 0
                    
                    return (
                      <Card key={item._id || item.id} className="bg-background border border-border p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="space-y-1">
                            <span className="text-xs font-mono font-bold text-zinc-550">ID: #{item.referenceId || item._id || item.id}</span>
                            <h4 className="text-base font-extrabold text-foreground capitalize font-outfit">
                              {item.structured?.category || item.category || "General"} Incident
                            </h4>
                          </div>
                          <Badge variant={
                            item.status === 'resolved' ? 'success' :
                            (item.status === 'in_progress' || item.status === 'assigned') ? 'info' :
                            (item.status === 'needsClarification' || item.status === 'needs details') ? 'warning' : 'secondary'
                          }>
                            {item.status === 'needsClarification' ? 'Needs Details' : item.status}
                          </Badge>
                        </div>

                        {/* Plain language summary */}
                        <div className="space-y-1 bg-card-muted/30 p-3 rounded-lg border border-border/50">
                          <span className="text-xs font-black text-zinc-550 uppercase tracking-wide block leading-none mb-1 flex items-center gap-1">
                            <CornerDownRight className="w-3 h-3 text-primary" /> Plain Language AI Summary
                          </span>
                          <p className="text-base font-semibold text-foreground leading-relaxed">
                            {item.structured?.description || item.description || item.rawText || "No description provided"}
                          </p>
                        </div>

                        {/* Interactive Status Timeline Stepper */}
                        <div className="py-4 border-y border-border/60">
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-4">Grievance Progress Timeline</span>
                          
                          <div className="relative flex items-center justify-between w-full">
                            {/* Line connector */}
                            <div className="absolute left-6 right-6 h-0.5 bg-border -z-10" />
                            <div 
                              className="absolute left-6 h-0.5 bg-primary -z-10 transition-all duration-500" 
                              style={{ width: currentStep === 1 ? "0%" : currentStep === 2 ? "50%" : "100%" }}
                            />

                            {/* Step 1: Received */}
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                currentStep >= 1 
                                  ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20" 
                                  : "bg-card border-border text-zinc-400"
                              }`}>
                                <Clock className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 mt-1">Received</span>
                            </div>

                            {/* Step 2: Dispatched */}
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                currentStep >= 2 
                                  ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20" 
                                  : "bg-card border-border text-zinc-400"
                              }`}>
                                <Activity className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 mt-1">In Progress</span>
                            </div>

                            {/* Step 3: Resolved */}
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                currentStep >= 3 
                                  ? "bg-success border-success text-white shadow-md shadow-success/20" 
                                  : "bg-card border-border text-zinc-400"
                              }`}>
                                <Check className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 mt-1">Resolved</span>
                            </div>

                          </div>
                        </div>

                        {/* Location and Photo Thumbnail Grid */}
                        <div className="flex flex-wrap gap-4 items-center justify-between">
                          <div className="flex flex-col gap-1">
                            {((item.location?.coordinates && item.location.coordinates.length >= 2) || (item.coordinates && item.coordinates.length >= 2)) ? (
                              <div className="inline-flex items-center gap-1.5 bg-primary-soft border border-primary/20 text-primary text-xs font-bold px-2.5 py-1 rounded-full shadow-inner select-none w-fit">
                                <MapPin className="w-3.5 h-3.5" /> geocoded ({(item.location?.coordinates?.[1] || item.coordinates?.[1] || 0).toFixed(5)}, {(item.location?.coordinates?.[0] || item.coordinates?.[0] || 0).toFixed(5)})
                              </div>
                            ) : (
                              <div className="text-xs font-bold text-zinc-500 italic">No coordinates registered</div>
                            )}
                            {(item.structured?.locationMentioned || (item.wardId && item.wardId.name) || item.assignedWard) && (
                              <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1.5 mt-1 select-none">
                                <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                                {item.structured?.locationMentioned || item.wardId?.name || item.assignedWard}
                              </span>
                            )}
                          </div>

                          {hasAttachment && (
                            <button 
                              onClick={() => {
                                const url = item.attachments[0].url;
                                const finalUrl = url && token ? `${url}?token=${encodeURIComponent(token)}` : url;
                                setLightboxUrl(finalUrl);
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                            >
                              <Camera className="w-3.5 h-3.5" /> View Photo Evidence
                            </button>
                          )}
                        </div>

                        {/* Metadata Verification Footer */}
                        <div className="border-t border-border/60 pt-3 flex flex-wrap gap-4 text-xs font-bold text-zinc-500 select-none">
                          <div className="flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span>AI confidence: {(item.structured?.confidence * 100 || 90).toFixed(0)}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                            <span>WhatsApp intake synced</span>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </main>

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
              className="relative max-w-4xl max-h-[80vh] overflow-hidden rounded-xl border border-border shadow-2xl bg-card"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={lightboxUrl} 
                alt="Citizen Evidence Preview" 
                className="object-contain max-w-full max-h-[80vh]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/public/placeholder.png";
                  console.error("Citizen preview image failed to load");
                }}
              />
            </motion.div>
            <button 
              onClick={() => setLightboxUrl(null)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-card border border-border text-xs font-bold text-foreground rounded-lg hover:bg-card-muted transition-colors shadow-lg"
            >
              Close Preview
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Notification Toast */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              className={`p-3.5 rounded-xl border flex items-center gap-2.5 shadow-xl text-xs font-bold pointer-events-auto min-w-[200px] ${
                t.type === "success" 
                  ? "bg-card border-border text-foreground" 
                  : "bg-red-500/10 border-red-500/25 text-red-500"
              }`}
            >
              {t.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              )}
              <span className="flex-1">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  )
}

const rootEl = document.getElementById("root")
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <CitizenApp />
    </React.StrictMode>
  )
}
