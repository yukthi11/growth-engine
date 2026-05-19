import React, { useState, useEffect, useRef } from 'react';
import { getPendingReplies, getLeadThread, suggestReply, sendManualReply, updateLead } from '../api/client';

const INTENT_THEMES = {
    interested: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    pricing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    inquiry: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    not_interested: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    unclear: 'bg-white/5 text-slate-400 border-white/10',
};

const isBase64 = (str) => {
    if (!str || typeof str !== 'string') return false;
    return str.startsWith('/9j/') || str.startsWith('iVBORw0KGgo') || (str.length > 200 && /^[a-zA-Z0-9+/=]+$/.test(str.substring(0, 60)));
};

/**
 * ReplyInbox — Two-pane threaded Chat Hub.
 * Left: one card per lead (grouped, no duplicates).
 * Right: full conversation thread + AI reply input.
 */
const ReplyInbox = ({ companyId, socket }) => {
    const [leads, setLeads] = useState([]);           // Unique leads with pending replies
    const [selectedLead, setSelectedLead] = useState(null);
    const [thread, setThread] = useState([]);          // Full conversation for selected lead
    const [replyText, setReplyText] = useState('');
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [isLoadingThread, setIsLoadingThread] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const threadEndRef = useRef(null);

    // ─── Load lead list ────────────────────────────────────────
    useEffect(() => {
        if (!companyId) return;
        fetchLeadList();
    }, [companyId]);

    // ─── Real-time: add new lead to list on socket event ──────
    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            setLeads(prev => {
                const exists = prev.find(l => l.lead_id === data.leadId);
                if (exists) {
                    // update the preview message
                    return prev.map(l => l.lead_id === data.leadId
                        ? { ...l, latest_message: data.message, latest_intent: data.intent }
                        : l
                    );
                }
                return [{
                    lead_id: data.leadId,
                    business_name: data.businessName,
                    phone: data.phone,
                    email_address: data.emailAddress,
                    latest_message: data.message,
                    latest_intent: data.intent,
                    reply_count: 1,
                }, ...prev];
            });
            // If this lead is currently selected, refresh the thread
            setSelectedLead(prev => {
                if (prev?.lead_id === data.leadId) {
                    fetchThread(data.leadId);
                }
                return prev;
            });
        };
        socket.on('new_reply', handler);
        return () => socket.off('new_reply', handler);
    }, [socket]);

    // ─── Auto-scroll to bottom when thread updates ────────────
    useEffect(() => {
        threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [thread]);

    const fetchLeadList = async () => {
        setIsLoadingList(true);
        try {
            const data = await getPendingReplies(companyId);
            // Group by lead_id → keep one card per lead, latest message as preview
            const map = new Map();
            data.forEach(r => {
                if (!map.has(r.lead_id)) {
                    map.set(r.lead_id, {
                        lead_id: r.lead_id,
                        business_name: r.business_name,
                        phone: r.phone,
                        email_address: r.email_address,
                        latest_message: r.message,
                        latest_intent: r.intent,
                        reply_count: 1,
                    });
                } else {
                    map.get(r.lead_id).reply_count++;
                    // Use the most-recent message preview (data comes DESC)
                }
            });
            setLeads([...map.values()]);
        } catch (err) {
            console.error('[Inbox] Load failed:', err);
        } finally {
            setIsLoadingList(false);
        }
    };

    const fetchThread = async (leadId) => {
        setIsLoadingThread(true);
        setThread([]);
        try {
            const data = await getLeadThread(leadId);
            setThread(data);
        } catch (err) {
            console.error('[Thread] Load failed:', err);
        } finally {
            setIsLoadingThread(false);
        }
    };

    const handleSelectLead = async (lead) => {
        setSelectedLead(lead);
        setReplyText('');
        await fetchThread(lead.lead_id);
        // Auto-generate AI suggestion from latest inbound message
        generateSuggestion(lead);
    };

    const generateSuggestion = async (lead) => {
        if (!lead?.latest_message || isBase64(lead.latest_message)) {
            setReplyText('Hi, I saw you sent something over. How can I help?');
            return;
        }
        setIsGenerating(true);
        try {
            const data = await suggestReply(lead.lead_id, lead.latest_message);
            setReplyText(data.suggestedReply || '');
        } catch {
            setReplyText('Hi, thanks for reaching out! Would you be free for a quick chat?');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSend = async () => {
        if (!replyText.trim() || !selectedLead) return;
        setIsSending(true);
        try {
            await sendManualReply(selectedLead.lead_id, replyText);
            setReplyText('');
            // Refresh thread to show the sent message
            await fetchThread(selectedLead.lead_id);
        } catch (err) {
            console.error('[Send] Failed:', err);
        } finally {
            setIsSending(false);
        }
    };

    const handleAction = async (status) => {
        if (!selectedLead) return;
        try {
            await updateLead(selectedLead.lead_id, { status });
            setLeads(prev => prev.filter(l => l.lead_id !== selectedLead.lead_id));
            setSelectedLead(null);
            setThread([]);
        } catch (err) {
            console.error('[Action] Failed:', err);
        }
    };

    // ── Render ─────────────────────────────────────────────────
    return (
        <div className="flex h-[680px] rounded-[40px] overflow-hidden border border-white/5 bg-white/[0.02] premium-shadow">

            {/* ── LEFT PANE: Lead List ── */}
            <div className="w-72 flex-shrink-0 border-r border-white/5 flex flex-col">
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight">Intervention Queue</h3>
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-0.5">
                            {leads.length} lead{leads.length !== 1 && 's'} pending
                        </p>
                    </div>
                    {leads.length > 0 && (
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                        </span>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isLoadingList ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="h-8 w-8 border-[3px] border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></div>
                        </div>
                    ) : leads.length === 0 ? (
                        <div className="px-6 py-20 text-center">
                            <div className="text-4xl mb-3">⚡</div>
                            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Perimeter Secure</p>
                        </div>
                    ) : (
                        leads.map(lead => (
                            <button
                                key={lead.lead_id}
                                onClick={() => handleSelectLead(lead)}
                                className={`w-full text-left px-5 py-4 border-b border-white/5 transition-all hover:bg-white/5 ${selectedLead?.lead_id === lead.lead_id ? 'bg-violet-600/10 border-l-2 border-l-violet-500' : ''}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-black text-white truncate max-w-[140px]">{lead.business_name}</span>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest ${INTENT_THEMES[lead.latest_intent] || INTENT_THEMES.unclear}`}>
                                        {lead.latest_intent || 'unclear'}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium truncate">
                                    {isBase64(lead.latest_message) ? '[Media]' : lead.latest_message}
                                </p>
                                {lead.reply_count > 1 && (
                                    <span className="text-[9px] text-violet-400 font-black uppercase tracking-widest mt-1 inline-block">
                                        {lead.reply_count} messages
                                    </span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* ── RIGHT PANE: Chat Thread ── */}
            <div className="flex-1 flex flex-col min-w-0">
                {!selectedLead ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-10">
                        <div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center border border-white/5 text-2xl">💬</div>
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Select a conversation</p>
                        <p className="text-[10px] text-slate-700 font-bold">Click a lead on the left to open their full chat history</p>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="px-8 py-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between flex-shrink-0">
                            <div>
                                <h4 className="text-base font-black text-white tracking-tight">{selectedLead.business_name}</h4>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedLead.phone}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleAction('converted')}
                                    className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Converted
                                </button>
                                <button
                                    onClick={() => handleAction('ignored')}
                                    className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Ignore
                                </button>
                            </div>
                        </div>

                        {/* Chat Bubbles */}
                        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
                            {isLoadingThread ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="h-8 w-8 border-[3px] border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></div>
                                </div>
                            ) : thread.length === 0 ? (
                                <div className="text-center py-16 text-slate-600 text-sm font-bold">No messages yet</div>
                            ) : (
                                thread.map((msg, idx) => {
                                    const isSent = msg.type === 'sent';
                                    const text = isBase64(msg.text) ? '[Media content]' : msg.text;
                                    return (
                                        <div key={idx} className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] rounded-[20px] px-5 py-3 space-y-1 ${isSent
                                                    ? 'bg-violet-600/20 border border-violet-500/20 rounded-br-md'
                                                    : 'bg-white/5 border border-white/10 rounded-bl-md'
                                                }`}>
                                                <p className="text-sm text-white font-medium leading-relaxed">{text}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] text-slate-500 font-bold">
                                                        {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                    </span>
                                                    {!isSent && msg.intent && msg.intent !== 'unclear' && (
                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${INTENT_THEMES[msg.intent] || INTENT_THEMES.unclear}`}>
                                                            {msg.intent}
                                                        </span>
                                                    )}
                                                    {isSent && (
                                                        <span className="text-[9px] text-violet-400 font-black uppercase">{msg.channel}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={threadEndRef} />
                        </div>

                        {/* Reply Input */}
                        <div className="px-8 py-5 border-t border-white/5 bg-white/[0.02] flex-shrink-0">
                            {isGenerating && (
                                <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-3 animate-pulse">AI drafting reply...</p>
                            )}
                            <div className="flex gap-3">
                                <textarea
                                    rows="3"
                                    value={replyText}
                                    onChange={e => setReplyText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                                    placeholder="Type a reply or edit the AI draft... (Enter to send)"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/40 placeholder:text-slate-700 resize-none transition-all"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={isSending || !replyText.trim()}
                                    className="px-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 self-end pb-3 pt-3"
                                >
                                    {isSending ? '...' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ReplyInbox;
