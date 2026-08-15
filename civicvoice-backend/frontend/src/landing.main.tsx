import React, { useState, useEffect } from "react"
import ReactDOM from "react-dom/client"
import { motion, AnimatePresence } from "framer-motion"
import {
  Building2,
  Moon,
  Sun,
  MessageSquare,
  FileText,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  MapPin,
  Mic,
  Camera,
  Languages,
  Check,
  Loader2,
  X,
  Lock,
  Phone,
  ShieldCheck,
  UserCheck,
  Cpu,
  Network,
  Calendar,
  AlertTriangle,
  Menu
} from "lucide-react"

import "./index.css"
import { Button } from "./components/ui/Button"
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/Card"
import { Badge } from "./components/ui/Badge"

export default function LandingApp() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("theme") === "dark"
  })

  const [showLogin, setShowLogin] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [loginRole, setLoginRole] = useState<'citizen' | 'officer' | 'admin'>('citizen')

  // Tab states for Citizen Portal
  const [citizenLoginMode, setCitizenLoginMode] = useState<'password' | 'otp' | 'lookup'>('password')

  // Login credentials
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [authError, setAuthError] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Citizen OTP Flow states
  const [citizenPhone, setCitizenPhone] = useState("")
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request')
  const [otpCode, setOtpCode] = useState("")
  const [newOtpPassword, setNewOtpPassword] = useState("")
  const [otpFeedback, setOtpFeedback] = useState("")
  const [isOtpLoading, setIsOtpLoading] = useState(false)

  // Citizen Quick Lookup states
  const [lookupComplaintId, setLookupComplaintId] = useState("")
  const [lookupFeedback, setLookupFeedback] = useState("")
  const [isLookupLoading, setIsLookupLoading] = useState(false)

  // Officer Forgot Password states
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotOfficerId, setForgotOfficerId] = useState("")
  const [forgotFeedback, setForgotFeedback] = useState("")
  const [isForgotLoading, setIsForgotLoading] = useState(false)

  // Sync dark class on mount and state change
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
    localStorage.setItem("theme", isDark ? "dark" : "light")
  }, [isDark])

  // Open login if URL has ?openLogin=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("openLogin") === "true") {
      setShowLogin(true)
    }
  }, [])

  // Dynamic typing WhatsApp message bubbles simulator
  const chatMessages = [
    { sender: "user", text: "Hi", time: "10:00 AM" },
    {
      sender: "bot",
      text: "👋 Welcome to CivicVoice / नागरिक सेवेत आपले स्वागत आहे!\n\nPlease select your language:",
      buttons: ["1. English", "2. मराठी", "3. हिंदी"],
      time: "10:00 AM"
    },
    { sender: "user", text: "2. मराठी", time: "10:01 AM" },
    {
      sender: "bot",
      text: "नागरिक सेवा हेल्पडेस्क 🏛️\nकृपया तुमच्या समस्येचे वर्णन करा (टाईप करा, व्हॉईस नोट किंवा फोटो पाठवा).",
      time: "10:01 AM"
    },
    {
      sender: "user",
      text: "🎙️ Voice Note (0:08)\n\"संजीवनी कॉलेज रोडवर कचरा साचला आहे व दुर्गंधी सुटली आहे.\"",
      time: "10:02 AM"
    },
    {
      sender: "user",
      text: "📷 [Photo Attached: Waste Overflow]",
      time: "10:02 AM"
    },
    {
      sender: "bot",
      text: "✅ व्हॉईस नोट व फोटो प्राप्त झाले!\nमाहिती पूर्ण असल्यास 'Done' दाबा.",
      buttons: ["✅ Done", "❌ Cancel"],
      time: "10:02 AM"
    },
    { sender: "user", text: "✅ Done", time: "10:03 AM" },
    {
      sender: "bot",
      text: "📍 वॉर्ड मॅचिंगसाठी कृपया तुमचे अचूक लोकेशन शेअर करा.",
      time: "10:03 AM"
    },
    {
      sender: "user",
      text: "📍 Location Pin Shared: Sanjivani Campus Area, Kopargaon",
      time: "10:03 AM"
    },
    {
      sender: "bot",
      text: "🎉 *तक्रार यशस्वीरित्या नोंदवली गेली आहे!*\n• Reference No: #CV-2026-894\n• वर्ग: स्वच्छता व कचरा व्यवस्थापन\n• वॉर्ड: Ward No. 3 (Auto-Geocoded)\n• अधिकारी: श्री. आर. के. पाटील\n\nस्थिती पाहण्यासाठी कधीही STATUS लिहा.",
      time: "10:04 AM"
    }
  ]

  const [activeMessages, setActiveMessages] = useState<any[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const chatContainerRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [activeMessages])

  useEffect(() => {
    if (showLogin) return
    let active = true

    const triggerChatSequence = async () => {
      while (active) {
        setActiveMessages([])
        await new Promise(r => setTimeout(r, 1000))
        for (let i = 0; i < chatMessages.length; i++) {
          if (!active) return
          if (chatMessages[i].sender === "bot") {
            setIsTyping(true)
            await new Promise(r => setTimeout(r, 1500))
            setIsTyping(false)
          } else {
            await new Promise(r => setTimeout(r, 800))
          }
          if (!active) return
          setActiveMessages(prev => [...prev, chatMessages[i]])
          await new Promise(r => setTimeout(r, 3000))
        }
        await new Promise(r => setTimeout(r, 6000))
      }
    }

    triggerChatSequence()
    return () => { active = false }
  }, [showLogin])

  // Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    const loginUser = loginRole === 'citizen' ? citizenPhone : username
    if (!loginUser || !password) {
      setAuthError("Please fill in all credentials")
      return
    }
    setIsLoggingIn(true)
    try {
      if (loginRole === 'citizen') {
        const response = await fetch("/api/citizen/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: loginUser, password })
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data.message || "Invalid phone or password")
        }
        setTimeout(() => {
          window.location.href = `citizen-dashboard.html?token=${encodeURIComponent(data.token)}`
        }, 500)
      } else {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: loginUser, username: loginUser, password }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data.message || "Invalid credentials")
        }

        const token = data.token
        const role = data.user?.role || data.role || 'user'

        setTimeout(() => {
          if (role === "officer") {
            window.location.href = `officer-dashboard.html?token=${encodeURIComponent(token)}`
          } else {
            window.location.href = `dashboard.html?token=${encodeURIComponent(token)}&role=${encodeURIComponent(role)}`
          }
        }, 500)
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed")
    } finally {
      setIsLoggingIn(false)
    }
  }

  // Request WhatsApp OTP
  const handleRequestOtp = async () => {
    setOtpFeedback("")
    if (!citizenPhone) {
      setOtpFeedback("Please enter your phone number first")
      return
    }
    setIsOtpLoading(true)
    try {
      const res = await fetch("/api/citizen/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: citizenPhone })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.message || "Failed to send verification code")
      }
      setOtpStep('verify')
      setOtpFeedback("Verification code sent to your WhatsApp!")
    } catch (err: any) {
      setOtpFeedback(err.message || "Failed to request code")
    } finally {
      setIsOtpLoading(false)
    }
  }

  // Verify OTP and Set Password
  const handleVerifyOtp = async () => {
    setOtpFeedback("")
    if (!otpCode || !newOtpPassword) {
      setOtpFeedback("Please fill in OTP code and new password")
      return
    }
    setIsOtpLoading(true)
    try {
      const res = await fetch("/api/citizen/verify-otp-set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: citizenPhone, otp: otpCode, newPassword: newOtpPassword })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.message || "Invalid OTP code")
      }
      setOtpFeedback("Password configured successfully! You can login now.")
      setCitizenLoginMode('password')
      setOtpStep('request')
    } catch (err: any) {
      setOtpFeedback(err.message || "Failed to verify code")
    } finally {
      setIsOtpLoading(false)
    }
  }

  // Citizen Reference Code Quick Lookup
  const handleQuickLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLookupFeedback("")
    if (!citizenPhone || !lookupComplaintId) {
      setLookupFeedback("Please enter both phone and complaint ID")
      return
    }
    setIsLookupLoading(true)
    try {
      const res = await fetch("/api/citizen/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: citizenPhone, complaintId: lookupComplaintId })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.message || "No matching grievance found")
      }
      // Successful lookup -> redirect to citizen dashboard in lookup mode
      window.location.href = `citizen-dashboard.html?phone=${encodeURIComponent(citizenPhone)}&complaintId=${encodeURIComponent(lookupComplaintId)}`
    } catch (err: any) {
      setLookupFeedback(err.message || "Lookup failed. Verify details.")
    } finally {
      setIsLookupLoading(false)
    }
  }

  // Officer Reset Request via Modal
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotFeedback("")
    if (!forgotOfficerId) {
      setForgotFeedback("Officer ID is required")
      return
    }
    setIsForgotLoading(true)
    try {
      const res = await fetch("/api/officer/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officerId: forgotOfficerId })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.message || "Failed to request reset")
      }
      setForgotFeedback("Request submitted to administrator review queue successfully.")
      setTimeout(() => {
        setShowForgotPassword(false)
        setForgotOfficerId("")
        setForgotFeedback("")
      }, 3000)
    } catch (err: any) {
      setForgotFeedback(err.message || "Request failed")
    } finally {
      setIsForgotLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex flex-col font-outfit bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors`}>

      {/* Sticky Header Nav Bar */}
      <header className="h-16 sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800 px-6 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center text-primary shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight font-outfit block leading-none">CivicVoice</span>
            <span className="text-xs font-bold text-zinc-500 dark:text-slate-400 uppercase tracking-widest leading-none block mt-1">Smart City Redressal</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-slate-400">
          <a href="#features" className="hover:text-primary transition-colors">System Features</a>
          <a href="#how-it-works" className="hover:text-primary transition-colors">Process Flow</a>
          <a href="#pipeline" className="hover:text-primary transition-colors">AI Pipeline</a>
        </nav>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDark(!isDark)}
            className="text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          <Button
            onClick={() => {
              setLoginRole('citizen')
              setShowLogin(true)
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm px-4 py-2.5 h-10"
          >
            Sign In Portal
          </Button>
        </div>

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDark(!isDark)}
            className="text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-zinc-100 h-11 w-11"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-zinc-500 dark:text-slate-400 hover:text-zinc-950 dark:hover:text-zinc-50 h-11 w-11"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile navigation dropdown */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-b border-border bg-card/95 backdrop-blur-md px-6 py-4 flex flex-col gap-4 text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-slate-400 sticky top-16 z-30 shadow-md overflow-hidden"
          >
            <a
              href="#features"
              onClick={() => setIsMobileMenuOpen(false)}
              className="hover:text-primary transition-colors py-2"
            >
              System Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setIsMobileMenuOpen(false)}
              className="hover:text-primary transition-colors py-2"
            >
              Process Flow
            </a>
            <a
              href="#pipeline"
              onClick={() => setIsMobileMenuOpen(false)}
              className="hover:text-primary transition-colors py-2"
            >
              AI Pipeline
            </a>
            <hr className="border-border my-1" />
            <Button
              onClick={() => {
                setLoginRole('citizen')
                setShowLogin(true)
                setIsMobileMenuOpen(false)
              }}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm h-11"
            >
              Sign In Portal
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {!showLogin ? (
            /* Redesigned Hero Landing Page view */
            <motion.main
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              {/* Hero section with mesh gradient overlay background */}
              <div className="relative overflow-hidden w-full border-b border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 transition-colors">
                {/* High-tech mesh gradient overlay */}
                <div
                  className="absolute inset-0 -z-10 pointer-events-none"
                  style={{
                    backgroundImage: `
                      radial-gradient(circle at 20% 30%, rgba(79, 70, 229, 0.15) 0%, transparent 60%),
                      radial-gradient(circle at 80% 70%, rgba(16, 185, 129, 0.12) 0%, transparent 60%),
                      radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.05) 0%, transparent 80%)
                    `,
                  }}
                />

                {/* Subtle dark dot-grid overlay */}
                <div
                  className="absolute inset-0 -z-10 pointer-events-none opacity-[0.08] dark:opacity-[0.15]"
                  style={{
                    backgroundImage: 'radial-gradient(#000000 1.5px, transparent 1.5px)',
                    backgroundSize: '24px 24px'
                  }}
                />

                <section className="relative pt-16 pb-20 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                  {/* Left side Callouts */}
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold px-3 py-1 rounded-full">
                      <Sparkles className="w-3.5 h-3.5" /> Groq LLaMA 3.3-70B AI Integration
                    </div>

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight font-outfit text-slate-900 dark:text-white">
                      Civic Grievances <br />
                      <span className="bg-gradient-to-r from-indigo-600 to-emerald-500 bg-clip-text text-transparent">
                        Redressed Instantly
                      </span>
                    </h1>

                    <p className="text-base text-slate-600 dark:text-slate-300 max-w-lg leading-relaxed font-semibold">
                      No apps to install. Citizens report issues in English, Marathi, or Hindi purely over WhatsApp. CivicVoice transcribes voice, visualizes photos, geocodes wards, and dispatches officers automatically.
                    </p>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-4">
                      <Button
                        onClick={() => setShowLogin(true)}
                        className="bg-primary hover:bg-primary/95 text-white font-semibold px-6 py-3.5 text-sm gap-2 shadow-lg shadow-primary/20 h-fit"
                      >
                        Access Dashboard <ArrowRight className="w-4 h-4" />
                      </Button>

                      {/* Official WhatsApp Helpline CTA Card */}
                      <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-md dark:shadow-none flex-1 max-w-xs transition-all duration-300 hover:shadow-lg">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1.5 leading-none">
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            WhatsApp Bot Live • Multi-Language (EN | MR | HI)
                          </span>
                        </div>
                        <div className="text-slate-800 dark:text-slate-200 font-mono text-sm font-bold mb-2 tracking-wider leading-none">
                          +1 (555) 176-5246
                        </div>
                        <a
                          href="https://wa.me/15551765246?text=Hi"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-xl transition-all duration-300 shadow-md hover:shadow-emerald-500/20 w-full gap-1.5"
                        >
                          Chat on WhatsApp 💬
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Right side WhatsApp Mockup Screen animation */}
                  <div className="flex justify-center relative">
                    <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full -z-10 animate-pulse" />

                    {/* Sleek, modern smartphone device frame */}
                    <div className="w-[312px] h-[562px] border-[6px] border-slate-800 bg-slate-900 rounded-[36px] shadow-2xl overflow-hidden flex flex-col relative transition-colors z-10">

                      {/* Phone notch */}
                      <div className="w-32 h-5 bg-slate-800 rounded-b-2xl absolute top-0 left-[50%] translate-x-[-50%] z-20 flex items-center justify-center">
                        <div className="w-10 h-1 bg-slate-900 rounded-full" />
                      </div>

                      {/* WhatsApp Header bar */}
                      <div className="absolute top-0 left-0 right-0 z-10 bg-[#00a884] text-white dark:bg-[#202c33] dark:text-slate-100 dark:border-slate-800 px-4 pt-7 pb-3 flex items-center gap-3 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-100">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-white dark:text-slate-100 truncate">CivicVoice Helpdesk</h4>
                          <span className="text-[10px] text-emerald-100 dark:text-emerald-400 font-bold block leading-none mt-0.5">Online &amp; Active</span>
                        </div>
                      </div>

                      {/* WhatsApp Messages stream with background wallpaper */}
                      <div
                        ref={chatContainerRef}
                        className="relative flex-1 overflow-y-auto max-h-[562px] bg-[#efeae2] dark:bg-[#0b141a] px-3 pt-16 pb-14 space-y-2 overscroll-contain [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300/60 [&::-webkit-scrollbar-thumb]:rounded-full"
                        style={{ overscrollBehavior: 'contain', overflowAnchor: 'none' }}
                      >
                        {/* WhatsApp Background Wallpaper Overlay */}
                        <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.03] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />

                        <AnimatePresence>
                          {activeMessages.map((msg, idx) => {
                            const isBot = msg.sender === "bot"
                            return isBot ? (
                              /* Bot message (Left aligned) */
                              <div key={idx} className="flex w-full justify-start my-1 z-10">
                                <motion.div
                                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                  className="max-w-[80%] bg-white text-slate-900 border border-slate-200 dark:bg-[#202c33] dark:text-slate-100 dark:border-slate-700 shadow-sm rounded-2xl rounded-tl-none px-3.5 py-2 text-sm text-left relative"
                                >
                                  <div className="space-y-2">
                                    <p className="whitespace-pre-line">{msg.text}</p>
                                    {msg.buttons && (
                                      <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                        {msg.buttons.map((btnText: string, bIdx: number) => (
                                          <div
                                            key={bIdx}
                                            className="bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-medium px-3 py-1 rounded-lg text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer select-none"
                                          >
                                            {btnText}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-1 ml-2 inline-block float-right font-mono">
                                    {msg.time}
                                  </span>
                                </motion.div>
                              </div>
                            ) : (
                              /* User message (Right aligned) */
                              <div key={idx} className="flex w-full justify-end my-1 z-10">
                                <motion.div
                                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                  className="max-w-[80%] bg-[#d9fdd3] text-slate-900 dark:bg-[#005c4b] dark:text-slate-50 shadow-sm rounded-2xl rounded-tr-none px-3.5 py-2 text-sm relative text-left"
                                >
                                  {msg.type === "location" ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1 text-xs uppercase tracking-wider font-bold">
                                        <MapPin className="w-3.5 h-3.5" /> GPS Coordinates
                                      </div>
                                      <p className="font-extrabold">{msg.name}</p>
                                      <span className="text-xs block opacity-80 font-mono">({msg.lat}, {msg.lng})</span>
                                    </div>
                                  ) : (
                                    <p className="whitespace-pre-line">{msg.text}</p>
                                  )}
                                  <span className="text-[10px] text-slate-500 dark:text-indigo-100/80 text-right mt-1 ml-2 inline-block float-right font-mono">
                                    {msg.time}
                                  </span>
                                </motion.div>
                              </div>
                            )
                          })}
                        </AnimatePresence>
                        {isTyping && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-white border border-slate-200 dark:bg-[#202c33] dark:border-slate-700 shadow-sm self-start rounded-2xl rounded-tl-none px-3.5 py-2.5 z-10 flex items-center gap-1 w-12 justify-center"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-400 animate-bounce" />
                          </motion.div>
                        )}
                      </div>

                      {/* WhatsApp Footer input */}
                      <div className="absolute bottom-0 left-0 right-0 z-10 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-slate-200 dark:border-slate-800 p-2.5 flex items-center gap-2">
                        <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-400 flex items-center justify-between">
                          <span>Report an issue...</span>
                          <div className="flex gap-2">
                            <Camera className="w-3.5 h-3.5 text-zinc-400" />
                            <Mic className="w-3.5 h-3.5 text-zinc-400" />
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center text-white text-xs shadow-sm">
                          <MessageSquare className="w-3.5 h-3.5" />
                        </div>
                      </div>

                    </div>
                  </div>

                </section>
              </div>

              {/* How CivicVoice Understands You - AI Pipeline Strip */}
              <section id="pipeline" className="py-12 bg-slate-50 dark:bg-slate-950 border-y border-slate-200/60 dark:border-slate-800 transition-colors">
                <div className="max-w-7xl mx-auto px-6">
                  <div className="text-center space-y-2 mb-10">
                    <h2 className="text-2xl font-black font-outfit text-slate-900 dark:text-white">How CivicVoice Underpins Trust</h2>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">A secure, layered automated pipeline</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                      { step: "01", icon: Mic, name: "Intake Channel", desc: "Citizen messages voice note, photo, or text in English, Hindi, or Marathi.", color: "text-blue-500 bg-blue-500/10" },
                      { step: "02", icon: Cpu, name: "AI Extraction", desc: "LLaMA 3.3 classifies category/confidence. Low-confidence marked 'Needs Details'.", color: "text-indigo-500 bg-indigo-500/10" },
                      { step: "03", icon: Network, name: "Geospatial Matching", desc: "OpenStreetMap Nominatim parses bounds, geofencing reports to correct wards.", color: "text-emerald-500 bg-emerald-500/10" },
                      { step: "04", icon: UserCheck, name: "Fallback Routing", desc: "Auto-assigned to officer by category rules, fallback layers, or ward queue.", color: "text-amber-500 bg-amber-500/10" }
                    ].map((pipeline, i) => {
                      const Icon = pipeline.icon
                      return (
                        <div key={i} className="group relative overflow-hidden bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-sm dark:shadow-none hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300 hover:-translate-y-1.5 rounded-2xl p-6 space-y-4">
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="flex items-center justify-between">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${pipeline.color}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-semibold font-mono text-zinc-400">{pipeline.step}</span>
                          </div>
                          <div>
                            <h4 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit mb-2" style={{ fontSize: "1.5rem" }}>{pipeline.name}</h4>
                            <p className="text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed mt-2" style={{ fontSize: "1.125rem" }}>{pipeline.desc}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>

              {/* Platform Features Section */}
              <section id="features" className="py-20 max-w-7xl mx-auto px-6">
                <div className="text-center space-y-2 mb-16">
                  <h2 className="text-3xl font-black font-outfit text-slate-900 dark:text-white">Platform Capabilities</h2>
                  <p className="text-lg font-medium text-slate-600 dark:text-slate-400 max-w-md mx-auto mt-3">
                    Engineered for high-volume municipal grievance handling.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { title: "Whisper STT Module", desc: "Transcribe Marathi, Hindi, and English voice messages with high precision using Groq Whisper.", icon: Mic },
                    { title: "Vision Processing", desc: "WhatsApp Media API handles photo attachments. vision analysis reviews photos for legitimacy.", icon: Camera },
                    { title: "Geospatial Boundary Map", desc: "Nominatim APIs and MongoDB geospatial indexes match coordinates with ward borders.", icon: MapPin },
                    { title: "Layered Assignment Rules", desc: "Auto-assignment fallbacks assign tickets dynamically, avoiding stranded grievances.", icon: UserCheck },
                    { title: "Duplicate Detection Engine", desc: "Silently groups similar issues from the same phone number within a time window.", icon: ShieldAlert },
                    { title: "Live Status Summaries", desc: "Citizens reply 'status' anytime on WhatsApp for an instant status breakdown.", icon: MessageSquare }
                  ].map((feat, i) => {
                    const Icon = feat.icon
                    return (
                      <Card key={i} className="group relative overflow-hidden bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-sm dark:shadow-none hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300 hover:-translate-y-1.5 rounded-2xl p-6">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <CardContent className="p-0 space-y-4">
                          <div className="w-10 h-10 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center text-primary transition-transform">
                            <Icon className="w-5 h-5" />
                          </div>
                          <h3 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit mb-2" style={{ fontSize: "1.5rem" }}>{feat.title}</h3>
                          <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 font-normal" style={{ fontSize: "1.125rem" }}>{feat.desc}</p>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>

              {/* How it Works Section */}
              <section id="how-it-works" className="py-20 bg-slate-50 dark:bg-slate-950 border-t border-slate-200/60 dark:border-slate-800 transition-colors">
                <div className="max-w-7xl mx-auto px-6">
                  <div className="text-center space-y-2 mb-16">
                    <h2 className="text-3xl font-black font-outfit text-slate-900 dark:text-white">System Intake Lifecycle</h2>
                    <p className="text-lg font-medium text-slate-600 dark:text-slate-400 max-w-md mx-auto mt-2">
                      Seamless coordination from submission to confirmed resolution.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                    <div className="hidden md:block absolute top-7 left-12 right-12 h-0.5 bg-border/40 z-0" />

                    {[
                      { step: "01", title: "Helpline Submission", desc: "Grievances are captured directly via WhatsApp webhook events instantly.", badge: "Intake" },
                      { step: "02", title: "Operations Dispatch", desc: "Admin reviews classifications, corrects ward routing, and delegates to officers.", badge: "Console" },
                      { step: "03", title: "Resolution & SLA", desc: "Field officer updates ticket status. WhatsApp notification updates the citizen.", badge: "Redressal" }
                    ].map((item, idx) => (
                      <div key={idx} className="group relative overflow-hidden bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-sm dark:shadow-none hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300 hover:-translate-y-1.5 rounded-2xl p-6 space-y-4 z-10">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="flex items-center justify-between">
                          <span className="text-3xl font-black text-primary/20 font-outfit block">{item.step}</span>
                          <span className="text-xs font-bold bg-primary-soft border border-primary/20 text-primary px-2.5 py-0.5 rounded-full uppercase tracking-wider">{item.badge}</span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white font-outfit mb-1" style={{ fontSize: "1.5rem" }}>{item.title}</h3>
                        <p className="text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed" style={{ fontSize: "1.125rem" }}>{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Security and Trust Signals Footer */}
              <footer id="contact" className="border-t border-slate-200 dark:border-slate-800 bg-indigo-50/20 dark:bg-slate-950 py-12 px-6 transition-colors">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary-soft border border-primary/20 flex items-center justify-center text-primary">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">CivicVoice Platform</span>
                    </div>
                    <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-semibold">
                      Ensuring accountability, transparent assignment, and responsive city services.
                    </p>
                    <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full w-max">
                      <ShieldCheck className="w-3.5 h-3.5" /> Long-lived Uptime Session Active
                    </div>
                  </div>

                  <div className="space-y-3 text-xs font-semibold">
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide uppercase">Infrastructure Security</h5>
                    <p className="text-sm text-slate-600 dark:text-slate-300 hover:text-primary transition-colors duration-200 cursor-pointer">Hash Encryption: Bcrypt salt</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 hover:text-primary transition-colors duration-200 cursor-pointer">Authentication: Scoped JSON Web Tokens</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 hover:text-primary transition-colors duration-200 cursor-pointer">Permissions: Role-based RBAC</p>
                  </div>

                  <div className="space-y-3 text-xs font-semibold">
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide uppercase">Helpline System</h5>
                    <p className="text-sm text-slate-600 dark:text-slate-300 hover:text-primary transition-colors duration-200 cursor-pointer">Intake API: Meta Cloud Webhook</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 hover:text-primary transition-colors duration-200 cursor-pointer">Uptime Rate: 99.98% operational</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 hover:text-primary transition-colors duration-200 cursor-pointer">Languages: EN | HI | MR supported</p>
                  </div>

                  <div className="space-y-3 text-xs font-semibold">
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide uppercase">Operational Partnerships</h5>
                    <p className="text-sm text-slate-600 dark:text-slate-300 hover:text-primary transition-colors duration-200 cursor-pointer">Municipal Wards Integration</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 hover:text-primary transition-colors duration-200 cursor-pointer">Geospatial Routing Engine</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 hover:text-primary transition-colors duration-200 cursor-pointer">OpenStreetMap Geocoder</p>
                  </div>
                </div>
              </footer>

            </motion.main>
          ) : (
            /* Tabbed Authentication login card - 3 tab setup */
            <motion.main
              key="auth"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 flex items-center justify-center p-6 relative bg-background/50 transition-colors"
            >
              {/* Glowing Background circles */}
              <div className="absolute top-[20%] left-[30%] w-80 h-80 bg-primary/5 blur-[120px] rounded-full -z-10" />
              <div className="absolute bottom-[20%] right-[30%] w-80 h-80 bg-indigo-500/5 blur-[120px] rounded-full -z-10" />

              <Card className="w-full max-w-md bg-card border-border shadow-2xl relative">
                {/* Close Button */}
                <button
                  onClick={() => setShowLogin(false)}
                  className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                <CardHeader className="p-6 pb-2 border-b border-border">
                  <CardTitle className="text-xl font-black tracking-tight text-center font-outfit">
                    Console Authentication
                  </CardTitle>
                  <p className="text-sm text-zinc-500 text-center font-semibold mt-1">
                    Select your municipal portal below
                  </p>

                  {/* 3-tab Role switcher */}
                  <div className="flex gap-1 p-1 bg-card-muted/80 border border-border rounded-lg mt-5 select-none">
                    <button
                      onClick={() => {
                        setLoginRole('citizen')
                        setAuthError("")
                      }}
                      className={`flex-1 text-center py-3 sm:py-2 text-xs font-black rounded-md transition-all uppercase tracking-wider min-h-[44px] sm:min-h-0 flex items-center justify-center ${loginRole === 'citizen'
                          ? "bg-card text-foreground shadow-sm border border-border"
                          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        }`}
                    >
                      Citizen
                    </button>
                    <button
                      onClick={() => {
                        setLoginRole('officer')
                        setAuthError("")
                      }}
                      className={`flex-1 text-center py-3 sm:py-2 text-xs font-black rounded-md transition-all uppercase tracking-wider min-h-[44px] sm:min-h-0 flex items-center justify-center ${loginRole === 'officer'
                          ? "bg-card text-foreground shadow-sm border border-border"
                          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        }`}
                    >
                      Officer
                    </button>
                    <button
                      onClick={() => {
                        setLoginRole('admin')
                        setAuthError("")
                      }}
                      className={`flex-1 text-center py-3 sm:py-2 text-xs font-black rounded-md transition-all uppercase tracking-wider min-h-[44px] sm:min-h-0 flex items-center justify-center ${loginRole === 'admin'
                          ? "bg-card text-foreground shadow-sm border border-border"
                          : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        }`}
                    >
                      Admin
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  {loginRole === 'citizen' ? (
                    <div className="space-y-4">
                      {/* Citizen Access Sub-navigation */}
                      <div className="flex gap-1 border-b border-border pb-1 select-none">
                        <button
                          onClick={() => {
                            setCitizenLoginMode('password')
                            setOtpFeedback("")
                          }}
                          className={`px-3 py-3 sm:py-1.5 text-xs font-bold uppercase tracking-wider transition-colors min-h-[44px] sm:min-h-0 flex items-center ${citizenLoginMode === 'password' ? 'text-primary border-b-2 border-primary' : 'text-zinc-400'}`}
                        >
                          Password
                        </button>
                        <button
                          onClick={() => {
                            setCitizenLoginMode('otp')
                            setOtpFeedback("")
                            setOtpStep('request')
                          }}
                          className={`px-3 py-3 sm:py-1.5 text-xs font-bold uppercase tracking-wider transition-colors min-h-[44px] sm:min-h-0 flex items-center ${citizenLoginMode === 'otp' ? 'text-primary border-b-2 border-primary' : 'text-zinc-400'}`}
                        >
                          OTP pass setup
                        </button>
                        <button
                          onClick={() => {
                            setCitizenLoginMode('lookup')
                            setLookupFeedback("")
                          }}
                          className={`px-3 py-3 sm:py-1.5 text-xs font-bold uppercase tracking-wider transition-colors min-h-[44px] sm:min-h-0 flex items-center ${citizenLoginMode === 'lookup' ? 'text-primary border-b-2 border-primary' : 'text-zinc-400'}`}
                        >
                          Ref Lookup
                        </button>
                      </div>

                      {citizenLoginMode === 'password' && (
                        <form onSubmit={handleLoginSubmit} className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">WhatsApp Phone Number</label>
                            <input
                              type="text"
                              value={citizenPhone}
                              onChange={(e) => setCitizenPhone(e.target.value)}
                              className="w-full bg-card-muted/50 border border-border rounded-lg px-3 py-3 sm:py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors h-11 sm:h-10"
                              placeholder="e.g. 919999988888"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Passcode</label>
                            <div className="relative">
                              <input
                                type={showPass ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-card-muted/50 border border-border rounded-lg pl-3 pr-10 py-3 sm:py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors h-11 sm:h-10"
                                placeholder="Enter account security key"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 flex items-center justify-center bg-transparent border-none outline-none focus:outline-none text-zinc-400 hover:text-zinc-600 transition-colors"
                              >
                                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {authError && (
                            <p className="text-xs font-bold text-red-500 flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> {authError}
                            </p>
                          )}

                          <Button type="submit" className="w-full text-sm font-bold gap-2 h-11 sm:h-10" disabled={isLoggingIn}>
                            {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Access Citizen Portal
                          </Button>
                        </form>
                      )}

                      {citizenLoginMode === 'otp' && (
                        <div className="space-y-3.5">
                          {otpStep === 'request' ? (
                            <div className="space-y-3.5">
                              <div className="bg-card-muted/50 p-3 border border-border rounded-xl">
                                <p className="text-sm text-zinc-500 leading-relaxed font-semibold">
                                  Submit details on WhatsApp first, then request a WhatsApp code below to set your account passcode.
                                </p>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">WhatsApp Phone Number</label>
                                <input
                                  type="text"
                                  value={citizenPhone}
                                  onChange={(e) => setCitizenPhone(e.target.value)}
                                  className="w-full bg-card-muted/50 border border-border rounded-lg px-3 py-3 sm:py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-11 sm:h-10"
                                  placeholder="e.g. 919999988888"
                                />
                              </div>

                              {otpFeedback && (
                                <p className="text-xs font-bold text-red-500 flex items-center gap-1">
                                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> {otpFeedback}
                                </p>
                              )}

                              <Button onClick={handleRequestOtp} className="w-full text-sm font-bold gap-2 h-11 sm:h-10" disabled={isOtpLoading}>
                                {isOtpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                Request Verification Code
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-3.5">
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Verification OTP Code</label>
                                <input
                                  type="text"
                                  value={otpCode}
                                  onChange={(e) => setOtpCode(e.target.value)}
                                  className="w-full bg-card-muted/50 border border-border rounded-lg px-3 py-3 sm:py-2.5 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-zinc-400 h-11 sm:h-10"
                                  placeholder="6-digit numeric OTP code"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Configure New Passcode</label>
                                <input
                                  type="password"
                                  value={newOtpPassword}
                                  onChange={(e) => setNewOtpPassword(e.target.value)}
                                  className="w-full bg-card-muted/50 border border-border rounded-lg px-3 py-3 sm:py-2.5 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-zinc-400 h-11 sm:h-10"
                                  placeholder="Configure password key"
                                />
                              </div>

                              {otpFeedback && (
                                <p className="text-xs font-bold text-primary flex items-center gap-1">
                                  <Sparkles className="w-3.5 h-3.5 shrink-0" /> {otpFeedback}
                                </p>
                              )}

                              <Button onClick={handleVerifyOtp} className="w-full text-sm font-bold gap-2 h-11 sm:h-10" disabled={isOtpLoading}>
                                {isOtpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                Set Account Password
                              </Button>

                              <button
                                onClick={() => {
                                  setOtpStep('request')
                                  setOtpFeedback("")
                                }}
                                className="w-full text-center text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mt-2 transition-colors min-h-[44px] flex items-center justify-center"
                              >
                                Back to request code
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {citizenLoginMode === 'lookup' && (
                        <form onSubmit={handleQuickLookup} className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Registered Phone Number</label>
                            <input
                              type="text"
                              value={citizenPhone}
                              onChange={(e) => setCitizenPhone(e.target.value)}
                              className="w-full bg-card-muted/50 border border-border rounded-lg px-3 py-3 sm:py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors h-11 sm:h-10"
                              placeholder="e.g. 919999988888"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Complaint ID / Ref Code</label>
                            <input
                              type="text"
                              value={lookupComplaintId}
                              onChange={(e) => setLookupComplaintId(e.target.value)}
                              className="w-full bg-card-muted/50 border border-border rounded-lg px-3 py-3 sm:py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors h-11 sm:h-10"
                              placeholder="e.g. 6a5ccda899ef..."
                            />
                          </div>

                          {lookupFeedback && (
                            <p className="text-xs font-bold text-red-500 flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> {lookupFeedback}
                            </p>
                          )}

                          <Button type="submit" className="w-full text-sm font-bold gap-2 h-11 sm:h-10" disabled={isLookupLoading}>
                            {isLookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Lookup Grievance Status
                          </Button>
                        </form>
                      )}
                    </div>
                  ) : (
                    /* Default password credentials login flow */
                    <form onSubmit={handleLoginSubmit} className="space-y-4">

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                          {loginRole === 'officer' ? "Officer phone ID / username" : "Administrator Email"}
                        </label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full bg-card-muted/50 border border-border rounded-lg px-3 py-3 sm:py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors h-11 sm:h-10"
                          placeholder={
                            loginRole === 'officer' ? "e.g. OFF-1002" : "e.g. admin@civicvoice.gov"
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Password</label>
                          {loginRole === 'officer' && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowForgotPassword(true)
                                setForgotFeedback("")
                              }}
                              className="text-xs text-zinc-550 hover:text-primary font-bold transition-colors min-h-[44px] flex items-center"
                            >
                              Forgot Password?
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={showPass ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-card-muted/50 border border-border rounded-lg pl-3 pr-10 py-3 sm:py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors h-11 sm:h-10"
                            placeholder="Enter account security key"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPass(!showPass)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 flex items-center justify-center bg-transparent border-none outline-none focus:outline-none text-zinc-400 hover:text-zinc-600 transition-colors"
                          >
                            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {authError && (
                        <p className="text-xs font-bold text-red-500 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> {authError}
                        </p>
                      )}

                      <Button type="submit" className="w-full text-sm font-bold gap-2 hover:bg-primary/95 h-11 sm:h-10" disabled={isLoggingIn}>
                        {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Sign In to Console
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>

              {/* Forgot Password Modal for Officers */}
              <AnimatePresence>
                {showForgotPassword && (
                  <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className="w-full max-w-sm bg-card border border-border p-6 rounded-2xl shadow-2xl relative"
                    >
                      <button
                        onClick={() => {
                          setShowForgotPassword(false)
                          setForgotOfficerId("")
                          setForgotFeedback("")
                        }}
                        className="absolute right-4 top-4 text-zinc-400 hover:text-foreground transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <h4 className="text-base font-black uppercase tracking-wider mb-2 font-outfit text-foreground">Request Password Reset</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed font-semibold mb-4">
                        Submit your Officer ID. The system administrator will verify your details and issue a new reset key.
                      </p>

                      <form onSubmit={handleForgotSubmit} className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Officer ID</label>
                          <input
                            type="text"
                            required
                            value={forgotOfficerId}
                            onChange={(e) => setForgotOfficerId(e.target.value)}
                            placeholder="e.g. OFF-1002"
                            className="w-full bg-card-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        {forgotFeedback && (
                          <p className={`text-xs font-bold leading-normal ${forgotFeedback.includes("success") ? "text-emerald-500" : "text-red-500"}`}>
                            {forgotFeedback}
                          </p>
                        )}

                        <div className="flex justify-end gap-2.5 pt-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setShowForgotPassword(false)
                              setForgotOfficerId("")
                              setForgotFeedback("")
                            }}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={isForgotLoading} className="gap-2">
                            {isForgotLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Submit Request
                          </Button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

            </motion.main>
          )}
        </AnimatePresence>
      </div>

      {/* Persistent Floating WhatsApp Action Widget */}
      <div className="fixed bottom-6 right-6 z-50 group">
        {/* Tooltip */}
        <div className="absolute right-full bottom-1/2 translate-y-1/2 mr-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none border border-slate-800">
          Need help? Report an issue on WhatsApp
        </div>

        <a
          href="https://wa.me/15551765246?text=Hi"
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex items-center justify-center w-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg hover:shadow-emerald-500/20 transition-all duration-300 hover:scale-110 active:scale-95"
        >
          <MessageSquare className="w-6 h-6" />

          {/* Pulsing green dot */}
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
          </span>
        </a>
      </div>

    </div>
  )
}

const rootEl = document.getElementById("root")
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <LandingApp />
    </React.StrictMode>
  )
}
