"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Building, MapPin,
  Search, UserSearch, PenTool, Copy, Check, AlertCircle as AlertCircleIcon
} from "lucide-react";

import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight";
import { FileUpload } from "@/components/ui/file-upload";
import { Skeleton } from "@/components/ui/skeleton";
import { BackgroundBeams } from "@/components/ui/background-beams";
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

  return (
      <div className="min-h-screen bg-background text-foreground selection:bg-indigo-500/30 overflow-x-hidden relative">
        <BackgroundBeams className="opacity-40" />
        <div className="fixed top-6 right-6 z-50">
          <ThemeToggle />
        </div>
        <div className="relative z-10">
          <section className="px-4">
            <HeroHighlight>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.4, 0.0, 0.2, 1] }}
                className="text-4xl md:text-7xl font-bold text-foreground max-w-4xl leading-tight text-center mx-auto"
              >
                AI Lead Intelligence <Highlight className="text-foreground bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">System</Highlight>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-secondary mt-4 text-center text-lg md:text-xl max-w-2xl mx-auto"
              >
                Upload companies → Get research, contacts, and outreach messages in seconds.
              </motion.p>
            </HeroHighlight>
          </section>

          <section className="max-w-4xl mx-auto px-4 py-8 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-card border border-border rounded-2xl p-6 mb-8 shadow-sm backdrop-blur-sm"
            >
              <h2 className="text-sm font-bold uppercase tracking-widest text-secondary mb-4 flex items-center gap-2">
                <Building size={16} />
                Quick Search
              </h2>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Company Name (e.g. Tesla)"
                    value={manualCompany}
                    onChange={(e) => setManualCompany(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Location (optional)"
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm"
                  />
                </div>
                <button
                  onClick={handleAddManualLead}
                  disabled={!manualCompany.trim()}
                  className="px-6 py-2 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Search size={16} />
                  Find Info
                </button>
              </div>
            </motion.div>

            <div className="relative flex items-center py-4 mb-4">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-widest text-secondary/40">OR UPLOAD BATCH</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <FileUpload onChange={handleFileUpload} accept=".xlsx, .xls, .csv" />
            </motion.div>

            <AnimatePresence>
              {leads.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mt-8 flex justify-center"
                >
                  <button
                    onClick={processAll}
                    disabled={isProcessingAll}
                    className="relative inline-flex h-12 overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50"
                  >
                    <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#818cf8_0%,#6366f1_50%,#818cf8_100%)]" />
                    <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-foreground px-8 py-1 text-sm font-medium text-background backdrop-blur-3xl">
                      {isProcessingAll ? "Processing Leads..." : "Start Processing All Leads"}
                    </span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <section className="max-w-7xl mx-auto px-4 py-20">
            <AnimatePresence>
              {leads.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 gap-8"
                >
                  <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
                    <h2 className="text-2xl font-bold text-foreground">Analysis Results</h2>
                    <p className="text-secondary text-sm">{leads.length} Leads Analyzed</p>
                  </div>

                  {leads.map((lead) => (
                    <CompanyCard key={lead.id} lead={lead} onProcess={() => processLead(lead.id)} />
                  ))}
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
      <div className="relative group p-[1px] rounded-3xl overflow-hidden transition-all duration-300 bg-card border border-border hover:border-accent/40">
        <div className="relative bg-card rounded-3xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <Building className="text-indigo-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-card-foreground">{lead.companyName}</h3>
                <div className="flex items-center gap-2 text-secondary text-sm mt-1">
                  <MapPin size={14} />
                  {lead.discoveredLocation || lead.location}
                  {lead.discoveredLocation && lead.location === "Unknown" && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 ml-2">Found HQ</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {lead.status === "idle" && (
                <button
                  onClick={onProcess}
                  className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Process Now
                </button>
              )}
              {lead.status === "processing" && (
                <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium">
                  <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  Processing...
                </div>
              )}
              {lead.status === "success" && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  <Check size={14} />
                  Success
                </div>
              )}
              {lead.status === "error" && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={onProcess}
                    className="text-xs font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 underline underline-offset-4"
                  >
                    Rerun
                  </button>
                  <div className="flex items-center gap-2 text-rose-400 text-sm font-medium bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
                    Error
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-secondary">
                <Search size={14} />
                Research
              </div>
              {lead.status === "processing" ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : lead.businessProfile ? (
                <div className="text-sm text-foreground space-y-5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent/70 block">Business Summary</span>
                    <p className="leading-relaxed text-secondary">{lead.businessProfile.description}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent/70 block">Size & Scale Signals</span>
                    <p className="leading-relaxed text-secondary">{lead.businessProfile.sizeSignals}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent/70 block">Digital Presence</span>
                    <p className="text-accent/80 break-all">{lead.businessProfile.digitalPresence}</p>
                  </div>
                  <div className="pt-4 border-t border-border space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-accent/70 block">Tools & Systems (Tech Stack)</span>
                    <p className="text-accent dark:text-accent/80 text-xs italic bg-muted p-2 rounded-lg border border-border">
                      {lead.businessProfile.toolsUsed}
                    </p>
                    {!lead.businessProfile.toolsUsed.toLowerCase().includes("inferred") && (
                      <span className="text-[9px] text-secondary block mt-1">Note: Tech stack inferred from public signals + job postings</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-secondary text-sm italic">Pending research phase...</p>
              )}
            </div>

            <div className="space-y-4 border-l border-border pl-0 lg:pl-8">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-secondary">
                <UserSearch size={14} />
                Contact Info
              </div>
              {lead.status === "processing" ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : lead.contactCard ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-accent/70">Phone:</span>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted border border-border">
                        <div className="flex flex-col max-w-[80%]">
                          <span className="text-sm truncate">{lead.contactCard.phone || "Not found"}</span>
                          {lead.contactCard.phoneSourceLabel && <span className="text-[8px] text-secondary">{lead.contactCard.phoneSourceLabel}</span>}
                        </div>
                        {lead.contactCard.phone && lead.contactCard.sourceUrl !== "N/A" && (
                          <a href={lead.contactCard.sourceUrl} target="_blank" rel="noreferrer" className="text-[9px] text-indigo-400 hover:underline">
                            (source)
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-accent/70">Email:</span>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted border border-border">
                        <div className="flex flex-col max-w-[80%]">
                          <span className="text-sm truncate">{lead.contactCard.email || "Not found"}</span>
                          {lead.contactCard.emailSourceLabel && <span className="text-[8px] text-secondary">{lead.contactCard.emailSourceLabel}</span>}
                        </div>
                        {lead.contactCard.email && lead.contactCard.sourceUrl !== "N/A" && (
                          <a href={lead.contactCard.sourceUrl} target="_blank" rel="noreferrer" className="text-[9px] text-indigo-400 hover:underline">
                            (source)
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-accent/70">WhatsApp:</span>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted border border-border">
                        <div className="flex flex-col max-w-[80%]">
                          <span className="text-sm truncate">{lead.contactCard.whatsapp || "Not found"}</span>
                          {lead.contactCard.whatsappSourceLabel && <span className="text-[8px] text-secondary">{lead.contactCard.whatsappSourceLabel}</span>}
                        </div>
                        {lead.contactCard.whatsapp && lead.contactCard.sourceUrl !== "N/A" && (
                          <a href={lead.contactCard.sourceUrl} target="_blank" rel="noreferrer" className="text-[9px] text-indigo-400 hover:underline">
                            (source)
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 flex items-center justify-between border-t border-border">
                    {lead.contactCard.sourceUrl && lead.contactCard.sourceUrl !== "N/A" ? (
                      <a
                        href={lead.contactCard.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-accent hover:underline underline-offset-4 flex items-center gap-1"
                      >
                        All Evidence Sources
                        <Copy size={10} className="opacity-50" />
                      </a>
                    ) : (
                      <span className="text-[10px] text-secondary italic">No specific source evidence URL found</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-secondary text-sm italic">Waiting for contact finder...</p>
              )}
            </div>

            <div className="space-y-4 border-l border-border pl-0 lg:pl-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-secondary">
                  <PenTool size={14} />
                  Outreach
                </div>
                {lead.outreachMessage && (
                  <button
                    onClick={copyToClipboard}
                    className="p-2 hover:bg-muted rounded-lg transition-colors text-secondary hover:text-foreground"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                )}
              </div>
              {lead.status === "processing" ? (
                <Skeleton className="h-32 w-full" />
              ) : lead.outreachMessage ? (
                <div className="space-y-4">
                  <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap font-medium">
                    {lead.outreachMessage}
                  </div>
                  {lead.outreachReasoning && (
                    <div className="bg-emerald-500/5 border border-emerald-600/20 rounded-xl p-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-500/70 block mb-1">Agent Strategy (Why this works?)</span>
                      <p className="text-[11px] text-secondary italic leading-relaxed">
                        &quot;{lead.outreachReasoning}&quot;
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-secondary text-sm italic">Generating outreach message...</p>
              )}
            </div>
          </div>

          {lead.logs.length > 0 && (
            <div className="mt-8 border-t border-border pt-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary block mb-3">Multi-Agent Activity Log</span>
              <div className="bg-muted rounded-xl p-3 font-mono text-[10px] text-secondary h-24 overflow-y-auto space-y-1 scrollbar-hide">
                {lead.logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-indigo-500/60 shrink-0">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                    <span>{log}</span>
                  </div>
                ))}
                {lead.status === "processing" && (
                  <div className="flex gap-2 animate-pulse">
                    <span className="text-indigo-500/60 shrink-0">...</span>
                    <span>Awaiting agent response...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {lead.error && (
            <div className="mt-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
              <p className="font-bold mb-1 flex items-center gap-2"><AlertCircleIcon size={14} /> Error</p>
              {lead.error}
            </div>
          )}
        </div>
      </div>
    );
  }
