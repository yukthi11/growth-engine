import React, { useState, useEffect, useRef } from 'react';
import { getCompanies, getLeads, getCampaigns, runDiscovery, runDiscoveryBatch, cancelDiscovery, syncCampaignToSheets, syncWorkspaceToSheets, deleteCampaign, getReplies, getSequenceSteps, deleteLead, getCompanyStats, getPendingReplies, sendCampaignOutreach } from '../api/client';
import CompanySelector from '../components/CompanySelector';
import CampaignSelector from '../components/CampaignSelector';
import LeadTable from '../components/LeadTable';
import AddLeadModal from '../components/AddLeadModal';
import CreateCampaignModal from '../components/CreateCampaignModal';
import SequenceVisualizer from '../components/SequenceVisualizer';
import StatsOverview from '../components/StatsOverview';
import MapCommandCenter from '../components/CommandCenter/MapCommandCenter';
import InboxPage from './InboxPage';
import ProposalWriter from './ProposalWriter';
import { io } from 'socket.io-client';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import SideNav from '../components/SideNav';
import EditLeadModal from '../components/EditLeadModal';
import ManageCompanyModal from '../components/ManageCompanyModal';
import DraftTemplateModal from '../components/DraftTemplateModal';
import SendOutreachModal from '../components/SendOutreachModal';
import OutreachStatusModal from '../components/OutreachStatusModal';

// Custom SVG Icons for the Main UI
const Icons = {
    Scan: () => <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    Globe: () => <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>
};

