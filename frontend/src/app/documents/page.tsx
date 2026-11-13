'use client';

import ClientOnly from '@/components/ClientOnly';

import React, { useState, useCallback, useRef } from 'react';
import {
  Upload, FileText, Search, Eye, Zap, CheckCircle2, XCircle,
  Clock, AlertTriangle, Trash2, Download, MoreVertical, FileUp,
  File, FilePlus, ChevronDown, X, Check, Loader2
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import { cn, formatDate, getEntityColor, getEntityBgColor } from '@/lib/utils';
import { documentApi, entityApi, relationshipApi } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { useDialog } from '@/context/DialogContext';
import { Document, ExtractedEntity, ExtractedRelationship } from '@/types';
import jsPDF from 'jspdf';

/* ─── Status Config ──────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { icon: any; label: string; class: string }> = {
  uploaded:   { icon: FileUp,        label: 'Uploaded',   class: 'text-[#6b6b7b]' },
  processing: { icon: Loader2,       label: 'Processing', class: 'text-[#f59e0b] animate-spin' },
  extracted:  { icon: Eye,           label: 'Extracted',  class: 'text-[#ff79c6]' },
  confirmed:  { icon: CheckCircle2,  label: 'Confirmed',  class: 'text-[#10b981]' },
  error:      { icon: XCircle,       label: 'Error',      class: 'text-[#ef4444]' },
};

/* ─── Extraction Review Modal ────────────────────────────────── */
interface ExtractionReviewProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
  onConfirm: () => void;
}

