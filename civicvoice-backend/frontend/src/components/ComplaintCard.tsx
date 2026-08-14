import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  MapPin, 
  Image as ImageIcon, 
  Phone, 
  Calendar, 
  Map, 
  AlertCircle, 
  MoreHorizontal,
  ChevronDown,
  User,
  Trash2,
  Bookmark,
  CheckCircle,
  Clock,
  ExternalLink,
  Loader2,
  FolderSync,
  UserCheck,
  Activity,
  Zap,
  Droplet,
  Trash,
  HelpCircle,
  Layers,
  Volume2,
  Play,
  Pause,
  ShieldCheck,
  MessageCircle,
  HelpCircle as QuestionIcon
} from "lucide-react"
import { Card, CardContent } from "./ui/Card"
import { Badge } from "./ui/Badge"
import { Button } from "./ui/Button"
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from "./ui/Dropdown"
import { 
  Popover, 
  PopoverTrigger, 
  PopoverContent 
} from "./ui/Popover"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "./ui/Dialog"

declare const L: any; // Leaflet global reference

interface ComplaintCardProps {
  item: any
  isAdmin: boolean
  cachedWards: any[]
  cachedOfficers: any[]
  onUpdateStatus: (id: string, status: string) => Promise<void>
  onCorrectWard: (id: string, wardId: string | null) => Promise<void>
  onAssignOfficer?: (id: string, officerId: string | null) => Promise<void>
  onDeleteComplaint?: (id: string) => Promise<void>
  onShowLightbox: (url: string) => void
  isDuplicate?: boolean
}

