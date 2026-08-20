import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
    getLeads,
    getProposalAutofill,
    generateProposal,
    getServices,
    getProposalLogo,
    uploadProposalLogo,
    exportProposalPdf,
    API_BASE_URL,
} from '../api/client';

const DEFAULT_MILESTONE_SPLIT = [
    { label: 'Upfront', percentage: 50 },
    { label: 'On Completion', percentage: 50 },
];

const formatINR = (amount) => `â‚¹${Math.round(amount).toLocaleString('en-IN')}`;

const formatTotals = (oneTime, monthly) => {
    if (oneTime === 0 && monthly === 0) return 'TBD';
    const parts = [];
    if (oneTime > 0) parts.push(formatINR(oneTime));
    if (monthly > 0) parts.push(`${formatINR(monthly)}/month`);
    return parts.join(' + ');
};

const CustomIcons = {
    Document: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    Sparkles: () => <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
    Download: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    Clipboard: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>,
    Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>,
    User: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    ChevronRight: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>,
    Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Briefcase: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
};

const TIER_RANK = { hot: 0, warm: 1, cold: 2 };
const TIER_BADGE = {
    hot: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    warm: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

const ProposalWriter = ({ companyId, initialLeadId }) => {
    // Form Inputs
    const [selectedLeadId, setSelectedLeadId] = useState('');
    const [leadQuery, setLeadQuery] = useState('');
    const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState(false);
    const appliedInitialLeadRef = useRef(null);
    const [businessName, setBusinessName] = useState('');
    const [projectName, setProjectName] = useState('');
    const [industry, setIndustry] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [problem, setProblem] = useState('');
    const [currentProcess, setCurrentProcess] = useState('');
    const [desiredOutcome, setDesiredOutcome] = useState('');
    const [customNotes, setCustomNotes] = useState('');
    const [timeline, setTimeline] = useState('');
    // lineItems: { [serviceId]: { service, quantity, unit_price, monthly_price } }
    // unit_price/monthly_price default to the catalog's base price but are freely
    // editable per-proposal â€” the catalog price is only ever a starting point.
    const [lineItems, setLineItems] = useState({});
    const [milestoneSplit, setMilestoneSplit] = useState(DEFAULT_MILESTONE_SPLIT);

    // UI States
    const [leads, setLeads] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [isAutofilling, setIsAutofilling] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [proposal, setProposal] = useState(null);
    const [copied, setCopied] = useState(false);

    // Fixed-format vs freeform authoring mode â€” see mode toggle below.
    const [mode, setMode] = useState('fixed'); // 'fixed' | 'freeform'
    const [logoUrl, setLogoUrl] = useState(null);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [freeformHtml, setFreeformHtml] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    const catalogByCategory = useMemo(() => {
        return catalog.reduce((acc, service) => {
            acc[service.category] = acc[service.category] || [];
            acc[service.category].push(service);
            return acc;
        }, {});
    }, [catalog]);

    const { oneTimeTotal, monthlyTotal } = useMemo(() => {
        return Object.values(lineItems).reduce(
            (totals, item) => {
                totals.oneTimeTotal += Number(item.unit_price || 0) * Number(item.quantity || 1);
                totals.monthlyTotal += Number(item.monthly_price || 0) * Number(item.quantity || 1);
                return totals;
            },
            { oneTimeTotal: 0, monthlyTotal: 0 }
        );
    }, [lineItems]);

    const pricingSummary = formatTotals(oneTimeTotal, monthlyTotal);
    const milestonePercentTotal = milestoneSplit.reduce((sum, m) => sum + Number(m.percentage || 0), 0);

    // Load leads + service catalog for the active workspace company
    useEffect(() => {
        fetchCatalog();
        getProposalLogo().then((res) => setLogoUrl(res.url)).catch(() => {});
    }, []);

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingLogo(true);
        try {
            const res = await uploadProposalLogo(file);
            setLogoUrl(res.url);
        } catch (err) {
            console.error('Failed to upload logo:', err);
            alert('Failed to upload logo: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsUploadingLogo(false);
            e.target.value = '';
        }
    };

    // Deep-updates a field on the generated proposal by key path, e.g.
    // ['how_it_helps', 1, 'items', 0, 'benefit'] â€” lets the sandbox stay
    // fully editable after generation without re-calling the LLM.
    const updateProposalField = (path, value) => {
        setProposal((prev) => {
            if (!prev) return prev;
            const next = structuredClone(prev);
            let obj = next;
            for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
            obj[path[path.length - 1]] = value;
            return next;
        });
    };

    useEffect(() => {
        if (companyId) {
            fetchLeadsList();
            // Reset state
            setProposal(null);
            resetForm();
        }
    }, [companyId]);

    // Auto-select the lead handed off from the leads table's "Generate Proposal"
    // quick action, once â€” guarded by ref so it doesn't refire on every leads refresh.
    useEffect(() => {
        if (initialLeadId && leads.length > 0 && appliedInitialLeadRef.current !== initialLeadId) {
            appliedInitialLeadRef.current = initialLeadId;
            selectLead(initialLeadId);
        }
    }, [initialLeadId, leads]);

    const fetchLeadsList = async () => {
        try {
            const res = await getLeads(companyId, 1, 100); // Fetch first 100 leads
            setLeads(res.data || []);
        } catch (err) {
            console.error('Failed to fetch leads for proposal dropdown:', err);
        }
    };

    const fetchCatalog = async () => {
        try {
            const res = await getServices();
            setCatalog(res.services || []);
        } catch (err) {
            console.error('Failed to fetch service catalog:', err);
        }
    };

    const resetForm = () => {
        setSelectedLeadId('');
        setBusinessName('');
        setProjectName('');
        setIndustry('');
        setContactPerson('');
        setProblem('');
        setCurrentProcess('');
        setDesiredOutcome('');
        setCustomNotes('');
        setTimeline('');
        setLineItems({});
        setMilestoneSplit(DEFAULT_MILESTONE_SPLIT);
    };

    // Sorted (hot -> warm -> cold/new) + search-filtered lead list for the combobox
    const sortedLeads = useMemo(() => {
        return [...leads].sort((a, b) => {
            const rankDiff = (TIER_RANK[a.tier] ?? 3) - (TIER_RANK[b.tier] ?? 3);
            if (rankDiff !== 0) return rankDiff;
            return (a.business_name || '').localeCompare(b.business_name || '');
        });
    }, [leads]);

    const filteredLeads = useMemo(() => {
        const q = leadQuery.trim().toLowerCase();
        if (!q) return sortedLeads;
        return sortedLeads.filter((lead) =>
            lead.business_name?.toLowerCase().includes(q) ||
            lead.location_normalized?.toLowerCase().includes(q)
        );
    }, [sortedLeads, leadQuery]);

    const selectedLead = leads.find((lead) => String(lead.id) === String(selectedLeadId));

    // Triggers AI Autofill for a given lead â€” shared by the search dropdown and
    // the "Generate Proposal" quick-action from the leads table (initialLeadId).
    const selectLead = async (leadId) => {
        setSelectedLeadId(leadId);
        setIsLeadDropdownOpen(false);
        setLeadQuery('');
        if (!leadId) {
            resetForm();
            return;
        }

        setIsAutofilling(true);
        try {
            const autofill = await getProposalAutofill(leadId);
            setBusinessName(autofill.business_name || '');
            setProjectName(autofill.project_name || '');
            setIndustry(autofill.industry || '');
            setContactPerson(autofill.contact_person || 'Business Owner');
            setProblem(autofill.problem || '');
            setCurrentProcess(autofill.current_process || '');
            setDesiredOutcome(autofill.desired_outcome || '');
            setTimeline(autofill.timeline || '4 Weeks');

            // Pre-check the services matched deterministically from this lead's
            // detected gaps (see backend/src/utils/serviceMatcher.js), seeded with
            // catalog base prices â€” still fully editable below before generating.
            const seeded = {};
            (autofill.recommended_services || []).forEach((service) => {
                seeded[service.id] = {
                    service,
                    quantity: 1,
                    unit_price: Number(service.base_price || 0),
                    monthly_price: Number(service.monthly_price || 0),
                };
            });
            setLineItems(seeded);
        } catch (err) {
            console.error('Error autofilling lead proposal details:', err);
            alert('Failed to autofill details. Please enter manually.');
        } finally {
            setIsAutofilling(false);
        }
    };

    const handleServiceToggle = (service) => {
        setLineItems((prev) => {
            const next = { ...prev };
            if (next[service.id]) {
                delete next[service.id];
            } else {
                next[service.id] = {
                    service,
                    quantity: 1,
                    unit_price: Number(service.base_price || 0),
                    monthly_price: Number(service.monthly_price || 0),
                };
            }
            return next;
        });
    };

    const handleLineItemFieldChange = (serviceId, field, value) => {
        setLineItems((prev) => ({
            ...prev,
            [serviceId]: { ...prev[serviceId], [field]: value },
        }));
    };

    const handleMilestoneChange = (index, field, value) => {
        setMilestoneSplit((prev) =>
            prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
        );
    };

    const addMilestone = () => {
        setMilestoneSplit((prev) => [...prev, { label: 'New Milestone', percentage: 0 }]);
    };

    const removeMilestone = (index) => {
        setMilestoneSplit((prev) => prev.filter((_, i) => i !== index));
    };

    // Handle Proposal Generation
    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!businessName || !projectName) {
            alert('Business Name and Project Name are required.');
            return;
        }

        setIsGenerating(true);
        setProposal(null);
        try {
            const items = Object.values(lineItems);
            const data = {
                business_name: businessName,
                industry,
                contact_person: contactPerson,
                project_name: projectName,
                problem,
                current_process: currentProcess,
                desired_outcome: desiredOutcome,
                selected_services: items.map((item) => item.service.name),
                notes: customNotes,
                timeline,
                // Structured pricing â€” total and milestone amounts are computed
                // server-side from these, never invented by the LLM.
                line_items: items.map((item) => ({
                    name: item.service.name,
                    unit_price: Number(item.unit_price || 0),
                    monthly_price: Number(item.monthly_price || 0),
                    quantity: Number(item.quantity || 1),
                })),
                milestone_split: milestoneSplit.map((m) => ({ label: m.label, percentage: Number(m.percentage || 0) })),
            };
            const result = await generateProposal(data);
            setProposal(result);
        } catch (err) {
            console.error('Failed to generate proposal:', err);
            alert('Failed to generate proposal: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsGenerating(false);
        }
    };

    // Export the current (possibly edited) proposal as a real, premium PDF â€”
    // rendered server-side via Puppeteer so it's identical regardless of browser.
    const handleDownloadPdf = async () => {
        setIsDownloading(true);
        try {
            const payload = mode === 'freeform'
                ? { mode: 'freeform', freeform_html: freeformHtml, business_name: businessName, project_name: projectName, company_name: 'Revive Technology' }
                : { mode: 'fixed', proposal, business_name: businessName, project_name: projectName, company_name: 'Revive Technology' };
            const blob = await exportProposalPdf(payload);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(projectName || businessName || 'proposal').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to export PDF:', err);
            alert('Failed to export PDF: ' + (err.response?.data?.error || err.message));
        } finally {
            setIsDownloading(false);
        }
    };

    // Copy Proposal Markdown
    const handleCopyMarkdown = () => {
        if (!proposal) return;

        let markdown = `# ${proposal.cover_page?.project_name || 'Business Proposal'}\n`;
        markdown += `Presented to: ${businessName}\n`;
        markdown += `Prepared by: REVIVE TECHNOLOGY\n\n`;
        markdown += `## Category\n${proposal.cover_page?.category_name || ''}\n\n`;
        markdown += `## "${proposal.cover_page?.headline || ''}"\n\n`;
        markdown += `---\n\n`;
        markdown += `# Problem Overview\n${proposal.problem_overview?.description || ''}\n\n`;
        markdown += `## Key Metrics\n`;
        if (proposal.key_benefits) {
            proposal.key_benefits.forEach(metric => {
                markdown += `* **${metric.value}** - ${metric.label}\n`;
            });
        }
        markdown += `\n---\n\n`;
        markdown += `# Proposed Solution\n\n`;
        if (proposal.how_it_helps) {
            proposal.how_it_helps.forEach(section => {
                markdown += `### ${section.section_name}\n`;
                if (section.items) {
                    section.items.forEach(item => {
                        markdown += `* **${item.feature}**: ${item.benefit}\n`;
                    });
                }
                markdown += `\n`;
            });
        }
        markdown += `\n`;
        markdown += `## Project Deliverables\n`;
        if (proposal.deliverables) {
            proposal.deliverables.forEach(item => {
                markdown += `* ${item}\n`;
            });
        }
        markdown += `\n---\n\n`;
        markdown += `# Delivery Timeline\n`;
        if (proposal.timeline) {
            proposal.timeline.forEach(step => {
                markdown += `### ${step.phase}\n${step.description}\n\n`;
            });
        }
        markdown += `\n---\n\n`;
        markdown += `# Investment Summary\n\n`;
        if (proposal.investment) {
            proposal.investment.forEach(item => {
                markdown += `* **${item.milestone_name}**: ${item.project_scope} - *${item.amount}*\n`;
            });
        }
        markdown += `\n`;
        markdown += `* **Total Project Investment**: ${proposal.final_summary?.total_investment || pricingSummary}\n`;
        markdown += `* **Payment Structure**: ${proposal.final_summary?.payment_structure || milestoneSplit.map(m => `${m.percentage}% ${m.label}`).join(', ')}\n`;
        markdown += `* **Support Included**: ${proposal.final_summary?.support_included || '30 Days Post-Launch Optimization'}\n`;
        markdown += `* **Timeline**: ${proposal.final_summary?.expected_delivery || timeline}\n`;

        navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-8 relative">
            <div className="flex items-center justify-between no-print flex-wrap gap-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-white tracking-tight uppercase italic leading-none flex items-center gap-3">
                        <CustomIcons.Document /> Proposal Writer
                    </h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                        AI-Powered Custom Business Consultant Solutions
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Global logo used in every proposal PDF's header */}
                    <label className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border border-white/5 rounded-2xl cursor-pointer hover:border-violet-500/40 transition-all">
                        {logoUrl ? (
                            <img src={`${API_BASE_URL}${logoUrl}`} alt="Company logo" className="h-6 w-auto max-w-[80px] object-contain" />
                        ) : (
                            <span className="text-[9px] font-black uppercase text-slate-500">No Logo</span>
                        )}
                        <span className="text-[9px] font-black uppercase text-violet-400">
                            {isUploadingLogo ? 'Uploadingâ€¦' : (logoUrl ? 'Change' : 'Upload Logo')}
                        </span>
                        <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleLogoUpload} disabled={isUploadingLogo} />
                    </label>

                    {/* Mode toggle: fixed AI-structured format vs. freeform from-scratch canvas */}
                    <div className="flex items-center bg-white/[0.02] border border-white/5 rounded-2xl p-1">
                        <button
                            type="button"
                            onClick={() => setMode('fixed')}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'fixed' ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-white'}`}
                        >
                            Fixed Format
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('freeform')}
                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${mode === 'freeform' ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-white'}`}
                        >
                            Freeform
                        </button>
                    </div>
                </div>
            </div>

            {mode === 'fixed' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 no-print">
                {/* Left Form Panel */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 space-y-6 premium-shadow">
                    <h3 className="text-lg font-black text-white tracking-tight uppercase flex items-center gap-2">
                        ðŸ“‹ Define Proposal Scope
                    </h3>
                    
                    <div className="space-y-4">
                        {/* Lead Selector â€” searchable, sorted hot -> warm -> cold */}
                        <div className="flex flex-col gap-2 relative">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                Load from Database (Autofill)
                            </label>
                            <input
                                type="text"
                                value={isLeadDropdownOpen ? leadQuery : (selectedLead ? `ðŸ¢ ${selectedLead.business_name} (${selectedLead.location_normalized || 'No Location'})` : '')}
                                onChange={(e) => setLeadQuery(e.target.value)}
                                onFocus={() => { setIsLeadDropdownOpen(true); setLeadQuery(''); }}
                                onBlur={() => setTimeout(() => setIsLeadDropdownOpen(false), 150)}
                                placeholder="Type to search leads by name or location..."
                                className="bg-[#0a0f1d] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all"
                            />
                            {isLeadDropdownOpen && (
                                <div className="absolute z-20 top-full mt-1 w-full max-h-72 overflow-y-auto bg-[#0a0f1d] border border-white/10 rounded-2xl shadow-2xl">
                                    <div
                                        onMouseDown={() => selectLead('')}
                                        className="px-4 py-2.5 cursor-pointer text-xs font-bold text-slate-500 hover:bg-white/5 hover:text-white transition-colors"
                                    >
                                        -- Manual Entry --
                                    </div>
                                    {filteredLeads.length === 0 && (
                                        <div className="px-4 py-3 text-xs font-bold text-slate-600">No matching leads</div>
                                    )}
                                    {filteredLeads.map((lead) => (
                                        <div
                                            key={lead.id}
                                            onMouseDown={() => selectLead(lead.id)}
                                            className="px-4 py-2.5 cursor-pointer flex items-center justify-between gap-2 hover:bg-violet-600/10 transition-colors"
                                        >
                                            <span className="text-xs font-bold text-white truncate">ðŸ¢ {lead.business_name} <span className="text-slate-500">({lead.location_normalized || 'No Location'})</span></span>
                                            {TIER_BADGE[lead.tier] && (
                                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${TIER_BADGE[lead.tier]}`}>
                                                    {lead.tier}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {isAutofilling && (
                            <div className="flex items-center gap-3 p-4 bg-violet-600/10 border border-violet-600/20 rounded-2xl text-xs font-bold text-violet-300">
                                <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin"></div>
                                AI is analyzing lead gaps and pre-populating proposal parameters...
                            </div>
                        )}

                        <form onSubmit={handleGenerate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black uppercase text-slate-500">Business Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Manning Gym"
                                        value={businessName}
                                        onChange={(e) => setBusinessName(e.target.value)}
                                        className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all font-sans"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black uppercase text-slate-500">Project Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Manning Gym Booking Automation"
                                        value={projectName}
                                        onChange={(e) => setProjectName(e.target.value)}
                                        className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black uppercase text-slate-500">Industry</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Health & Fitness"
                                        value={industry}
                                        onChange={(e) => setIndustry(e.target.value)}
                                        className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all font-sans"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black uppercase text-slate-500">Contact Person</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Rahul Sharma"
                                        value={contactPerson}
                                        onChange={(e) => setContactPerson(e.target.value)}
                                        className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-500">Operational Problem</label>
                                <textarea
                                    rows="2"
                                    placeholder="What inefficiencies or risks are they facing?"
                                    value={problem}
                                    onChange={(e) => setProblem(e.target.value)}
                                    className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all font-sans resize-none"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-500">Current Process</label>
                                <textarea
                                    rows="2"
                                    placeholder="How are they currently handling this (pain points)?"
                                    value={currentProcess}
                                    onChange={(e) => setCurrentProcess(e.target.value)}
                                    className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all font-sans resize-none"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-500">Desired Outcome</label>
                                <textarea
                                    rows="2"
                                    placeholder="What does success look like (revenue, time saved)?"
                                    value={desiredOutcome}
                                    onChange={(e) => setDesiredOutcome(e.target.value)}
                                    className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all font-sans resize-none"
                                />
                            </div>

                            {/* Service Catalog Picker */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[9px] font-black uppercase text-slate-500">Include Systems & Services</label>
                                <div className="flex flex-col gap-4 bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                                    {Object.keys(catalogByCategory).length === 0 && (
                                        <p className="text-xs font-bold text-slate-600">Loading catalog...</p>
                                    )}
                                    {Object.entries(catalogByCategory).map(([category, services]) => (
                                        <div key={category} className="flex flex-col gap-2">
                                            <span className="text-[9px] font-black uppercase text-violet-400 tracking-widest">{category}</span>
                                            <div className="flex flex-col gap-2">
                                                {services.map(service => {
                                                    const item = lineItems[service.id];
                                                    const isSelected = !!item;
                                                    return (
                                                        <div key={service.id} className="flex flex-col gap-2 border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
                                                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-400 hover:text-white transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => handleServiceToggle(service)}
                                                                    className="rounded border-white/10 text-violet-600 focus:ring-violet-500"
                                                                />
                                                                {service.name}
                                                            </label>
                                                            {isSelected && (
                                                                <div className="flex items-center gap-2 pl-6">
                                                                    {service.price_type !== 'custom_quote' && (
                                                                        <>
                                                                            {service.price_type !== 'monthly' && (
                                                                                <input
                                                                                    type="number"
                                                                                    value={item.unit_price}
                                                                                    onChange={(e) => handleLineItemFieldChange(service.id, 'unit_price', e.target.value)}
                                                                                    className="w-28 bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-violet-500"
                                                                                    placeholder="One-time â‚¹"
                                                                                />
                                                                            )}
                                                                            {(service.price_type === 'monthly' || service.price_type === 'one_time_plus_monthly') && (
                                                                                <input
                                                                                    type="number"
                                                                                    value={item.monthly_price}
                                                                                    onChange={(e) => handleLineItemFieldChange(service.id, 'monthly_price', e.target.value)}
                                                                                    className="w-28 bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-violet-500"
                                                                                    placeholder="Monthly â‚¹"
                                                                                />
                                                                            )}
                                                                        </>
                                                                    )}
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={item.quantity}
                                                                        onChange={(e) => handleLineItemFieldChange(service.id, 'quantity', e.target.value)}
                                                                        className="w-16 bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-violet-500"
                                                                        title="Quantity"
                                                                    />
                                                                    {service.price_type === 'custom_quote' && (
                                                                        <span className="text-[10px] font-bold text-slate-600 uppercase">Custom quote â€” priced outside this proposal</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[9px] font-black uppercase text-slate-500">Live Total</span>
                                    <span className="text-sm font-black text-violet-400">{pricingSummary}</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-500">Delivery Timeline</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 3 Weeks"
                                    value={timeline}
                                    onChange={(e) => setTimeline(e.target.value)}
                                    className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all font-sans"
                                />
                            </div>

                            {/* Milestone Split Builder â€” percentages of the computed total above, not free text */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[9px] font-black uppercase text-slate-500">Payment Milestones</label>
                                    <span className={`text-[9px] font-black uppercase ${milestonePercentTotal === 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                        {milestonePercentTotal}% allocated
                                    </span>
                                </div>
                                <div className="flex flex-col gap-2 bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                                    {milestoneSplit.map((m, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={m.label}
                                                onChange={(e) => handleMilestoneChange(idx, 'label', e.target.value)}
                                                className="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-violet-500"
                                                placeholder="Milestone label"
                                            />
                                            <input
                                                type="number"
                                                value={m.percentage}
                                                onChange={(e) => handleMilestoneChange(idx, 'percentage', e.target.value)}
                                                className="w-20 bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-violet-500"
                                            />
                                            <span className="text-xs font-bold text-slate-500">%</span>
                                            {milestoneSplit.length > 1 && (
                                                <button type="button" onClick={() => removeMilestone(idx)} className="text-slate-600 hover:text-red-400 text-xs font-black px-1">âœ•</button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={addMilestone}
                                        className="text-[10px] font-black uppercase text-violet-400 hover:text-violet-300 self-start"
                                    >
                                        + Add Milestone
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-500">Custom Notes (Context / Constraints)</label>
                                <textarea
                                    rows="2"
                                    placeholder="Any custom constraints, support needs, or terms..."
                                    value={customNotes}
                                    onChange={(e) => setCustomNotes(e.target.value)}
                                    className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all font-sans resize-none"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isGenerating}
                                className="w-full py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-violet-600/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Generating Proposal...
                                    </>
                                ) : (
                                    <>
                                        <CustomIcons.Sparkles /> Generate Premium Proposal
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Interactive Preview Panel */}
                <div className="flex flex-col h-[calc(100vh-140px)] overflow-hidden">
                    {proposal ? (
                        <div className="flex-1 flex flex-col bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden premium-shadow">
                            {/* Actions Header */}
                            <div className="p-6 border-b border-white/5 bg-midnight-lighter flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    LIVE CONSULTANT PREVIEW
                                </span>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleCopyMarkdown}
                                        className="px-4 py-2 border border-white/10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                                    >
                                        {copied ? <CustomIcons.Check /> : <CustomIcons.Clipboard />}
                                        {copied ? 'Copied!' : 'Copy Markdown'}
                                    </button>
                                    <button
                                        onClick={handleDownloadPdf}
                                        disabled={isDownloading}
                                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-violet-600/15 disabled:opacity-50"
                                    >
                                        {isDownloading ? (
                                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <CustomIcons.Download />
                                        )}
                                        {isDownloading ? 'Rendering PDFâ€¦' : 'Download PDF'}
                                    </button>
                                </div>
                            </div>

                            {/* Document Render Panel */}
                            <div className="flex-1 overflow-y-auto p-10 bg-slate-950/40 space-y-12">
                                <div className="proposal-render-doc bg-[#0d0f17] border border-white/5 rounded-3xl p-10 max-w-2xl mx-auto space-y-12 shadow-2xl relative text-slate-300">
                                    {/* Cover Page Card */}
                                    <div className="p-10 rounded-2xl border border-violet-500/10 bg-gradient-to-br from-violet-950/20 via-indigo-950/20 to-midnight flex flex-col min-h-[400px] justify-between relative overflow-hidden">
                                        <div className="absolute inset-0 bg-violet-600/[0.02] radial-gradient"></div>
                                        <div className="z-10 flex items-center justify-between">
                                            <span className="text-xs font-black text-violet-400 tracking-[0.2em] uppercase">REVIVE TECHNOLOGY</span>
                                            <div className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center font-black text-sm text-white">R</div>
                                        </div>
                                        <div className="z-10 space-y-4 my-8">
                                            <input
                                                value={proposal.cover_page?.category_name || ''}
                                                onChange={(e) => updateProposalField(['cover_page', 'category_name'], e.target.value)}
                                                placeholder="Business Automation Systems"
                                                className="w-full bg-transparent text-[10px] font-black text-violet-300/60 uppercase tracking-widest focus:outline-none focus:text-violet-300 placeholder:text-violet-300/40"
                                            />
                                            <input
                                                value={proposal.cover_page?.project_name || projectName || ''}
                                                onChange={(e) => updateProposalField(['cover_page', 'project_name'], e.target.value)}
                                                className="w-full bg-transparent text-3xl font-black text-white italic tracking-tight uppercase leading-tight focus:outline-none"
                                            />
                                            <input
                                                value={proposal.cover_page?.headline || ''}
                                                onChange={(e) => updateProposalField(['cover_page', 'headline'], e.target.value)}
                                                className="w-full bg-transparent text-sm font-bold text-violet-300 italic focus:outline-none"
                                            />
                                        </div>
                                        <div className="z-10 border-t border-white/5 pt-4 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                            <span>Prepared For: {businessName}</span>
                                            <span>Date: {new Date().toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'})}</span>
                                        </div>
                                    </div>

                                    {/* Problem Overview & Metrics */}
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest uppercase">01 / Challenge</span>
                                            <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Problem Overview</h3>
                                        </div>
                                        <textarea
                                            value={proposal.problem_overview?.description || ''}
                                            onChange={(e) => updateProposalField(['problem_overview', 'description'], e.target.value)}
                                            rows={4}
                                            className="w-full bg-transparent text-sm font-medium leading-relaxed text-slate-400 focus:outline-none resize-none"
                                        />

                                        {/* Metric Cards */}
                                        <div className="grid grid-cols-3 gap-4 pt-4">
                                            {proposal.key_benefits?.map((metric, idx) => (
                                                <div key={idx} className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl text-center space-y-1">
                                                    <input
                                                        value={metric.value || ''}
                                                        onChange={(e) => updateProposalField(['key_benefits', idx, 'value'], e.target.value)}
                                                        className="w-full bg-transparent text-xl font-black text-violet-400 tracking-tight leading-none text-center focus:outline-none"
                                                    />
                                                    <input
                                                        value={metric.label || ''}
                                                        onChange={(e) => updateProposalField(['key_benefits', idx, 'label'], e.target.value)}
                                                        className="w-full bg-transparent text-[8px] font-black uppercase text-slate-500 tracking-wider text-center focus:outline-none"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Solution detail */}
                                    <div className="space-y-8">
                                        <div className="space-y-2">
                                            <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest">02 / Architecture</span>
                                            <h3 className="text-xl font-black text-white uppercase tracking-tight italic">How This Solution Helps</h3>
                                        </div>

                                        <div className="space-y-6">
                                            {proposal.how_it_helps?.map((section, idx) => (
                                                <div key={idx} className="bg-white/[0.01] border border-white/5 p-6 rounded-2xl space-y-4">
                                                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0"></span>
                                                        <input
                                                            value={section.section_name || ''}
                                                            onChange={(e) => updateProposalField(['how_it_helps', idx, 'section_name'], e.target.value)}
                                                            className="w-full bg-transparent focus:outline-none"
                                                        />
                                                    </h4>
                                                    <div className="space-y-3 pl-4 border-l border-white/5">
                                                        {section.items?.map((item, itemIdx) => (
                                                            <div key={itemIdx} className="space-y-1 text-xs">
                                                                <input
                                                                    value={item.feature || ''}
                                                                    onChange={(e) => updateProposalField(['how_it_helps', idx, 'items', itemIdx, 'feature'], e.target.value)}
                                                                    className="w-full bg-transparent font-black text-slate-300 focus:outline-none"
                                                                />
                                                                <textarea
                                                                    value={item.benefit || ''}
                                                                    onChange={(e) => updateProposalField(['how_it_helps', idx, 'items', itemIdx, 'benefit'], e.target.value)}
                                                                    rows={2}
                                                                    className="w-full bg-transparent font-medium text-slate-400 leading-relaxed resize-none focus:outline-none"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Scope & Deliverables */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                                <CustomIcons.Briefcase /> Deliverables
                                            </h4>
                                            <ul className="space-y-2 text-xs font-bold text-slate-400">
                                                {proposal.deliverables?.map((deliv, idx) => (
                                                    <li key={idx} className="flex items-start gap-2">
                                                        <span className="text-violet-400 mt-0.5">â€¢</span>
                                                        <input
                                                            value={deliv || ''}
                                                            onChange={(e) => updateProposalField(['deliverables', idx], e.target.value)}
                                                            className="w-full bg-transparent focus:outline-none"
                                                        />
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                                <CustomIcons.Clock /> Expected Timeline
                                            </h4>
                                            <div className="space-y-4 relative border-l border-white/5 pl-4">
                                                {proposal.timeline?.map((step, idx) => (
                                                    <div key={idx} className="space-y-1 relative text-xs">
                                                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border border-violet-500 bg-midnight"></div>
                                                        <input
                                                            value={step.phase || ''}
                                                            onChange={(e) => updateProposalField(['timeline', idx, 'phase'], e.target.value)}
                                                            className="w-full bg-transparent font-black text-white focus:outline-none"
                                                        />
                                                        <textarea
                                                            value={step.description || ''}
                                                            onChange={(e) => updateProposalField(['timeline', idx, 'description'], e.target.value)}
                                                            rows={2}
                                                            className="w-full bg-transparent font-medium text-slate-500 leading-normal resize-none focus:outline-none"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Final Investment Breakdown */}
                                    <div className="space-y-6 pt-4 border-t border-white/5">
                                        <h4 className="text-xs font-black text-white uppercase tracking-widest">
                                            03 / Financial Investment
                                        </h4>
                                        
                                        <div className="border border-white/5 rounded-2xl overflow-hidden text-xs">
                                            <table className="w-full text-left">
                                                <thead className="bg-white/5">
                                                    <tr>
                                                        <th className="p-4 font-black uppercase text-[10px] text-slate-400">Milestone</th>
                                                        <th className="p-4 font-black uppercase text-[10px] text-slate-400">Project Scope</th>
                                                        <th className="p-4 font-black uppercase text-[10px] text-slate-400 text-right">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {proposal.investment?.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-white/[0.01]">
                                                            <td className="p-4 font-black text-white">
                                                                <input
                                                                    value={item.milestone_name || ''}
                                                                    onChange={(e) => updateProposalField(['investment', idx, 'milestone_name'], e.target.value)}
                                                                    className="w-full bg-transparent font-black text-white focus:outline-none"
                                                                />
                                                            </td>
                                                            <td className="p-4 font-medium text-slate-400">
                                                                <input
                                                                    value={item.project_scope || ''}
                                                                    onChange={(e) => updateProposalField(['investment', idx, 'project_scope'], e.target.value)}
                                                                    className="w-full bg-transparent font-medium text-slate-400 focus:outline-none"
                                                                />
                                                            </td>
                                                            <td className="p-4 font-black text-violet-400 text-right">
                                                                <input
                                                                    value={item.amount || ''}
                                                                    onChange={(e) => updateProposalField(['investment', idx, 'amount'], e.target.value)}
                                                                    className="w-full bg-transparent font-black text-violet-400 text-right focus:outline-none"
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-6 space-y-3 text-xs font-bold text-slate-400">
                                            <div className="flex items-center justify-between text-white border-b border-white/5 pb-2">
                                                <span className="font-black uppercase tracking-wider shrink-0">Total Investment</span>
                                                <input
                                                    value={proposal.final_summary?.total_investment || ''}
                                                    onChange={(e) => updateProposalField(['final_summary', 'total_investment'], e.target.value)}
                                                    className="w-1/2 bg-transparent text-lg font-black text-violet-400 leading-none text-right focus:outline-none"
                                                />
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="shrink-0">Payment Structure</span>
                                                <input
                                                    value={proposal.final_summary?.payment_structure || ''}
                                                    onChange={(e) => updateProposalField(['final_summary', 'payment_structure'], e.target.value)}
                                                    className="w-1/2 bg-transparent text-slate-300 text-right font-black focus:outline-none"
                                                />
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="shrink-0">Support Included</span>
                                                <input
                                                    value={proposal.final_summary?.support_included || ''}
                                                    onChange={(e) => updateProposalField(['final_summary', 'support_included'], e.target.value)}
                                                    className="w-1/2 bg-transparent text-slate-300 text-right font-black focus:outline-none"
                                                />
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="shrink-0">Expected Delivery</span>
                                                <input
                                                    value={proposal.final_summary?.expected_delivery || ''}
                                                    onChange={(e) => updateProposalField(['final_summary', 'expected_delivery'], e.target.value)}
                                                    className="w-1/2 bg-transparent text-slate-300 text-right font-black focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-[40px] flex flex-col items-center justify-center p-10 text-center premium-shadow">
                            <div className="w-20 h-20 rounded-[28px] bg-white/5 flex items-center justify-center text-3xl mb-6 shadow-inner">
                                ðŸ“ƒ
                            </div>
                            <h4 className="text-lg font-black text-slate-300 uppercase tracking-tight italic">Live Proposal Sandbox</h4>
                            <p className="text-xs font-medium text-slate-600 max-w-sm mt-2 leading-relaxed">
                                Prefill with a lead from your database or enter parameters manually, then click Generate to construct a premium, client-ready proposal.
                            </p>
                        </div>
                    )}
                </div>
            </div>
            )}

            {mode === 'freeform' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 no-print">
                {/* Left: fixed necessities only */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 space-y-6 premium-shadow">
                    <h3 className="text-lg font-black text-white tracking-tight uppercase flex items-center gap-2">
                        ðŸ“‹ Fixed Necessities
                    </h3>
                    <p className="text-xs font-medium text-slate-500 leading-relaxed">
                        These stay fixed in the exported PDF's cover and header/footer. Everything else below is written from scratch.
                    </p>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase text-slate-500">Business Name (Prepared For)</label>
                        <input
                            type="text"
                            placeholder="e.g. Manning Gym"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all font-sans"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase text-slate-500">Project / Proposal Title</label>
                        <input
                            type="text"
                            placeholder="e.g. Manning Gym Booking Automation"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all font-sans"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={isDownloading || !freeformHtml}
                        className="w-full py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-violet-600/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                        {isDownloading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <CustomIcons.Download />
                        )}
                        {isDownloading ? 'Rendering PDFâ€¦' : 'Download PDF'}
                    </button>
                </div>

                {/* Right: freeform canvas, sits inside the same fixed header/footer shell in the exported PDF */}
                <div className="flex flex-col h-[calc(100vh-140px)] overflow-hidden bg-white/[0.02] border border-white/5 rounded-[40px] premium-shadow">
                    <div className="p-6 border-b border-white/5 bg-midnight-lighter">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            FREEFORM CANVAS â€” LIVE
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-950/40">
                        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-2xl mx-auto proposal-quill-wrapper">
                            <ReactQuill
                                theme="snow"
                                value={freeformHtml}
                                onChange={setFreeformHtml}
                                placeholder="Write the proposal body from scratch here â€” the logo, header and footer are applied automatically on export."
                            />
                        </div>
                    </div>
                </div>
            </div>
            )}
        </div>
    );
};

export default ProposalWriter;
