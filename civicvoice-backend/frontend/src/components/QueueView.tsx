import React, { useState } from "react"
import { Search, Inbox, SlidersHorizontal, AlertCircle } from "lucide-react"
import ComplaintCard from "./ComplaintCard"

interface QueueViewProps {
  complaints: any[]
  isAdmin: boolean
  cachedWards: any[]
  cachedOfficers: any[]
  onUpdateStatus: (id: string, status: string) => Promise<void>
  onCorrectWard: (id: string, wardId: string | null) => Promise<void>
  onAssignOfficer?: (id: string, officerId: string | null) => Promise<void>
  onDeleteComplaint?: (id: string) => Promise<void>
  onShowLightbox: (url: string) => void
  loading: boolean
}

export default function QueueView({
  complaints,
  isAdmin,
  cachedWards,
  cachedOfficers,
  onUpdateStatus,
  onCorrectWard,
  onAssignOfficer,
  onDeleteComplaint,
  onShowLightbox,
  loading
}: QueueViewProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const filtered = complaints.filter((c) => {
    const rawText = c.rawText?.toLowerCase() || ""
    const category = c.structured?.category?.toLowerCase() || ""
    const sender = c.senderId?.toLowerCase() || ""
    const desc = c.structured?.description?.toLowerCase() || ""
    const search = searchTerm.toLowerCase()

    return rawText.includes(search) || category.includes(search) || sender.includes(search) || desc.includes(search)
  })

  return (
    <div className="space-y-4">
      {/* Search toolbar bar */}
      <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2.5 shadow-sm">
        <Search className="w-4 h-4 text-zinc-400 shrink-0" />
        <input
          type="text"
          placeholder="Filter dispatch queue by phone, category name, or AI description summary..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent border-none text-sm font-semibold text-foreground focus:outline-none placeholder:text-zinc-400"
        />
      </div>

      {/* Loading state skeleton list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 bg-card/60 border border-border rounded-xl animate-pulse flex items-center justify-between px-5">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-card-muted rounded w-1/4" />
                <div className="h-3 bg-card-muted rounded w-1/2" />
              </div>
              <div className="h-3 bg-card-muted rounded w-20" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        /* Empty queue view design */
        <div className="border border-dashed border-border rounded-2xl flex flex-col items-center justify-center p-12 text-center text-zinc-500 bg-card-muted/10 transition-colors">
          <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center text-zinc-405 mb-4 shadow-sm">
            <Inbox className="w-5 h-5" />
          </div>
          <h4 className="text-foreground font-black text-base mb-1 font-outfit">Queue is empty</h4>
          <p className="text-sm max-w-xs leading-relaxed text-zinc-400 font-semibold">
            No complaints matching current filters were found in the dispatcher dashboard.
          </p>
        </div>
      ) : (
        /* Queue listing with animations */
        <div className="space-y-3">
          {filtered.map((item) => {
            // Client-side duplicate detection based on same text, phone and 30-min window
            const isDup = complaints.some((other) => 
              other._id !== item._id && 
              other.senderId === item.senderId && 
              other.rawText === item.rawText && 
              Math.abs(new Date(other.createdAt).getTime() - new Date(item.createdAt).getTime()) < 30 * 60 * 1000
            )

            return (
              <ComplaintCard
                key={item._id}
                item={item}
                isAdmin={isAdmin}
                cachedWards={cachedWards}
                cachedOfficers={cachedOfficers}
                onUpdateStatus={onUpdateStatus}
                onCorrectWard={onCorrectWard}
                onAssignOfficer={onAssignOfficer}
                onDeleteComplaint={onDeleteComplaint}
                onShowLightbox={onShowLightbox}
                isDuplicate={isDup}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
