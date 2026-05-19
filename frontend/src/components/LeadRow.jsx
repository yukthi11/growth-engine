import React, { useState } from 'react';
import { updateLead } from '../api/client';

const VALID_STATUSES = ['new', 'queued', 'messaged', 'contacted', 'replied', 'interested', 'closed', 'rejected', 'converted', 'ignored'];

const STATUS_THEMES = {
    new: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    queued: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    messaged: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    contacted: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    replied: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    interested: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    closed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    converted: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30',
    ignored: 'bg-slate-500/10 text-slate-500 border-white/5'
};

const LeadRow = ({ lead, onUpdate, onViewMessages, onEdit, onDelete }) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [showGap, setShowGap] = useState(false);

    const handleStatusChange = async (newStatus) => {
        setIsUpdating(true);
        try {
            await updateLead(lead.id, { status: newStatus });
            onUpdate();
        } catch (err) {
            console.error('Failed to update status:', err);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to permanently delete ${lead.business_name}?`)) {
            try {
                await onDelete(lead.id);
            } catch (err) {
                console.error('Delete failed:', err);
            }
        }
    };

    const Icons = {
        Messages: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
        Edit: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
        Delete: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
    };

    return (
        <tr className="hover:bg-white/5 transition-colors group">
            {/* Business Cell */}
            <td className="px-6 py-4 whitespace-nowrap border-r border-white/5 last:border-0 min-w-[200px]">
                <div className="flex items-center">
                    <div className="flex-shrink-0 h-8 w-8 bg-white/5 rounded-lg flex items-center justify-center text-slate-500 group-hover:bg-violet-500/20 group-hover:text-violet-400 transition-colors border border-white/5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011-1v5m-4 0h4" />
                        </svg>
                    </div>
                    <div className="ml-3 truncate max-w-[150px]">
                        <div className="text-[11px] font-black text-white truncate" title={lead.business_name}>{lead.business_name}</div>
                        {lead.instagram_username && (
                            <div className="flex items-center gap-1 mt-0.5">
                                <svg className="w-2.5 h-2.5 text-rose-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                </svg>
                                <span className="text-[9px] font-black text-rose-400">@{lead.instagram_username}</span>
                            </div>
                        )}
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">ID: {lead.id}</div>
                    </div>
                </div>
            </td>
            {/* Email Cell */}
            <td className="px-6 py-4 whitespace-nowrap border-r border-white/5 last:border-0 min-w-[160px]">
                {lead.email_address ? (
                    <div className="text-[11px] text-violet-400 font-black tracking-tight">{lead.email_address}</div>
                ) : (
                    <div className="text-[10px] text-slate-600 font-bold uppercase italic opacity-50">Couldn't find</div>
                )}
            </td>
            {/* Phone Cell */}
            <td className="px-6 py-4 whitespace-nowrap border-r border-white/5 last:border-0 min-w-[140px]">
                {lead.phone ? (
                    <div className="text-[11px] text-cyan-400 font-black tracking-tight">{lead.phone}</div>
                ) : (
                    <div className="text-[10px] text-slate-600 font-bold uppercase italic opacity-50">Couldn't find</div>
                )}
            </td>
            {/* Website Cell */}
            <td className="px-6 py-4 whitespace-nowrap border-r border-white/5 last:border-0 min-w-[140px]">
                {lead.website ? (
                    <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-slate-400 font-bold hover:text-white transition-colors underline decoration-white/10 decoration-dotted underline-offset-4 truncate block max-w-[120px]">
                        {lead.website.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]}
                    </a>
                ) : (
                    <div className="text-[10px] text-slate-600 font-bold uppercase italic opacity-50">Couldn't find</div>
                )}
            </td>
            {/* Location Cell */}
            <td className="px-6 py-4 whitespace-nowrap border-r border-white/5 last:border-0 min-w-[200px]">
                {lead.location_normalized ? (
                    <div className="text-[10px] text-slate-300 font-bold tracking-wide truncate max-w-[300px] hover:text-white transition-colors" title={lead.location_normalized}>
                        {lead.location_normalized}
                    </div>
                ) : (
                    <div className="text-[10px] text-slate-600 font-bold uppercase italic opacity-50">Couldn't find</div>
                )}
            </td>
            {/* Score Cell */}
            <td className="px-6 py-4 whitespace-nowrap border-r border-white/5 last:border-0 min-w-[130px]">
                <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${lead.tier === 'hot' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : lead.tier === 'warm' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-white/5 text-slate-500 border-white/5'}`}>
                        {lead.tier || 'New'}
                    </span>
                    <div className="flex flex-col">
                        <div className="h-0.5 w-10 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500" style={{ width: `${lead.intent_score || 0}%` }}></div>
                        </div>
                        <span className="text-[8px] font-bold text-slate-500 mt-0.5">{lead.intent_score || 0}% Match</span>
                    </div>
                </div>
            </td>

            {/* Outreach DNA Cell */}
            <td className="px-6 py-4 border-r border-white/5 last:border-0 min-w-[300px]">
                <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                        <div className="text-[11px] text-slate-500 font-medium line-clamp-2 italic leading-relaxed" title={lead.outreach_draft}>
                            {lead.outreach_draft || 'No draft generated...'}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                            <button
                                onClick={() => setShowGap(!showGap)}
                                className={`flex items-center gap-2 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all
                                    ${showGap ? 'bg-violet-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}
                                `}
                            >
                                <svg className={`w-2.5 h-2.5 transition-transform duration-300 ${showGap ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                                </svg>
                                {showGap ? 'Close Analysis' : 'Expand DNA & Strategy'}
                            </button>
                        </div>
                    </div>

                    {showGap && (
                        <div className="mt-2 p-4 rounded-xl bg-midnight border border-violet-600/20 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                            {/* Strategy Section */}
                            {lead.gap_pitch && (
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-1.5 py-0.5 bg-violet-600/20 text-violet-400 text-[8px] font-black uppercase tracking-widest rounded leading-none">
                                            {lead.gap_pillar || 'Gap'}
                                        </span>
                                        {lead.gap_top?.slice(0, 3).map((gap, i) => (
                                            <span key={i} className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">• {gap.replace(/([A-Z])/g, ' $1')}</span>
                                        ))}
                                    </div>
                                    <div className="text-[10px] text-slate-300 font-medium leading-relaxed bg-violet-600/5 p-2 rounded-lg border border-violet-600/10 italic">
                                        "{lead.gap_pitch}"
                                    </div>
                                </div>
                            )}

                            {/* Full DNA Editor */}
                            <div>
                                <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center gap-1">
                                    <Icons.Messages /> Outreach DNA (Full Edit)
                                </div>
                                <textarea
                                    defaultValue={lead.outreach_draft || ''}
                                    onBlur={async (e) => {
                                        const newVal = e.target.value;
                                        if (newVal === lead.outreach_draft) return;
                                        try {
                                            await updateLead(lead.id, { outreach_draft: newVal });
                                            onUpdate();
                                        } catch (err) {
                                            console.error('Failed to update draft:', err);
                                        }
                                    }}
                                    placeholder="Enter full personalized DNA..."
                                    className="w-full bg-white/5 border border-white/5 rounded-lg p-3 text-[11px] text-white font-medium leading-relaxed focus:outline-none focus:ring-1 focus:ring-violet-500/30 custom-scrollbar"
                                    rows={4}
                                />
                                {lead.gap_vertical && (
                                    <div className="mt-3 pt-3 border-t border-white/5 text-[8px] text-slate-500 font-bold uppercase tracking-widest flex justify-between items-center">
                                        <span>Vertical: <span className="text-slate-300">{lead.gap_vertical}</span></span>
                                        <span>ID: {lead.id}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </td>

            {/* Actions Cell */}
            <td className="px-6 py-4 whitespace-nowrap text-right flex items-center justify-end gap-2">
                <button
                    onClick={() => onViewMessages(lead)}
                    className="p-2 bg-white/5 hover:bg-violet-500/10 text-slate-500 hover:text-violet-300 rounded-lg border border-white/5 transition-all"
                    title="Open Outreach Panel"
                >
                    <Icons.Messages />
                </button>

                <button
                    onClick={() => onEdit(lead)}
                    className="p-2 bg-white/5 hover:bg-violet-500/20 text-slate-500 hover:text-violet-400 rounded-lg border border-white/5 transition-all"
                    title="Correct Lead Details"
                >
                    <Icons.Edit />
                </button>

                <div className="relative">
                    <select
                        value={lead.status}
                        disabled={isUpdating}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className={`appearance-none block px-3 py-1.5 text-[10px] font-black rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-1 ring-white/5 uppercase tracking-widest ${STATUS_THEMES[lead.status] || 'bg-white/5 text-slate-400 border-white/5'} ${isUpdating ? 'opacity-50' : ''}`}
                    >
                        {VALID_STATUSES.map((status) => (
                            <option key={status} value={status} className="bg-midnight text-white">
                                {status}
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={handleDelete}
                    className="p-2 bg-white/5 hover:bg-rose-500/20 text-slate-600 hover:text-rose-400 rounded-lg border border-white/5 transition-all"
                    title="Purge Lead"
                >
                    <Icons.Delete />
                </button>
            </td>
        </tr>
    );
};

export default LeadRow;
