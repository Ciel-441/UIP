'use client';

import ClientOnly from '@/components/ClientOnly';

import React, { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { useRoom } from '@/hooks/useRoom';
import { settingsApi, aiApi, profileApi } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import {
  Server,
  Database,
  Palette,
  User,
  CheckCircle2,
  XCircle,
  Save,
  RefreshCw,
  Globe,
  Cpu,
  Sun,
  Moon,
  AlertOctagon,
  Trash2,
  Undo2,
  Clock,
  Eye,
  CheckCheck,
  Scale,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useDialog } from '@/context/DialogContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const { myRole } = useRoom();
  const { confirm, showToast } = useDialog();

  // Ollama settings
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [aiStatus, setAiStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [savingOllama, setSavingOllama] = useState(false);

  // Database status
  const [dbStatus, setDbStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Privacy
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(true);

  // Danger Zone
  const [clearingGraph, setClearingGraph] = useState(false);
  const [undoingGraph, setUndoingGraph] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ has_backup: boolean; expires_in_minutes: number }>({ has_backup: false, expires_in_minutes: 0 });

  // Load settings
  useEffect(() => {
    loadSettings();
    checkAiStatus();
    checkDbStatus();
    checkBackupStatus();
  }, []);

  const checkBackupStatus = async () => {
    try {
      const res = await settingsApi.getBackupStatus();
      setBackupStatus(res.data);
    } catch (err) {
      // Ignored
    }
  };

  const loadSettings = async () => {
    try {
      const res = await settingsApi.get();
      const settings = res.data;
      if (settings) {
        if (settings.ollama_endpoint) setOllamaEndpoint(settings.ollama_endpoint);
        if (settings.ollama_model) setOllamaModel(settings.ollama_model);
        if (settings.theme) {
          setTheme(settings.theme as 'dark' | 'light');
          if (settings.theme === 'light') {
            document.body.classList.add('light-mode');
          } else {
            document.body.classList.remove('light-mode');
          }
        }
      }
      
      const profRes = await profileApi.get();
      if (profRes.data && typeof profRes.data.read_receipts_enabled === 'boolean') {
        setReadReceiptsEnabled(profRes.data.read_receipts_enabled);
      }
    } catch (err) {
      // Settings may not exist yet
    }
  };

  const checkAiStatus = async () => {
    setAiStatus('checking');
    try {
      const res = await aiApi.status();
      const isOnline = res.data?.status === 'online' || res.data?.ollama_available;
      setAiStatus(isOnline ? 'online' : 'offline');
      if (isOnline && res.data?.available_models) {
        setAvailableModels(res.data.available_models);
      } else {
        setAvailableModels([]);
      }
    } catch {
      setAiStatus('offline');
      setAvailableModels([]);
    }
  };

  const checkDbStatus = async () => {
    setDbStatus('checking');
    try {
      await api.get('/api/health');
      setDbStatus('online');
    } catch {
      setDbStatus('offline');
    }
  };

  const saveOllamaSettings = async () => {
    setSavingOllama(true);
    try {
      await settingsApi.update('ollama_endpoint', ollamaEndpoint);
      await settingsApi.update('ollama_model', ollamaModel);
      await checkAiStatus();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSavingOllama(false);
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    try {
      await settingsApi.update('theme', newTheme);
    } catch (err) {
      // Revert on error
      setTheme(theme);
      if (theme === 'light') {
        document.body.classList.add('light-mode');
      } else {
        document.body.classList.remove('light-mode');
      }
    }
  };

  const handleClearGraph = async () => {
    const confirmed = await confirm({
      title: "Clear Knowledge Graph",
      message: "Are you absolutely sure? This will delete ALL entities and relationships from the database. A temporary backup will be kept for 1 hour.",
      type: "destructive",
      confirmText: "Clear Graph",
      cancelText: "Keep Data"
    });
    if (!confirmed) {
      return;
    }
    setClearingGraph(true);
    try {
      await settingsApi.clearGraph();
      await checkBackupStatus();
      showToast('Knowledge graph cleared successfully. A temporary backup has been created.', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to clear graph', 'error');
    } finally {
      setClearingGraph(false);
    }
  };

  const handleUndoClearGraph = async () => {
    setUndoingGraph(true);
    try {
      await settingsApi.undoClearGraph();
      await checkBackupStatus();
      showToast('Knowledge graph restored successfully from backup!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to restore graph', 'error');
    } finally {
      setUndoingGraph(false);
    }
  };

  const StatusIndicator = ({ status }: { status: 'online' | 'offline' | 'checking' }) => {
    if (status === 'checking') {
      return <Spinner size="sm" />;
    }
    return (
      <div className="flex items-center gap-2">
        {status === 'online' ? (
          <>
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-[#10b981] animate-ping opacity-50" />
            </div>
            <span className="text-sm text-[#10b981] font-medium">Online</span>
          </>
        ) : (
          <>
            <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
            <span className="text-sm text-[#ef4444] font-medium">Offline</span>
          </>
        )}
      </div>
    );
  };

  return (
    <ClientOnly>
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-sm text-[#6b6b7b] mt-1">Configure your platform preferences</p>
        </div>

        {/* Ollama Configuration */}
        {myRole === 'admin' && (
          <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl p-6 hover-card-glowing animate-stagger-1">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#d68eff]/15 text-[#d68eff]">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Ollama Configuration</h3>
                  <p className="text-sm text-[#6b6b7b]">Configure your local LLM connection</p>
                </div>
              </div>
              <StatusIndicator status={aiStatus} />
            </div>

            <div className="space-y-5">
              <Input
                label="Endpoint URL"
                type="url"
                placeholder="http://localhost:11434"
                value={ollamaEndpoint}
                onChange={(e) => setOllamaEndpoint(e.target.value)}
                icon={<Globe className="w-4 h-4" />}
                id="settings-ollama-endpoint"
              />

              {availableModels.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <label htmlFor="settings-ollama-model-select" className="text-xs font-semibold text-[#8e8ea2] uppercase tracking-wider">
                    Model Name
                  </label>
                  <div className="relative">
                    <select
                      id="settings-ollama-model-select"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      className="w-full bg-[#161622] border border-[#2a2a3e] rounded-lg pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff79c6] focus:ring-1 focus:ring-[#ff79c6] appearance-none"
                    >
                      {ollamaModel && !availableModels.includes(ollamaModel) && (
                        <option value={ollamaModel}>{ollamaModel} (current)</option>
                      )}
                      {availableModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#6b6b7b]">
                      <Server className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ) : (
                <Input
                  label="Model Name"
                  type="text"
                  placeholder="llama3"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  icon={<Server className="w-4 h-4" />}
                  id="settings-ollama-model"
                />
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={saveOllamaSettings}
                  loading={savingOllama}
                  icon={<Save className="w-4 h-4" />}
                  size="sm"
                  id="settings-save-ollama"
                >
                  Save Configuration
                </Button>
                <Button
                  onClick={checkAiStatus}
                  variant="outline"
                  icon={<RefreshCw className="w-4 h-4" />}
                  size="sm"
                  id="settings-check-ai"
                >
                  Test Connection
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Database Status */}
        <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl p-6 hover-card-glowing animate-stagger-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#06b6d4]/15 text-[#06b6d4]">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Database Status</h3>
                <p className="text-sm text-[#6b6b7b]">PostgreSQL connection health</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusIndicator status={dbStatus} />
              <Button
                onClick={checkDbStatus}
                variant="ghost"
                size="sm"
                icon={<RefreshCw className="w-4 h-4" />}
                id="settings-check-db"
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Theme Toggle */}
        <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl p-6 hover-card-glowing animate-stagger-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#f59e0b]/15 text-[#f59e0b]">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Appearance</h3>
                <p className="text-sm text-[#6b6b7b]">Toggle between dark and light theme</p>
              </div>
            </div>

            <button
              onClick={toggleTheme}
              className={cn(
                'relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-[#ff79c6]/50',
                theme === 'dark' ? 'bg-[#ff79c6]' : 'bg-[#3a3a4e]'
              )}
              id="settings-theme-toggle"
            >
              <div
                className={cn(
                  'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center transition-transform duration-300',
                  theme === 'dark' ? 'left-0.5' : 'left-[30px]'
                )}
              >
                {theme === 'dark' ? (
                  <Moon className="w-3.5 h-3.5 text-[#ff79c6]" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-[#f59e0b]" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* User Profile */}
        <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl p-6 hover-card-glowing animate-stagger-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#10b981]/15 text-[#10b981]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">User Profile</h3>
              <p className="text-sm text-[#6b6b7b]">Your account information</p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff79c6] to-[#d68eff] flex items-center justify-center overflow-hidden shadow-lg shadow-[#ff79c6]/20 shrink-0">
              {user?.pfp_url ? (
                <img src={user.pfp_url} alt="User Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-white">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-lg font-semibold text-white">{user?.name || 'User'}</p>
              <p className="text-sm text-[#6b6b7b]">{user?.email || 'user@example.com'}</p>
              {user?.created_at && (
                <p className="text-xs text-[#6b6b7b]/60">
                  Member since {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Privacy */}
        <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl p-6 hover-card-glowing animate-stagger-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#3b82f6]/15 text-[#3b82f6]">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Privacy</h3>
                <p className="text-sm text-[#6b6b7b]">Manage your messaging privacy</p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCheck className="w-5 h-5 text-[#6b6b7b]" />
              <div>
                <p className="text-sm font-medium text-white">Read Receipts</p>
                <p className="text-xs text-[#6b6b7b]">Let others know when you've read their messages</p>
              </div>
            </div>
            <button
              onClick={async () => {
                const newVal = !readReceiptsEnabled;
                setReadReceiptsEnabled(newVal);
                try {
                  await profileApi.update({ read_receipts_enabled: newVal });
                } catch (e) {
                  setReadReceiptsEnabled(!newVal);
                }
              }}
              className={cn(
                'relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-[#ff79c6]/50',
                readReceiptsEnabled ? 'bg-[#10b981]' : 'bg-[#3a3a4e]'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300',
                  readReceiptsEnabled ? 'left-[30px]' : 'left-0.5'
                )}
              />
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-[#12121a] border border-[#ef4444]/30 rounded-xl p-6 relative overflow-hidden hover-card-glowing animate-stagger-6">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <AlertOctagon className="w-32 h-32 text-[#ef4444]" />
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#ef4444]/15 text-[#ef4444]">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#ef4444]">Danger Zone</h3>
              <p className="text-sm text-[#6b6b7b]">Destructive actions for your workspace</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div>
              <p className="text-sm font-medium text-white mb-1">Clear Knowledge Graph</p>
              <p className="text-xs text-[#6b6b7b] max-w-sm">
                Permanently delete all extracted entities and relationships. Your uploaded documents will remain, but their extraction statuses will be reset.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Button
                onClick={handleClearGraph}
                loading={clearingGraph}
                variant="outline"
                className="border-[#ef4444]/50 text-[#ef4444] hover:bg-[#ef4444]/10 w-full"
                icon={<Trash2 className="w-4 h-4" />}
              >
                Wipe Graph Data
              </Button>
              {backupStatus.has_backup && (
                <div className="flex flex-col items-end gap-1 mt-2">
                  <Button
                    onClick={handleUndoClearGraph}
                    loading={undoingGraph}
                    variant="secondary"
                    className="w-full bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20 border border-[#10b981]/30"
                    icon={<Undo2 className="w-4 h-4" />}
                  >
                    Undo Wipe
                  </Button>
                  <span className="text-[10px] text-[#6b6b7b] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Backup expires in {backupStatus.expires_in_minutes}m
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Legal Policies & Disclaimers */}
          <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-[#ff79c6]/10 text-[#ff79c6]">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-medium text-white">Legal, Disclaimers & Model Ethics</h3>
                <p className="text-xs text-[#6b6b7b]">Mandatory disclaimers regarding platform misuse and uncensored AI generation</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-[#a0a0b0] leading-relaxed">
                The Unified Intelligence Platform is open-source research software distributed "AS IS". The authors and maintainers assume zero liability for any misuse of this software or any statements, outputs, or hallucinations generated by connected uncensored AI models.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="/terms"
                  className="px-4 py-2 rounded-lg bg-[#160e1d] border border-[#241527] hover:border-[#ff79c6]/50 text-xs font-medium text-white transition-colors inline-flex items-center gap-2"
                >
                  <Scale className="w-3.5 h-3.5 text-[#ff79c6]" />
                  Terms & Conditions
                </a>
                <a
                  href="/privacy"
                  className="px-4 py-2 rounded-lg bg-[#160e1d] border border-[#241527] hover:border-[#ff79c6]/50 text-xs font-medium text-white transition-colors inline-flex items-center gap-2"
                >
                  <Shield className="w-3.5 h-3.5 text-[#ff79c6]" />
                  Privacy Policy
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
    </ClientOnly>
  );
}
