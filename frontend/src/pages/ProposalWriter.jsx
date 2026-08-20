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

const formatINR = (amount) => `₹${Math.round(amount).toLocaleString('en-IN')}`;

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
    ChevronRight: ({ className = '' }) => <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>,
    Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Briefcase: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
};

const SECTION_ORDER = ['problem', 'helps', 'scope', 'investment'];

// Rough per-section height estimate for the preview's page-break math — tuned
// against the real PDF template's block sizes, not pixel-exact (the actual
// export is rendered separately by Puppeteer).
const estimateSectionHeight = (key, dp) => {
    const HEADER = 74; // section label + title + rule
    switch (key) {
        case 'problem': {
            let h = HEADER + 110;
            if (dp.key_benefits?.length) h += 130;
            return h;
        }
        case 'helps': {
            if (!dp.how_it_helps?.length) return HEADER + 90;
            return HEADER + dp.how_it_helps.reduce((sum, s) => sum + 56 + (s.items?.length || 0) * 66, 0);
        }
        case 'scope': {
            const delivH = dp.deliverables?.length ? dp.deliverables.length * 30 : 90;
            const timelineH = dp.timeline?.length ? dp.timeline.length * 90 : 90;
            return HEADER + 40 + Math.max(delivH, timelineH);
        }
        case 'investment': {
            const rows = dp.investment?.length || 0;
            return HEADER + 46 + rows * 46 + 190;
        }
        default:
            return 0;
    }
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
    // editable per-proposal — the catalog price is only ever a starting point.
    const [lineItems, setLineItems] = useState({});
    const [milestoneSplit, setMilestoneSplit] = useState(DEFAULT_MILESTONE_SPLIT);

    // UI States
    const [leads, setLeads] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [isAutofilling, setIsAutofilling] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [proposal, setProposal] = useState(null);
    const [copied, setCopied] = useState(false);

    // Fixed-format vs freeform authoring mode — see mode toggle below.
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

    // Before the AI has generated anything, the preview still mirrors the left
    // form live — cover, problem statement, selected services, and computed
    // pricing are all known client-side already. Sections that only the LLM can
    // fill in (benefits, how-it-helps, phased timeline) render as placeholders
    // until Generate is clicked.
    const draftProposal = useMemo(() => ({
        cover_page: { category_name: industry || 'Business Proposal', project_name: projectName, headline: '' },
        problem_overview: { description: problem || currentProcess || '' },
        key_benefits: [],
        how_it_helps: [],
        deliverables: Object.values(lineItems).map((item) => item.service.name),
        timeline: [],
        investment: milestoneSplit.map((m) => ({
            milestone_name: m.label,
            project_scope: `${m.percentage}% of total investment`,
            amount: pricingSummary === 'TBD' ? 'TBD' : pricingSummary,
        })),
        final_summary: {
            total_investment: pricingSummary,
            payment_structure: milestoneSplit.map((m) => `${m.percentage}% ${m.label}`).join(', '),
            support_included: '30 Days Post-Launch Optimization Support',
            expected_delivery: timeline || 'TBD',
        },
    }), [industry, projectName, problem, currentProcess, lineItems, milestoneSplit, pricingSummary, timeline]);

    const displayProposal = proposal || draftProposal;
    const isDraft = !proposal;

    // Paginate the preview like a real PDF viewer: the cover is always its own
    // page (matching the backend's forced page-break-after on .cover), and the
    // four body sections — each atomic in the exported PDF via
    // page-break-inside: avoid — are greedily packed into fixed-height sheets
    // using an estimated height (item counts × known per-row heights), so no
    // DOM measurement/hidden clones are needed for a single-page-at-a-time view.
    const PAGE_CONTENT_HEIGHT = 900;
    const bodyPages = useMemo(() => {
        const result = [[]];
        let consumed = 0;
        SECTION_ORDER.forEach((key) => {
            const h = estimateSectionHeight(key, displayProposal);
            if (consumed > 0 && consumed + h > PAGE_CONTENT_HEIGHT) {
                result.push([]);
                consumed = 0;
            }
            result[result.length - 1].push(key);
            consumed += h;
        });
        return result;
    }, [displayProposal]);

    const totalPages = 1 + bodyPages.length;

    const [previewPageIndex, setPreviewPageIndex] = useState(0);
    useEffect(() => {
        if (previewPageIndex > totalPages - 1) setPreviewPageIndex(totalPages - 1);
    }, [totalPages, previewPageIndex]);
    // Jump back to the cover whenever a fresh generation replaces the proposal.
    useEffect(() => { setPreviewPageIndex(0); }, [proposal]);

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
    // ['how_it_helps', 1, 'items', 0, 'benefit'] — lets the sandbox stay
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
    // quick action, once — guarded by ref so it doesn't refire on every leads refresh.
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

    // Triggers AI Autofill for a given lead — shared by the search dropdown and
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
            // catalog base prices — still fully editable below before generating.
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
                // Structured pricing — total and milestone amounts are computed
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

    // Export the current (possibly edited) proposal as a real, premium PDF —
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
                            {isUploadingLogo ? 'Uploading…' : (logoUrl ? 'Change' : 'Upload Logo')}
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
                        📋 Define Proposal Scope
                    </h3>
                    
                    <div className="space-y-4">
                        {/* Lead Selector — searchable, sorted hot -> warm -> cold */}
                        <div className="flex flex-col gap-2 relative">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                Load from Database (Autofill)
                            </label>
                            <input
                                type="text"
                                value={isLeadDropdownOpen ? leadQuery : (selectedLead ? `🏢 ${selectedLead.business_name} (${selectedLead.location_normalized || 'No Location'})` : '')}
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
                                            <span className="text-xs font-bold text-white truncate">🏢 {lead.business_name} <span className="text-slate-500">({lead.location_normalized || 'No Location'})</span></span>
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
                                                                                    placeholder="One-time ₹"
                                                                                />
                                                                            )}
                                                                            {(service.price_type === 'monthly' || service.price_type === 'one_time_plus_monthly') && (
                                                                                <input
                                                                                    type="number"
                                                                                    value={item.monthly_price}
                                                                                    onChange={(e) => handleLineItemFieldChange(service.id, 'monthly_price', e.target.value)}
                                                                                    className="w-28 bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-violet-500"
                                                                                    placeholder="Monthly ₹"
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
                                                                        <span className="text-[10px] font-bold text-slate-600 uppercase">Custom quote — priced outside this proposal</span>
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

                            {/* Milestone Split Builder — percentages of the computed total above, not free text */}
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
                                                <button type="button" onClick={() => removeMilestone(idx)} className="text-slate-600 hover:text-red-400 text-xs font-black px-1">✕</button>
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

                {/* Right Interactive Preview Panel — always shows the live doc, styled
                    to match the exported PDF, so what you see is what you'll download */}
                <div className="flex flex-col">
                    <div className="flex flex-col bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden premium-shadow">
                        {/* Actions Header */}
                        <div className="p-6 border-b border-white/5 bg-midnight-lighter flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                {isDraft ? 'LIVE DOCUMENT PREVIEW · DRAFT' : 'LIVE CONSULTANT PREVIEW'}
                            </span>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleCopyMarkdown}
                                    disabled={isDraft}
                                    className="px-4 py-2 border border-white/10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                                >
                                    {copied ? <CustomIcons.Check /> : <CustomIcons.Clipboard />}
                                    {copied ? 'Copied!' : 'Copy Markdown'}
                                </button>
                                <button
                                    onClick={handleDownloadPdf}
                                    disabled={isDownloading || isDraft}
                                    title={isDraft ? 'Generate the full proposal first' : undefined}
                                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-violet-600/15 disabled:opacity-40 disabled:pointer-events-none"
                                >
                                    {isDownloading ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <CustomIcons.Download />
                                    )}
                                    {isDownloading ? 'Rendering PDF…' : 'Download PDF'}
                                </button>
                            </div>
                        </div>

                        {/* Document Render Panel — one page at a time, like a PDF viewer */}
                        <div className="p-10 bg-slate-950/40">
                            <div className="doc-page doc-pages">
                                {/* Page 1 — Cover, always its own sheet (matches the backend's forced page break) */}
                                {previewPageIndex === 0 && (
                                <div className="doc-sheet rounded-2xl shadow-2xl p-12">
                                    <div className="doc-header">
                                        <div className="doc-header-brand">
                                            {logoUrl ? (
                                                <img src={`${API_BASE_URL}${logoUrl}`} alt="Company logo" />
                                            ) : (
                                                <span>Revive Technology</span>
                                            )}
                                        </div>
                                        <span>Proposal</span>
                                    </div>

                                    <input
                                        value={displayProposal.cover_page?.category_name || ''}
                                        readOnly={isDraft}
                                        onChange={(e) => updateProposalField(['cover_page', 'category_name'], e.target.value)}
                                        placeholder="Business Automation Systems"
                                        className="doc-eyebrow"
                                    />
                                    <input
                                        value={displayProposal.cover_page?.project_name || projectName || ''}
                                        readOnly={isDraft}
                                        onChange={(e) => updateProposalField(['cover_page', 'project_name'], e.target.value)}
                                        placeholder="Project name"
                                        className="doc-h1"
                                    />
                                    <input
                                        value={displayProposal.cover_page?.headline || ''}
                                        readOnly={isDraft}
                                        onChange={(e) => updateProposalField(['cover_page', 'headline'], e.target.value)}
                                        placeholder={isDraft ? 'A one-line headline appears here after Generate' : ''}
                                        className="doc-headline"
                                    />
                                    <div className="doc-meta-row">
                                        <span>Prepared For: {businessName || '—'}</span>
                                        <span>Date: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                    </div>

                                    <div className="doc-footer">
                                        <span>Confidential — Prepared for {businessName || 'Client'}</span>
                                        <span>Page 1 / {totalPages}</span>
                                    </div>
                                </div>
                                )}

                                {/* Body page — sections greedily packed by estimated height, one page shown at a time */}
                                {previewPageIndex > 0 && (() => {
                                    const pageKeys = bodyPages[previewPageIndex - 1] || [];
                                    return (
                                    <div className="doc-sheet rounded-2xl shadow-2xl p-12">
                                        <div className="doc-header">
                                            <div className="doc-header-brand">
                                                {logoUrl ? (
                                                    <img src={`${API_BASE_URL}${logoUrl}`} alt="Company logo" />
                                                ) : (
                                                    <span>Revive Technology</span>
                                                )}
                                            </div>
                                            <span>Proposal</span>
                                        </div>

                                        {pageKeys.includes('problem') && (
                                <div className="doc-section">
                                    <span className="doc-section-label">01 / Challenge</span>
                                    <h3 className="doc-section-title">Problem Overview</h3>
                                    <hr className="doc-rule" />
                                    <textarea
                                        value={displayProposal.problem_overview?.description || ''}
                                        readOnly={isDraft}
                                        onChange={(e) => updateProposalField(['problem_overview', 'description'], e.target.value)}
                                        placeholder="Describe the operational problem on the left to see it here."
                                        rows={4}
                                        className="doc-p"
                                    />
                                    {displayProposal.key_benefits?.length > 0 && (
                                        <div className="doc-metrics">
                                            {displayProposal.key_benefits.map((metric, idx) => (
                                                <div key={idx} className="doc-metric">
                                                    <input
                                                        value={metric.value || ''}
                                                        onChange={(e) => updateProposalField(['key_benefits', idx, 'value'], e.target.value)}
                                                        className="value"
                                                    />
                                                    <input
                                                        value={metric.label || ''}
                                                        onChange={(e) => updateProposalField(['key_benefits', idx, 'label'], e.target.value)}
                                                        className="label"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                        )}

                                        {/* Solution detail */}
                                        {pageKeys.includes('helps') && (
                                <div className="doc-section">
                                    <span className="doc-section-label">02 / Architecture</span>
                                    <h3 className="doc-section-title">How This Solution Helps</h3>
                                    <hr className="doc-rule" />
                                    {displayProposal.how_it_helps?.length > 0 ? (
                                        displayProposal.how_it_helps.map((section, idx) => (
                                            <div key={idx} className="doc-helps-block">
                                                <h4>
                                                    <input
                                                        value={section.section_name || ''}
                                                        onChange={(e) => updateProposalField(['how_it_helps', idx, 'section_name'], e.target.value)}
                                                        className="w-full bg-transparent border-none"
                                                    />
                                                </h4>
                                                {section.items?.map((item, itemIdx) => (
                                                    <div key={itemIdx} className="doc-helps-item">
                                                        <input
                                                            value={item.feature || ''}
                                                            onChange={(e) => updateProposalField(['how_it_helps', idx, 'items', itemIdx, 'feature'], e.target.value)}
                                                            className="feature"
                                                        />
                                                        <textarea
                                                            value={item.benefit || ''}
                                                            onChange={(e) => updateProposalField(['how_it_helps', idx, 'items', itemIdx, 'benefit'], e.target.value)}
                                                            rows={2}
                                                            className="benefit"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="doc-placeholder">Generate the proposal to build this section</div>
                                    )}
                                </div>
                                        )}

                                        {/* Scope & Deliverables */}
                                        {pageKeys.includes('scope') && (
                                <div className="doc-section doc-two-col">
                                    <div>
                                        <span className="doc-section-label">Scope</span>
                                        <h3 className="doc-section-title" style={{ fontSize: '15px' }}>Deliverables</h3>
                                        {displayProposal.deliverables?.length > 0 ? (
                                            <ul className="doc-deliverables">
                                                {displayProposal.deliverables.map((deliv, idx) => (
                                                    <li key={idx}>
                                                        <span>•</span>
                                                        <input
                                                            value={deliv || ''}
                                                            readOnly={isDraft}
                                                            onChange={(e) => updateProposalField(['deliverables', idx], e.target.value)}
                                                        />
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="doc-placeholder">Select services on the left</div>
                                        )}
                                    </div>
                                    <div>
                                        <span className="doc-section-label">Delivery</span>
                                        <h3 className="doc-section-title" style={{ fontSize: '15px' }}>Expected Timeline</h3>
                                        {displayProposal.timeline?.length > 0 ? (
                                            displayProposal.timeline.map((step, idx) => (
                                                <div key={idx} className="doc-timeline-item">
                                                    <input
                                                        value={step.phase || ''}
                                                        onChange={(e) => updateProposalField(['timeline', idx, 'phase'], e.target.value)}
                                                        className="phase"
                                                    />
                                                    <textarea
                                                        value={step.description || ''}
                                                        onChange={(e) => updateProposalField(['timeline', idx, 'description'], e.target.value)}
                                                        rows={2}
                                                        className="description"
                                                    />
                                                </div>
                                            ))
                                        ) : (
                                            <div className="doc-placeholder">Generate to build phased timeline</div>
                                        )}
                                    </div>
                                </div>
                                        )}

                                        {/* Final Investment Breakdown */}
                                        {pageKeys.includes('investment') && (
                                <div className="doc-section">
                                    <span className="doc-section-label">03 / Financial Investment</span>
                                    <h3 className="doc-section-title">Investment Summary</h3>
                                    <hr className="doc-rule" />
                                    <table className="doc-table">
                                        <thead>
                                            <tr>
                                                <th>Milestone</th>
                                                <th>Project Scope</th>
                                                <th style={{ textAlign: 'right' }}>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayProposal.investment?.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <input
                                                            value={item.milestone_name || ''}
                                                            readOnly={isDraft}
                                                            onChange={(e) => updateProposalField(['investment', idx, 'milestone_name'], e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            value={item.project_scope || ''}
                                                            readOnly={isDraft}
                                                            onChange={(e) => updateProposalField(['investment', idx, 'project_scope'], e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            value={item.amount || ''}
                                                            readOnly={isDraft}
                                                            onChange={(e) => updateProposalField(['investment', idx, 'amount'], e.target.value)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    <div className="doc-summary-box">
                                        <div className="doc-summary-row total">
                                            <span>Total Investment</span>
                                            <input
                                                value={displayProposal.final_summary?.total_investment || ''}
                                                readOnly={isDraft}
                                                onChange={(e) => updateProposalField(['final_summary', 'total_investment'], e.target.value)}
                                            />
                                        </div>
                                        <div className="doc-summary-row">
                                            <span>Payment Structure</span>
                                            <input
                                                value={displayProposal.final_summary?.payment_structure || ''}
                                                readOnly={isDraft}
                                                onChange={(e) => updateProposalField(['final_summary', 'payment_structure'], e.target.value)}
                                            />
                                        </div>
                                        <div className="doc-summary-row">
                                            <span>Support Included</span>
                                            <input
                                                value={displayProposal.final_summary?.support_included || ''}
                                                readOnly={isDraft}
                                                onChange={(e) => updateProposalField(['final_summary', 'support_included'], e.target.value)}
                                            />
                                        </div>
                                        <div className="doc-summary-row">
                                            <span>Expected Delivery</span>
                                            <input
                                                value={displayProposal.final_summary?.expected_delivery || ''}
                                                readOnly={isDraft}
                                                onChange={(e) => updateProposalField(['final_summary', 'expected_delivery'], e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                        )}

                                        <div className="doc-footer">
                                            <span>Confidential — Prepared for {businessName || 'Client'}</span>
                                            <span>Page {previewPageIndex + 1} / {totalPages}</span>
                                        </div>
                                    </div>
                                    );
                                })()}

                                {/* Page navigation */}
                                <div className="doc-nav">
                                    <button
                                        type="button"
                                        onClick={() => setPreviewPageIndex((p) => Math.max(0, p - 1))}
                                        disabled={previewPageIndex === 0}
                                        className="doc-nav-btn"
                                        aria-label="Previous page"
                                    >
                                        <CustomIcons.ChevronRight className="rotate-180" />
                                    </button>
                                    <span className="doc-nav-label">Page {previewPageIndex + 1} of {totalPages}</span>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                                        disabled={previewPageIndex === totalPages - 1}
                                        className="doc-nav-btn"
                                        aria-label="Next page"
                                    >
                                        <CustomIcons.ChevronRight />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {mode === 'freeform' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 no-print">
                {/* Left: fixed necessities only */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 space-y-6 premium-shadow">
                    <h3 className="text-lg font-black text-white tracking-tight uppercase flex items-center gap-2">
                        📋 Fixed Necessities
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
                        {isDownloading ? 'Rendering PDF…' : 'Download PDF'}
                    </button>
                </div>

                {/* Right: freeform canvas, sits inside the same fixed header/footer shell in the exported PDF */}
                <div className="flex flex-col h-[calc(100vh-140px)] overflow-hidden bg-white/[0.02] border border-white/5 rounded-[40px] premium-shadow">
                    <div className="p-6 border-b border-white/5 bg-midnight-lighter">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            FREEFORM CANVAS — LIVE
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-950/40">
                        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-2xl mx-auto proposal-quill-wrapper">
                            <ReactQuill
                                theme="snow"
                                value={freeformHtml}
                                onChange={setFreeformHtml}
                                placeholder="Write the proposal body from scratch here — the logo, header and footer are applied automatically on export."
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
