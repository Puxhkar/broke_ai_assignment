"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { 
  Building, MapPin, Mail, Phone, MessageCircle, 
  Search, UserSearch, PenTool, Copy, Check, AlertCircle as AlertCircleIcon
} from "lucide-react";

import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight";
import { FileUpload } from "@/components/ui/file-upload";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";

interface Lead {
  id: string;
  companyName: string;
  location: string;
  status: "idle" | "processing" | "success" | "error";
  businessProfile?: {
    description: string;
    sizeSignals: string;
    digitalPresence: string;
    toolsUsed: string;
  };
  contactCard?: {
    phone?: string;
    email?: string;
    whatsapp?: string;
    sourceUrl: string;
  };
  outreachMessage?: string;
  error?: string;
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);

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
      })).filter(l => l.companyName !== "Unknown");

      setLeads(parsedLeads);
    };
    reader.readAsArrayBuffer(file);
  };

  const processLead = async (id: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: "processing", error: undefined } : l)));
    
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;

    try {
      const response = await fetch("/api/process-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: lead.companyName, location: lead.location }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process");
      }

      setLeads((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                status: "success",
                businessProfile: data.businessProfile,
                contactCard: data.contactCard,
                outreachMessage: data.outreachMessage,
              }
            : l
        )
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to process";
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: "error", error: errorMessage } : l))
      );
    }
  };

  const processAll = async () => {
    setIsProcessingAll(true);
    for (const lead of leads) {
      if (lead.status === "idle" || lead.status === "error") {
        await processLead(lead.id);
      }
    }
    setIsProcessingAll(false);
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white selection:bg-indigo-500/30 overflow-x-hidden">
      <div className="relative z-10">
        <section className="px-4">
          <HeroHighlight>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0.0, 0.2, 1] }}
              className="text-4xl md:text-7xl font-bold text-white max-w-4xl leading-tight text-center mx-auto"
            >
              AI Lead Intelligence <Highlight className="text-white bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-300">System</Highlight>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-neutral-500 dark:text-neutral-400 mt-4 text-center text-lg md:text-xl max-w-2xl mx-auto"
            >
              Upload companies → Get research, contacts, and outreach messages in seconds.
            </motion.p>
          </HeroHighlight>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-10">
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
                  className="relative inline-flex h-12 overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50 disabled:opacity-50"
                >
                  <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                  <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl">
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
                <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                  <h2 className="text-2xl font-bold text-white">Analysis Results</h2>
                  <p className="text-neutral-400 text-sm">{leads.length} Leads Analyzed</p>
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
    <div className="relative group p-[1px] rounded-3xl overflow-hidden transition-all duration-300 bg-white/5 border border-white/10 hover:border-white/20">
      <div className="relative bg-zinc-950 rounded-3xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Building className="text-indigo-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{lead.companyName}</h3>
              <div className="flex items-center gap-2 text-neutral-400 text-sm mt-1">
                <MapPin size={14} />
                {lead.location}
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
              <div className="flex items-center gap-2 text-rose-400 text-sm font-medium bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
                Error
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
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
              <div className="text-sm text-neutral-300 space-y-4">
                <p><span className="text-white font-medium">Summary:</span> {lead.businessProfile.description}</p>
                <p><span className="text-white font-medium">Scale:</span> {lead.businessProfile.sizeSignals}</p>
                <div className="pt-2">
                  <span className="text-xs text-neutral-500 block mb-2 uppercase">Tech Stack</span>
                  <p className="text-indigo-300">{lead.businessProfile.toolsUsed}</p>
                </div>
              </div>
            ) : (
              <p className="text-neutral-600 text-sm italic">Pending research phase...</p>
            )}
          </div>

          <div className="space-y-4 border-l border-white/5 pl-0 lg:pl-8">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
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
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <Phone size={16} className="text-neutral-500" />
                  <span className="text-sm">{lead.contactCard.phone || "No phone found"}</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <Mail size={16} className="text-neutral-500" />
                  <span className="text-sm">{lead.contactCard.email || "No email found"}</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <MessageCircle size={16} className="text-neutral-500" />
                  <span className="text-sm">{lead.contactCard.whatsapp || "No WhatsApp found"}</span>
                </div>
                <div className="pt-2">
                  <a 
                    href={lead.contactCard.sourceUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
                  >
                    View Source Link
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-neutral-600 text-sm italic">Waiting for contact finder...</p>
            )}
          </div>

          <div className="space-y-4 border-l border-white/5 pl-0 lg:pl-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
                <PenTool size={14} />
                Outreach
              </div>
              {lead.outreachMessage && (
                <button 
                  onClick={copyToClipboard}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-neutral-400 hover:text-white"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              )}
            </div>
            {lead.status === "processing" ? (
              <Skeleton className="h-32 w-full" />
            ) : lead.outreachMessage ? (
              <div className="relative">
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                  {lead.outreachMessage}
                </div>
              </div>
            ) : (
              <p className="text-neutral-600 text-sm italic">Generating outreach message...</p>
            )}
          </div>
        </div>

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