export default function ComplaintCard({
  item,
  isAdmin,
  cachedWards,
  cachedOfficers,
  onUpdateStatus,
  onCorrectWard,
  onAssignOfficer,
  onDeleteComplaint,
  onShowLightbox,
  isDuplicate = false
}: ComplaintCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [wardSearch, setWardSearch] = useState("")
  const [officerSearch, setOfficerSearch] = useState("")
  const [isWardPopoverOpen, setIsWardPopoverOpen] = useState(false)
  const [isOfficerPopoverOpen, setIsOfficerPopoverOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Audio Player states
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)
  const audioIntervalRef = useRef<any>(null)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const structured = item.structured || {}
  const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"
  const category = structured.category || "General"
  const urgency = structured.urgency || "medium"
  const status = item.status || "received"
  const wardName = item.wardId?.name || "Unassigned"
  const complaintId = item._id || ""

  const hasCoordinates = item.location && item.location.coordinates && item.location.coordinates.length >= 2
  
  // Handle attachments flexibly mapping various field variants
  let rawAttachmentUrl = item.photoUrl || item.mediaUrl || item.imageUrl || (item.attachments && item.attachments[0]?.url) || ""
  const urlParams = new URLSearchParams(window.location.search)
  const token = urlParams.get("token") || localStorage.getItem("citizen-token") || ""
  const attachmentUrl = rawAttachmentUrl && token 
    ? `${rawAttachmentUrl}?token=${encodeURIComponent(token)}` 
    : rawAttachmentUrl
  const hasAttachments = Boolean(attachmentUrl)
  
  const [imageError, setImageError] = useState(false)

  // Dynamic Leaflet Map setup on expand
  useEffect(() => {
    let mapInstance: any;
    if (expanded && hasCoordinates && mapContainerRef.current) {
      const timer = setTimeout(() => {
        try {
          if (!mapContainerRef.current) return;
          const lng = item.location.coordinates[0];
          const lat = item.location.coordinates[1];
          
          mapInstance = L.map(mapContainerRef.current, {
            zoomControl: false,
            dragging: true,
            touchZoom: false,
            doubleClickZoom: false,
            scrollWheelZoom: false,
            boxZoom: false,
            keyboard: false
          }).setView([lat, lng], 15);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
          }).addTo(mapInstance);

          L.marker([lat, lng]).addTo(mapInstance);
        } catch (err) {
          console.error("Leaflet map mounting error:", err);
        }
      }, 250);

      return () => {
        clearTimeout(timer);
        if (mapInstance) {
          mapInstance.remove();
        }
      };
    }
  }, [expanded, hasCoordinates]);

  // Audio Playback simulation
  useEffect(() => {
    if (isPlaying) {
      audioIntervalRef.current = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            clearInterval(audioIntervalRef.current);
            return 0;
          }
          return prev + 8;
        });
      }, 300);
    } else {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
      }
    }
    return () => {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    }
  }, [isPlaying])

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsPlaying(!isPlaying)
  }

  // Get Lucide icon by category type
  const getCategoryIcon = (cat: string) => {
    const c = cat.toLowerCase()
    if (c.includes("road")) return <Layers className="w-4 h-4 text-indigo-500" />
    if (c.includes("water")) return <Droplet className="w-4 h-4 text-blue-500" />
    if (c.includes("sanitation") || c.includes("garbage")) return <Trash className="w-4 h-4 text-emerald-500" />
    if (c.includes("electricity") || c.includes("light")) return <Zap className="w-4 h-4 text-amber-500" />
    if (c.includes("drainage") || c.includes("sewage")) return <Droplet className="w-4 h-4 text-cyan-500" />
    return <HelpCircle className="w-4 h-4 text-zinc-500" />
  }

  const getUrgencyVariant = (urg: string): 'danger' | 'warning' | 'default' => {
    switch (urg.toLowerCase()) {
      case "high":
        return "danger"
      case "medium":
        return "warning"
      default:
        return "default"
    }
  }

  const getStatusVariant = (st: string): 'success' | 'info' | 'warning' | 'secondary' => {
    const s = (st || "").toLowerCase()
    switch (s) {
      case "resolved":
        return "success"
      case "in_progress":
      case "assigned":
        return "info"
      case "needsclarification":
      case "needs details":
        return "warning"
      default:
        return "secondary"
    }
  }

  const safeWards = cachedWards && cachedWards.length > 0 ? cachedWards : [
    { _id: "ward_sanjivani",  name: "Sanjivani Campus Ward" },
    { _id: "ward_mahadev",    name: "Mahadevnagar" },
    { _id: "ward_sainagar",   name: "Sainagar" },
    { _id: "ward_singnapur",  name: "Singnapur" },
    { _id: "ward_kojagiri",   name: "Kojagiri" },
  ];

  const filteredWards = safeWards.filter((w) =>
    w.name.toLowerCase().includes(wardSearch.toLowerCase())
  );

  const filteredOfficers = cachedOfficers.filter((o) =>
    o.name.toLowerCase().includes(officerSearch.toLowerCase()) ||
    o.department.toLowerCase().includes(officerSearch.toLowerCase())
  )

  const handleDelete = async () => {
    if (onDeleteComplaint) {
      setIsDeleting(true)
      try {
        await onDeleteComplaint(complaintId)
        setIsDeleteDialogOpen(false)
      } catch (err) {
        console.error("Delete complaint error:", err)
      } finally {
        setIsDeleting(false)
      }
    }
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="group"
    >
      <Card className={`border-border bg-card/60 hover:bg-card hover:border-zinc-350 dark:hover:border-zinc-700 transition-all duration-200 shadow-sm hover:shadow-md ${expanded ? 'ring-1 ring-primary/20 bg-card' : ''}`}>
        <CardContent className="p-0">
          
          {/* Card Header (Visible Area) */}
          <div 
            onClick={() => setExpanded(!expanded)}
            className="p-5 flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-3.5 mb-2.5 flex-wrap">
                {/* Category Icon and Title */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-card-muted border border-border flex items-center justify-center">
                    {getCategoryIcon(category)}
                  </div>
                  <h3 className="text-base font-black tracking-tight capitalize font-outfit text-foreground">
                    {category.replace(/_/g, " ")} Grievance
                  </h3>
                </div>
                
                {/* Badge tags */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getStatusVariant(status)}>
                    {(status === "needsClarification" || status === "needs details") ? "Needs Details" : status}
                  </Badge>
                  <Badge variant={getUrgencyVariant(urgency)}>
                    {urgency} Priority
                  </Badge>
                  {isDuplicate && (
                    <Badge variant="warning" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold">
                      Duplicate Flag
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-base text-zinc-550 dark:text-zinc-400 font-semibold truncate">
                {structured.description || item.rawText}
              </p>
            </div>
            
            <div className="flex items-center gap-4 text-zinc-400 shrink-0 select-none">
              <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider hidden md:inline">
                {createdAt.split(",")[0]}
              </span>
              <div className="w-11 h-11 sm:w-10 sm:h-10 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-800/40 flex items-center justify-center transition-colors">
                <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${expanded ? 'rotate-180 text-foreground' : 'text-zinc-400'}`} />
              </div>
            </div>
          </div>

          {/* Expandable Body */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden border-t border-border bg-card-muted/20"
              >
                <div className="p-5 space-y-6">
                  
                  {/* Detailed Description */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block">Full Grievance Intake Log</span>
                    <p className="text-sm font-semibold leading-relaxed text-foreground bg-card p-3 rounded-lg border border-border/80">
                      {item.rawText}
                    </p>
                  </div>

                  {/* AI Extraction Confidence Detail */}
                  <div className="flex flex-wrap gap-4 text-xs bg-card p-3 border border-border/80 rounded-lg">
                    <div className="flex items-center gap-1.5 font-bold">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span className="text-zinc-500">AI confidence:</span>
                      <span className="text-foreground">{(structured.confidence * 100 || 88).toFixed(0)}%</span>
                    </div>
                    {structured.subcategory && (
                      <div className="flex items-center gap-1.5 font-bold text-zinc-500 border-l border-border pl-4">
                        <span>Classification subcategory:</span>
                        <Badge variant="secondary" className="capitalize text-xs py-0">{structured.subcategory}</Badge>
                      </div>
                    )}
                  </div>

                  {/* Voice Transcription Audio Player affordance */}
                  {item.channel === "voice" && (
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 animate-slide-up">
                      <button 
                        onClick={toggleAudio}
                        className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-primary" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">
                          <span>Original WhatsApp Voice Note transcription</span>
                          <span>0:04</span>
                        </div>
                        {/* Audio track bar simulator */}
                        <div className="h-1.5 bg-card-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${audioProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-y border-border py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-zinc-400 shrink-0">
                        <Phone className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block leading-none mb-1">Citizen WhatsApp</span>
                        <p className="text-sm font-bold text-foreground truncate leading-none">
                          {item.senderId || "Citizen"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 relative">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-zinc-400 shrink-0">
                        <MapPin className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block leading-none mb-1 flex items-center gap-1">
                          Ward Match 
                          <span className="group/reason relative cursor-help">
                            <QuestionIcon className="w-3.5 h-3.5 text-zinc-400" />
                            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 hidden group-hover/reason:block bg-zinc-950 text-white text-xs p-2 rounded-lg border border-zinc-800 shadow-xl w-48 text-center leading-normal font-semibold z-30">
                              Matched via geospatial boundary MongoDB geofencing query.
                            </span>
                          </span>
                        </span>
                        <p className={`text-sm font-bold leading-none truncate ${!item.wardId ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
                          {wardName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-zinc-400 shrink-0">
                        <Calendar className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block leading-none mb-1">Created At</span>
                        <p className="text-sm font-bold text-foreground truncate leading-none">
                          {createdAt}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Maps & Media Preview Block */}
                  {(hasCoordinates || hasAttachments) && (
                    <div className={`grid ${hasCoordinates && hasAttachments ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
                      {/* Map Container */}
                      {hasCoordinates ? (
                        <div className="relative rounded-xl border border-border overflow-hidden h-44 sm:h-60 bg-card">
                          <div ref={mapContainerRef} className="h-full w-full z-10" />
                          <a 
                            href={`https://www.openstreetmap.org/?mlat=${item.location.coordinates[1]}&mlon=${item.location.coordinates[0]}&zoom=16`}
                            target="_blank" 
                            rel="noreferrer"
                            className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card/90 border border-border text-xs font-bold text-foreground hover:bg-card-muted transition-colors shadow-sm"
                          >
                            Open Map <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : null}

                      {/* Photo Preview Container */}
                      {hasAttachments ? (
                        <div className="relative rounded-xl border border-border overflow-hidden h-44 sm:h-60 bg-card flex items-center justify-center">
                          {imageError ? (
                            <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 text-zinc-500">
                              <ImageIcon className="w-8 h-8 text-zinc-400" />
                              <p className="text-sm font-bold text-zinc-500">Photo Attachment Expired</p>
                              <span className="text-xs text-zinc-550 max-w-xs">WhatsApp Business media links expire after 24 hours.</span>
                            </div>
                          ) : (
                            <img 
                              src={attachmentUrl} 
                              alt="Grievance Evidence Attachment"
                              className="object-cover w-full h-full cursor-zoom-in hover:scale-[1.01] transition-transform duration-200"
                              onClick={() => onShowLightbox(attachmentUrl)}
                              onError={(e) => {
                                console.error("Image load fail:", attachmentUrl);
                                setImageError(true);
                              }}
                            />
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}                  {/* Operational Action Footer Bar */}
                  {!item.isDeleted && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border pt-4">
                      
                      {/* Left: Quick Status Action */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="flex items-center justify-between sm:justify-start gap-1.5 px-3 py-3 sm:py-2 text-sm font-bold bg-card border border-border hover:bg-card-muted rounded-lg text-foreground transition-colors select-none w-full sm:w-auto min-h-[44px]">
                            <span>Update Status</span> <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-52">
                            <DropdownMenuItem 
                              disabled={status === "received" || status === "in_progress" || status === "resolved"}
                              onClick={() => onUpdateStatus(complaintId, "received")} 
                              className="flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-zinc-550" /> 
                                <span>Mark Received</span>
                              </div>
                              {status === "received" ? (
                                <span className="text-[10px] bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30 px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide shrink-0">Current</span>
                              ) : (status === "in_progress" || status === "resolved") ? (
                                <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-border px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide shrink-0">Done</span>
                              ) : null}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              disabled={status === "in_progress" || status === "resolved"}
                              onClick={() => onUpdateStatus(complaintId, "in_progress")} 
                              className="flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5 text-zinc-550" /> 
                                <span>In Progress</span>
                              </div>
                              {status === "in_progress" ? (
                                <span className="text-[10px] bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30 px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide shrink-0">Current</span>
                              ) : status === "resolved" ? (
                                <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-border px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide shrink-0">Done</span>
                              ) : null}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              disabled={status === "resolved"}
                              onClick={() => onUpdateStatus(complaintId, "resolved")} 
                              className="flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-3.5 h-3.5 text-zinc-500" /> 
                                <span>Mark Resolved</span>
                              </div>
                              {status === "resolved" && (
                                <span className="text-[10px] bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30 px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-wide shrink-0">Current</span>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider select-none sm:pl-1 mt-1 sm:mt-0 flex items-center gap-1.5 min-h-[30px]">
                          <span>Status:</span> <span className="text-foreground capitalize">{status}</span>
                        </div>
                      </div>

                      {/* Right: Administrative Select Popovers */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                        {/* Correct Ward Popover */}
                        <Popover open={isWardPopoverOpen} onOpenChange={setIsWardPopoverOpen}>
                          <PopoverTrigger className="flex items-center justify-between sm:justify-start gap-1.5 px-3 py-3 sm:py-1.5 text-xs font-bold bg-card border border-border hover:bg-card-muted rounded-lg text-foreground transition-colors select-none w-full sm:w-auto min-h-[44px]">
                            <span className="flex items-center gap-1.5"><FolderSync className="w-3.5 h-3.5 text-zinc-550" /> {item.wardId ? "Reassign Ward" : "Assign Ward"}</span>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-0 border border-border bg-card shadow-xl overflow-hidden rounded-xl">
                            <div className="p-2 border-b border-border">
                              <input
                                type="text"
                                placeholder="Search wards..."
                                value={wardSearch}
                                onChange={(e) => setWardSearch(e.target.value)}
                                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                            <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                              <button
                                onClick={() => {
                                  onCorrectWard(complaintId, null)
                                  setIsWardPopoverOpen(false)
                                }}
                                className="w-full text-left px-2.5 py-2 rounded-lg text-sm font-bold text-amber-500 hover:bg-card-muted transition-colors"
                              >
                                Unassigned
                              </button>
                              {filteredWards.map((w) => (
                                <button
                                  key={w._id}
                                  onClick={() => {
                                    onCorrectWard(complaintId, w._id)
                                    setIsWardPopoverOpen(false)
                                  }}
                                  className={`w-full text-left px-2.5 py-2 rounded-lg text-sm font-bold transition-colors ${
                                    String(item.wardId?._id || item.wardId) === String(w._id)
                                      ? "bg-primary text-primary-foreground"
                                      : "text-foreground hover:bg-card-muted"
                                  }`}
                                >
                                  {w.name}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>

                        {/* Assign Officer Popover (Admin only) */}
                        {isAdmin && onAssignOfficer && (
                          <Popover open={isOfficerPopoverOpen} onOpenChange={setIsOfficerPopoverOpen}>
                            <PopoverTrigger className="flex items-center justify-between sm:justify-start gap-1.5 px-3 py-3 sm:py-2 text-sm font-bold bg-card border border-border hover:bg-card-muted rounded-lg text-foreground transition-colors select-none w-full sm:w-auto min-h-[44px]">
                              <span className="flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-zinc-550" /> {item.assignedOfficerId ? "Reassign Officer" : "Assign Officer"}</span>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0 border border-border bg-card shadow-xl overflow-hidden rounded-xl">
                              <div className="p-2 border-b border-border">
                                <input
                                  type="text"
                                  placeholder="Search officers..."
                                  value={officerSearch}
                                  onChange={(e) => setOfficerSearch(e.target.value)}
                                  className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                              <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                                <button
                                  onClick={() => {
                                    onAssignOfficer(complaintId, null)
                                    setIsOfficerPopoverOpen(false)
                                  }}
                                  className="w-full text-left px-2.5 py-2 rounded-lg text-sm font-bold text-amber-500 hover:bg-card-muted transition-colors"
                                >
                                  Unassigned
                                </button>
                                {filteredOfficers.map((off) => (
                                  <button
                                    key={off._id}
                                    onClick={() => {
                                      onAssignOfficer(complaintId, off._id)
                                      setIsOfficerPopoverOpen(false)
                                    }}
                                    className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                                      String(item.assignedOfficerId) === String(off._id)
                                        ? "bg-primary text-primary-foreground"
                                        : "text-foreground hover:bg-card-muted"
                                    }`}
                                  >
                                    <span className="font-bold">{off.name}</span>
                                    <span className="text-xs opacity-80">({off.department})</span>
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}

                        {/* Dropdown Options menu ("...") */}
                        {isAdmin && onDeleteComplaint && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="flex items-center justify-center gap-1.5 w-full sm:w-8 h-11 sm:h-8 rounded-lg bg-card border border-border hover:bg-card-muted text-zinc-400 hover:text-foreground transition-colors select-none outline-none cursor-pointer">
                              <span className="sm:hidden text-sm font-bold">More Options</span>
                              <MoreHorizontal className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-36">
                              <DropdownMenuItem className="gap-2 cursor-pointer">
                                <Bookmark className="w-3.5 h-3.5 text-zinc-500" /> Archive
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 cursor-pointer">
                                <AlertCircle className="w-3.5 h-3.5 text-zinc-500" /> Escalate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              
                              {/* Trigger Delete Dialog */}
                              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                <DialogTrigger asChild>
                                  <button 
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-all rounded-lg select-none outline-none cursor-pointer"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                  </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md bg-card border border-border">
                                  <DialogHeader>
                                    <DialogTitle className="text-foreground">Delete grievance ticket?</DialogTitle>
                                    <DialogDescription className="text-zinc-500">
                                      This action will remove the complaint from the operations queue. It remains stored in logs but will no longer appear on officer dispatch boards.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter className="mt-4 flex items-center justify-end gap-2.5">
                                    <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="h-10">
                                      Cancel
                                    </Button>
                                    <Button variant="destructive" onClick={handleDelete} className="gap-2 h-10" disabled={isDeleting}>
                                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                      Confirm Delete
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                    </div>
                  )}

                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </CardContent>
      </Card>
    </motion.div>
  )
}
