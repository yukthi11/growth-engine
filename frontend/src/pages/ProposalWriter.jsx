import React, { useState, useEffect } from 'react';
import { getLeads, getProposalAutofill, generateProposal } from '../api/client';

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

const ProposalWriter = ({ companyId }) => {
    // Form Inputs
    const [selectedLeadId, setSelectedLeadId] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [projectName, setProjectName] = useState('');
    const [industry, setIndustry] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [problem, setProblem] = useState('');
    const [currentProcess, setCurrentProcess] = useState('');
    const [desiredOutcome, setDesiredOutcome] = useState('');
    const [customNotes, setCustomNotes] = useState('');
    const [timeline, setTimeline] = useState('');
    const [pricing, setPricing] = useState('');
    const [milestones, setMilestones] = useState('');
    const [selectedServices, setSelectedServices] = useState([]);

    // UI States
    const [leads, setLeads] = useState([]);
    const [isAutofilling, setIsAutofilling] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [proposal, setProposal] = useState(null);
    const [copied, setCopied] = useState(false);

    const availableServices = [
        'The WhatsApp Assistant',
        'The Smart Booking System',
        'The Live Owner Dashboard',
        'The Attendance Manager',
        'The Lead Tracker',
        'The Reporting Center',
        'Local Google Maps Optimization',
        'Google Business Profile Review Automation'
    ];

    // Load leads for the active workspace company
    useEffect(() => {
        if (companyId) {
            fetchLeadsList();
            // Reset state
            setProposal(null);
            resetForm();
        }
    }, [companyId]);

    const fetchLeadsList = async () => {
        try {
            const res = await getLeads(companyId, 1, 100); // Fetch first 100 leads
            setLeads(res.data || []);
        } catch (err) {
            console.error('Failed to fetch leads for proposal dropdown:', err);
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
        setPricing('');
        setMilestones('');
        setSelectedServices([]);
    };

    // Trigger AI Autofill when lead changes
    const handleLeadChange = async (e) => {
        const leadId = e.target.value;
        setSelectedLeadId(leadId);
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
            setPricing(autofill.pricing || '');
            setMilestones(autofill.milestones || '');
            setSelectedServices(autofill.selected_services || []);
        } catch (err) {
            console.error('Error autofilling lead proposal details:', err);
            alert('Failed to autofill details. Please enter manually.');
        } finally {
            setIsAutofilling(false);
        }
    };

    const handleServiceToggle = (service) => {
        setSelectedServices(prev => 
            prev.includes(service) 
                ? prev.filter(s => s !== service) 
                : [...prev, service]
        );
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
            const data = {
                business_name: businessName,
                industry,
                contact_person: contactPerson,
                project_name: projectName,
                problem,
                current_process: currentProcess,
                desired_outcome: desiredOutcome,
                selected_services: selectedServices,
                notes: customNotes,
                timeline,
                pricing,
                milestones
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

    // Print to PDF
    const handlePrint = () => {
        window.print();
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
        markdown += `* **Total Project Investment**: ${proposal.final_summary?.total_investment || pricing}\n`;
        markdown += `* **Payment Structure**: ${proposal.final_summary?.payment_structure || milestones}\n`;
        markdown += `* **Support Included**: ${proposal.final_summary?.support_included || '30 Days Post-Launch Optimization'}\n`;
        markdown += `* **Timeline**: ${proposal.final_summary?.expected_delivery || timeline}\n`;

        navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-8 relative">
            {/* Custom print stylesheet overrides */}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    body {
                        background: white !important;
                        color: black !important;
                    }
                    /* Hide everything except the proposal container */
                    #root, header, aside, main > :not(.proposal-print-container), .no-print {
                        display: none !important;
                    }
                    /* Show and format print container */
                    .proposal-print-container {
                        display: block !important;
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white !important;
                        color: #0d0d0d !important;
                        padding: 20px !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    .print-gradient-hero {
                        background: #f4f4f7 !important;
                        border: 2px solid #000 !important;
                        color: black !important;
                    }
                    .print-card {
                        background: #fafafa !important;
                        border: 1px solid #ddd !important;
                        color: black !important;
                        box-shadow: none !important;
                    }
                    .print-table {
                        border: 1px solid #ddd !important;
                    }
                    .print-table th, .print-table td {
                        border-bottom: 1px solid #ddd !important;
                        color: black !important;
                    }
                    .print-metric {
                        font-size: 32px !important;
                        font-weight: 800 !important;
                        color: #7c3aed !important;
                    }
                    .page-break {
                        page-break-before: always;
                        padding-top: 20px;
                    }
                }
            `}} />

            <div className="flex items-center justify-between no-print">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-white tracking-tight uppercase italic leading-none flex items-center gap-3">
                        <CustomIcons.Document /> Proposal Writer
                    </h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                        AI-Powered Custom Business Consultant Solutions
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 no-print">
                {/* Left Form Panel */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 space-y-6 premium-shadow">
                    <h3 className="text-lg font-black text-white tracking-tight uppercase flex items-center gap-2">
                        📋 Define Proposal Scope
                    </h3>
                    
                    <div className="space-y-4">
                        {/* Lead Selector */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                Load from Database (Autofill)
                            </label>
                            <select
                                value={selectedLeadId}
                                onChange={handleLeadChange}
                                className="bg-[#0a0f1d] border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all cursor-pointer"
                            >
                                <option value="">-- Manual Entry / Select a Lead --</option>
                                {leads.map(lead => (
                                    <option key={lead.id} value={lead.id}>
                                        🏢 {lead.business_name} ({lead.location_normalized || 'No Location'})
                                    </option>
                                ))}
                            </select>
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

                            {/* Services Checkbox List */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[9px] font-black uppercase text-slate-500">Include Systems & Services</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-white/[0.01] border border-white/5 rounded-2xl p-4">
                                    {availableServices.map(service => (
                                        <label key={service} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-400 hover:text-white transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={selectedServices.includes(service)}
                                                onChange={() => handleServiceToggle(service)}
                                                className="rounded border-white/10 text-violet-600 focus:ring-violet-500"
                                            />
                                            {service}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black uppercase text-slate-500">Project Pricing</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. ₹45,000"
                                        value={pricing}
                                        onChange={(e) => setPricing(e.target.value)}
                                        className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all font-sans"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-500">Milestone Payments</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 50% initiation fee / 50% delivery"
                                    value={milestones}
                                    onChange={(e) => setMilestones(e.target.value)}
                                    className="bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-violet-500 transition-all font-sans"
                                />
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
                                        onClick={handlePrint}
                                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-violet-600/15"
                                    >
                                        <CustomIcons.Download />
                                        Print / Save PDF
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
                                            <p className="text-[10px] font-black text-violet-300/60 uppercase tracking-widest">
                                                {proposal.cover_page?.category_name || 'Business Automation Systems'}
                                            </p>
                                            <h1 className="text-3xl font-black text-white italic tracking-tight uppercase leading-tight">
                                                {proposal.cover_page?.project_name || projectName}
                                            </h1>
                                            <p className="text-sm font-bold text-violet-300 italic">
                                                "{proposal.cover_page?.headline}"
                                            </p>
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
                                        <p className="text-sm font-medium leading-relaxed text-slate-400">
                                            {proposal.problem_overview?.description}
                                        </p>

                                        {/* Metric Cards */}
                                        <div className="grid grid-cols-3 gap-4 pt-4">
                                            {proposal.key_benefits?.map((metric, idx) => (
                                                <div key={idx} className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl text-center space-y-1">
                                                    <div className="text-xl font-black text-violet-400 tracking-tight leading-none">
                                                        {metric.value}
                                                    </div>
                                                    <div className="text-[8px] font-black uppercase text-slate-500 tracking-wider">
                                                        {metric.label}
                                                    </div>
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
                                                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                                                        {section.section_name}
                                                    </h4>
                                                    <div className="space-y-3 pl-4 border-l border-white/5">
                                                        {section.items?.map((item, itemIdx) => (
                                                            <div key={itemIdx} className="space-y-1 text-xs">
                                                                <span className="font-black text-slate-300 block">{item.feature}:</span>
                                                                <span className="font-medium text-slate-400 leading-relaxed block">{item.benefit}</span>
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
                                                        <span className="text-violet-400 mt-0.5">•</span>
                                                        <span>{deliv}</span>
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
                                                        <span className="font-black text-white block">{step.phase}</span>
                                                        <span className="font-medium text-slate-500 block leading-normal">{step.description}</span>
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
                                                            <td className="p-4 font-black text-white">{item.milestone_name}</td>
                                                            <td className="p-4 font-medium text-slate-400">{item.project_scope}</td>
                                                            <td className="p-4 font-black text-violet-400 text-right">{item.amount}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-6 space-y-3 text-xs font-bold text-slate-400">
                                            <div className="flex items-center justify-between text-white border-b border-white/5 pb-2">
                                                <span className="font-black uppercase tracking-wider">Total Investment</span>
                                                <span className="text-lg font-black text-violet-400 leading-none">{proposal.final_summary?.total_investment}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Payment Structure</span>
                                                <span className="text-slate-300 text-right font-black">{proposal.final_summary?.payment_structure}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Support Included</span>
                                                <span className="text-slate-300 text-right font-black">{proposal.final_summary?.support_included}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Expected Delivery</span>
                                                <span className="text-slate-300 text-right font-black">{proposal.final_summary?.expected_delivery}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-[40px] flex flex-col items-center justify-center p-10 text-center premium-shadow">
                            <div className="w-20 h-20 rounded-[28px] bg-white/5 flex items-center justify-center text-3xl mb-6 shadow-inner">
                                📃
                            </div>
                            <h4 className="text-lg font-black text-slate-300 uppercase tracking-tight italic">Live Proposal Sandbox</h4>
                            <p className="text-xs font-medium text-slate-600 max-w-sm mt-2 leading-relaxed">
                                Prefill with a lead from your database or enter parameters manually, then click Generate to construct a premium, client-ready proposal.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Hidden Printable Document Container for Window.print() */}
            {proposal && (
                <div className="hidden proposal-print-container proposal-document p-10 text-black bg-white space-y-10 font-sans">
                    {/* Page 1: Cover Page */}
                    <div className="print-gradient-hero p-16 border-4 border-black min-h-[900px] flex flex-col justify-between" style={{pageBreakAfter: 'always'}}>
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-bold tracking-[0.2em] uppercase text-violet-800">REVIVE TECHNOLOGY</span>
                            <span className="text-sm font-bold border-2 border-black px-2 py-1">PROPOSAL</span>
                        </div>
                        <div className="space-y-6">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                                {proposal.cover_page?.category_name}
                            </p>
                            <h1 className="text-5xl font-black tracking-tight uppercase leading-none" style={{color: 'black'}}>
                                {proposal.cover_page?.project_name}
                            </h1>
                            <p className="text-xl font-bold italic text-violet-700">
                                "{proposal.cover_page?.headline}"
                            </p>
                        </div>
                        <div className="border-t-2 border-black pt-6 flex justify-between text-xs font-bold uppercase tracking-wider text-gray-600">
                            <span>Client: {businessName}</span>
                            <span>Prepared: {new Date().toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'})}</span>
                        </div>
                    </div>

                    {/* Page 2: Problem Overview */}
                    <div className="space-y-6 min-h-[800px]" style={{pageBreakAfter: 'always'}}>
                        <div className="border-b border-black pb-2">
                            <span className="text-[10px] font-bold text-violet-800 uppercase tracking-wider">SECTION 01</span>
                            <h2 className="text-2xl font-black uppercase tracking-tight">Challenge & Problem Overview</h2>
                        </div>
                        <p className="text-base leading-relaxed text-gray-800 font-medium">
                            {proposal.problem_overview?.description}
                        </p>

                        <div className="grid grid-cols-3 gap-6 pt-10">
                            {proposal.key_benefits?.map((metric, idx) => (
                                <div key={idx} className="print-card p-6 border border-gray-300 bg-gray-50 text-center space-y-1">
                                    <div className="print-metric text-4xl font-extrabold text-violet-700">
                                        {metric.value}
                                    </div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                        {metric.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Page 3: Solution details */}
                    <div className="space-y-8 min-h-[800px]" style={{pageBreakAfter: 'always'}}>
                        <div className="border-b border-black pb-2">
                            <span className="text-[10px] font-bold text-violet-800 uppercase tracking-wider">SECTION 02</span>
                            <h2 className="text-2xl font-black uppercase tracking-tight">Proposed Solution Architecture</h2>
                        </div>

                        <div className="space-y-6">
                            {proposal.how_it_helps?.map((section, idx) => (
                                <div key={idx} className="print-card p-6 border border-gray-300 bg-gray-50 rounded-lg space-y-4">
                                    <h3 className="text-sm font-bold uppercase tracking-wider border-b border-gray-300 pb-2 text-violet-800">
                                        {section.section_name}
                                    </h3>
                                    <div className="space-y-4 pl-4">
                                        {section.items?.map((item, itemIdx) => (
                                            <div key={itemIdx} className="space-y-1 text-sm">
                                                <strong className="text-gray-900 block">{item.feature}:</strong>
                                                <span className="text-gray-700 block leading-relaxed">{item.benefit}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Page 4: Deliverables & Timeline */}
                    <div className="space-y-8 min-h-[800px]" style={{pageBreakAfter: 'always'}}>
                        <div className="border-b border-black pb-2">
                            <span className="text-[10px] font-bold text-violet-800 uppercase tracking-wider">SECTION 03</span>
                            <h2 className="text-2xl font-black uppercase tracking-tight">Scope & Delivery Blueprint</h2>
                        </div>

                        <div className="grid grid-cols-2 gap-10">
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-violet-800">Project Deliverables</h3>
                                <ul className="space-y-3 text-sm text-gray-700">
                                    {proposal.deliverables?.map((deliv, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <span className="text-violet-700 font-bold">•</span>
                                            <span>{deliv}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-violet-800">Expected Timeline</h3>
                                <div className="space-y-6 relative border-l-2 border-gray-300 pl-4">
                                    {proposal.timeline?.map((step, idx) => (
                                        <div key={idx} className="space-y-1 relative text-sm">
                                            <div className="absolute -left-[22px] top-1.5 w-2.5 h-2.5 rounded-full border border-gray-400 bg-white"></div>
                                            <strong className="text-gray-900 block">{step.phase}</strong>
                                            <span className="text-gray-600 block leading-normal">{step.description}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Page 5: Financials */}
                    <div className="space-y-8">
                        <div className="border-b border-black pb-2">
                            <span className="text-[10px] font-bold text-violet-800 uppercase tracking-wider">SECTION 04</span>
                            <h2 className="text-2xl font-black uppercase tracking-tight">Project Investment Details</h2>
                        </div>

                        <div className="print-table border border-gray-300 rounded-lg overflow-hidden text-sm">
                            <table className="w-full text-left">
                                <thead className="bg-gray-100 border-b border-gray-300">
                                    <tr>
                                        <th className="p-4 font-bold uppercase text-xs text-gray-600">Milestone</th>
                                        <th className="p-4 font-bold uppercase text-xs text-gray-600">Project Scope</th>
                                        <th className="p-4 font-bold uppercase text-xs text-gray-600 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-300">
                                    {proposal.investment?.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-4 font-bold text-gray-900">{item.milestone_name}</td>
                                            <td className="p-4 text-gray-700">{item.project_scope}</td>
                                            <td className="p-4 font-bold text-violet-800 text-right">{item.amount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="print-card border border-gray-300 bg-gray-50 rounded-lg p-6 space-y-4 text-sm">
                            <div className="flex justify-between border-b border-gray-300 pb-2 text-base font-bold text-black">
                                <span>Total Project Investment</span>
                                <span className="text-violet-800">{proposal.final_summary?.total_investment}</span>
                            </div>
                            <div className="flex justify-between text-gray-700 font-medium">
                                <span>Payment Structure</span>
                                <span className="text-black font-bold">{proposal.final_summary?.payment_structure}</span>
                            </div>
                            <div className="flex justify-between text-gray-700 font-medium">
                                <span>Support Included</span>
                                <span className="text-black font-bold">{proposal.final_summary?.support_included}</span>
                            </div>
                            <div className="flex justify-between text-gray-700 font-medium">
                                <span>Expected Delivery</span>
                                <span className="text-black font-bold">{proposal.final_summary?.expected_delivery}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProposalWriter;
