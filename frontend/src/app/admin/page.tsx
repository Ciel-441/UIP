'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRoom } from '@/hooks/useRoom';
import { roomApi, dashboardApi, authApi } from '@/lib/api';
import { motion } from 'framer-motion';
import { Users, Shield, Copy, UserCheck, UserX, Loader2, Key, Check, ArrowLeft, Search, FileText, Database, Calendar, Clock, File, History, User, UserPlus, Award, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useRouter } from 'next/navigation';

export default function AdminPanelPage() {
  const { user } = useAuth();
  const { activeRoom, myRole } = useRoom();
  const router = useRouter();

  const [members, setMembers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);

  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('viewer');
  const [addingMember, setAddingMember] = useState(false);
  const [addError, setAddError] = useState('');

  // Audit Logs States
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedUserForLogs, setSelectedUserForLogs] = useState<any | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Contribution Stats States
  const [contributionData, setContributionData] = useState<any>(null);
  const [contribLoading, setContribLoading] = useState(false);
  const [expandedUserContrib, setExpandedUserContrib] = useState<number | null>(null);

  const fetchLogs = async () => {
    if (!activeRoom) return;
    try {
      setLogsLoading(true);
      const res = await dashboardApi.auditLogs({
        user_id: selectedUserForLogs?.user_id || undefined,
        limit: 100
      });
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeRoom, selectedUserForLogs]);

  useEffect(() => {
    if (myRole !== 'admin') {
      router.push('/dashboard');
      return;
    }
    fetchData();
    
    const handleJoinReq = () => {
      fetchData();
    };
    window.addEventListener('room_join_request', handleJoinReq);
    return () => window.removeEventListener('room_join_request', handleJoinReq);
  }, [activeRoom, myRole, router]);

  const fetchData = async () => {
    if (!activeRoom) return;
    try {
      setLoading(true);
      const [membersRes, requestsRes, infoRes, contribRes] = await Promise.all([
        roomApi.listMembers(),
        roomApi.listRequests(),
        roomApi.info(),
        dashboardApi.contributionStats().catch(err => {
          console.error("Failed to load contribution stats", err);
          return { data: { total_activities: 0, user_stats: [] } };
        })
      ]);
      setMembers(membersRes.data.members || []);
      setPendingRequests(requestsRes.data.requests || []);
      setStats(infoRes.data || null);
      setContributionData(contribRes.data || { total_activities: 0, user_stats: [] });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    try {
      setAddingMember(true);
      setAddError('');
      await roomApi.addMember({ user_id: parseInt(selectedUserId), role: selectedRole });
      setShowAddMember(false);
      setSelectedUserId('');
      setSelectedRole('viewer');
      fetchData();
    } catch (err: any) {
      setAddError(err.response?.data?.detail || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleApprove = async (membershipId: number) => {
    try {
      await roomApi.approveMember(membershipId);
      fetchData();
    } catch (err) {}
  };

  const handleReject = async (membershipId: number) => {
    try {
      await roomApi.rejectMember(membershipId);
      fetchData();
    } catch (err) {}
  };

  const handleRemove = async (membershipId: number) => {
    try {
      await roomApi.removeMember(membershipId);
      fetchData();
    } catch (err) {}
  };

  const handleRoleChange = async (membershipId: number, role: string) => {
    try {
      await roomApi.updateMemberRole(membershipId, { role });
      fetchData();
    } catch (err) {}
  };

  const handleGenerateInvite = async () => {
    try {
      const res = await roomApi.generateInvite({ expires_hours: 168, max_uses: 10 });
      setInviteCode(res.data.code);
    } catch (err) {}
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff79c6]" />
      </div>
    );
  }

  const filteredMembers = members.filter(member => 
    member.user_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    member.user_email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const formatAction = (action: string) => {
    switch (action.toLowerCase()) {
      case 'created':
        return { label: 'Created', color: 'bg-green-500/10 text-green-400 border-green-500/20' };
      case 'deleted':
        return { label: 'Deleted', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
      case 'updated':
      case 'edited':
        return { label: 'Updated', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' };
      case 'merged':
        return { label: 'Merged', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      case 'bulk_imported':
        return { label: 'Bulk Import', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      default:
        return { label: action, color: 'bg-[#2a2a3e] text-[#a0a0b0] border-[#3a3a5e]' };
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType?.toLowerCase()) {
      case 'document':
      case 'file':
        return <File className="w-4 h-4 text-[#ff92df]" />;
      case 'entity':
      case 'node':
        return <Database className="w-4 h-4 text-purple-400" />;
      case 'relationship':
      case 'link':
        return <Shield className="w-4 h-4 text-green-400" />;
      default:
        return <FileText className="w-4 h-4 text-[#a0a0b0]" />;
    }
  };

  const activeMembers = members;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.back()} 
          className="p-2 bg-[#2a2a3e]/50 hover:bg-[#2a2a3e] rounded-xl transition-colors text-[#a0a0b0] hover:text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Workspace Admin</h1>
          <p className="text-[#a0a0b0]">Manage members and security for {activeRoom?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="p-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-[#ff79c6]/10 rounded-lg"><Users className="text-[#ff79c6] w-6 h-6" /></div>
            <div>
              <p className="text-sm text-[#a0a0b0]">Total Members</p>
              <h3 className="text-2xl font-bold text-white">{stats?.member_count || 0}</h3>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-purple-500/10 rounded-lg"><Shield className="text-purple-500 w-6 h-6" /></div>
            <div>
              <p className="text-sm text-[#a0a0b0]">Entities Managed</p>
              <h3 className="text-2xl font-bold text-white">Isolated</h3>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-green-500/10 rounded-lg"><Key className="text-green-500 w-6 h-6" /></div>
            <div className="flex-1">
              <p className="text-sm text-[#a0a0b0]">Invite Code</p>
              {inviteCode ? (
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-[#12121a] px-2 py-1 rounded text-green-400 font-mono flex-1 text-center">{inviteCode}</code>
                  <button onClick={copyInvite} className="p-1.5 hover:bg-[#2a2a3e] rounded transition-colors">
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-[#a0a0b0]" />}
                  </button>
                </div>
              ) : (
                <Button size="sm" onClick={handleGenerateInvite} className="mt-1 w-full bg-[#12121a] border border-[#2a2a3e] hover:bg-[#1a1a2e]">Generate</Button>
              )}
            </div>
          </div>
        </GlassCard>
      </div>

      {pendingRequests.filter(req => req.status === 'pending').length > 0 && (
        <GlassCard className="p-0 overflow-hidden border-yellow-500/30 shadow-lg shadow-yellow-500/5">
          <div className="p-4 border-b border-[#2a2a3e] bg-yellow-500/5">
            <h3 className="text-lg font-semibold text-yellow-400 flex items-center gap-2">
              <UserCheck className="w-5 h-5" /> Pending Requests ({pendingRequests.filter(req => req.status === 'pending').length})
            </h3>
          </div>
          <div className="divide-y divide-[#2a2a3e]">
            {pendingRequests.filter(req => req.status === 'pending').map(req => (
              <div key={req.id} className="flex items-center justify-between p-4 hover:bg-[#12121a]/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2a2a3e] flex items-center justify-center font-bold text-white shrink-0">
                    {req.user_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-white">{req.user_name}</p>
                    <p className="text-sm text-[#a0a0b0]">{req.user_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleApprove(req.id)} className="bg-green-500 hover:bg-green-600 text-white border-0">Approve</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleReject(req.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">Reject</Button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[#2a2a3e] flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5" /> Active Members
          </h3>
          <Button 
            onClick={() => { setShowAddMember(!showAddMember); setAddError(''); }}
            size="sm"
            className="bg-accent hover:bg-accent-hover text-white flex items-center gap-1.5 border-0 shadow-md shadow-accent/10 cursor-pointer"
            icon={<UserPlus className="w-4 h-4" />}
          >
            Add Member
          </Button>
        </div>

        {showAddMember && (
          <div className="p-4 bg-[#12121a]/50 border-b border-[#2a2a3e] flex flex-col md:flex-row md:items-end gap-4 transition-all">
            <div className="flex-1">
              <label className="block text-[10px] text-[#6b6b7b] uppercase font-bold tracking-widest mb-1.5">Select User to Add</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full bg-[#0a0a0f] border border-[#2a2a3e] text-white text-xs rounded-xl p-2.5 outline-none focus:border-[#ff79c6] transition-colors"
              >
                <option value="">-- Choose a user who joined --</option>
                {pendingRequests
                  .map(req => (
                    <option key={req.user_id} value={req.user_id}>
                      {req.user_name} ({req.user_email}){req.status !== 'pending' ? ` (${req.status})` : ''}
                    </option>
                  ))
                }
              </select>
            </div>
            <div className="w-full md:w-[150px]">
              <label className="block text-[10px] text-[#6b6b7b] uppercase font-bold tracking-widest mb-1.5">Assign Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full bg-[#0a0a0f] border border-[#2a2a3e] text-white text-xs rounded-xl p-2.5 outline-none focus:border-[#ff79c6] transition-colors"
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="analyst">Analyst</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleAddMember}
                disabled={addingMember || !selectedUserId}
                size="sm"
                className="bg-[#ff79c6] hover:bg-[#ff92df] text-white shrink-0 border-0 h-[38px] px-4"
              >
                {addingMember ? 'Adding...' : 'Add'}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowAddMember(false); setAddError(''); }}
                size="sm"
                className="text-[#a0a0b0] border-[#2a2a3e] hover:bg-[#2a2a3e]/30 shrink-0 h-[38px] px-4"
              >
                Cancel
              </Button>
            </div>
            {addError && (
              <p className="text-xs text-red-400 mt-1 md:w-full md:mt-2">{addError}</p>
            )}
          </div>
        )}
        <div className="overflow-x-auto pb-2">
          <table className="w-full text-left text-sm min-w-[500px]">
            <thead className="bg-[#12121a] text-[#a0a0b0]">
              <tr>
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Joined</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2a3e]">
              {activeMembers.map(member => {
                const isSelf = member.user_id === user?.id;
                const isCreator = member.is_creator || member.user_id === stats?.created_by;
                const isTargetAdmin = member.role === 'admin';
                const loggedInIsCreator = stats?.created_by === user?.id;
                const disableRoleSelect = isCreator || (!loggedInIsCreator && isTargetAdmin && !isSelf);
                const showKickButton = !isCreator && (loggedInIsCreator || !isTargetAdmin || isSelf);

                return (
                  <tr key={member.id} className="hover:bg-[#12121a]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {member.pfp_url ? (
                          <img src={member.pfp_url} alt={member.user_name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#ff79c6]/20 text-[#ff92df] flex items-center justify-center font-bold text-xs shrink-0">
                            {member.user_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">{member.user_name}</p>
                            {isCreator && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-accent/20 text-accent border border-accent/30 rounded">
                                Creator
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#a0a0b0]">{member.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        disabled={disableRoleSelect}
                        className="bg-[#12121a] border border-[#2a2a3e] text-white text-xs rounded-lg focus:ring-1 focus:ring-[#ff79c6] p-1.5 outline-none disabled:opacity-50"
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="analyst">Analyst</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-[#a0a0b0]">
                      {new Date(member.joined_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {showKickButton && (
                        <button onClick={() => handleRemove(member.id)} className="text-[#6b6b7b] hover:text-red-400 transition-colors" title="Remove Member">
                          <UserX className="w-4 h-4 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Collaborator Contributions & Analytics Panel */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <Award className="w-5 h-5 text-[#ff92df]" /> Collaborator Contributions & Analytics
          </h2>
          <p className="text-[#a0a0b0] text-sm">Visual metrics of active contributions, progress levels, and files contributed by each person.</p>
        </div>

        {contribLoading ? (
          <GlassCard className="p-8 flex justify-center items-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#ff79c6]" />
          </GlassCard>
        ) : !contributionData || !contributionData.user_stats || contributionData.user_stats.length === 0 ? (
          <GlassCard className="p-8 text-center text-[#a0a0b0] text-sm italic">
            No contributions analytics data recorded yet.
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {contributionData.user_stats.map((stat: any) => {
              const u = stat.user;
              const isExpanded = expandedUserContrib === u.id;
              
              // Calculate relative contribution ratio based on score
              const totalScore = contributionData.total_score || 1;
              const ratio = Math.min(100, Math.round((stat.contribution_score / totalScore) * 1000) / 10);
              
              return (
                <motion.div
                  key={u.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <GlassCard className="p-5 h-full flex flex-col justify-between hover:border-[#ff79c6]/30 transition-all duration-300 border-[#2a2a3e] relative overflow-hidden group">
                    <div className="space-y-4">
                      {/* User Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {u.pfp_url ? (
                            <img src={u.pfp_url} alt={u.name} className="w-10 h-10 rounded-full object-cover border border-[#ff79c6]/30 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#ff79c6]/20 text-[#ff92df] border border-[#ff79c6]/30 flex items-center justify-center font-bold text-sm shrink-0">
                              {u.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-white group-hover:text-[#ff92df] transition-colors truncate">{u.name}</h4>
                              <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-[#2a2a3e] text-[#a0a0b0] border border-[#3a3a5e] rounded capitalize shrink-0">
                                {u.role}
                              </span>
                            </div>
                            <p className="text-xs text-[#a0a0b0] truncate">{u.email}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-[#6b6b7b] uppercase tracking-wider whitespace-nowrap">Score</span>
                          <p className="text-xl font-extrabold text-[#ff92df]">{stat.contribution_score}</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-[#a0a0b0]">Workspace Share</span>
                          <span className="text-white">{ratio}%</span>
                        </div>
                        <div className="w-full bg-[#0a0a0f] rounded-full h-2 overflow-hidden border border-[#2a2a3e]">
                          <div 
                            className="bg-gradient-to-r from-accent-secondary to-accent h-full rounded-full transition-all duration-500" 
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                      </div>

                      {/* Mini Metrics Grid */}
                      <div className="grid grid-cols-3 gap-2 bg-[#0c0c14]/40 p-2.5 rounded-xl border border-[#2a2a3e]/50">
                        <div className="text-center p-1.5">
                          <div className="flex justify-center mb-1"><Database className="w-4 h-4 text-purple-400" /></div>
                          <span className="text-[10px] text-[#6b6b7b] uppercase tracking-wider block">Entities</span>
                          <span className="text-sm font-bold text-white mt-0.5 block">{stat.entities_created}</span>
                        </div>
                        <div className="text-center p-1.5">
                          <div className="flex justify-center mb-1"><Shield className="w-4 h-4 text-green-400" /></div>
                          <span className="text-[10px] text-[#6b6b7b] uppercase tracking-wider block">Links</span>
                          <span className="text-sm font-bold text-white mt-0.5 block">{stat.relationships_created}</span>
                        </div>
                        <div className="text-center p-1.5">
                          <div className="flex justify-center mb-1"><FileText className="w-4 h-4 text-[#ff92df]" /></div>
                          <span className="text-[10px] text-[#6b6b7b] uppercase tracking-wider block">Docs</span>
                          <span className="text-sm font-bold text-white mt-0.5 block">{stat.documents_uploaded}</span>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Contributed Artifacts */}
                    <div className="mt-4 pt-3 border-t border-[#2a2a3e]/70">
                      <button
                        onClick={() => setExpandedUserContrib(isExpanded ? null : u.id)}
                        className="w-full flex items-center justify-between text-xs text-[#a0a0b0] hover:text-white transition-colors cursor-pointer py-1"
                      >
                        <span className="flex items-center gap-1.5 font-medium">
                          <TrendingUp className="w-3.5 h-3.5 text-[#ff92df]" /> 
                          Contributed Artifacts ({stat.contributed_documents.length} docs)
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {isExpanded && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-3 space-y-2 max-h-[160px] overflow-y-auto pr-1"
                        >
                          {stat.contributed_documents.length === 0 ? (
                            <p className="text-[11px] text-[#6b6b7b] italic py-2 pl-2">No documents uploaded by this user yet.</p>
                          ) : (
                            stat.contributed_documents.map((doc: any) => (
                              <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-[#0a0a0f] border border-[#2a2a3e]/50 hover:border-[#ff79c6]/20 transition-all">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-3.5 h-3.5 text-[#ff92df] shrink-0" />
                                  <span className="text-xs text-white truncate font-medium">{doc.name}</span>
                                </div>
                                <span className="text-[9px] text-[#6b6b7b] shrink-0 font-mono">
                                  {new Date(doc.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            ))
                          )}
                        </motion.div>
                      )}
                    </div>
                    
                    {stat.last_active && (
                      <div className="mt-3 pt-3 border-t border-[#2a2a3e]/50 flex items-center gap-1.5 text-[10px] text-[#6b6b7b]">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                        <span>Last active: {new Date(stat.last_active).toLocaleDateString()}</span>
                      </div>
                    )}
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Audit Log Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <History className="w-5 h-5 text-[#ff92df]" /> Detailed Audit Log & User Tracking
          </h2>
          <p className="text-[#a0a0b0] text-sm">Track real-time actions, uploads, and edits made by each collaborator.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* User Search & Selection Sidebar */}
          <GlassCard className="p-4 lg:col-span-1 flex flex-col h-[600px] border-[#2a2a3e]">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#6b6b7b]" />
              <input
                type="text"
                placeholder="Search user..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full bg-[#12121a] border border-[#2a2a3e] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-[#6b6b7b] focus:outline-none focus:border-[#ff79c6] transition-colors"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              <button
                onClick={() => setSelectedUserForLogs(null)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 ${
                  !selectedUserForLogs
                    ? 'bg-[#ff79c6]/10 text-white border border-[#ff79c6]/20'
                    : 'text-[#a0a0b0] hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-[#2a2a3e] flex items-center justify-center font-bold text-xs">
                  All
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">All Collaborators</p>
                  <p className="text-[10px] text-[#6b6b7b] truncate">Show all activities</p>
                </div>
              </button>

              {filteredMembers.map((member) => {
                const isSelected = selectedUserForLogs?.user_id === member.user_id;
                return (
                  <button
                    key={member.id}
                    onClick={() => setSelectedUserForLogs(member)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 ${
                      isSelected
                        ? 'bg-[#ff79c6]/10 text-white border border-[#ff79c6]/20'
                        : 'text-[#a0a0b0] hover:text-white hover:bg-white/[0.02] border border-transparent'
                    }`}
                  >
                    {member.pfp_url ? (
                      <img src={member.pfp_url} alt={member.user_name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#ff79c6]/10 text-[#ff92df] flex items-center justify-center font-bold text-xs shrink-0">
                        {member.user_name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{member.user_name}</p>
                      <p className="text-[10px] text-[#6b6b7b] truncate">{member.user_email}</p>
                    </div>
                  </button>
                );
              })}

              {filteredMembers.length === 0 && (
                <div className="text-center py-8 text-xs text-[#6b6b7b] italic">
                  No members found
                </div>
              )}
            </div>
          </GlassCard>

          {/* Audit Logs Stream */}
          <GlassCard className="p-0 lg:col-span-3 flex flex-col h-[600px] overflow-hidden border-[#2a2a3e]">
            <div className="p-4 border-b border-[#2a2a3e] flex items-center justify-between bg-[#12121a]/20">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {selectedUserForLogs ? `Activity History: ${selectedUserForLogs.user_name}` : 'All Workspace Activities'}
                </h3>
                <p className="text-[11px] text-[#6b6b7b]">
                  {selectedUserForLogs ? `Showing historical logs filtered by ${selectedUserForLogs.user_email}` : 'Recent audit logs for this room'}
                </p>
              </div>
              {selectedUserForLogs && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedUserForLogs(null)}
                  className="text-xs text-[#ff92df] hover:text-white"
                >
                  Clear Filter
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#2a2a3e] p-2 space-y-1">
              {logsLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-[#a0a0b0]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#ff79c6]" />
                  Loading logs...
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-xs text-[#6b6b7b] italic py-20">
                  No activities logged yet
                </div>
              ) : (
                logs.map((log) => {
                  const actStyle = formatAction(log.action);
                  return (
                    <div key={log.id} className="p-3 hover:bg-white/[0.01] transition-colors rounded-lg flex gap-3 items-start border-0">
                      {log.user_pfp_url ? (
                        <img src={log.user_pfp_url} alt={log.user_name} className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#2a2a3e]/50 text-[#a0a0b0] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                          {log.user_name.charAt(0)}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-white">{log.user_name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${actStyle.color}`}>
                            {actStyle.label}
                          </span>
                          <span className="text-[10px] text-[#6b6b7b] font-mono bg-[#12121a] px-1.5 py-0.5 rounded border border-[#2a2a3e]/50 flex items-center gap-1">
                            {getEntityIcon(log.entity_type)}
                            {log.entity_type}
                          </span>
                        </div>
                        
                        <p className="text-xs text-[#a0a0b0] break-words leading-relaxed font-normal">
                          {log.details || `Touched ${log.entity_type} (ID: ${log.entity_id})`}
                        </p>

                        <div className="flex items-center gap-3 text-[10px] text-[#6b6b7b]">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
