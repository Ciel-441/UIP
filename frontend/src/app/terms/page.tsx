'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Scale,
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
  Sparkles,
  ChevronRight,
  ShieldX,
  Flame,
  CheckCircle2
} from 'lucide-react';
import ClientOnly from '@/components/ClientOnly';

export default function TermsAndConditionsPage() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState('misuse-disclaimer');

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
    { id: 'misuse-disclaimer', title: 'Absolute Disclaimer of Misuse' },
    { id: 'ai-disclaimer', title: 'Uncensored AI Model Output Disclaimer' },
    { id: 'acceptance', title: 'Acceptance of Terms & License' },
    { id: 'user-obligations', title: 'User Obligations & Prohibited Activities' },
    { id: 'simulations', title: 'Digital Twins & Predictive Models' },
    { id: 'indemnification', title: 'Indemnification & Hold Harmless' },
    { id: 'warranty', title: 'Warranty Disclaimers ("AS IS")' },
    { id: 'governance', title: 'Termination & Amendments' },
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
        <div className="fixed top-0 right-1/4 w-[600px] h-[600px] bg-[#d68eff]/5 rounded-full blur-[180px] pointer-events-none -z-10" />
        <div className="fixed bottom-0 left-1/4 w-[500px] h-[500px] bg-[#ff79c6]/5 rounded-full blur-[180px] pointer-events-none -z-10" />

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
                  className="px-3 py-1 rounded-lg text-xs font-medium text-[#a8a0b0] hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/terms"
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#ff79c6]/15 text-[#ff79c6] border border-[#ff79c6]/30 shadow-sm transition-all"
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
                  title="Print terms"
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
              <Scale className="w-3.5 h-3.5" />
              <span>User Agreement & Limitation of Liability</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Terms and Conditions of Service
            </h1>
            <p className="text-[#a8a0b0] text-sm sm:text-base mt-3 max-w-3xl leading-relaxed">
              Please read these terms carefully before accessing, hosting, building, or utilizing the Unified Intelligence Platform.
              By accessing this project, you explicitly acknowledge our zero-liability stance regarding any platform misuse and all outputs
              generated by integrated uncensored artificial intelligence models.
            </p>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-6 pt-6 border-t border-[#241527] text-xs text-[#72687d]">
              <div>
                <span className="text-[#a8a0b0] font-medium">Effective Date:</span> September 16, 2026
              </div>
              <div className="w-1 h-1 rounded-full bg-[#3d1f43]" />
              <div>
                <span className="text-[#a8a0b0] font-medium">Document Version:</span> 1.4.0
              </div>
              <div className="w-1 h-1 rounded-full bg-[#3d1f43]" />
              <div>
                <span className="text-[#a8a0b0] font-medium">Governing License:</span> MIT Open Source License
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
                  Quick Navigation
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
                      <Shield className="w-3.5 h-3.5 text-[#ff79c6]" />
                      <span>Data Protection</span>
                    </div>
                    <p className="text-[11px] text-[#72687d] leading-relaxed">
                      Learn how local workspace data and document embeddings are preserved.
                    </p>
                    <Link
                      href="/privacy"
                      className="inline-flex items-center text-xs font-medium text-[#ff79c6] hover:text-[#ff92df] gap-1 transition-colors"
                    >
                      Read Privacy Policy <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </aside>

            {/* Terms Body */}
            <div className="lg:col-span-8 space-y-12">

              {/* ⚠️ CRITICAL CLAUSE 1: ABSOLUTE DISCLAIMER OF MISUSE */}
              <section id="misuse-disclaimer" className="scroll-mt-24">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-[#ef4444]/15 via-[#160e1d] to-[#0f0914] border-2 border-[#ef4444]/40 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                    <ShieldX className="w-36 h-36 text-[#ef4444]" />
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#ef4444] flex-shrink-0">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30">
                        Binding Disclaimer 1.0
                      </div>
                      <h2 className="text-xl font-bold text-white tracking-tight">
                        Zero Responsibility & Absolute Disclaimer for Any Misuse of this Project
                      </h2>
                      <div className="text-sm text-[#d4c9dc] leading-relaxed space-y-2.5">
                        <p className="font-semibold text-white">
                          UNDER NO CIRCUMSTANCES SHALL THE AUTHORS, ORIGINAL DEVELOPERS, CODE REPOSITORY CONTRIBUTORS, COPYRIGHT HOLDERS, OR HOSTING AFFILIATES BE HELD LIABLE FOR ANY KIND OF MISUSE, ILLICIT APPLICATION, UNLAWFUL OPERATION, OR HARMFUL OUTCOME RESULTING DIRECTLY OR INDIRECTLY FROM THIS PROJECT OR ANY FORK THEREOF.
                        </p>
                        <p>
                          The Unified Intelligence Platform (UIP) provides deep graph mining, document intelligence, automated parsing, multi-tenant collaboration, and computational simulations. You acknowledge that:
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 text-xs text-[#a8a0b0] pl-1">
                          <li><strong className="text-white">Sole User Responsibility:</strong> You alone bear total responsibility for verifying the legal authority and ethical propriety of all data, texts, documents, and network topologies ingested into the platform.</li>
                          <li><strong className="text-white">Prohibition of Malicious Use:</strong> You may not use this system for cyber warfare, unlawful corporate espionage, unauthorized personally identifiable information (PII) tracking, copyright infringement, malicious automation, or harassment.</li>
                          <li><strong className="text-white">Deployment Immunity:</strong> If any party deploys this platform in violation of local, federal, or international laws, that party accepts 100% legal culpability and unconditionally indemnifies and holds harmless the project maintainers.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ⚠️ CRITICAL CLAUSE 2: UNCENSORED AI MODEL OUTPUT DISCLAIMER */}
              <section id="ai-disclaimer" className="scroll-mt-24 space-y-4">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-[#f59e0b]/15 via-[#160e1d] to-[#0f0914] border-2 border-[#f59e0b]/40 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                    <Flame className="w-36 h-36 text-[#f59e0b]" />
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-[#f59e0b]/20 border border-[#f59e0b]/40 text-[#f59e0b] flex-shrink-0">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30">
                        Binding AI Disclaimer 2.0
                      </div>
                      <h2 className="text-xl font-bold text-white tracking-tight">
                        Uncensored AI Model Outputs: Complete Disclaimer of Responsibility
                      </h2>
                      <div className="text-sm text-[#d4c9dc] leading-relaxed space-y-2.5">
                        <p className="font-semibold text-white">
                          THIS SOFTWARE IS ARCHITECTED TO CONNECT TO AND EXECUTE LOCAL, PRIVATE, UNCENSORED, OR USER-CONFIGURED ARTIFICIAL INTELLIGENCE MODELS (INCLUDING OLLAMA RUNNING QWEN, LLAMA, DEEPSEEK, MISTRAL, OR CUSTOM FINE-TUNES).
                        </p>
                        <p className="font-semibold text-[#f59e0b]">
                          WE ARE NOT RESPONSIBLE FOR ANYTHING THE AI SAYS, GENERATES, PREDICTS, INFERS, CONTRADICTS, OR ADVISES AS OUTPUT.
                        </p>
                        <p>
                          Because integrated models are often completely uncensored and lack centralized corporate filtering:
                        </p>
                        <div className="p-4 rounded-xl bg-[#08050a] border border-[#f59e0b]/30 text-xs space-y-2 text-[#d4c9dc]">
                          <div className="flex items-start gap-2">
                            <span className="text-[#f59e0b] font-bold">•</span>
                            <div>
                              <strong className="text-white">Unfiltered & Autonomous Generations:</strong> Uncensored neural networks produce completions based strictly on mathematical token probability. Outputs may be vulgar, misleading, offensive, factually false, legally hazardous, or scientifically flawed. The creators do not review or endorse any output.
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-[#f59e0b] font-bold">•</span>
                            <div>
                              <strong className="text-white">Zero Professional Reliance:</strong> Output generated by the AI assistant or extraction engine must NEVER be construed as professional medical, agricultural chemical safety, engineering, legal, or fiscal advice.
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-[#f59e0b] font-bold">•</span>
                            <div>
                              <strong className="text-white">Human-in-the-Loop Mandate:</strong> The operator and human users are solely responsible for reviewing, sanity-checking, and validating all extracted graph relationships, answers, and summaries prior to relying on them.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 3: Acceptance of Terms & License */}
              <section id="acceptance" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ff79c6]/10 border border-[#ff79c6]/30 flex items-center justify-center text-[#ff79c6] text-xs font-bold">
                    01
                  </div>
                  <h2 className="text-lg font-bold text-white">Acceptance of Terms & MIT License</h2>
                </div>

                <div className="p-5 rounded-2xl bg-[#0f0914] border border-[#241527] space-y-3 text-sm text-[#a8a0b0] leading-relaxed">
                  <p>
                    By registering an account, accessing any Data Room, executing Docker containers, or interacting with API endpoints, you express full, irrevocable consent to these Terms and Conditions.
                  </p>
                  <p className="text-xs">
                    This project is licensed under the <strong className="text-white">MIT License</strong>: Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, subject to the condition that the copyright notice and this permission notice be included in all copies or substantial portions of the Software.
                  </p>
                </div>
              </section>

              {/* Section 4: User Obligations */}
              <section id="user-obligations" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ff79c6]/10 border border-[#ff79c6]/30 flex items-center justify-center text-[#ff79c6] text-xs font-bold">
                    02
                  </div>
                  <h2 className="text-lg font-bold text-white">User Obligations & Prohibited Activities</h2>
                </div>

                <div className="p-5 rounded-2xl bg-[#0f0914] border border-[#241527] space-y-3 text-sm text-[#a8a0b0] leading-relaxed">
                  <p>
                    As an operator or user of this instance, you agree NOT to:
                  </p>
                  <ul className="space-y-2 list-disc list-inside text-xs text-[#d4c9dc] pl-1">
                    <li>Ingest or vectorize documents containing unauthorized medical health records, illegal material, or state secrets.</li>
                    <li>Attempt to bypass room workspace isolation boundaries or escalate RBAC privileges without authorization.</li>
                    <li>Conduct distributed denial-of-service (DDoS) attacks against running backend endpoints or WebSocket gateways.</li>
                    <li>Use the platform's continuous discovery engine to crawl or scrape private websites without authorization.</li>
                  </ul>
                </div>
              </section>

              {/* Section 5: Simulations & Digital Twins */}
              <section id="simulations" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ff79c6]/10 border border-[#ff79c6]/30 flex items-center justify-center text-[#ff79c6] text-xs font-bold">
                    03
                  </div>
                  <h2 className="text-lg font-bold text-white">Digital Twins, Predictive Simulations & Forecasts</h2>
                </div>

                <div className="p-5 rounded-2xl bg-[#0f0914] border border-[#241527] space-y-3 text-sm text-[#a8a0b0] leading-relaxed">
                  <p>
                    The platform includes digital twin configurations, scenario stress tests, and mathematical forecasting graphs:
                  </p>
                  <div className="p-3.5 rounded-xl bg-[#160e1d] border border-[#241527] text-xs text-[#a8a0b0] space-y-1.5">
                    <p>
                      <strong className="text-white">Experimental Nature:</strong> Simulations and parameter curves are mathematical approximations calculated from user-provided formulas. They do not constitute guaranteed future outcomes, clinical safety trials, or financial projections.
                    </p>
                    <p>
                      The creators bear zero responsibility for commercial, physical, environmental, or material losses sustained through reliance on platform simulations.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 6: Indemnification */}
              <section id="indemnification" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ff79c6]/10 border border-[#ff79c6]/30 flex items-center justify-center text-[#ff79c6] text-xs font-bold">
                    04
                  </div>
                  <h2 className="text-lg font-bold text-white">Indemnification & Hold Harmless</h2>
                </div>

                <div className="p-5 rounded-2xl bg-[#0f0914] border border-[#241527] space-y-3 text-sm text-[#a8a0b0] leading-relaxed">
                  <p>
                    You agree to defend, indemnify, and hold harmless the Unified Intelligence Platform developers, contributors, and maintainers against any and all claims, damages, liabilities, losses, costs, or debt (including legal fees) arising from:
                  </p>
                  <ul className="space-y-1 text-xs text-[#a8a0b0] list-disc list-inside">
                    <li>Your deployment, operation, or misuse of this software.</li>
                    <li>Any output, message, or hallucination generated by the connected AI models.</li>
                    <li>Any infringement of third-party intellectual property or privacy rights.</li>
                    <li>Breach of any provision within these Terms and Conditions.</li>
                  </ul>
                </div>
              </section>

              {/* Section 7: Warranty Disclaimers */}
              <section id="warranty" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ff79c6]/10 border border-[#ff79c6]/30 flex items-center justify-center text-[#ff79c6] text-xs font-bold">
                    05
                  </div>
                  <h2 className="text-lg font-bold text-white">Warranty Disclaimers ("AS IS")</h2>
                </div>

                <div className="p-5 rounded-2xl bg-[#0f0914] border border-[#241527] space-y-3 text-sm text-[#a8a0b0] leading-relaxed">
                  <p className="text-xs uppercase tracking-wide font-mono text-[#72687d]">
                    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
                  </p>
                </div>
              </section>

              {/* Section 8: Governance & Amendments */}
              <section id="governance" className="scroll-mt-24 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ff79c6]/10 border border-[#ff79c6]/30 flex items-center justify-center text-[#ff79c6] text-xs font-bold">
                    06
                  </div>
                  <h2 className="text-lg font-bold text-white">Amendments & Continued Use</h2>
                </div>

                <div className="p-5 rounded-2xl bg-[#0f0914] border border-[#241527] space-y-3 text-sm text-[#a8a0b0] leading-relaxed">
                  <p>
                    We reserve the right to revise or modify these Terms and Conditions at any time. Continued usage or repository synchronization after modifications constitutes acceptance of the updated terms.
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
                    <Link
                      href="/privacy"
                      className="px-4 py-2 rounded-xl bg-[#160e1d] border border-[#241527] hover:border-[#ff79c6]/40 text-white font-medium transition-colors inline-flex items-center gap-1.5"
                    >
                      <Shield className="w-4 h-4 text-[#ff79c6]" /> View Privacy Policy
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
              <Link href="/terms" className="text-[#ff79c6] hover:underline">Terms of Service</Link>
              <Link href="/privacy" className="text-[#a8a0b0] hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/login" className="text-[#a8a0b0] hover:text-white transition-colors">Sign In</Link>
              <Link href="/dashboard" className="text-[#a8a0b0] hover:text-white transition-colors">Dashboard</Link>
            </div>
          </div>
        </footer>
      </div>
    </ClientOnly>
  );
}
