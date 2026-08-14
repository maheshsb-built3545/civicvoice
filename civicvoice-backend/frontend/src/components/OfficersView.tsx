import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardHeader, CardTitle, CardContent } from "./ui/Card"
import { Button } from "./ui/Button"
import { 
  Users2, 
  UserPlus, 
  KeyRound, 
  Loader2, 
  Search, 
  Check, 
  Mail, 
  Phone, 
  MapPin, 
  Copy, 
  CheckCheck,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  X,
  Trash2,
  AlertTriangle
} from "lucide-react"
import { Badge } from "./ui/Badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/Dialog"

interface OfficersViewProps {
  officers: any[]
  wards?: any[]
  onAddOfficer: (data: any) => Promise<any>
  onChangePassword: (officerId: string, newPass: string) => Promise<any>
  onToggleStatus?: (officerId: string, currentActive: boolean) => Promise<void>
  onDeleteOfficer?: (officerId: string) => Promise<void>
  token?: string
  loading: boolean
}

export default function OfficersView({
  officers,
  wards = [],
  onAddOfficer,
  onChangePassword,
  onToggleStatus,
  onDeleteOfficer,
  token,
  loading
}: OfficersViewProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const wardOptions = wards.length > 0 ? wards : [
    { _id: "ward_sanjivani",  name: "Sanjivani Campus Ward" },
    { _id: "ward_mahadev",    name: "Mahadevnagar" },
    { _id: "ward_sainagar",   name: "Sainagar" },
    { _id: "ward_singnapur",  name: "Singnapur" },
    { _id: "ward_kojagiri",   name: "Kojagiri" },
  ];

  // Add Officer Form State
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [selectedWardId, setSelectedWardId] = useState("")
  const [category, setCategory] = useState("roads")
  const [isAdding, setIsAdding] = useState(false)
  
  // Password keys modals / feedback
  const [showKeyDialog, setShowKeyDialog] = useState(false)
  const [dialogTitle, setDialogTitle] = useState("")
  const [dialogKey, setDialogKey] = useState("")
  const [isCopied, setIsCopied] = useState(false)

  // Reset Password State
  const [selectedOfficerId, setSelectedOfficerId] = useState("")
  const [isResetting, setIsResetting] = useState(false)

  // Deletion States
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingOfficer, setDeletingOfficer] = useState<any>(null)
  const [checkingDeletion, setCheckingDeletion] = useState(false)
  const [unresolvedCount, setUnresolvedCount] = useState<number | null>(null)
  const [isPerformingDelete, setIsPerformingDelete] = useState(false)

  const startDeleteOfficer = async (officer: any) => {
    setDeletingOfficer(officer)
    setUnresolvedCount(null)
    setCheckingDeletion(true)
    setIsDeleteDialogOpen(true)
    try {
      const res = await fetch(`/api/officers/${officer._id}/deletion-check`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUnresolvedCount(data.unresolvedCount)
      } else {
        setUnresolvedCount(0)
      }
    } catch (err) {
      setUnresolvedCount(0)
    } finally {
      setCheckingDeletion(false)
    }
  }

  const confirmDeleteOfficer = async () => {
    if (!deletingOfficer || !onDeleteOfficer) return
    setIsPerformingDelete(true)
    try {
      await onDeleteOfficer(deletingOfficer._id)
      setIsDeleteDialogOpen(false)
      setDeletingOfficer(null)
    } catch (err) {
      console.error(err)
    } finally {
      setIsPerformingDelete(false)
    }
  }
  
  const [formFeedback, setFormFeedback] = useState("")

  // Filter officers based on search query
  const filteredOfficers = officers.filter(off => {
    const query = searchQuery.toLowerCase()
    return (
      (off.name || "").toLowerCase().includes(query) ||
      (off.officerId || "").toLowerCase().includes(query) ||
      (off.department || "").toLowerCase().includes(query) ||
      (off.contact || "").toLowerCase().includes(query)
    )
  })

  const copyToClipboard = () => {
    navigator.clipboard.writeText(dialogKey)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormFeedback("")
    if (!name || !phone || !selectedWardId) {
      setFormFeedback("Name, Phone, and Ward are required")
      return
    }
    setIsAdding(true)
    try {
      const payload = {
        name,
        phone,
        email,
        wards: [selectedWardId]
      }
      console.log("[DEBUG] Register Officer Payload:", payload)
      
      const tempPass = await onAddOfficer(payload)
      
      setDialogTitle(`Registered Officer ID: ${name}`)
      setDialogKey(tempPass)
      setShowKeyDialog(true)
      
      setName("")
      setPhone("")
      setEmail("")
      setSelectedWardId("")
    } catch (err: any) {
      setFormFeedback(err.message || "Failed to create officer")
    } finally {
      setIsAdding(false)
    }
  }

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormFeedback("")
    if (!selectedOfficerId) {
      setFormFeedback("Please select an officer first")
      return
    }
    setIsResetting(true)
    try {
      const targetOff = officers.find(o => o._id === selectedOfficerId)
      const tempPass = await onChangePassword(selectedOfficerId, "")
      
      setDialogTitle(`Reset Passcode for ${targetOff?.name || 'Officer'}`)
      setDialogKey(tempPass)
      setShowKeyDialog(true)
      
      setSelectedOfficerId("")
    } catch (err: any) {
      setFormFeedback(err.message || "Failed to reset password")
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-outfit">
      
      {/* Searchable Officer Directory table */}
      <Card className="lg:col-span-2 bg-card border-border transition-colors">
        <CardHeader className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-base font-black uppercase tracking-wider text-zinc-550 flex items-center gap-2 font-outfit">
            <Users2 className="w-4 h-4 text-primary" /> Officer Directory
          </CardTitle>
          
          {/* Search box input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, name, or phone..."
              className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-zinc-400"
            />
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-zinc-500 font-bold animate-pulse">
                Syncing database records...
              </div>
            ) : filteredOfficers.length === 0 ? (
              <div className="p-12 text-center text-zinc-450 font-semibold border border-dashed border-border rounded-b-2xl bg-card-muted/10">
                No active officers matching filters found.
              </div>
            ) : (
              <>
                {/* Desktop View Table */}
                <table className="hidden md:table w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-xs font-bold text-zinc-650 dark:text-zinc-400 uppercase tracking-widest bg-card-muted/20 select-none">
                      <th className="px-5 py-3">Officer Profile</th>
                      <th className="px-5 py-3">Assigned Ward Area</th>
                      <th className="px-5 py-3">Category Scope</th>
                      <th className="px-5 py-3">Phone Contact</th>
                      <th className="px-5 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredOfficers.map((off) => {
                      const wardNames = off.wards && off.wards.length > 0 
                        ? off.wards.map((w: any) => w.name).join(", ") 
                        : (off.ward?.name || "Unassigned")
                        
                      const initials = off.name ? off.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() : "OFF"
                      
                      return (
                        <tr key={off._id} className="hover:bg-card-muted/30 transition-colors text-sm font-semibold text-foreground">
                          <td className="px-5 py-3 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-soft text-primary border border-primary/20 flex items-center justify-center font-bold text-xs select-none shadow-sm">
                              {initials}
                            </div>
                            <div>
                              <div className="font-extrabold text-foreground">{off.name}</div>
                              <span className="text-xs font-mono font-bold text-zinc-500">{off.officerId || "N/A"}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span className={wardNames === "Unassigned" ? "text-zinc-450 italic" : "text-foreground font-bold"}>
                                {wardNames}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3 capitalize text-zinc-500">{off.department || "General"}</td>
                          <td className="px-5 py-3 font-mono text-zinc-500">
                            <div className="flex flex-col">
                              <span>{off.contact}</span>
                              {off.email && <span className="text-xs text-zinc-400 font-semibold">{off.email}</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <div className="flex items-center justify-center gap-2.5">
                              {onToggleStatus ? (
                                <button
                                  onClick={() => onToggleStatus(off._id, off.active !== false)}
                                  className="focus:outline-none"
                                  title="Click to toggle active status"
                                >
                                  {off.active !== false ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold cursor-pointer hover:bg-emerald-500/20">Active</Badge>
                                  ) : (
                                    <Badge className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-border text-xs font-bold cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700">Inactive</Badge>
                                  )}
                                </button>
                              ) : (
                                off.active !== false ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">Active</Badge>
                                ) : (
                                  <Badge className="bg-zinc-150 text-zinc-450 border border-border text-xs font-bold">Inactive</Badge>
                                )
                              )}

                              {onDeleteOfficer && (
                                <button
                                  onClick={() => startDeleteOfficer(off)}
                                  className="text-zinc-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-500/10 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
                                  title="Delete Officer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Mobile View Cards */}
                <div className="md:hidden grid grid-cols-1 gap-4 p-4">
                  {filteredOfficers.map((off) => {
                    const wardNames = off.wards && off.wards.length > 0 
                      ? off.wards.map((w: any) => w.name).join(", ") 
                      : (off.ward?.name || "Unassigned")
                      
                    const initials = off.name ? off.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() : "OFF"
                    
                    return (
                      <div key={off._id} className="bg-background border border-border p-4 rounded-xl space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary-soft text-primary border border-primary/20 flex items-center justify-center font-bold text-sm select-none shadow-sm">
                              {initials}
                            </div>
                            <div>
                              <div className="font-extrabold text-foreground">{off.name}</div>
                              <span className="text-xs font-mono font-bold text-zinc-500">{off.officerId || "N/A"}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {onToggleStatus ? (
                              <button
                                onClick={() => onToggleStatus(off._id, off.active !== false)}
                                className="focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
                                title="Click to toggle active status"
                              >
                                {off.active !== false ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold cursor-pointer hover:bg-emerald-500/20 px-2.5 py-1">Active</Badge>
                                ) : (
                                  <Badge className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-border text-xs font-bold cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2.5 py-1">Inactive</Badge>
                                )}
                              </button>
                            ) : (
                              off.active !== false ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold px-2.5 py-1">Active</Badge>
                              ) : (
                                <Badge className="bg-zinc-150 text-zinc-450 border border-border text-xs font-bold px-2.5 py-1">Inactive</Badge>
                              )
                            )}

                            {onDeleteOfficer && (
                              <button
                                onClick={() => startDeleteOfficer(off)}
                                className="text-zinc-400 hover:text-red-500 transition-colors p-2.5 hover:bg-red-500/10 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
                                title="Delete Officer"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-xs border-t border-border/60 pt-3">
                          <div>
                            <span className="text-zinc-500 font-bold uppercase tracking-wider block mb-1">Ward Area</span>
                            <span className="flex items-center gap-1.5 text-foreground font-semibold">
                              <MapPin className="w-3.5 h-3.5 text-zinc-450 shrink-0" />
                              <span className={wardNames === "Unassigned" ? "text-zinc-450 italic" : "text-foreground font-extrabold truncate"}>
                                {wardNames}
                              </span>
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 font-bold uppercase tracking-wider block mb-1">Category Scope</span>
                            <span className="capitalize text-foreground font-extrabold block truncate">{off.department || "General"}</span>
                          </div>
                        </div>

                        <div className="border-t border-border/60 pt-3 text-xs">
                          <span className="text-zinc-500 font-bold uppercase tracking-wider block mb-1">Phone Contact</span>
                          <div className="font-mono text-foreground flex flex-col gap-0.5">
                            <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> {off.contact}</span>
                            {off.email && <span className="text-zinc-400 font-semibold truncate block max-w-full">{off.email}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Forms Panel */}
      <div className="space-y-6">
        
        {/* Register Officer */}
        <Card className="bg-card border-border transition-colors">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base font-black uppercase tracking-wider text-zinc-550 flex items-center gap-2 font-outfit">
              <UserPlus className="w-4 h-4 text-emerald-500" /> Register Officer
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-sm font-semibold">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-3 sm:py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-zinc-400 h-11 sm:h-10"
                  placeholder="e.g. Inspector John"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Phone (WhatsApp ID)</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-3 sm:py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-zinc-400 h-11 sm:h-10"
                  placeholder="e.g. 919876543210"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Email (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-3 sm:py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-zinc-400 h-11 sm:h-10"
                  placeholder="e.g. john@civicvoice.gov"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Assigned Ward</label>
                <select
                  required
                  value={selectedWardId}
                  onChange={(e) => setSelectedWardId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-3 sm:py-2.5 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer h-11 sm:h-10"
                >
                  <option className="bg-card text-foreground py-2 font-semibold" value="">Select Ward...</option>
                  {wardOptions.map((w) => (
                    <option className="bg-card text-foreground py-2 font-semibold" key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>



              {formFeedback && !showKeyDialog && (
                <p className="text-xs font-bold text-red-500">
                  {formFeedback}
                </p>
              )}

              <Button type="submit" className="w-full text-sm gap-2 h-11 sm:h-10" disabled={isAdding}>
                {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Create Officer Account
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Officer Password */}
        <Card className="bg-card border-border transition-colors">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-base font-black uppercase tracking-wider text-zinc-550 flex items-center gap-2 font-outfit">
              <KeyRound className="w-4 h-4 text-amber-500" /> Reset Password Tool
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleResetSubmit} className="space-y-3.5 text-sm font-semibold">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Target Officer</label>
                <select
                  required
                  value={selectedOfficerId}
                  onChange={(e) => setSelectedOfficerId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-3 sm:py-2.5 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer h-11 sm:h-10"
                >
                  <option className="bg-card text-foreground py-2 font-semibold" value="">Select Officer...</option>
                  {officers.map((off) => (
                    <option className="bg-card text-foreground py-2 font-semibold" key={off._id} value={off._id}>
                      {off.name} ({off.department || "General"})
                    </option>
                  ))}
                </select>
              </div>

              {formFeedback && !showKeyDialog && selectedOfficerId && (
                <p className="text-xs font-bold text-red-500">
                  {formFeedback}
                </p>
              )}

              <Button type="submit" variant="secondary" className="w-full text-sm gap-2 h-11 sm:h-10" disabled={isResetting}>
                {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Reset Password Key
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>

      {/* Copyable Temporary Key Modal/Dialog */}
      <AnimatePresence>
        {showKeyDialog && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-card border border-border p-6 rounded-2xl shadow-2xl relative text-center"
            >
              <button 
                onClick={() => {
                  setShowKeyDialog(false)
                  setDialogKey("")
                  setDialogTitle("")
                }}
                className="absolute right-4 top-4 text-zinc-400 hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>

              <h4 className="text-base font-black uppercase tracking-wider mb-2 font-outfit text-foreground">{dialogTitle}</h4>
              <p className="text-xs text-zinc-500 leading-normal font-semibold mb-4">
                Copy this temporary account security passcode key. It will not be shown again.
              </p>

              <div className="bg-background border border-border p-3.5 rounded-xl flex items-center justify-between font-mono text-sm text-foreground font-bold mb-5 select-all">
                <span className="truncate">{dialogKey}</span>
                <button 
                  onClick={copyToClipboard}
                  className="p-1.5 rounded-lg border border-border hover:bg-card-muted text-zinc-400 hover:text-foreground transition-colors ml-2"
                  title="Copy password key"
                >
                  {isCopied ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <Button 
                onClick={() => {
                  setShowKeyDialog(false)
                  setDialogKey("")
                  setDialogTitle("")
                }}
                className="w-full text-sm font-bold py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground"
              >
                Done
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Officer Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md bg-card border border-border p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2 font-black uppercase tracking-wider font-outfit text-base">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Delete Officer Account?
            </DialogTitle>
            <DialogDescription className="text-zinc-550 pt-3">
              {checkingDeletion ? (
                <span className="flex items-center gap-2 text-zinc-500 font-bold animate-pulse text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" /> Verifying assigned complaints operational load...
                </span>
              ) : unresolvedCount === null ? (
                <span className="text-xs font-semibold">Checking officer's operational load status...</span>
              ) : unresolvedCount > 0 ? (
                <div className="space-y-3">
                  <p className="font-extrabold text-red-500 bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    Deletion Blocked: This officer currently has {unresolvedCount} unresolved complaint(s) assigned.
                  </p>
                  <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                    To maintain grievance resolution accountability, you must reassign all unresolved tickets to other officers before deleting this account.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="font-bold text-foreground text-sm">
                    Are you sure you want to delete {deletingOfficer?.name}?
                  </p>
                  <p className="text-xs text-zinc-550 leading-relaxed font-semibold">
                    This action will soft-delete the officer account, deactivate their credentials immediately, and remove them from dispatch directories. Past resolved complaints attribution will be preserved.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex items-center justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} disabled={isPerformingDelete} className="h-10 text-xs font-bold px-4">
              Cancel
            </Button>
            <Button 
              variant={unresolvedCount !== null && unresolvedCount > 0 ? "secondary" : "destructive"}
              onClick={confirmDeleteOfficer} 
              className="gap-2 h-10 text-xs font-bold px-4" 
              disabled={isPerformingDelete || checkingDeletion || (unresolvedCount !== null && unresolvedCount > 0)}
            >
              {isPerformingDelete ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
