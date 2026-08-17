import React, { useState, useEffect } from 'react';
import { getOutreachProgress, getOutreachSummary } from '../api/client';

const SendOutreachModal = ({ isOpen, onClose, onSubmit, campaignName, campaignId }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isTracking, setIsTracking] = useState(false);
    const [progress, setProgress] = useState(null);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [summary, setSummary] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    // Fetch the per-channel sent/remaining summary whenever the modal opens
    useEffect(() => {
        if (isOpen && campaignId) {
            setSummaryLoading(true);
            getOutreachSummary(campaignId)
                .then(setSummary)
                .catch(() => setSummary(null))
                .finally(() => setSummaryLoading(false));
        }
    }, [isOpen, campaignId]);

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setIsSubmitting(false);
            setIsTracking(false);
            setProgress(null);
            setSelectedChannel(null);
        }
    }, [isOpen]);

    // Poll for real-time progress while a dispatch is running
    useEffect(() => {
        let interval;
        if (isTracking && campaignId) {
            interval = setInterval(async () => {
                try {
                    const data = await getOutreachProgress(campaignId);
                    setProgress(data);
                    if (data.queued === 0 && data.dispatched > 0) {
                        clearInterval(interval);
                        setTimeout(() => {
                            setIsTracking(false);
                            onClose();
                        }, 3000);
                    }
                } catch (err) {
                    console.error("Progress polling failed:", err);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTracking, campaignId, onClose]);

    if (!isOpen) return null;

    const handleSelect = async (channel) => {
        setSelectedChannel(channel);
        setIsSubmitting(true);
        try {
            await onSubmit(channel);
            setIsSubmitting(false);
            setIsTracking(true);
        } catch (err) {
            console.error('Outreach trigger failed:', err);
            setIsSubmitting(false);
            setSelectedChannel(null);
        }
    };

    // Determine if there is a partial send history to show
    const hasSentHistory = summary && (summary.whatsapp_sent > 0 || summary.email_sent > 0);
    const hasRemainingWhatsApp = summary && summary.whatsapp_remaining > 0;
    const hasRemainingEmail = summary && summary.email_remaining > 0;

    return (
        <div className="fixed inset-0 z-[200] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen p-4">
                {/* Glass Backdrop */}
                <div
                    className="fixed inset-0 bg-midnight/85 backdrop-blur-xl animate-in fade-in duration-300"
                    onClick={isSubmitting ? null : onClose}
                ></div>

                {/* Modal Container */}
                <div className="relative bg-midnight-lighter border border-white/10 rounded-[40px] shadow-2xl max-w-lg w-full p-10 animate-in slide-in-from-bottom-8 duration-300 premium-shadow">

                    {/* Header */}
                    <div className="mb-8 text-center relative">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-600/10 border border-violet-600/20 rounded-full text-[10px] font-black uppercase tracking-widest text-violet-400 mb-4">
                            Campaign Dispatcher
                        </div>
                        <h3 className="text-3xl font-black text-white tracking-tighter italic">
                            Launch Outreach
                        </h3>
                        <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest leading-none mt-1">
                            Active Campaign: <span className="text-white italic normal-case">{campaignName || 'Current Selection'}</span>
                        </p>

                        {!isSubmitting && (
                            <button
                                onClick={onClose}
                                className="absolute top-0 right-0 p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-slate-500 hover:text-white transition-all active:scale-95"
                                title="Close"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {isSubmitting ? (
                            <div className="py-20 flex flex-col items-center justify-center space-y-4">
                                <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">
                                    Firing up {selectedChannel === 'all' ? 'WhatsApp & Email' : selectedChannel} pacers...
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Prior Send History Strip */}
                                {!summaryLoading && hasSentHistory && (
                                    <div className="bg-white/3 border border-white/8 rounded-[18px] p-4 mb-2">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">
                                            Previous Send Activity
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base">💬</span>
                                                <div>
                                                    <div className="text-sm font-black text-emerald-400">{summary.whatsapp_sent} sent</div>
                                                    <div className="text-[9px] text-slate-500 uppercase tracking-wide">{summary.whatsapp_remaining} remaining</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-base">✉️</span>
                                                <div>
                                                    <div className="text-sm font-black text-emerald-400">{summary.email_sent} sent</div>
                                                    <div className="text-[9px] text-slate-500 uppercase tracking-wide">{summary.email_remaining} remaining</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Continue Sending section — shown only when there is partial history */}
                                {hasSentHistory && (hasRemainingWhatsApp || hasRemainingEmail) && (
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">
                                            Continue Where You Left Off
                                        </p>
                                        {hasRemainingWhatsApp && (
                                            <div
                                                onClick={() => handleSelect('whatsapp')}
                                                className="p-5 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 hover:border-emerald-500/30 rounded-[20px] cursor-pointer flex items-center justify-between transition-all duration-300 group transform hover:-translate-y-0.5 active:scale-98"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg">💬</span>
                                                    <div>
                                                        <h4 className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">Continue WhatsApp</h4>
                                                        <p className="text-[10px] text-slate-500">{summary.whatsapp_remaining} leads not yet contacted</p>
                                                    </div>
                                                </div>
                                                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                    </svg>
                                                </div>
                                            </div>
                                        )}
                                        {hasRemainingEmail && (
                                            <div
                                                onClick={() => handleSelect('email')}
                                                className="p-5 bg-violet-500/5 hover:bg-violet-500/10 border border-violet-500/10 hover:border-violet-500/30 rounded-[20px] cursor-pointer flex items-center justify-between transition-all duration-300 group transform hover:-translate-y-0.5 active:scale-98"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg">✉️</span>
                                                    <div>
                                                        <h4 className="text-sm font-black text-white group-hover:text-violet-400 transition-colors">Continue Email</h4>
                                                        <p className="text-[10px] text-slate-500">{summary.email_remaining} leads not yet contacted</p>
                                                    </div>
                                                </div>
                                                <div className="p-2 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-xl group-hover:scale-110 transition-transform">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                    </svg>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Divider when both sections are showing */}
                                {hasSentHistory && (hasRemainingWhatsApp || hasRemainingEmail) && (
                                    <div className="flex items-center gap-3 py-1">
                                        <div className="flex-1 h-px bg-white/5"></div>
                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Or start fresh</span>
                                        <div className="flex-1 h-px bg-white/5"></div>
                                    </div>
                                )}

                                {/* Standard Channel Cards — always shown */}
                                {/* WhatsApp Card */}
                                <div
                                    onClick={() => handleSelect('whatsapp')}
                                    className="p-6 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 hover:border-emerald-500/30 rounded-[24px] cursor-pointer flex items-center justify-between transition-all duration-300 group transform hover:-translate-y-0.5 active:scale-98"
                                >
                                    <div className="space-y-1 flex-1 pr-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">💬</span>
                                            <h4 className="text-sm font-black text-white uppercase tracking-wider group-hover:text-emerald-400 transition-colors">WhatsApp Channel</h4>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                            Dispatches highly personalized pitch texts and mockup proof attachments humanly over your active session.
                                        </p>
                                    </div>
                                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl group-hover:scale-110 transition-transform flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Email Card */}
                                <div
                                    onClick={() => handleSelect('email')}
                                    className="p-6 bg-violet-500/5 hover:bg-violet-500/10 border border-violet-500/10 hover:border-violet-500/30 rounded-[24px] cursor-pointer flex items-center justify-between transition-all duration-300 group transform hover:-translate-y-0.5 active:scale-98"
                                >
                                    <div className="space-y-1 flex-1 pr-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">✉️</span>
                                            <h4 className="text-sm font-black text-white uppercase tracking-wider group-hover:text-violet-400 transition-colors">Email Channel</h4>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                            Dispatches rich HTML visual pitches, automatically choosing between direct verified SMTP or Resend API.
                                        </p>
                                    </div>
                                    <div className="p-3 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-xl group-hover:scale-110 transition-transform flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Send All Card */}
                                <div
                                    onClick={() => handleSelect('all')}
                                    className="p-6 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10 hover:border-amber-500/30 rounded-[24px] cursor-pointer flex items-center justify-between transition-all duration-300 group transform hover:-translate-y-0.5 active:scale-98"
                                >
                                    <div className="space-y-1 flex-1 pr-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">⚡</span>
                                            <h4 className="text-sm font-black text-white uppercase tracking-wider group-hover:text-amber-400 transition-colors">Unified Dual Outreach</h4>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed">
                                            Runs both WhatsApp and Email workers concurrently for maximum penetration and follow-up capability.
                                        </p>
                                    </div>
                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                </div>
                            </>
                        )}

                        {isTracking && progress && (
                            <div className="py-10 flex flex-col space-y-6 animate-in fade-in duration-500">
                                <div className="text-center space-y-2">
                                    <h4 className="text-xl font-black text-white tracking-tight">Dispatch in Progress</h4>
                                    <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">
                                        {progress.completed + progress.failed} / {progress.dispatched} Messages Processed
                                    </p>
                                </div>

                                {/* Progress Bar */}
                                <div className="relative w-full h-4 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                    <div
                                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-500 ease-out"
                                        style={{ width: `${progress.dispatched > 0 ? ((progress.completed + progress.failed) / progress.dispatched) * 100 : 0}%` }}
                                    ></div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-3 gap-4 pt-4">
                                    <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
                                        <div className="text-2xl font-black text-white">{progress.queued}</div>
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Queued</div>
                                    </div>
                                    <div className="bg-emerald-500/10 rounded-2xl p-4 text-center border border-emerald-500/20">
                                        <div className="text-2xl font-black text-emerald-400">{progress.completed}</div>
                                        <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">Sent</div>
                                    </div>
                                    <div className="bg-rose-500/10 rounded-2xl p-4 text-center border border-rose-500/20">
                                        <div className="text-2xl font-black text-rose-400">{progress.failed}</div>
                                        <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-1">Failed</div>
                                    </div>
                                </div>

                                {progress.queued === 0 && progress.dispatched > 0 && (
                                    <div className="text-center mt-4">
                                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-xs font-black text-emerald-400 uppercase tracking-widest">
                                            ✅ Dispatch Complete
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer Close Button */}
                    {!isSubmitting && !isTracking && (
                        <div className="mt-8 pt-6 border-t border-white/5 flex">
                            <button
                                onClick={onClose}
                                className="w-full py-4 border border-white/10 hover:bg-white/5 text-slate-500 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all active:scale-95"
                            >
                                Cancel Dispatch
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default SendOutreachModal;
