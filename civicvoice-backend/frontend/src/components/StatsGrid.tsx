import React from "react"
import { Card, CardContent } from "./ui/Card"
import { 
  Inbox, 
  Clock, 
  Activity, 
  CheckCircle2,
  TrendingUp,
  TrendingDown
} from "lucide-react"

interface StatsProps {
  stats: {
    total: number
    received: number
    inProgress: number
    resolved: number
  }
}

export default function StatsGrid({ stats }: StatsProps) {
  // Sparkline generator helper
  const drawSparkline = (points: number[], colorClass: string) => {
    const width = 100
    const height = 30
    const max = Math.max(...points, 1)
    const min = Math.min(...points, 0)
    const range = max - min
    
    const coordinates = points.map((p, index) => {
      const x = (index / (points.length - 1)) * width
      const y = height - ((p - min) / range) * height
      return `${x},${y}`
    }).join(" ")

    return (
      <svg className="w-24 h-8 opacity-60" viewBox={`0 0 ${width} ${height}`}>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={colorClass}
          points={coordinates}
        />
      </svg>
    )
  }

  const cards = [
    {
      title: "Total Complaints",
      value: stats.total,
      icon: Inbox,
      color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
      sparkline: drawSparkline([10, 15, 8, 20, 14, 25, stats.total], "text-blue-500"),
      trend: { label: "+12.5% vs last week", up: true }
    },
    {
      title: "Received Queue",
      value: stats.received,
      icon: Clock,
      color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
      sparkline: drawSparkline([5, 12, 10, 15, 6, 8, stats.received], "text-amber-500"),
      trend: { label: "-3.2% vs yesterday", up: false }
    },
    {
      title: "In Progress",
      value: stats.inProgress,
      icon: Activity,
      color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
      sparkline: drawSparkline([8, 10, 14, 18, 12, 16, stats.inProgress], "text-indigo-500"),
      trend: { label: "+5.4% new assignment", up: true }
    },
    {
      title: "Resolved Issues",
      value: stats.resolved,
      icon: CheckCircle2,
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      sparkline: drawSparkline([12, 18, 22, 28, 32, 38, stats.resolved], "text-emerald-500"),
      trend: { label: "92% completion rate", up: true }
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((card, i) => {
        const Icon = card.icon
        const TrendIcon = card.trend.up ? TrendingUp : TrendingDown
        return (
          <Card key={i} className="hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 bg-card border-border">
            <CardContent className="p-5 flex flex-col justify-between h-36">
              {/* Top Row: Icon and Title */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 tracking-wide uppercase">{card.title}</span>
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              {/* Middle Row: Large Value & Sparkline */}
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-4xl font-extrabold text-foreground tracking-tight font-outfit">
                  {card.value}
                </span>
                <div className="flex items-center shrink-0">
                  {card.sparkline}
                </div>
              </div>

              {/* Bottom Row: Trend indicators */}
              <div className="flex items-center justify-between border-t border-border/40 pt-2.5 mt-2">
                <div className="flex items-center gap-1">
                  <TrendIcon className={`w-3.5 h-3.5 ${card.trend.up ? "text-emerald-500" : "text-amber-500"}`} />
                  <span className={`text-xs font-bold ${card.trend.up ? "text-emerald-500" : "text-amber-500"}`}>
                    {card.trend.label}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
