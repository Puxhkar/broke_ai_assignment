"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Building, MapPin,
  Search, UserSearch, PenTool, Copy, Check, AlertCircle as AlertCircleIcon
} from "lucide-react";

import { BackgroundBeams } from "@/components/ui/background-beams";
import { FileUpload } from "@/components/ui/file-upload";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion, AnimatePresence } from "framer-motion";
import { delay } from "@/lib/utils";

interface Lead {
  id: string;
  companyName: string;
  location: string;
  discoveredLocation?: string;
  status: "idle" | "processing" | "success" | "error";
  logs: string[];
  businessProfile?: {
    description: string;
    sizeSignals: string;
    digitalPresence: string;
    toolsUsed: string;
  };
  contactCard?: {
    phone?: string;
    phoneSourceLabel?: string;
    email?: string;
    emailSourceLabel?: string;
    whatsapp?: string;
    whatsappSourceLabel?: string;
    sourceUrl: string;
  };
  outreachMessage?: string;
  outreachReasoning?: string;
  error?: string;
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [manualCompany, setManualCompany] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet);

      const parsedLeads: Lead[] = json.map((row, index) => ({
        id: `lead-${index}`,
        companyName: row["Company Name"] || row["company_name"] || row["Company"] || row["name"] || row["Name"] || row["Organization"] || "Unknown",
        location: row["Location"] || row["location"] || row["City"] || row["city"] || row["Address"] || row["address"] || "Unknown",
        status: "idle" as const,
        logs: [],
      })).filter(l => l.companyName !== "Unknown");

      setLeads(parsedLeads);
    };
    reader.readAsArrayBuffer(file);
  };

  const processLead = async (id: string, leadOverride?: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: "processing", logs: ["Init: Requesting pipeline access..."], error: undefined } : l)));

    const lead = leadOverride || leads.find((l) => l.id === id);
    if (!lead) return;

    try {
      const response = await fetch("/api/process-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: lead.companyName, location: lead.location }),
      });

      if (!response.ok) throw new Error("Connection failed");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream unavailable");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const update = JSON.parse(line);

          if (update.error) throw new Error(update.error);

          setLeads((prev) => prev.map((l) => {
            if (l.id !== id) return l;

            // LangGraph updates format: { node_name: { state_updates } }
            const nodeName = Object.keys(update)[0];
            const data = update[nodeName];

            return {
              ...l,
              ...data,
              logs: data.logs ? [...l.logs, ...data.logs] : l.logs,
              status: nodeName === "outreachWriter" ? "success" : "processing",
            };
          }));
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Stream error";
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: "error", error: msg } : l)));
    }
  };

  const processAll = async () => {
    setIsProcessingAll(true);
    for (const lead of leads) {
      if (lead.status === "idle" || lead.status === "error") {
        await processLead(lead.id);
        await delay(4000); // 4s delay between leads to respect rate limits
      }
    }
    setIsProcessingAll(false);
  };

  const handleAddManualLead = async () => {
    if (!manualCompany.trim()) return;
    
    const newLead: Lead = {
      id: `manual-${Date.now()}`,
      companyName: manualCompany.trim(),
      location: manualLocation.trim() || "Unknown",
      status: "idle",
      logs: [],
    };
    
    setLeads(prev => [newLead, ...prev]);
    setManualCompany("");
    setManualLocation("");
    
    // Process this specific lead immediately
    await processLead(newLead.id, newLead);
  };

  const downloadLeads = () => {
    const processedLeads = leads.filter(l => l.status === "success");
    if (processedLeads.length === 0) return;

    const data = processedLeads.map(l => ({
      Company: l.companyName,
      Location: l.discoveredLocation || l.location,
      Summary: l.businessProfile?.description || "",
      Scale: l.businessProfile?.sizeSignals || "",
      Tech: l.businessProfile?.toolsUsed || "",
      Phone: l.contactCard?.phone || "",
      Email: l.contactCard?.email || "",
      WhatsApp: l.contactCard?.whatsapp || "",
      Outreach: l.outreachMessage || ""
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Verified Leads");
    XLSX.writeFile(wb, `Lead_Intelligence_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-accent/30 overflow-x-hidden relative font-sans">
      {mounted && (
        <>
          <div className="fixed inset-0 bg-grid-warm pointer-events-none opacity-50" />
          <BackgroundBeams className="opacity-[0.03] pointer-events-none" />
        </>
      )}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="relative pt-32 pb-16 px-4 overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-center space-y-10"
            >
              <h1 className="text-7xl md:text-[10rem] font-black tracking-tighter leading-[0.8] text-foreground lowercase">
                Lead <span className="text-accent italic font-medium tracking-normal">intelligence</span>
                <br />
                <span className="text-4xl md:text-7xl font-bold opacity-40 tracking-tight">Autonomous pipeline</span>
              </h1>
              <p className="text-foreground/70 text-xl md:text-3xl max-w-3xl mx-auto font-medium leading-relaxed tracking-tight">
                Transform raw company names into deep business insights, verified contacts, and tailored outreach.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Search & Upload Section */}
        <section className="max-w-6xl mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start"
          >
            {/* Quick Search Card */}
            <div className="glass-card p-12 rounded-[3.5rem] space-y-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -mr-12 -mt-12 blur-3xl" />
              <div className="flex items-center gap-5">
                <div className="p-4 rounded-2.5xl bg-accent/10 border border-accent/20 group-hover:bg-accent/20 transition-colors">
                  <UserSearch size={28} className="text-accent" />
                </div>
                <h2 className="text-3xl font-black tracking-tight">Manual Entry</h2>
              </div>
              
              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-[0.3em] text-accent/60 ml-2">Company Name</label>
                  <div className="relative group/input">
                    <Building className="absolute left-6 top-1/2 -translate-y-1/2 text-secondary/50 group-focus-within/input:text-accent transition-colors" size={24} />
                    <input
                      type="text"
                      placeholder="e.g. Brokai Labs"
                      value={manualCompany}
                      onChange={(e) => setManualCompany(e.target.value)}
                      className="w-full pl-16 pr-8 py-6 rounded-3xl bg-muted/20 border border-border/50 focus:border-accent/40 focus:ring-[12px] focus:ring-accent/[0.04] outline-none transition-all text-lg font-bold placeholder:opacity-40"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-[0.3em] text-accent/60 ml-2">Location</label>
                  <div className="relative group/input">
                    <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-secondary/50 group-focus-within/input:text-accent transition-colors" size={24} />
                    <input
                      type="text"
                      placeholder="e.g. India"
                      value={manualLocation}
                      onChange={(e) => setManualLocation(e.target.value)}
                      className="w-full pl-16 pr-8 py-6 rounded-3xl bg-muted/20 border border-border/50 focus:border-accent/40 focus:ring-[12px] focus:ring-accent/[0.04] outline-none transition-all text-lg font-bold placeholder:opacity-40"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddManualLead}
                  disabled={!manualCompany.trim()}
                  className="w-full py-6 rounded-3xl bg-accent hover:bg-accent/90 text-white font-black tracking-tight shadow-2xl shadow-accent/20 transition-all active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-4 text-xl"
                >
                  <Search size={24} strokeWidth={3} />
                  Analyze Lead
                </button>
              </div>
            </div>

            {/* Upload Card */}
            <div className="glass-card p-1 rounded-[3.5rem] h-full flex flex-col group/upload overflow-hidden">
              <div className="p-12 pb-8">
                <div className="flex items-center gap-5">
                  <div className="p-4 rounded-2.5xl bg-secondary/10 border border-secondary/20 shadow-inner group-hover/upload:bg-secondary/20 transition-colors">
                    <Building size={28} className="text-secondary" />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight">Batch Sync</h2>
                </div>
              </div>
              <div className="flex-1 p-10 pt-0">
                <FileUpload onChange={handleFileUpload} accept=".xlsx, .xls, .csv" />
              </div>
            </div>
          </motion.div>

          <AnimatePresence>
            {leads.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-16 flex justify-center"
              >
                <button
                  onClick={processAll}
                  disabled={isProcessingAll}
                  className="group relative px-12 py-5 overflow-hidden rounded-2.5xl bg-foreground text-background font-black tracking-tighter text-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-2xl shadow-foreground/10"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-accent to-secondary opacity-0 group-hover:opacity-10 transition-opacity" />
                  <span className="relative flex items-center gap-4">
                    {isProcessingAll ? (
                      <div className="w-6 h-6 border-3 border-background border-t-transparent animate-spin rounded-full" />
                    ) : (
                      <>
                        <PenTool size={24} strokeWidth={2.5} />
                        Run Full Pipeline Analysis
                      </>
                    )}
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Results Section */}
        <section className="max-w-6xl mx-auto px-4 py-24">
          <AnimatePresence mode="popLayout">
            {leads.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-16"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border/40 pb-10 gap-6">
                  <div>
                    <h2 className="text-4xl font-black tracking-tight">Intelligence Dashboard</h2>
                    <p className="text-foreground/50 font-medium mt-2 text-lg italic">Real-time autonomous pipeline monitoring</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {leads.some(l => l.status === "success") && (
                      <button
                        onClick={downloadLeads}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent font-bold text-xs hover:bg-accent/20 transition-all shadow-sm"
                      >
                        <Copy size={14} />
                        Export Intelligence (.xlsx)
                      </button>
                    )}
                    <div className="bg-secondary/10 text-secondary px-5 py-2.5 rounded-2xl border border-secondary/20 font-black text-sm tracking-widest uppercase">
                      {leads.length} Entities
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-12">
                  {leads.map((lead) => (
                    <CompanyCard key={lead.id} lead={lead} onProcess={() => processLead(lead.id)} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}

function CompanyCard({ lead, onProcess }: { lead: Lead; onProcess: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (lead.outreachMessage) {
      navigator.clipboard.writeText(lead.outreachMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card rounded-[3.5rem] overflow-hidden group/card relative mb-12 shadow-2xl shadow-accent/5 transition-all hover:shadow-accent/10 border-border/40"
    >
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-accent/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-700" />
      
      <div className="p-10 md:p-16">
        {/* Card Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 mb-20">
          <div className="flex items-center gap-10">
            <div className="relative group/logo">
              <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full opacity-0 group-hover/logo:opacity-100 transition-opacity duration-700" />
              <div className="relative w-24 h-24 rounded-[2.5rem] bg-accent/10 flex items-center justify-center border border-accent/20 shadow-inner overflow-hidden group-hover/logo:scale-105 transition-transform duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                <Building className="text-accent w-12 h-12 stroke-[2.5px]" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground uppercase leading-tight">{lead.companyName}</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-muted/60 border border-border/50 text-secondary font-black text-[10px] tracking-[0.1em] uppercase shadow-sm">
                  <MapPin size={14} className="text-accent" />
                  {lead.discoveredLocation || lead.location}
                </div>
                {lead.discoveredLocation && (
                   <span className="text-[9px] bg-accent/15 text-accent border border-accent/25 px-4 py-1.5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-sm animate-in fade-in zoom-in duration-500">Verified HQ</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <AnimatePresence mode="wait">
              {lead.status === "idle" && (
                <motion.button
                  key="idle"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onClick={onProcess}
                  className="px-10 py-5 rounded-[1.8rem] bg-accent text-white font-black text-sm tracking-[0.05em] uppercase hover:bg-accent/90 transition-all flex items-center gap-4 shadow-2xl shadow-accent/25 active:scale-95 group/btn"
                >
                  <Search size={20} strokeWidth={3} className="group-hover/btn:scale-110 transition-transform" />
                  Initiate Research
                </motion.button>
              )}
              {lead.status === "processing" && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-10 py-5 rounded-[1.8rem] bg-accent/[0.03] border-2 border-accent/15 text-accent font-black text-sm uppercase tracking-widest flex items-center gap-5 shadow-inner"
                >
                  <div className="w-6 h-6 rounded-full border-[3px] border-accent border-t-transparent animate-spin" />
                  Agent Working
                </motion.div>
              )}
              {lead.status === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="px-10 py-5 rounded-[1.8rem] bg-secondary/15 border border-secondary/30 text-secondary font-black text-sm uppercase tracking-[0.15em] flex items-center gap-4 shadow-xl shadow-secondary/5"
                >
                  <div className="p-1 rounded-full bg-secondary/20 shadow-inner">
                    <Check size={18} strokeWidth={4} className="text-foreground" />
                  </div>
                  Pipeline Complete
                </motion.div>
              )}
              {lead.status === "error" && (
                <motion.button
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={onProcess}
                  className="px-10 py-5 rounded-[1.8rem] bg-orange-600/5 border-2 border-orange-600/20 text-orange-600 font-black text-sm uppercase tracking-widest hover:bg-orange-600/10 transition-all flex items-center gap-4 active:scale-95"
                >
                  <AlertCircleIcon size={22} strokeWidth={3} />
                  Retry Process
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Content Tabs/Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          {/* Research Column */}
          <div className="lg:col-span-4 space-y-10">
            <div className="flex items-center gap-4 border-b border-border/40 pb-6">
              <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20">
                <Search size={18} className="text-accent" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-[0.25em] text-accent/80">Autonomous Research</h4>
            </div>

            {lead.status === "processing" ? (
              <div className="space-y-6">
                <Skeleton className="h-24 w-full rounded-2.5xl" />
                <Skeleton className="h-14 w-full rounded-2.5xl" />
                <Skeleton className="h-14 w-full rounded-2.5xl" />
              </div>
            ) : lead.businessProfile ? (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/40 block">Executive Summary</span>
                  <p className="text-xl font-bold leading-relaxed text-foreground tracking-tight">{lead.businessProfile.description}</p>
                </div>
                
                <div className="grid grid-cols-1 gap-8">
                  <div className="p-6 rounded-2.5xl bg-muted/20 border border-border/60 group/item hover:border-accent/40 transition-colors">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-accent/40 block mb-3">Scale & Impact</span>
                    <p className="text-sm font-bold text-foreground/90 leading-snug">{lead.businessProfile.sizeSignals}</p>
                  </div>
                  
                  <div className="p-6 rounded-2.5xl bg-muted/20 border border-border/60 group/item hover:border-accent/40 transition-colors">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-accent/40 block mb-3">Infrastructure</span>
                    <p className="text-xs font-mono text-accent font-black tracking-tight">{lead.businessProfile.toolsUsed}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center glass rounded-[2.5rem] border-dashed border-2 border-border/40">
                <p className="text-secondary/30 text-xs font-black uppercase tracking-[0.3em] italic">Awaiting Agent Dispatch...</p>
              </div>
            )}
          </div>

          {/* Contact Column */}
          <div className="lg:col-span-4 space-y-10">
            <div className="flex items-center gap-4 border-b border-border/40 pb-6">
              <div className="p-2.5 rounded-xl bg-secondary/10 border border-secondary/20">
                <UserSearch size={18} className="text-secondary" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-[0.25em] text-secondary/80">Contact Intel</h4>
            </div>

            {lead.status === "processing" ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            ) : lead.contactCard ? (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <ContactItem label="Primary Phone" value={lead.contactCard.phone} source={lead.contactCard.sourceUrl} labelSub={lead.contactCard.phoneSourceLabel} />
                <ContactItem label="Official Email" value={lead.contactCard.email} source={lead.contactCard.sourceUrl} labelSub={lead.contactCard.emailSourceLabel} />
                <ContactItem label="WhatsApp Direct" value={lead.contactCard.whatsapp} source={lead.contactCard.sourceUrl} labelSub={lead.contactCard.whatsappSourceLabel} />
                
                {lead.contactCard.sourceUrl && lead.contactCard.sourceUrl !== "N/A" && (
                   <a
                   href={lead.contactCard.sourceUrl}
                   target="_blank"
                   rel="noreferrer"
                   className="mt-8 flex items-center justify-center gap-3 p-4 rounded-2.5xl bg-muted/40 border border-border/80 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/50 hover:text-accent hover:border-accent/40 hover:bg-muted/60 transition-all font-mono shadow-sm"
                 >
                   Explore Verified Source <Copy size={12} />
                 </a>
                )}
              </div>
            ) : (
              <div className="py-20 text-center glass rounded-[2.5rem] border-dashed border-2 border-border/40">
                <p className="text-secondary/30 text-xs font-black uppercase tracking-[0.3em] italic">Awaiting Extraction...</p>
              </div>
            )}
          </div>

          {/* Outreach Column */}
          <div className="lg:col-span-4 space-y-10">
            <div className="flex items-center gap-4 border-b border-border/40 pb-6">
              <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/20">
                <PenTool size={18} className="text-accent" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-[0.25em] text-accent/80">Strategic Outreach</h4>
            </div>

            {lead.status === "processing" ? (
              <Skeleton className="h-64 w-full rounded-[2.5rem]" />
            ) : lead.outreachMessage ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="relative group/outreach">
                  <div className="absolute -inset-1.5 bg-gradient-to-br from-accent/20 to-secondary/20 rounded-[3rem] blur-xl opacity-0 group-hover/outreach:opacity-100 transition-opacity" />
                  <div className="relative p-8 rounded-[2.5rem] bg-accent/[0.04] dark:bg-accent/[0.06] border border-accent/20 text-md font-bold leading-relaxed tracking-tight text-foreground/90 whitespace-pre-wrap shadow-inner">
                    {lead.outreachMessage}
                    <button
                      onClick={copyToClipboard}
                      className="absolute top-6 right-6 p-3 rounded-2xl bg-background border border-border shadow-md hover:scale-110 active:scale-95 transition-all text-accent group-hover/outreach:bg-muted"
                    >
                      {copied ? <Check size={16} strokeWidth={3} className="text-secondary" /> : <Copy size={16} strokeWidth={2.5} />}
                    </button>
                  </div>
                </div>

                {lead.outreachReasoning && (
                  <div className="p-6 rounded-2.5xl bg-secondary/[0.05] border border-secondary/20 relative overflow-hidden group/reason">
                    <div className="absolute top-0 left-0 w-1 h-full bg-secondary/30" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-secondary/60 block mb-3">Agent Rationale</span>
                    <p className="text-xs text-foreground/70 font-bold leading-relaxed italic">&quot;{lead.outreachReasoning}&quot;</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center glass rounded-[2.5rem] border-dashed border-2 border-border/40">
                <p className="text-secondary/30 text-xs font-black uppercase tracking-[0.3em] italic">Synthesis Pending...</p>
              </div>
            )}
          </div>
        </div>

        {/* Console / Log Footer */}
        {lead.logs.length > 0 && (
          <div className="mt-20 pt-12 border-t border-border/30">
            <div className="flex items-center gap-6 mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-accent/50 blur-lg rounded-full animate-pulse" />
                <div className="relative w-3.5 h-3.5 rounded-full bg-accent shadow-[0_0_12px_rgba(212,163,115,0.8)]" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.5em] text-accent/60">Autonomous Pipeline Log</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-32 overflow-y-auto scrollbar-hide pr-2">
              {lead.logs.map((log, i) => (
                <div key={i} className="px-5 py-4 rounded-2xl bg-muted/30 border border-border/40 text-[10px] font-mono text-accent/80 flex gap-4 items-center hover:bg-muted/50 transition-all duration-300 group/log">
                  <span className="opacity-30 font-bold group-hover/log:opacity-60 transition-opacity">{String(i+1).padStart(2, '0')}</span>
                  <span className="truncate font-bold tracking-tight">{log}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {lead.error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 p-8 rounded-[2.5rem] bg-orange-600/5 border border-orange-600/20 text-orange-600 flex items-center gap-6"
          >
            <div className="p-3 rounded-2xl bg-orange-600/10 shadow-inner">
              <AlertCircleIcon size={24} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-[0.2em] mb-1.5">Pipeline Halt</p>
              <p className="text-sm font-bold tracking-tight">{lead.error}</p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function ContactItem({ label, value, source, labelSub }: { label: string, value?: string, source?: string, labelSub?: string }) {
  const isFound = value && !value.toLowerCase().includes("not found") && !value.toLowerCase().includes("not public");
  
  return (
    <div className={`p-6 rounded-[2rem] border transition-all duration-500 relative overflow-hidden group/contact ${isFound ? 'bg-muted/40 border-secondary/30 hover:border-accent/60 hover:bg-muted/60 shadow-lg shadow-accent/[0.02]' : 'bg-muted/10 border-dashed border-border/60 opacity-60'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-accent/50">{label}</span>
        {isFound && source && source !== "N/A" && (
          <a href={source} target="_blank" rel="noreferrer" className="p-2 rounded-xl bg-accent/5 opacity-0 group-hover/contact:opacity-100 transition-opacity duration-300">
             <Copy size={12} className="text-accent" />
          </a>
        )}
      </div>
      <p className={`text-lg font-black tracking-tight truncate ${isFound ? 'text-foreground' : 'text-foreground/30'}`}>{value || "N/A"}</p>
      {labelSub && labelSub !== "N/A" && <p className="text-[9px] font-bold text-secondary mt-2 uppercase tracking-widest opacity-60 italic">{labelSub}</p>}
    </div>
  );
}
