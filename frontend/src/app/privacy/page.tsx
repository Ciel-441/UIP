'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Lock,
  Cpu,
  ArrowLeft,
  Printer,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Database,
  EyeOff,
  Scale,
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';
import ClientOnly from '@/components/ClientOnly';

export default function PrivacyPolicyPage() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState('summary');

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const sections = [
    { id: 'disclaimer', title: 'Critical Disclaimers & Misuse Policy' },
    { id: 'ai-models', title: 'Uncensored AI Model Outputs' },
    { id: 'data-collection', title: 'Information Collected & Handled' },
    { id: 'architecture', title: 'Multi-Tenant & Local Architecture' },
    { id: 'retention', title: 'Data Retention & Deletion Rights' },
    { id: 'third-party', title: 'Third-Party Services & Integrations' },
    { id: 'security', title: 'Security Practices' },
    { id: 'contact', title: 'Contact & Governance' },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <ClientOnly>
      <div className="min-h-screen bg-[#070409] text-white selection:bg-[#ff79c6]/30 selection:text-white relative overflow-x-hidden">
        {/* Ambient background glows */}
        <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-[#ff79c6]/5 rounded-full blur-[180px] pointer-events-none -z-10" />
        <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-[#d68eff]/5 rounded-full blur-[180px] pointer-events-none -z-10" />

        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-40 bg-[#070409]/80 backdrop-blur-xl border-b border-[#241527]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#a8a0b0] hover:text-white hover:bg-white/5 border border-[#241527] transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 bg-[#12121a] flex-shrink-0 flex items-center justify-center group-hover:border-[#ff79c6]/50 transition-colors">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="text-sm font-bold tracking-tight text-white group-hover:text-[#ff79c6] transition-colors">
                    Unified Intelligence Platform
                  </span>
                  <span className="hidden sm:inline-block text-[10px] text-[#72687d] ml-2 px-1.5 py-0.5 rounded bg-[#160e1d] border border-[#241527]">
                    Legal Documentation
                  </span>
                </div>
              </Link>
            </div>

            {/* Document Switcher Tabs & Tools */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center p-1 rounded-xl bg-[#0f0914] border border-[#241527]">
                <Link
                  href="/privacy"
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#ff79c6]/15 text-[#ff79c6] border border-[#ff79c6]/30 shadow-sm transition-all"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/terms"
                  className="px-3 py-1 rounded-lg text-xs font-medium text-[#a8a0b0] hover:text-white transition-colors"
                >
                  Terms & Conditions
                </Link>
              </div>

              <div className="hidden md:flex items-center gap-1.5 border-l border-[#241527] pl-3">
                <button
                  onClick={handleCopyLink}
                  className="p-2 rounded-lg text-[#a8a0b0] hover:text-white hover:bg-white/5 transition-colors text-xs flex items-center gap-1"
                  title="Copy document URL"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={handlePrint}
                  className="p-2 rounded-lg text-[#a8a0b0] hover:text-white hover:bg-white/5 transition-colors text-xs"
                  title="Print policy"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="relative border-b border-[#241527] bg-gradient-to-b from-[#120a17]/50 to-transparent">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[#ff79c6]/10 text-[#ff79c6] border border-[#ff79c6]/20 mb-4">
              <Shield className="w-3.5 h-3.5" />
              <span>Official Privacy Policy & Data Handling Mandate</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Privacy Policy & Security Disclaimers
            </h1>
            <p className="text-[#a8a0b0] text-sm sm:text-base mt-3 max-w-3xl leading-relaxed">
              Understand how data, files, and multi-tenant rooms are managed in the Unified Intelligence Platform (UIP).
              This document outlines data privacy protocols, local isolation, and non-negotiable liability limits
              regarding autonomous generative AI outputs and platform deployment.
            </p>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-6 pt-6 border-t border-[#241527] text-xs text-[#72687d]">
              <div>
                <span className="text-[#a8a0b0] font-medium">Effective Date:</span> September 16, 2026
              </div>
              <div className="w-1 h-1 rounded-full bg-[#3d1f43]" />
              <div>
                <span className="text-[#a8a0b0] font-medium">Version:</span> 1.4.0 (Enterprise / Open Instance)
              </div>
              <div className="w-1 h-1 rounded-full bg-[#3d1f43]" />
              <div>
                <span className="text-[#a8a0b0] font-medium">Applies To:</span> Self-Hosted, Cloud & On-Prem Deployments
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Layout */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            {/* Table of Contents (Sticky on Desktop) */}
            <aside className="hidden lg:block lg:col-span-4">
              <div className="sticky top-24 space-y-4 p-5 rounded-2xl bg-[#0f0914] border border-[#241527]">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#72687d]">
                  Table of Contents
                </h3>
                <nav className="space-y-1">
                  {sections.map(({ id, title }) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      className={`block px-3 py-2 rounded-lg text-xs transition-all ${
                        activeSection === id
                          ? 'bg-[#ff79c6]/10 text-[#ff79c6] font-medium translate-x-1 border-l-2 border-[#ff79c6]'
                          : 'text-[#a8a0b0] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {title}
                    </a>
                  ))}
                </nav>

                <div className="pt-4 border-t border-[#241527]">
                  <div className="p-3 rounded-xl bg-[#160e1d] border border-[#241527] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <Scale className="w-3.5 h-3.5 text-[#ff79c6]" />
                      <span>Associated Agreement</span>
                    </div>
                    <p className="text-[11px] text-[#72687d] leading-relaxed">
                      Your usage is concurrently governed by our standard terms.
                    </p>
                    <Link
                      href="/terms"
                      className="inline-flex items-center text-xs font-medium text-[#ff79c6] hover:text-[#ff92df] gap-1 transition-colors"
                    >
                      Review Terms of Service <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </aside>

            {/* Document Body */}
            <div className="lg:col-span-8 space-y-12">

              {/* ⚠️ CRITICAL DISCLAIMER 1: ZERO LIABILITY FOR MISUSE */}
              <section id="disclaimer" className="scroll-mt-24">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-[#ef4444]/15 via-[#160e1d] to-[#0f0914] border-2 border-[#ef4444]/40 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                    <ShieldAlert className="w-32 h-32 text-[#ef4444]" />
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#ef4444] flex-shrink-0">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-xl font-bold text-white tracking-tight">
                        Critical Notice: Absolute Disclaimer of Responsibility for Any Misuse
                      </h2>
                      <div className="text-sm text-[#d4c9dc] leading-relaxed space-y-2">
                        <p className="font-semibold text-white">
                          THE CREATORS, MAINTAINERS, CONTRIBUTORS, LICENSORS, AND AFFILIATED ENTITIES OF UNIFIED INTELLIGENCE PLATFORM (UIP) ACCEPT ZERO RESPONSIBILITY AND ZERO LIABILITY FOR ANY KIND OF MISUSE OF THIS SOFTWARE, REPOSITORY, OR DERIVATIVE SYSTEMS.
                        </p>
                        <p>
                          This software is open-source research and enterprise software distributed on an <span className="text-white font-mono font-medium">"AS IS" AND "AS AVAILABLE"</span> basis. The software includes powerful graph traversal, document parsing, automated scraping, continuous intelligence discovery, and neural inference capabilities.
                        </p>
                        <p>
                          Any user, host, administrator, or organization deploying, hosting, modifying, or executing this platform assumes <span className="underline decoration-[#ef4444] font-medium text-white">sole, complete, and unreserved legal and operational liability</span> for all activities carried out through their instance. We explicitly disclaim responsibility for:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-xs text-[#a8a0b0] pl-2">
                          <li>Unlawful ingestion of copyrighted, confidential, classified, or proprietary documents.</li>
                          <li>Deployment of this platform for surveillance, malicious reconnaissance, fraud, or harassment.</li>
                          <li>Security breaches, credential leaks, or data loss caused by self-hosted misconfiguration.</li>
                          <li>Decisions made based on predictive simulations, digital twin forecasts, or automated risk charts.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ⚠️ CRITICAL DISCLAIMER 2: UNCENSORED AI MODEL OUTPUTS */}
              <section id="ai-models" className="scroll-mt-24 space-y-4">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-[#f59e0b]/15 via-[#160e1d] to-[#0f0914] border-2 border-[#f59e0b]/40 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                    <Sparkles className="w-32 h-32 text-[#f59e0b]" />
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-[#f59e0b]/20 border border-[#f59e0b]/40 text-[#f59e0b] flex-shrink-0">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-xl font-bold text-white tracking-tight">
                        Uncensored AI Model Outputs: Zero Developer Responsibility
                      </h2>
                      <div className="text-sm text-[#d4c9dc] leading-relaxed space-y-2">
                        <p className="font-semibold text-white">
                          THIS PLATFORM IS DESIGNED TO CONNECT DIRECTLY TO LOCAL, ON-PREMISE, OR THIRD-PARTY ARTIFICIAL INTELLIGENCE MODELS (INCLUDING BUT NOT LIMITED TO OLLAMA, QWEN, LLAMA, DEEPSEEK, AND OTHER UNCENSORED OR CUSTOM WEIGHTS).
                        </p>
                        <p>
                          WE DO NOT CONTROL, CENSOR, MONITOR, OR AUDIT THE INFERENCE PRODUCED BY THESE MODELS. UNDER NO CIRCUMSTANCES SHALL THE DEVELOPERS OR MAINTAINERS BE HELD RESPONSIBLE FOR ANYTHING THE AI MODEL GENERATES, TRANSMITS, INSTRUCTS, ADVISES, OR PROFILES AS OUTPUT.
                        </p>
                        <div className="p-3.5 rounded-xl bg-[#0a060d] border border-[#f59e0b]/30 text-xs text-[#d4c9dc] space-y-1.5">
                          <p className="font-semibold text-[#f59e0b]">Important Legal & Operational Realities:</p>
                          <ul className="list-disc list-inside space-y-1 text-[#a8a0b0]">
                            <li><strong className="text-white">Uncensored Nature:</strong> Local AI models may generate responses without moderation filters, guardrails, or ethical alignment. Outputs may be inaccurate, offensive, biased, hallucinatory, or unsuitable.</li>
                            <li><strong className="text-white">No Professional Advice:</strong> Any AI output regarding medical, agricultural chemical applications, legal compliance, engineering structures, or financial forecasting is synthetic and cannot be treated as expert guidance.</li>
                            <li><strong className="text-white">Full User Risk:</strong> You and your organization bear 100% of the responsibility to review, sanitize, and verify all AI-generated assertions before acting upon them.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 3: Information Collected & Handled */}
              <section id="data-collection" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ff79c6]/10 border border-[#ff79c6]/30 flex items-center justify-center text-[#ff79c6] text-xs font-bold">
                    01
                  </div>
                  <h2 className="text-lg font-bold text-white">Information Collected & Stored</h2>
                </div>
                
                <div className="p-5 rounded-2xl bg-[#0f0914] border border-[#241527] space-y-4 text-sm text-[#a8a0b0] leading-relaxed">
                  <p>
                    Depending on how an instance is configured by its operator, the system handles the following categories of information:
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-[#160e1d] border border-[#241527]">
                      <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-[#ff79c6]" /> Account & Authentication
                      </h4>
                      <p className="text-xs text-[#72687d]">
                        Email addresses, names, cryptographically salted bcrypt password hashes, session JWT tokens, and RBAC permission roles.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#160e1d] border border-[#241527]">
                      <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-[#ff79c6]" /> Documents & Uploads
                      </h4>
                      <p className="text-xs text-[#72687d]">
                        PDF files, Word DOCX, plain text, and binary attachments uploaded by room members for vectorization and relationship extraction.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#160e1d] border border-[#241527]">
                      <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#ff79c6]" /> Knowledge Graph Data
                      </h4>
                      <p className="text-xs text-[#72687d]">
                        Entities (nodes), ontological types, confidence ratings, semantic relationships (edges), and discovery metadata stored in Neo4j/relational storage.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#160e1d] border border-[#241527]">
                      <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <EyeOff className="w-3.5 h-3.5 text-[#ff79c6]" /> Chat & Interactions
                      </h4>
                      <p className="text-xs text-[#72687d]">
                        Team chat messages, system AI prompt queries, audio note recordings, and investigation hypothesis records strictly partitioned per room.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4: Architecture & Multi-Tenancy */}
              <section id="architecture" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ff79c6]/10 border border-[#ff79c6]/30 flex items-center justify-center text-[#ff79c6] text-xs font-bold">
                    02
                  </div>
                  <h2 className="text-lg font-bold text-white">Multi-Tenant Workspace & Local Isolation</h2>
                </div>

                <div className="p-5 rounded-2xl bg-[#0f0914] border border-[#241527] space-y-3 text-sm text-[#a8a0b0] leading-relaxed">
                  <p>
                    The platform enforces strict physical and logical multi-tenancy:
                  </p>
                  <ul className="space-y-2 list-disc list-inside text-xs pl-1">
                    <li><strong className="text-white">Workspace (Room) Boundary:</strong> Data stored under one Data Room cannot be queried, traversed, or leaked to another Data Room without explicit administrative invitation.</li>
                    <li><strong className="text-white">Local-First Processing:</strong> When configured with local Ollama, all inference, summarization, and entity extraction take place on your infrastructure. Zero prompts or file contents are forwarded to external proprietary clouds.</li>
                    <li><strong className="text-white">Self-Hosted Integrity:</strong> The open-source code operates completely within your own Docker containers or Bare-Metal instances.</li>
                  </ul>
                </div>
              </section>

              {/* Section 5: Retention & User Deletion Rights */}
              <section id="retention" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ff79c6]/10 border border-[#ff79c6]/30 flex items-center justify-center text-[#ff79c6] text-xs font-bold">
                    03
                  </div>
                  <h2 className="text-lg font-bold text-white">Data Retention & Deletion Controls</h2>
                </div>

                <div className="p-5 rounded-2xl bg-[#0f0914] border border-[#241527] space-y-3 text-sm text-[#a8a0b0] leading-relaxed">
                  <p>
                    Users and room administrators have granular control over their information:
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#ff79c6] mt-1.5 flex-shrink-0" />
                      <div>
                        <strong className="text-white">Document Purge:</strong> Deleting a document removes its physical record from the file system and wipes linked unconfirmed entities from the knowledge database.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#ff79c6] mt-1.5 flex-shrink-0" />
                      <div>
                        <strong className="text-white">Graph Reset:</strong> Room administrators can execute full graph wipe operations or roll back to recent automated graph snapshots.
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#ff79c6] mt-1.5 flex-shrink-0" />
                      <div>
                        <strong className="text-white">Account Termination:</strong> Operators are responsible for fulfilling GDPR/CCPA data deletion requests within their individually hosted deployments.
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 6: Third-Party Services */}
              <section id="third-party" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ff79c6]/10 border border-[#ff79c6]/30 flex items-center justify-center text-[#ff79c6] text-xs font-bold">
                    04
                  </div>
                  <h2 className="text-lg font-bold text-white">Third-Party Services & Optional Connectors</h2>
                </div>

                <div className="p-5 rounded-2xl bg-[#0f0914] border border-[#241527] space-y-3 text-sm text-[#a8a0b0] leading-relaxed">
                  <p>
                    If the platform administrator enables external third-party services, data handling is governed by respective provider policies:
                  </p>
                  <ul className="space-y-1.5 list-disc list-inside text-xs text-[#a8a0b0]">
                    <li><strong className="text-white">SMTP Email Gateways:</strong> Used solely to dispatch account verification tokens and password reset messages.</li>
                    <li><strong className="text-white">External Model Endpoints:</strong> If you intentionally configure endpoints targeting OpenAI, Anthropic, or external providers instead of local Ollama, your prompts are subject to their specific data handling terms.</li>
                    <li><strong className="text-white">WebRTC Peer-to-Peer:</strong> Video and audio calls between team members stream peer-to-peer without centralized recording by default.</li>
                  </ul>
                </div>
              </section>

              {/* Section 7: Security Practices */}
              <section id="security" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ff79c6]/10 border border-[#ff79c6]/30 flex items-center justify-center text-[#ff79c6] text-xs font-bold">
                    05
                  </div>
                  <h2 className="text-lg font-bold text-white">Security & Vulnerability Reporting</h2>
                </div>

                <div className="p-5 rounded-2xl bg-[#0f0914] border border-[#241527] space-y-3 text-sm text-[#a8a0b0] leading-relaxed">
                  <p>
                    Security safeguards implemented across the platform architecture include:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-[#160e1d] border border-[#241527]">
                      <span className="font-semibold text-white">Bcrypt Passwords:</span> Salted, high-cost key derivation.
                    </div>
                    <div className="p-3 rounded-lg bg-[#160e1d] border border-[#241527]">
                      <span className="font-semibold text-white">JWT Access Control:</span> Cryptographically signed bearer tokens.
                    </div>
                    <div className="p-3 rounded-lg bg-[#160e1d] border border-[#241527]">
                      <span className="font-semibold text-white">Brute-Force Lockout:</span> Automatic timed freeze on repeated login failures.
                    </div>
                    <div className="p-3 rounded-lg bg-[#160e1d] border border-[#241527]">
                      <span className="font-semibold text-white">Strict RBAC:</span> Room-isolated permission verification on every REST & WS endpoint.
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 8: Contact & Inquiries */}
              <section id="contact" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ff79c6]/10 border border-[#ff79c6]/30 flex items-center justify-center text-[#ff79c6] text-xs font-bold">
                    06
                  </div>
                  <h2 className="text-lg font-bold text-white">Contact & Governance</h2>
                </div>

                <div className="p-5 rounded-2xl bg-[#0f0914] border border-[#241527] space-y-3 text-sm text-[#a8a0b0] leading-relaxed">
                  <p>
                    For questions regarding this Privacy Policy or software architecture, please refer to the official documentation repository. For self-hosted instances operated by private enterprises, contact your system administrator or legal department.
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
                    <Link
                      href="/terms"
                      className="px-4 py-2 rounded-xl bg-[#160e1d] border border-[#241527] hover:border-[#ff79c6]/40 text-white font-medium transition-colors inline-flex items-center gap-1.5"
                    >
                      <Scale className="w-4 h-4 text-[#ff79c6]" /> View Terms & Conditions
                    </Link>
                    <Link
                      href="/login"
                      className="px-4 py-2 rounded-xl bg-[#ff79c6]/10 border border-[#ff79c6]/30 text-[#ff79c6] hover:bg-[#ff79c6]/20 font-medium transition-colors"
                    >
                      Return to Sign In
                    </Link>
                  </div>
                </div>
              </section>

            </div>
          </div>
        </main>

        {/* Global Clean Footer */}
        <footer className="border-t border-[#241527] bg-[#0a060d] py-8 mt-16 text-xs text-[#72687d]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">Unified Intelligence Platform</span>
              <span>© {new Date().getFullYear()}</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-[#ff79c6] hover:underline">Privacy Policy</Link>
              <Link href="/terms" className="text-[#a8a0b0] hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/login" className="text-[#a8a0b0] hover:text-white transition-colors">Sign In</Link>
              <Link href="/dashboard" className="text-[#a8a0b0] hover:text-white transition-colors">Dashboard</Link>
            </div>
          </div>
        </footer>
      </div>
    </ClientOnly>
  );
}