function ExtractionReviewModal({ isOpen, onClose, document: doc, onConfirm }: ExtractionReviewProps) {
  const { confirm, showToast } = useDialog();
  const [extractedEntities, setExtractedEntities] = useState<(ExtractedEntity & { selected: boolean })[]>([]);
  const [extractedRelationships, setExtractedRelationships] = useState<(ExtractedRelationship & { selected: boolean })[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [step, setStep] = useState<'entities' | 'relationships'>('entities');

  // Load extraction data when opened
  React.useEffect(() => {
    if (!isOpen || !doc) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await documentApi.get(doc.id);
        const data = res.data;
        if (data.extracted_entities) {
          setExtractedEntities(data.extracted_entities.map((e: ExtractedEntity) => ({ ...e, selected: true })));
        }
        if (data.extracted_relationships) {
          setExtractedRelationships(data.extracted_relationships.map((r: ExtractedRelationship) => ({ ...r, selected: true })));
        }
      } catch {
        // If doc details endpoint doesn't return extracted data, show empty state
        setExtractedEntities([]);
        setExtractedRelationships([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    setStep('entities');
  }, [isOpen, doc]);

  const toggleEntity = (idx: number) => {
    setExtractedEntities((prev) => prev.map((e, i) => i === idx ? { ...e, selected: !e.selected } : e));
  };

  const toggleRelationship = (idx: number) => {
    setExtractedRelationships((prev) => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  const selectAllEntities = (selected: boolean) => {
    setExtractedEntities((prev) => prev.map((e) => ({ ...e, selected })));
  };

  const selectAllRels = (selected: boolean) => {
    setExtractedRelationships((prev) => prev.map((r) => ({ ...r, selected })));
  };

  const handleConfirm = async () => {
    if (!doc) return;
    setConfirming(true);
    try {
      const selectedEntities = extractedEntities.filter((e) => e.selected).map(({ selected, ...rest }) => rest);
      const selectedRels = extractedRelationships.filter((r) => r.selected).map(({ selected, ...rest }) => rest);
      await documentApi.confirm(doc.id, { entities: selectedEntities, relationships: selectedRels });
      onConfirm();
      onClose();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
      showToast(msg || 'Failed to confirm extraction', "error");
    } finally {
      setConfirming(false);
    }
  };

  const selectedEntCount = extractedEntities.filter((e) => e.selected).length;
  const selectedRelCount = extractedRelationships.filter((r) => r.selected).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review Extracted Data" size="xl">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-[#0a0a0f] rounded-xl p-1">
            <button
              className={cn(
                'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200',
                step === 'entities'
                  ? 'bg-[#ff79c6] text-white shadow-lg shadow-[#ff79c6]/20'
                  : 'text-[#6b6b7b] hover:text-[#a0a0b0]'
              )}
              onClick={() => setStep('entities')}
            >
              Entities ({selectedEntCount}/{extractedEntities.length})
            </button>
            <button
              className={cn(
                'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200',
                step === 'relationships'
                  ? 'bg-[#ff79c6] text-white shadow-lg shadow-[#ff79c6]/20'
                  : 'text-[#6b6b7b] hover:text-[#a0a0b0]'
              )}
              onClick={() => setStep('relationships')}
            >
              Relationships ({selectedRelCount}/{extractedRelationships.length})
            </button>
          </div>

          {/* Content */}
          {step === 'entities' && (
            <div>
              {extractedEntities.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-[#6b6b7b] mx-auto mb-2" />
                  <p className="text-sm text-[#6b6b7b]">No entities extracted</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-[#6b6b7b]">Select entities to add to graph</span>
                    <div className="flex gap-2">
                      <button onClick={() => selectAllEntities(true)} className="text-xs text-[#ff79c6] hover:text-[#ff92df] transition-colors">Select All</button>
                      <button onClick={() => selectAllEntities(false)} className="text-xs text-[#6b6b7b] hover:text-[#a0a0b0] transition-colors">Deselect All</button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    {extractedEntities.map((entity, idx) => {
                      const color = getEntityColor(entity.type);
                      return (
                        <button
                          key={idx}
                          onClick={() => toggleEntity(idx)}
                          className={cn(
                            'w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-all duration-200',
                            entity.selected
                              ? 'bg-white/[0.03] border-[#3a3a4e]'
                              : 'bg-transparent border-[#2a2a3e] opacity-50'
                          )}
                        >
                          <div className={cn(
                            'mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                          )}
                            style={{
                              borderColor: entity.selected ? color : '#3a3a4e',
                              backgroundColor: entity.selected ? `${color}22` : 'transparent',
                            }}
                          >
                            {entity.selected && <Check className="w-3 h-3" style={{ color }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white">{entity.name}</span>
                              <span
                                className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full"
                                style={{ color, backgroundColor: `${color}22` }}
                              >
                                {entity.type}
                              </span>
                            </div>
                            {entity.description && (
                              <p className="text-xs text-[#6b6b7b] line-clamp-2">{entity.description}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'relationships' && (
            <div>
              {extractedRelationships.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-[#6b6b7b] mx-auto mb-2" />
                  <p className="text-sm text-[#6b6b7b]">No relationships extracted</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-[#6b6b7b]">Select relationships to add to graph</span>
                    <div className="flex gap-2">
                      <button onClick={() => selectAllRels(true)} className="text-xs text-[#ff79c6] hover:text-[#ff92df] transition-colors">Select All</button>
                      <button onClick={() => selectAllRels(false)} className="text-xs text-[#6b6b7b] hover:text-[#a0a0b0] transition-colors">Deselect All</button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    {extractedRelationships.map((rel, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleRelationship(idx)}
                        className={cn(
                          'w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all duration-200',
                          rel.selected
                            ? 'bg-white/[0.03] border-[#3a3a4e]'
                            : 'bg-transparent border-[#2a2a3e] opacity-50'
                        )}
                      >
                        <div className={cn(
                          'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                          rel.selected ? 'border-[#ff79c6] bg-[#ff79c6]/20' : 'border-[#3a3a4e]'
                        )}>
                          {rel.selected && <Check className="w-3 h-3 text-[#ff79c6]" />}
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-sm text-white font-medium truncate">{rel.source_name}</span>
                          <span className="text-xs text-[#ff79c6] font-medium px-2 py-0.5 bg-[#ff79c6]/10 rounded-full whitespace-nowrap">
                            {rel.type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm text-white font-medium truncate">{rel.target_name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-[#2a2a3e]">
            <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirm}
              loading={confirming}
              disabled={selectedEntCount === 0 && selectedRelCount === 0}
              className="flex-1"
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              Confirm ({selectedEntCount + selectedRelCount} items)
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ─── Main Documents Page ────────────────────────────────────── */
export default function DocumentsPage() {
  const { confirm, showToast } = useDialog();
  const { data: documents, loading, error, refetch } = useApi<Document[]>(() => documentApi.list(), []);
  const [uploading, setUploading] = useState(false);
  const [extractingIds, setExtractingIds] = useState<Set<number>>(new Set());
  const [reviewDoc, setReviewDoc] = useState<Document | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFileName, setCreateFileName] = useState('');
  const [createFileContent, setCreateFileContent] = useState('');
  const [createFileType, setCreateFileType] = useState<'txt' | 'pdf'>('txt');

  const prevDocumentsRef = useRef<Document[]>([]);

  // Poll for status updates if any document is processing
  React.useEffect(() => {
    const hasProcessing = documents?.some(d => d.status === 'processing');
    if (hasProcessing) {
      const interval = setInterval(() => {
        refetch();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [documents, refetch]);

  // Check for document state transitions to error to show popups
  React.useEffect(() => {
    if (!documents) return;
    
    documents.forEach(doc => {
      const prevDoc = prevDocumentsRef.current.find(d => d.id === doc.id);
      if (prevDoc && prevDoc.status !== 'error' && doc.status === 'error') {
        const hasSlurError = Array.isArray(doc.extracted_entities) && 
          doc.extracted_entities.length > 0 && 
          doc.extracted_entities[0]?.error === "Inappropriate language used";

        if (hasSlurError) {
          showToast("Inappropriate language used", "error");
        } else {
          showToast(`Extraction failed for ${doc.original_name}`, "error");
        }
      }
    });

    prevDocumentsRef.current = documents;
  }, [documents, showToast]);

  /* ── Upload handler ──────────────────────────────────────── */
  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await documentApi.upload(file);
      }
      await refetch();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Upload failed', "error");
    } finally {
      setUploading(false);
    }
  }, [refetch]);

  /* ── Drag & Drop handlers ────────────────────────────────── */
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const handleCreateFile = useCallback(async () => {
    if (!createFileName.trim() || !createFileContent.trim()) return;
    
    const baseName = createFileName.trim().replace(/\.(txt|pdf)$/i, '');
    const filename = `${baseName}.${createFileType}`;
    
    let file: File;
    
    if (createFileType === 'pdf') {
      const doc = new jsPDF();
      const textLines = doc.splitTextToSize(createFileContent, 180);
      let y = 10;
      for (let i = 0; i < textLines.length; i++) {
        if (y > 280) {
          doc.addPage();
          y = 10;
        }
        doc.text(textLines[i], 10, y);
        y += 7;
      }
      const pdfBlob = doc.output('blob');
      file = new window.File([pdfBlob], filename, { type: 'application/pdf' });
    } else {
      file = new window.File([createFileContent], filename, { type: 'text/plain' });
    }

    const dt = new DataTransfer();
    dt.items.add(file);
    await handleUpload(dt.files);
    setIsCreateModalOpen(false);
    setCreateFileName('');
    setCreateFileContent('');
    setCreateFileType('txt');
  }, [createFileName, createFileContent, createFileType, handleUpload]);

  /* ── Extract handler ─────────────────────────────────────── */
  const handleExtract = async (docId: number) => {
    setExtractingIds(prev => {
      const next = new Set(prev);
      next.add(docId);
      return next;
    });

    try {
      await documentApi.extract(docId);
      showToast("Extraction started! This may take several minutes on local hardware.", "success");
      await refetch();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Extraction failed', "error");
    } finally {
      setExtractingIds(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  /* ── Delete handler ──────────────────────────────────────── */
  const handleDelete = async (docId: number, name: string) => {
    const confirmed = await confirm({
      title: "Delete Document",
      message: `Are you sure you want to delete "${name}"?`,
      type: "destructive",
      confirmText: "Delete"
    });
    if (!confirmed) return;
    try {
      await documentApi.delete(docId);
      await refetch();
      showToast(`Document "${name}" deleted successfully`, "success");
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to delete', "error");
    }
  };

  /* ── Reset handler ───────────────────────────────────────── */
  const handleReset = async (docId: number) => {
    const confirmed = await confirm({
      title: "Reset Document",
      message: "Reset this document? This will allow you to extract it again.",
      type: "warning",
      confirmText: "Reset"
    });
    if (!confirmed) return;
    try {
      await documentApi.reset(docId);
      await refetch();
      showToast("Document reset successfully", "success");
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Reset failed', "error");
    }
  };

  return (
    <ClientOnly>
    <AppShell>
      <div className="max-w-6xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff79c6] to-[#d68eff] flex items-center justify-center shadow-lg shadow-[#ff79c6]/20">
                <FileText className="w-5 h-5 text-white" />
              </div>
              Documents
            </h1>
            <p className="text-sm text-[#6b6b7b] mt-1 ml-[52px]">Upload, process, and extract knowledge from documents</p>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              icon={<FilePlus className="w-4 h-4" />}
              onClick={() => setIsCreateModalOpen(true)}
              className="flex-1 sm:flex-initial justify-center"
            >
              Create Document
            </Button>
            <div className="text-right border-l border-[#2a2a3e] pl-4 shrink-0">
              <p className="text-2xl font-bold text-white tabular-nums">{documents?.length || 0}</p>
              <p className="text-[10px] text-[#6b6b7b] uppercase tracking-wider">Total Documents</p>
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'relative mb-8 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer group overflow-hidden',
            dragActive
              ? 'border-[#ff79c6] bg-[#ff79c6]/5 scale-[1.01]'
              : 'border-[#2a2a3e] bg-[#12121a]/50 hover:border-[#3a3a4e] hover:bg-[#12121a]'
          )}
        >
          {/* Gradient glow on hover/drag */}
          <div className={cn(
            'absolute inset-0 opacity-0 transition-opacity duration-500 pointer-events-none',
            dragActive ? 'opacity-100' : 'group-hover:opacity-50'
          )}>
            <div className="absolute inset-0 bg-gradient-to-b from-[#ff79c6]/5 via-transparent to-transparent" />
          </div>

          <div className="relative py-10 px-6 text-center">
            <div className={cn(
              'mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300',
              dragActive
                ? 'bg-[#ff79c6]/20 scale-110'
                : 'bg-[#1a1a2e] group-hover:bg-[#ff79c6]/10 group-hover:scale-105'
            )}>
              {uploading ? (
                <Loader2 className="w-7 h-7 text-[#ff79c6] animate-spin" />
              ) : (
                <Upload className={cn(
                  'w-7 h-7 transition-colors duration-300',
                  dragActive ? 'text-[#ff79c6]' : 'text-[#6b6b7b] group-hover:text-[#ff79c6]'
                )} />
              )}
            </div>
            <p className="text-sm font-medium text-white mb-1">
              {uploading ? 'Uploading...' : dragActive ? 'Drop files here' : 'Drag & drop files here, or click to browse'}
            </p>
            <p className="text-xs text-[#6b6b7b]">Supports PDF, DOCX, TXT files</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.doc"
            onChange={(e) => handleUpload(e.target.files)}
            className="hidden"
          />
        </div>

        {/* Document List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <AlertTriangle className="w-12 h-12 text-[#ef4444] mx-auto mb-3" />
            <p className="text-sm text-[#ef4444] mb-3">{error}</p>
            <Button variant="secondary" size="sm" onClick={refetch}>Retry</Button>
          </div>
        ) : !documents || documents.length === 0 ? (
          <div className="text-center py-16">
            <File className="w-16 h-16 text-[#2a2a3e] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-1">No documents yet</h3>
            <p className="text-sm text-[#6b6b7b]">Upload your first document to get started</p>
          </div>
        ) : (
          <div className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_130px_100px_130px_180px] gap-4 px-6 py-3.5 border-b border-[#2a2a3e] bg-[#0a0a0f]/50">
              <span className="text-[11px] font-medium text-[#6b6b7b] uppercase tracking-wider">Document</span>
              <span className="text-[11px] font-medium text-[#6b6b7b] uppercase tracking-wider">Status</span>
              <span className="text-[11px] font-medium text-[#6b6b7b] uppercase tracking-wider text-center">Entities</span>
              <span className="text-[11px] font-medium text-[#6b6b7b] uppercase tracking-wider">Date</span>
              <span className="text-[11px] font-medium text-[#6b6b7b] uppercase tracking-wider text-right">Actions</span>
            </div>

            {/* Table body */}
            <div className="divide-y divide-[#2a2a3e]/50">
              {documents.map((doc) => {
                const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.uploaded;
                const StatusIcon = statusCfg.icon;
                const isExtracting = extractingIds.has(doc.id);

                return (
                  <div
                    key={doc.id}
                    className="flex flex-col md:grid md:grid-cols-[1fr_130px_100px_130px_180px] gap-4 p-4 md:px-6 md:py-4 items-start md:items-center hover:bg-white/[0.02] transition-colors group"
                  >
                    {/* Name */}
                    <div className="flex items-center gap-3 min-w-0 w-full md:w-auto">
                      <div className="w-9 h-9 rounded-lg bg-[#1a1a2e] border border-[#2a2a3e] flex items-center justify-center shrink-0 group-hover:border-[#3a3a4e] transition-colors">
                        <FileText className="w-4 h-4 text-[#6b6b7b]" />
                      </div>
                      <div className="min-w-0 flex-1 md:flex-initial">
                        <p className="text-sm font-medium text-white truncate">{doc.original_name || doc.filename}</p>
                        <p className="text-[10px] text-[#6b6b7b] truncate">{doc.filename}</p>
                      </div>
                    </div>

                    {/* Status & Details Wrapper */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 w-full md:w-auto md:contents">
                      {/* Status */}
                      <div className="shrink-0 w-full max-w-[140px] md:w-[120px]">
                        {doc.status === 'processing' ? (
                          <div className="flex flex-col gap-1 w-full">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-[#f59e0b] font-medium flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                Processing
                              </span>
                              <span className="text-[#f59e0b] font-semibold tabular-nums">
                                {doc.progress ?? 0}%
                              </span>
                            </div>
                            <div className="w-full h-1 bg-[#1a1a2e] rounded-full overflow-hidden border border-[#2a2a3e]">
                              <div
                                className="h-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] rounded-full shadow-[0_0_6px_rgba(245,158,11,0.5)] transition-all duration-500 ease-out"
                                style={{ width: `${doc.progress ?? 0}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <Badge variant="status" status={doc.status}>
                            <StatusIcon className={cn('w-3 h-3 mr-1.5', statusCfg.class)} />
                            {statusCfg.label}
                          </Badge>
                        )}
                      </div>

                      {/* Entity count */}
                      <div className="md:text-center flex items-center gap-1.5 md:block text-[#a0a0b0] md:text-white">
                        <span className="md:hidden text-xs text-[#6b6b7b]">Entities:</span>
                        <span className="text-sm font-semibold tabular-nums">
                          {doc.entity_count ?? '—'}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="text-[#6b6b7b]">
                        <span className="md:hidden text-xs mr-1">Date:</span>
                        <span className="text-xs">{formatDate(doc.created_at)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto border-t border-[#2a2a3e]/30 pt-3 md:pt-0 md:border-none">
                      <div className="flex items-center gap-2">
                        {(doc.status === 'processing' || isExtracting) && (
                          <span className="text-xs text-[#f59e0b] flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Extracting ({doc.progress ?? 0}%)
                          </span>
                        )}
                        {((doc.status === 'uploaded' || doc.status === 'error') && !isExtracting) && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Zap className="w-3.5 h-3.5" />}
                            onClick={() => handleExtract(doc.id)}
                          >
                            Extract
                          </Button>
                        )}
                        {(doc.status === 'extracted') && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleReset(doc.id)}
                            >
                              Re-process
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<Eye className="w-3.5 h-3.5" />}
                              onClick={() => setReviewDoc(doc)}
                            >
                              Review
                            </Button>
                          </div>
                        )}
                        {doc.status === 'confirmed' && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleReset(doc.id)}
                            >
                              Re-process
                            </Button>
                            <Badge variant="status" status="confirmed">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Saved
                            </Badge>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(doc.id, doc.original_name || doc.filename); }}
                        className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-[#6b6b7b] hover:text-[#ef4444] transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Extraction Review Modal */}
        <ExtractionReviewModal
          isOpen={!!reviewDoc}
          onClose={() => setReviewDoc(null)}
          document={reviewDoc}
          onConfirm={refetch}
        />

        {/* Create Text/PDF File Modal */}
        <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Document" size="lg">
          <div className="space-y-4">
            <div className="flex items-center gap-6 mb-4">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input 
                  type="radio" 
                  name="fileType" 
                  value="txt" 
                  checked={createFileType === 'txt'} 
                  onChange={() => setCreateFileType('txt')}
                  className="accent-[#ff79c6] w-4 h-4"
                />
                TXT File
              </label>
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input 
                  type="radio" 
                  name="fileType" 
                  value="pdf" 
                  checked={createFileType === 'pdf'} 
                  onChange={() => setCreateFileType('pdf')}
                  className="accent-[#ff79c6] w-4 h-4"
                />
                PDF Document
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#a0a0b0] mb-1">Filename</label>
              <input
                type="text"
                value={createFileName}
                onChange={(e) => setCreateFileName(e.target.value)}
                placeholder={`e.g. meeting-notes.${createFileType}`}
                className="w-full bg-[#12121a] border border-[#2a2a3e] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff79c6]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#a0a0b0] mb-1">Content</label>
              <textarea
                value={createFileContent}
                onChange={(e) => setCreateFileContent(e.target.value)}
                placeholder="Type or paste document content here..."
                rows={10}
                className="w-full bg-[#12121a] border border-[#2a2a3e] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff79c6] resize-none"
              />
            </div>
            <div className="flex gap-3 pt-4 border-t border-[#2a2a3e]">
              <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)} className="flex-1">Cancel</Button>
              <Button variant="primary" onClick={handleCreateFile} disabled={!createFileName.trim() || !createFileContent.trim() || uploading} className="flex-1">
                {uploading ? 'Saving...' : 'Save & Upload'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
    </ClientOnly>
  );
}