const Dashboard = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [activeTab, setActiveTab] = useState('automation');
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [campaigns, setCampaigns] = useState([]);
    const campaignsRef = useRef([]);          // always holds latest campaigns for socket closures
    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [leads, setLeads] = useState([]);
    const [pendingRepliesCount, setPendingRepliesCount] = useState(0);

    // Feature States
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [syncStatus, setSyncStatus] = useState(null); // { type: 'success' | 'error' | 'loading', message: string, url?: string }
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedLeadForEdit, setSelectedLeadForEdit] = useState(null);
    const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
    const [isDeletingCampaign, setIsDeletingCampaign] = useState(false);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [isDeepScan, setIsDeepScan] = useState(false);
    const [isAutoEnrich, setIsAutoEnrich] = useState(true);
    const [isAutoOutreach, setIsAutoOutreach] = useState(true);
    const [discoveryQuery, setDiscoveryQuery] = useState('');
    const [discoverySource, setDiscoverySource] = useState('auto');
    const [discoveryResult, setDiscoveryResult] = useState(null);
    const [selectedInboxLead, setSelectedInboxLead] = useState(null);
    const [proposalLeadId, setProposalLeadId] = useState(null);
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [isAddingCompany, setIsAddingCompany] = useState(false);
    const [page, setPage] = useState(1);
    const [paginationData, setPaginationData] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchData, setBatchData] = useState({ queryCount: 0, leadsFound: 0 });
    const [isPipelineActive, setIsPipelineActive] = useState(false);
    const [pendingJobsCount, setPendingJobsCount] = useState(0);
    const [stats, setStats] = useState({ totalLeads: 0, activeSequences: 0, interestedReplies: 0, successRate: 0 });
    const [replies, setReplies] = useState([]);
    const [sequenceSteps, setSequenceSteps] = useState([]);
    const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
    const [isSendingOutreach, setIsSendingOutreach] = useState(false);
    const [isSendOutreachModalOpen, setIsSendOutreachModalOpen] = useState(false);
    const [outreachCampaignId, setOutreachCampaignId] = useState(null);
    const [isOutreachStatusModalOpen, setIsOutreachStatusModalOpen] = useState(false);
    const [selectedOutreachStatusLead, setSelectedOutreachStatusLead] = useState(null);

    const [socket, setSocket] = useState(null);
    // Holds the AbortController for the current single-query discovery fetch
    const discoveryAbortRef = useRef(null);

    useEffect(() => {
        if (selectedCompanyId) {
            checkPendingNotifications();
            checkActivePipeline();
        }
        const interval = setInterval(() => {
            if (selectedCompanyId) checkActivePipeline();
        }, 15000);
        return () => clearInterval(interval);
    }, [selectedCompanyId, isPipelineActive]);

    const handleCancelDiscovery = async () => {
        // 1. Abort any in-flight single-query HTTP request
        if (discoveryAbortRef.current) {
            discoveryAbortRef.current.abort();
            discoveryAbortRef.current = null;
        }
        // 2. Mark any pending queued batch jobs as cancelled in DB
        try {
            if (selectedCompanyId) await cancelDiscovery(selectedCompanyId);
        } catch (err) { console.error('Failed to cancel queued jobs:', err); }

        setIsDiscovering(false);
        setIsPipelineActive(false);
        setPendingJobsCount(0);
        setDiscoveryResult(null);
    };

    const checkActivePipeline = async () => {
        if (!selectedCompanyId) return;
        try {
            const res = await fetch(`http://127.0.0.1:5000/discovery/queue/${selectedCompanyId}`);
            const queue = await res.json();
            const active = queue.filter(q => q.status === 'pending' || q.status === 'processing');

            if (active.length > 0) {
                setPendingJobsCount(active.length);
                setIsPipelineActive(true);
            } else if (!isDiscovering) {
                setPendingJobsCount(0);
                setIsPipelineActive(false);
            }
        } catch (err) { console.error('Pipeline check failed:', err); }
    };

    const checkPendingNotifications = async () => {
        try {
            const res = await fetch(`http://127.0.0.1:5000/discovery/pending-notifications/${selectedCompanyId}`);
            const notifications = await res.json();
            if (notifications.length > 0) {
                const totalFound = notifications.reduce((sum, n) => sum + (n.leads_found || 0), 0);

                setBatchData({ queryCount: notifications.length, leadsFound: totalFound });
                setShowBatchModal(true);

                for (const n of notifications) {
                    await fetch(`http://127.0.0.1:5000/discovery/acknowledge/${n.id}`, { method: 'POST' });
                }

                fetchLeads(1);
                fetchDashboardHub();
            }
        } catch (err) { console.error('Notifications check failed:', err); }
    };

    const [isCampaignCompleteOpen, setIsCampaignCompleteOpen] = useState(false);
    const [completedCampaignName, setCompletedCampaignName] = useState('');

    useEffect(() => {
        const s = io('http://127.0.0.1:5000');
        setSocket(s);
        s.on('new_reply', () => setPendingRepliesCount(prev => prev + 1));
        s.on('campaign_complete', (data) => {
            // Use ref so we always have the latest campaigns list (avoids stale closure)
            const campaign = campaignsRef.current.find(c => c.id.toString() === data.campaignId.toString());
            setCompletedCampaignName(campaign?.name || 'Campaign');
            setIsCampaignCompleteOpen(true);
            fetchDashboardHub(); // Refresh stats
            fetchLeads(page); // Refresh status in table
        });
        s.on('discovery_batch_complete', async (data) => {
            setBatchData({ queryCount: 1, leadsFound: data.leadsFound });
            setShowBatchModal(true);
            if (data.id) await fetch(`http://127.0.0.1:5000/discovery/acknowledge/${data.id}`, { method: 'POST' });
            fetchLeads(1);
            fetchDashboardHub();
        });
        return () => s.disconnect();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, selectedCampaignId]);

    useEffect(() => { fetchCompanies(); }, []);

    useEffect(() => {
        if (selectedCompanyId) {
            // Keep current campaign selected unless it's a hard brand switch
            setSearchQuery('');
            setDebouncedSearch('');
            setPage(1);
            fetchCampaigns();
            fetchDashboardHub();

            const current = companies.find(c => c.id === parseInt(selectedCompanyId));
            if (current) {
                setIsAutoEnrich(current.auto_enrich ?? true);
                setIsAutoOutreach(current.auto_outreach ?? true);
            }
        }
    }, [selectedCompanyId]); // Remove 'companies' from dependencies to prevent jump on save

    useEffect(() => {
        if (selectedCompanyId) {
            fetchLeads(page);
            if (selectedCampaignId) {
                fetchSequenceSteps(selectedCampaignId);
            } else {
                setSequenceSteps([]);
            }
        }
    }, [selectedCompanyId, selectedCampaignId, debouncedSearch, page]);

    const fetchDashboardHub = async () => {
        if (!selectedCompanyId) return;
        try {
            const statsData = await getCompanyStats(selectedCompanyId);
            setStats({
                totalLeads: statsData.total_leads,
                activeSequences: statsData.active_sequences,
                interestedReplies: statsData.interested_replies,
                successRate: statsData.success_rate
            });
        } catch (err) { console.error('Stats fetch failed:', err); }

        try {
            const allReplies = await getReplies(selectedCompanyId);
            setReplies(allReplies);
            const pending = await getPendingReplies(selectedCompanyId);
            setPendingRepliesCount(pending.length);
        } catch (err) { console.error('Replies sync failed:', err); }
    };

    const fetchSequenceSteps = async (campaignId) => {
        try { const steps = await getSequenceSteps(campaignId); setSequenceSteps(steps); }
        catch (err) { console.error('Steps sync failed:', err); }
    };

    const fetchCompanies = async () => {
        try {
            const data = await getCompanies();
            setCompanies(data);
            if (data.length > 0 && !selectedCompanyId) setSelectedCompanyId(data[0].id.toString());
        } catch (err) { console.error('Fetch companies failed:', err); }
    };

    const fetchCampaigns = async () => {
        try {
            const data = await getCampaigns(selectedCompanyId);
            setCampaigns(data);
            campaignsRef.current = data;
        }
        catch (err) { console.error('Fetch campaigns failed:', err); }
    };

    const fetchLeads = async (pageNumber) => {
        if (!selectedCompanyId) return;
        setIsLoading(true);
        try {
            const data = await getLeads(selectedCompanyId, pageNumber, 20, selectedCampaignId || null, debouncedSearch);
            setLeads(data.data);
            setPaginationData(data.pagination);
        } catch (err) { console.error('Fetch leads failed:', err); }
        finally { setIsLoading(false); }
    };

    const handleSyncCampaign = async () => {
        if (!selectedCampaignId || !selectedCompanyId) return;
        setIsExporting(true);
        setSyncStatus({ type: 'loading', message: 'Syncing campaign leads to Sheets...' });
        try {
            const res = await syncCampaignToSheets(selectedCompanyId, selectedCampaignId);
            setSyncStatus({
                type: 'success',
                message: res.message,
                url: res.spreadsheetUrl
            });
        } catch (err) {
            setSyncStatus({
                type: 'error',
                message: err.response?.data?.error || 'Sync failed. Please check your credentials.'
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleSyncWorkspace = async () => {
        if (!selectedCompanyId) return;
        setIsExporting(true);
        setSyncStatus({ type: 'loading', message: 'Syncing entire workspace architecture...' });
        try {
            const res = await syncWorkspaceToSheets(selectedCompanyId);
            setSyncStatus({
                type: 'success',
                message: `Successfully synced ${res.details?.length || 0} campaigns to Sheets.`,
                url: res.spreadsheetUrl
            });
        } catch (err) {
            setSyncStatus({
                type: 'error',
                message: err.response?.data?.error || 'Workspace sync failed.'
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteLead = async (id) => {
        try {
            await deleteLead(id);
            fetchLeads(page);
            fetchDashboardHub();
        } catch (err) { console.error('Delete failed:', err); }
    };

    const openEditModal = (lead) => {
        setSelectedLeadForEdit(lead);
        setIsEditModalOpen(true);
    };

    const handleDeleteCampaign = async () => {
        if (!selectedCampaignId) return;
        if (!window.confirm('WARNING: Deleting this campaign will permanently delete ALL leads within it. This cannot be undone. Continue?')) return;

        setIsDeletingCampaign(true);
        try {
            await deleteCampaign(selectedCampaignId);
            setSelectedCampaignId('');
            fetchCampaigns();
            fetchLeads(1);
            fetchDashboardHub();
        } catch (err) {
            console.error('Delete campaign failed:', err);
            alert('Failed to delete campaign');
        } finally {
            setIsDeletingCampaign(false);
        }
    };

    // Update campaign name locally so the dropdown reflects the new name instantly
    const handleRenameCampaign = (id, newName) => {
        setCampaigns(prev => prev.map(c => String(c.id) === String(id) ? { ...c, name: newName } : c));
    };

    const handleToggleAutoEnrich = async () => {
        if (!selectedCompanyId) return;
        const newVal = !isAutoEnrich;
        setIsAutoEnrich(newVal);
        try {
            await fetch(`http://127.0.0.1:5000/companies/${selectedCompanyId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auto_enrich: newVal })
            });
            setCompanies(prev => prev.map(c =>
                c.id === parseInt(selectedCompanyId) ? { ...c, auto_enrich: newVal } : c
            ));
        } catch (err) {
            console.error('Failed to update auto-enrich:', err);
            setIsAutoEnrich(!newVal);
        }
    };

    const handleToggleAutoOutreach = async () => {
        if (!selectedCompanyId) return;
        const newVal = !isAutoOutreach;
        setIsAutoOutreach(newVal);
        try {
            await fetch(`http://127.0.0.1:5000/companies/${selectedCompanyId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auto_outreach: newVal })
            });
            setCompanies(prev => prev.map(c =>
                c.id === parseInt(selectedCompanyId) ? { ...c, auto_outreach: newVal } : c
            ));
        } catch (err) {
            console.error('Failed to update auto-outreach:', err);
            setIsAutoOutreach(!newVal);
        }
    };

    const handleDiscovery = async () => {
        if (!discoveryQuery.trim() || !selectedCompanyId) return;
        
        // Use semicolon (;) as the batch delimiter so commas can be used for explicit locations
        const queries = discoveryQuery.includes(';')
            ? discoveryQuery.split(';').map(q => q.trim()).filter(Boolean)
            : [discoveryQuery.trim()];

        setIsDiscovering(true);
        setDiscoveryResult(null);
        setIsPipelineActive(true);
        setPendingJobsCount(queries.length);
        const isSingleMode = queries.length === 1;

        try {
            if (queries.length > 1) {
                const payload = {
                    queries,
                    companyId: selectedCompanyId,
                    campaignId: selectedCampaignId || null
                };
                if (discoverySource !== 'auto') payload.source = discoverySource;
                
                const res = await runDiscoveryBatch(payload);
                alert(`🚀 ${res.message} The engine is now processing your batch in the background.`);
                setDiscoveryQuery('');
            } else {
                const payload = {
                    query: queries[0],
                    campaignId: selectedCampaignId || null,
                    companyId: selectedCompanyId,
                    deep: isDeepScan
                };
                if (discoverySource !== 'auto') payload.source = discoverySource;

                // Create a fresh AbortController for this request
                const controller = new AbortController();
                discoveryAbortRef.current = controller;

                const res = await runDiscovery(payload, controller.signal);
                discoveryAbortRef.current = null;
                setDiscoveryResult({
                    count: res.leadsFound,
                    query: queries[0],
                    campaignId: res.campaignId,
                    campaignName: campaigns.find(c => c.id.toString() === res.campaignId?.toString())?.name || 'Your Database'
                });
                fetchLeads(1);
                fetchDashboardHub();
            }
        } catch (err) {
            // DOMException name 'AbortError' means the user cancelled — silently ignore
            if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
                console.error('Discovery failed:', err);
            }
        } finally {
            setIsDiscovering(false);
            if (isSingleMode) {
                setIsPipelineActive(false);
                setPendingJobsCount(0);
            }
        }
    };

    const openSendOutreachModal = (campaignIdOverride = null) => {
        const campaignId = campaignIdOverride || selectedCampaignId;
        if (!campaignId) {
            alert('Select a campaign before launching outreach.');
            return;
        }
        if (!selectedCompanyId) {
            alert('Select a company before launching outreach.');
            return;
        }
        setOutreachCampaignId(campaignId);
        setIsSendOutreachModalOpen(true);
    };

    const triggerSendOutreach = async (channel) => {
        const campaignId = outreachCampaignId || selectedCampaignId;
        if (!campaignId || !selectedCompanyId) {
            alert('Select a campaign and company before launching outreach.');
            return;
        }

        setIsSendingOutreach(true);
        try {
            await sendCampaignOutreach(campaignId, channel, selectedCompanyId);
            
            fetchLeads(page);
            fetchDashboardHub();
        } catch (err) {
            console.error('Failed to send outreach:', err);
            alert(err?.response?.data?.error || 'Failed to start outreach.');
        } finally {
            setIsSendingOutreach(false);
            // We NO LONGER close the modal here! 
            // The modal will transition to the progress tracking view automatically.
        }
    };

    const openOutreachStatusModal = (lead) => {
        setSelectedOutreachStatusLead(lead);
        setIsOutreachStatusModalOpen(true);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'automation':
                return (
                    <div className="space-y-8 animate-in transition-all">
                        <StatsOverview stats={stats} />
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-8">
                                <h3 className="text-lg font-black text-white tracking-tight uppercase mb-4">Command Intelligence</h3>
                                <div className="p-10 rounded-[40px] bg-white/[0.02] border border-white/5 premium-shadow flex flex-col items-center justify-center text-center">
                                    <div className="text-4xl mb-4">💬</div>
                                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Chat Intelligence Active</p>
                                    <button
                                        onClick={() => setActiveTab('inbox')}
                                        className="mt-6 px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all"
                                    >
                                        Open Reply Inbox
                                    </button>
                                </div>
                            </div>
                            <div className="p-8 rounded-[40px] bg-white/[0.02] border border-white/5 premium-shadow">
                                <h3 className="text-lg font-black text-white tracking-tight uppercase mb-8">Outreach Journey</h3>
                                <SequenceVisualizer steps={sequenceSteps} />
                            </div>
                        </div>
                    </div>
                );
            case 'leads':
                return (
                    <div className="space-y-8 animate-in">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h2 className="text-3xl font-black text-white tracking-tight uppercase italic leading-none">Database Architecture</h2>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Registered Territories: {paginationData?.total || 0}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    placeholder="Filter registered leads..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-64 pl-4 pr-4 py-3 bg-white/5 border border-white/5 rounded-2xl text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/10 placeholder:text-slate-700 transition-all font-sans"
                                />
                                <button
                                    onClick={selectedCampaignId ? handleSyncCampaign : handleSyncWorkspace}
                                    disabled={isExporting || !selectedCompanyId}
                                    className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-2xl font-black uppercase text-[10px] hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-30"
                                >
                                    <svg className={`w-3 h-3 ${isExporting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    {selectedCampaignId ? 'Sync Campaign' : 'Sync Workspace'}
                                </button>
                                <button onClick={() => setIsLeadModalOpen(true)} className="px-6 py-3 bg-white text-midnight rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-white/5 transform hover:scale-95 transition-all">Add Lead</button>
                                <button
                                    onClick={() => openSendOutreachModal()}
                                    disabled={!selectedCampaignId || isSendingOutreach}
                                    className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-violet-600/20 transform hover:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    {isSendingOutreach ? 'Sending...' : 'Send Outreach'}
                                </button>
                            </div>
                        </div>
                        <div className="rounded-[40px] border border-white/5 bg-white/[0.02]">
                            <LeadTable
                                leads={leads}
                                onUpdate={() => fetchLeads(page)}
                                onViewMessages={(lead) => {
                                    setSelectedInboxLead(lead);
                                    setActiveTab('inbox');
                                }}
                                onEdit={openEditModal}
                                onDelete={handleDeleteLead}
                                onOpenOutreachStatus={openOutreachStatusModal}
                                onGenerateProposal={(lead) => {
                                    setProposalLeadId(lead.id);
                                    setActiveTab('proposals');
                                }}
                            />
                        </div>

                        {paginationData && paginationData.total > 0 && (
                            <div className="mt-8 flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-[32px] premium-shadow group">
                                <div className="flex items-center gap-4">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                                        Architectural View: <span className="text-violet-400">{(page - 1) * 20 + 1}-{Math.min(page * 20, paginationData.total)}</span> of {paginationData.total}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        className={`p-3 rounded-2xl border border-white/5 transition-all text-white flex items-center justify-center
                                            ${page === 1 ? 'opacity-20 cursor-not-allowed' : 'bg-white/5 hover:bg-violet-600/20 hover:border-violet-600/30 active:scale-90'}
                                        `}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>

                                    <div className="px-6 flex items-center gap-2">
                                        <span className="text-xs font-black text-white italic">Layer {page}</span>
                                        <div className="w-8 h-[2px] bg-white/5 overflow-hidden rounded-full">
                                            <div
                                                className="h-full bg-violet-600 transition-all duration-700 ease-out"
                                                style={{ width: `${(page / Math.ceil(paginationData.total / 20)) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{Math.ceil(paginationData.total / 20)}</span>
                                    </div>

                                    <button
                                        disabled={page >= Math.ceil(paginationData.total / 20)}
                                        onClick={() => setPage(p => p + 1)}
                                        className={`p-3 rounded-2xl border border-white/5 transition-all text-white flex items-center justify-center
                                            ${page >= Math.ceil(paginationData.total / 20) ? 'opacity-20 cursor-not-allowed' : 'bg-white/5 hover:bg-violet-600/20 hover:border-violet-600/30 active:scale-90'}
                                        `}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'discovery':
                return (
                    <div className="max-w-4xl mx-auto py-20 animate-in space-y-12">
                        <div className="text-center space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-600/10 border border-violet-600/20 rounded-full text-[10px] font-black uppercase tracking-widest text-violet-400">
                                <Icons.Globe /> Intelligence Layer V2
                            </div>
                            <h2 className="text-6xl font-black text-white tracking-tighter italic leading-none">Where next?</h2>
                            <p className="text-slate-500 font-medium max-w-lg mx-auto">AI-powered discovery identifies warm territories based on your niche and target geography.</p>
                        </div>
                        <div className="relative group space-y-6">
                            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-indigo-700 rounded-[32px] blur opacity-25 group-focus-within:opacity-50 transition duration-1000"></div>
                            <div className="relative bg-midnight-lighter border border-white/10 p-2 rounded-[28px] flex items-center shadow-2xl">
                                <div className="pl-6 text-slate-600 group-focus-within:text-violet-400 transition-colors">
                                    {isDiscovering ? (
                                        <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <Icons.Scan />
                                    )}
                                </div>
                                <input
                                    value={discoveryQuery}
                                    onChange={(e) => setDiscoveryQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleDiscovery()}
                                    placeholder="e.g. Wellness centers in Mumbai..."
                                    className="flex-1 bg-transparent px-6 py-4 text-2xl text-white font-medium focus:outline-none placeholder:text-slate-800"
                                    disabled={isDiscovering}
                                />
                                <button
                                    onClick={isDiscovering ? handleCancelDiscovery : handleDiscovery}
                                    disabled={!isDiscovering && !discoveryQuery.trim()}
                                    className={`px-12 py-5 rounded-2xl font-black text-white uppercase tracking-widest text-[10px] shadow-xl transition-all active:scale-95 group relative flex items-center justify-center gap-2
                                        ${isDiscovering ? 'bg-rose-600 hover:bg-rose-500' : 'bg-violet-600 hover:bg-violet-500'}
                                    `}
                                >
                                    {isDiscovering ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Cancel
                                        </>
                                    ) : (
                                        <>
                                            <span className="group-hover:translate-x-1 transition-transform">{isDeepScan ? 'Hyper-Local Discovery' : 'Discover'}</span>
                                            {isDeepScan && (
                                                <span className="absolute -top-3 -right-2 px-2 py-1 bg-amber-500 rounded-lg text-[8px] border border-midnight shadow-lg animate-bounce">
                                                    EST: ~8m
                                                </span>
                                            )}
                                        </>
                                    )}
                                </button>
                            </div>

                            {!isDiscovering && discoveryResult && (
                                <div className="mt-8 p-8 rounded-[32px] bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center animate-in duration-500">
                                    <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center text-xl mb-4">✨</div>
                                    <h4 className="text-xl font-black text-white uppercase tracking-tight italic">Mission Success</h4>
                                    <p className="text-sm font-bold text-slate-400 mt-2">
                                        Identified <span className="text-emerald-400">{discoveryResult.count}</span> high-intent territories for <span className="text-white italic">"{discoveryResult.query}"</span>
                                    </p>
                                    <div className="mt-6 flex items-center gap-4">
                                        <button
                                            onClick={() => { setActiveTab('leads'); setDiscoveryResult(null); }}
                                            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                                        >
                                            View Database
                                        </button>
                                        <button
                                            onClick={() => openSendOutreachModal(discoveryResult.campaignId)}
                                            disabled={!discoveryResult?.campaignId || isSendingOutreach}
                                            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {isSendingOutreach ? 'Sending...' : 'Send Outreach'}
                                        </button>
                                        <button
                                            onClick={() => setDiscoveryResult(null)}
                                            className="px-6 py-3 text-slate-500 hover:text-white font-black text-[10px] uppercase tracking-widest transition-all"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!isDiscovering && !discoveryResult && (
                                <div className="flex items-center justify-center gap-6 px-4">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input type="checkbox" className="sr-only" checked={isDeepScan} onChange={(e) => setIsDeepScan(e.target.checked)} />
                                            <div className={`block w-10 h-6 rounded-full transition-colors ${isDeepScan ? 'bg-violet-600' : 'bg-white/10'}`}></div>
                                            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isDeepScan ? 'translate-x-4' : ''}`}></div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Deep Discovery</span>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input type="checkbox" className="sr-only" checked={isAutoEnrich} onChange={handleToggleAutoEnrich} />
                                            <div className={`block w-10 h-6 rounded-full transition-colors ${isAutoEnrich ? 'bg-violet-600' : 'bg-white/10'}`}></div>
                                            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isAutoEnrich ? 'translate-x-4' : ''}`}></div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Auto-Enrich</span>
                                        </div>
                                    </label>
                                    <label className={`flex items-center gap-3 cursor-pointer group ${!isAutoEnrich ? 'opacity-30 pointer-events-none' : ''}`}>
                                        <div className="relative">
                                            <input type="checkbox" className="sr-only" checked={isAutoOutreach} onChange={handleToggleAutoOutreach} disabled={!isAutoEnrich} />
                                            <div className={`block w-10 h-6 rounded-full transition-colors ${isAutoOutreach && isAutoEnrich ? 'bg-amber-500' : 'bg-white/10'}`}></div>
                                            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isAutoOutreach && isAutoEnrich ? 'translate-x-4' : ''}`}></div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Auto-Outreach AI</span>
                                        </div>
                                    </label>

                                    <div className="flex items-center gap-3 ml-4 border-l border-white/5 pl-6">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Engine</span>
                                        <select 
                                            value={discoverySource}
                                            onChange={(e) => setDiscoverySource(e.target.value)}
                                            className="bg-[#0a0f1d] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                                        >
                                            <option value="auto">🤖 Auto (Maps + JustDial)</option>
                                            <option value="google_maps">🗺️ Google Maps Only</option>
                                            <option value="justdial">📱 JustDial Only</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'stats':
                return (
                    <div className="space-y-12 animate-in py-8">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">Performance Intelligence</h2>
                        </div>
                        <StatsOverview stats={stats} />
                        <MapCommandCenter companyId={selectedCompanyId} />
                    </div>
                );
            case 'inbox':
                return <InboxPage
                    companyId={selectedCompanyId}
                    socket={socket}
                    initialLead={selectedInboxLead}
                    onLeadChange={(lead) => setSelectedInboxLead(lead)}
                    onOpenDraftModal={() => setIsDraftModalOpen(true)}
                    campaignId={selectedCampaignId}
                    campaigns={campaigns}
                />;
            case 'proposals':
                return <ProposalWriter companyId={selectedCompanyId} initialLeadId={proposalLeadId} />;
            default: return null;
        }
    };

    return (
        <div className="min-h-screen bg-midnight selection:bg-violet-500/30 font-sans relative overflow-hidden">
            <div className="flex h-screen overflow-hidden">
                <SideNav
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    isOpen={isSidebarOpen}
                    setIsOpen={setIsSidebarOpen}
                    badgeCount={pendingRepliesCount}
                    onManageCompany={(isAdd) => {
                        setIsAddingCompany(isAdd);
                        setIsCompanyModalOpen(true);
                    }}
                />

                <div className={`flex-1 flex flex-col min-w-0 h-screen relative overflow-auto duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isSidebarOpen ? 'pl-72' : 'pl-0'}`}>
                    <header className="h-24 border-b border-white/5 flex items-center justify-between px-10 bg-midnight/50 backdrop-blur-xl sticky top-0 z-[50]">
                        <div className="flex items-center gap-8">
                            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 bg-white/5 hover:bg-violet-600/10 border border-white/10 rounded-2xl text-slate-500 hover:text-violet-400 transition-all group">
                                <svg className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7" /></svg>
                            </button>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black uppercase text-slate-700 tracking-widest">Workspace</span>
                                <CompanySelector companies={companies} selectedCompany={selectedCompanyId} onChange={setSelectedCompanyId} minimal={true} />
                                <button onClick={handleSyncWorkspace} disabled={isExporting || !selectedCompanyId} className="p-2 border border-white/10 rounded-xl bg-white/5 hover:bg-violet-600/10 text-slate-500 hover:text-violet-400 transition-all">
                                    <svg className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </button>
                            </div>
                            <div className="flex items-center gap-3 ml-4 border-l border-white/5 pl-8">
                                <span className="text-[10px] font-black uppercase text-slate-700 tracking-widest leading-none">Campaign</span>
                                <CampaignSelector campaigns={campaigns} selectedCampaign={selectedCampaignId} onChange={setSelectedCampaignId} onDelete={handleDeleteCampaign} onRenamed={handleRenameCampaign} isDeleting={isDeletingCampaign} minimal={true} />
                                <button onClick={() => setIsCampaignModalOpen(true)} title="Architect New Campaign" className="p-2 border border-white/10 rounded-xl bg-white/5 hover:bg-emerald-600/10 text-slate-500 hover:text-emerald-400 transition-all">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            {selectedCompanyId && (
                                <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/10 flex flex-col items-end">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 leading-none">Intelligence Credit</span>
                                    <span className="text-sm font-black text-violet-400 mt-1">Unlimited CRC</span>
                                </div>
                            )}
                        </div>
                    </header>
                    <main id="main-content" className={`${activeTab === 'inbox' ? 'w-full px-8 h-[calc(100vh-96px)] overflow-hidden py-2' : 'container mx-auto p-10 pb-40'}`}>
                        {renderContent()}
                    </main>
                </div>
            </div>

            <AddLeadModal companyId={selectedCompanyId} isOpen={isLeadModalOpen} campaigns={campaigns} defaultCampaignId={selectedCompanyId} onClose={() => setIsLeadModalOpen(false)} onSuccess={() => { fetchLeads(1); fetchDashboardHub(); }} />
            <CreateCampaignModal companyId={selectedCompanyId} isOpen={isCampaignModalOpen} onClose={() => setIsCampaignModalOpen(false)} onSuccess={() => { fetchCampaigns(); fetchDashboardHub(); }} />
            <EditLeadModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} lead={selectedLeadForEdit} campaigns={campaigns} onSuccess={() => { fetchLeads(page); fetchDashboardHub(); }} />
            <ManageCompanyModal isOpen={isCompanyModalOpen} onClose={() => { setIsCompanyModalOpen(false); setIsAddingCompany(false); }} company={isAddingCompany ? null : companies.find(c => c.id.toString() === selectedCompanyId)} onSuccess={fetchCompanies} />
            <DraftTemplateModal isOpen={isDraftModalOpen} onClose={() => setIsDraftModalOpen(false)} company={companies.find(c => c.id.toString() === selectedCompanyId)} campaignId={selectedCampaignId} onSuccess={fetchCompanies} />
            <SendOutreachModal isOpen={isSendOutreachModalOpen} onClose={() => setIsSendOutreachModalOpen(false)} onSubmit={triggerSendOutreach} campaignName={campaigns.find(c => c.id.toString() === (outreachCampaignId || selectedCampaignId)?.toString())?.name || 'Your Database'} campaignId={outreachCampaignId || selectedCampaignId} />
            <OutreachStatusModal isOpen={isOutreachStatusModalOpen} onClose={() => setIsOutreachStatusModalOpen(false)} lead={selectedOutreachStatusLead} />

            {syncStatus && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-midnight/80 backdrop-blur-xl animate-in duration-300">
                    <div className="w-full max-w-sm bg-midnight-lighter border border-white/10 rounded-[40px] p-10 premium-shadow">
                        <div className={`w-20 h-20 rounded-[28px] mx-auto mb-8 flex items-center justify-center text-3xl
                            ${syncStatus.type === 'loading' ? 'bg-violet-600/20 text-violet-400 animate-pulse' :
                                syncStatus.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                                    'bg-rose-500/20 text-rose-400'}
                        `}>
                            {syncStatus.type === 'loading' ? '⏳' :
                                syncStatus.type === 'success' ? '✅' : '❌'}
                        </div>
                        <h3 className="text-xl font-black text-white text-center mb-2 uppercase tracking-tight">
                            {syncStatus.type === 'loading' ? 'Syncing...' :
                                syncStatus.type === 'success' ? 'Success' : 'Failed'}
                        </h3>
                        <p className="text-sm font-bold text-slate-500 text-center mb-10 leading-relaxed px-4">{syncStatus.message}</p>
                        <div className="flex flex-col gap-3">
                            {syncStatus.url && (
                                <a href={syncStatus.url} target="_blank" rel="noopener noreferrer" className="w-full py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest text-center transition-all shadow-lg shadow-violet-600/20">Open Spreadsheet</a>
                            )}
                            <button onClick={() => setSyncStatus(null)} className="w-full py-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Close</button>
                        </div>
                    </div>
                </div>
            )}
            {isCampaignCompleteOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-midnight/80 backdrop-blur-xl animate-in duration-500">
                    <div className="w-full max-w-sm bg-midnight-lighter border border-white/10 rounded-[40px] p-10 premium-shadow text-center">
                        <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-[28px] mx-auto mb-8 flex items-center justify-center text-3xl animate-bounce">
                            🚀
                        </div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic mb-2">Campaign Delivered!</h2>
                        <p className="text-sm font-bold text-slate-500 mb-10 leading-relaxed">
                            Mission accomplished. All messages for <span className="text-white">"{completedCampaignName}"</span> have been successfully dispatched.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => { setIsCampaignCompleteOpen(false); setActiveTab('leads'); }}
                                className="w-full py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-violet-600/20"
                            >
                                Review Results
                            </button>
                            <button
                                onClick={() => setIsCampaignCompleteOpen(false)}
                                className="w-full py-4 bg-white/5 hover:bg-white/10 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
