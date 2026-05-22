import React, { useState, useEffect } from 'react';
import { getMessages } from '../api/client';

const OutreachStatusModal = ({ isOpen, onClose, lead }) => {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && lead?.id) {
            fetchOutreachLogs();
        }
    }, [isOpen, lead]);

    const fetchOutreachLogs = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getMessages(lead.id);
            // API returns messages ordered DESC, we can display them as a clean feed
            setMessages(data);
        } catch (err) {
            console.error('Failed to fetch outreach messages:', err);
            setError('Could not fetch outreach logs. Verify database visibility.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <div className="fixed inset-0 z-[200] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen p-4">
                {/* Glass Backdrop */}
                <div 
                    className="fixed inset-0 bg-midnight/85 backdrop-blur-xl animate-in fade-in duration-300" 
                    onClick={onClose}
                ></div>

                {/* Modal Container */}
                <div className="relative bg-midnight-lighter border border-white/10 rounded-[40px] shadow-2xl max-w-2xl w-full p-10 animate-in slide-in-from-bottom-8 duration-300 premium-shadow">
                    
                    {/* Header */}
                    <div className="mb-8 flex items-start justify-between">
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-600/10 border border-violet-600/20 rounded-full text-[10px] font-black uppercase tracking-widest text-violet-400">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                                </span>
                                Outreach Ledger
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tighter italic">
                                {lead?.business_name || 'Lead Identity'}
                            </h3>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-none mt-1">
                                Complete Dispatch Logs & Status History
                            </p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-95"
                            title="Close Modal"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Metadata Header Row */}
                    <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 mb-6 text-[10px] font-bold uppercase tracking-widest">
                        <div className="flex flex-col gap-1 border-r border-white/5 pr-4">
                            <span className="text-slate-500">Registered Email</span>
                            <span className="text-violet-400 text-xs font-black tracking-normal lowercase truncate">
                                {lead?.email_address || 'n/a'}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1 pl-2">
                            <span className="text-slate-500">Registered Phone</span>
                            <span className="text-cyan-400 text-xs font-black tracking-normal">
                                {lead?.phone || 'n/a'}
                            </span>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {isLoading ? (
                            <div className="py-20 flex flex-col items-center justify-center space-y-4">
                                <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Syncing logs from database...</p>
                            </div>
                        ) : error ? (
                            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                                <p className="text-xs font-black text-rose-400 uppercase tracking-wider">{error}</p>
                                <button 
                                    onClick={fetchOutreachLogs}
                                    className="mt-3 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                                >
                                    Retry Sync
                                </button>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="py-16 text-center border border-white/5 bg-white/[0.01] rounded-3xl p-8 flex flex-col items-center">
                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3 text-xl">
                                    📭
                                </div>
                                <h4 className="text-sm font-black text-white uppercase tracking-wider">No Outreach Sent Yet</h4>
                                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-1 max-w-xs leading-relaxed">
                                    This lead has not been contacted through email or WhatsApp. It is completely warm and safe to initiate outreach.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {messages.map((msg, index) => {
                                    const isWhatsApp = msg.channel === 'whatsapp';
                                    const isSent = msg.status === 'sent';
                                    const isPending = msg.status === 'pending';
                                    const isFailed = msg.status === 'failed';

                                    return (
                                        <div 
                                            key={msg.id || index}
                                            className="p-6 rounded-[24px] bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all duration-300 relative overflow-hidden group"
                                        >
                                            {/* Top indicators row */}
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    {/* Channel Badge */}
                                                    <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border flex items-center gap-1
                                                        ${isWhatsApp 
                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                            : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                                                        }
                                                    `}>
                                                        {isWhatsApp ? '📱 WhatsApp' : '✉️ Email'}
                                                    </span>

                                                    {/* Status Badge */}
                                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border
                                                        ${isSent 
                                                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                                                            : isPending 
                                                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
                                                                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                                        }
                                                    `}>
                                                        {msg.status}
                                                    </span>
                                                </div>

                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                                    {formatDate(msg.created_at || msg.sent_at)}
                                                </span>
                                            </div>

                                            {/* Pitch Content Preview */}
                                            <div className="space-y-1">
                                                <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest block ml-0.5">Message Pitch</span>
                                                <div className="text-[10px] text-slate-300 font-medium leading-relaxed bg-white/5 p-3.5 rounded-xl border border-white/5 italic max-h-32 overflow-y-auto custom-scrollbar">
                                                    {msg.message_text || msg.content || 'Empty message body...'}
                                                </div>
                                            </div>

                                            {/* Failure Reason Warning */}
                                            {isFailed && msg.failure_reason && (
                                                <div className="mt-3 p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/10 flex items-start gap-2.5 text-rose-400">
                                                    <span className="text-xs mt-0.5">⚠️</span>
                                                    <div className="space-y-0.5">
                                                        <span className="text-[8px] font-black uppercase tracking-widest block">Delivery Failure Reason</span>
                                                        <span className="text-[10px] font-medium leading-tight block">
                                                            {msg.failure_reason}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer Close Button */}
                    <div className="mt-8 pt-6 border-t border-white/5 flex">
                        <button 
                            onClick={onClose}
                            className="w-full py-4 border border-white/10 hover:bg-white/5 text-slate-400 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all active:scale-95"
                        >
                            Dismiss Logs
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default OutreachStatusModal;
