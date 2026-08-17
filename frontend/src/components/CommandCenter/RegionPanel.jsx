import React from 'react';

// ─── Funnel bar component (reusable) ──────────────────────────────────
const FunnelBar = ({ label, value, total, colorClass }) => {
    const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
                <span className={`text-xs font-black ${colorClass}`}>{value}</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${colorClass.replace('text-', 'bg-')}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

// ─── Main Region Panel ────────────────────────────────────────────────
const RegionPanel = ({ region, onClose }) => {
    if (!region) return null;

    const responseRate = region.total_leads > 0
        ? Math.round((region.responded / region.total_leads) * 100)
        : 0;

    // Determine status color based on response rate
    const getStatusColor = () => {
        if (responseRate >= 15) return 'emerald';
        if (responseRate >= 5) return 'amber';
        return 'slate';
    };
    const statusColor = getStatusColor();

    return (
        <div className="absolute top-4 right-4 w-80 z-[1000] animate-in">
            <div className="rounded-[28px] bg-midnight/90 backdrop-blur-2xl border border-white/10 p-6 premium-shadow">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-2 h-2 rounded-full bg-${statusColor}-400 animate-pulse`}></div>
                            <span className={`text-[9px] font-black uppercase tracking-widest text-${statusColor}-400`}>
                                {responseRate >= 15 ? 'High Response' : responseRate >= 5 ? 'Active' : 'New Territory'}
                            </span>
                        </div>
                        <h3 className="text-lg font-black text-white tracking-tight italic uppercase leading-tight truncate">
                            {region.campaign_name}
                        </h3>
                        {region.top_location && (
                            <p className="text-[10px] font-bold text-slate-600 mt-1 truncate">
                                📍 {region.top_location}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-all ml-2 flex-shrink-0"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                        <span className="text-xl font-black text-white block">{region.total_leads}</span>
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Leads</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                        <span className="text-xl font-black text-violet-400 block">{region.contacted}</span>
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Contacted</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
                        <span className="text-xl font-black text-emerald-400 block">{responseRate}%</span>
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Response</span>
                    </div>
                </div>

                {/* Outreach Funnel */}
                <div className="space-y-3 mb-6">
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Outreach Funnel</span>
                    <FunnelBar label="Total Leads" value={region.total_leads} total={region.total_leads} colorClass="text-violet-400" />
                    <FunnelBar label="Contacted" value={region.contacted} total={region.total_leads} colorClass="text-cyan-400" />
                    <FunnelBar label="Responded" value={region.responded} total={region.total_leads} colorClass="text-emerald-400" />
                    <FunnelBar label="Pending Leads" value={region.pending} total={region.total_leads} colorClass="text-amber-400" />
                </div>

                {/* Channel Breakdown */}
                {(region.pending_whatsapp > 0 || region.pending_email > 0 || region.sent_whatsapp > 0 || region.sent_email > 0 || region.failed_messages > 0) && (
                    <div className="space-y-3 mb-6">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Message Status by Channel</span>
                        
                        {/* Pending Messages */}
                        {(region.pending_whatsapp > 0 || region.pending_email > 0) && (
                            <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-2">
                                <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">⏳ Pending</span>
                                <div className="flex items-center gap-3">
                                    {region.pending_whatsapp > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.212L4 20l1.212-3.757A8 8 0 1112 20z"/>
                                            </svg>
                                            <span className="text-xs font-black text-green-400">{region.pending_whatsapp}</span>
                                            <span className="text-[8px] font-bold text-slate-600">WhatsApp</span>
                                        </div>
                                    )}
                                    {region.pending_email > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                            <span className="text-xs font-black text-blue-400">{region.pending_email}</span>
                                            <span className="text-[8px] font-bold text-slate-600">Email</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Sent Messages */}
                        {(region.sent_whatsapp > 0 || region.sent_email > 0) && (
                            <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">✓ Delivered</span>
                                <div className="flex items-center gap-3">
                                    {region.sent_whatsapp > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.212L4 20l1.212-3.757A8 8 0 1112 20z"/>
                                            </svg>
                                            <span className="text-xs font-black text-green-400">{region.sent_whatsapp}</span>
                                            <span className="text-[8px] font-bold text-slate-600">WhatsApp</span>
                                        </div>
                                    )}
                                    {region.sent_email > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                            <span className="text-xs font-black text-blue-400">{region.sent_email}</span>
                                            <span className="text-[8px] font-bold text-slate-600">Email</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Failed Messages */}
                        {region.failed_messages > 0 && (
                            <div className="p-3 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex items-center gap-2">
                                <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">✕ Failed</span>
                                <span className="text-xs font-black text-rose-400">{region.failed_messages}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Campaign ID for reference */}
                <div className="pt-4 border-t border-white/5">
                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
                        Campaign #{region.campaign_id}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default RegionPanel;
