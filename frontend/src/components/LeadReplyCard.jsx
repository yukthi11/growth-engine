import React, { useState, useEffect } from 'react';
import { suggestReply, sendManualReply, updateLead } from '../api/client';

const INTENT_THEMES = {
    interested: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    pricing: 'bg-amber-500/10 text-amber-400 border-amber-500/20 ring-1 ring-amber-500/30',
    inquiry: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
};

const TARGET_LABELS = {
    visibility: 'Growth & Visibility',
    footfall: 'Footfall & Events',
    partnership: 'Partnerships & Communities'
};

const isBase64 = (str) => {
    if (!str || typeof str !== 'string') return false;
    // Check for common image headers in base64
    return str.startsWith('/9j/') || str.startsWith('iVBORw0KGgo') || (str.length > 100 && /^[a-zA-Z0-9+/=]+$/.test(str.substring(0, 50)));
};

/**
 * LeadReplyCard - Actionable follow-up interface for a single lead reply.
 */
const LeadReplyCard = ({ reply, onActionComplete }) => {
    const [suggestion, setSuggestion] = useState('');
    const [replyText, setReplyText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // Auto-fetch AI suggestion on mount
    useEffect(() => {
        const fetchSuggestion = async () => {
            if (isBase64(reply.message)) {
                setReplyText('Hi, I saw you sent an image/media. How can I help you today?');
                return;
            }
            
            setIsLoading(true);
            try {
                // Use lead.id if via API, leadId if via Socket
                const id = reply.lead_id || reply.leadId;
                const data = await suggestReply(id, reply.message);
                setSuggestion(data.suggestedReply);
                setReplyText(data.suggestedReply);
            } catch (err) {
                console.error('Suggestion failed:', err);
                setReplyText('Hi, thanks for reaching out! Would you be free for a quick chat?');
            } finally {
                setIsLoading(false);
            }
        };
        fetchSuggestion();
    }, [reply.lead_id, reply.leadId, reply.message]);

    const handleSend = async () => {
        if (!replyText.trim()) return;
        setIsSending(true);
        try {
            const id = reply.lead_id || reply.leadId;
            await sendManualReply(id, replyText);
            onActionComplete(reply.id || reply.leadId);
        } catch (err) {
            console.error('Send failed:', err);
        } finally {
            setIsSending(false);
        }
    };

    const handleStatusUpdate = async (status) => {
        try {
            const id = reply.lead_id || reply.leadId;
            await updateLead(id, { status });
            onActionComplete(reply.id || reply.leadId);
        } catch (err) {
            console.error('Status update failed:', err);
        }
    };

    const messageToDisplay = isBase64(reply.message) 
        ? "[Lead sent an image or media content]" 
        : `"${reply.message}"`;

    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-[32px] p-6 premium-shadow hover:border-white/10 transition-all space-y-6 animate-in">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h4 className="text-lg font-black text-white leading-none uppercase tracking-tight truncate max-w-[200px]" title={reply.business_name}>
                        {reply.business_name}
                    </h4>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{reply.phone}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${INTENT_THEMES[reply.intent] || 'bg-white/5 text-slate-400 border-white/5'}`}>
                        {reply.intent === 'pricing' ? '⚠️ PRICING / HIGH PRIO' : reply.intent}
                    </span>
                    <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-violet-600/10 text-violet-400 border border-violet-600/20">
                        {TARGET_LABELS[reply.lead_intent] || TARGET_LABELS[reply.primaryIntent] || 'Standard Route'}
                    </span>
                </div>
            </div>

            <div className="bg-midnight/40 rounded-2xl p-4 border border-white/5 italic text-slate-400 text-sm leading-relaxed relative group">
                <div className="absolute -top-3 -left-2 bg-midnight px-2 text-slate-700 text-xs font-black italic">Lead said</div>
                {messageToDisplay}
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">AI Follow-up Strategy</span>
                    {isLoading && <span className="animate-pulse text-[10px] text-violet-400 font-bold uppercase italic">Thinking...</span>}
                </div>
                <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 min-h-[100px] transition-all resize-none"
                    placeholder="Draft your reply..."
                />
            </div>

            <div className="flex items-center justify-between pt-2">
                <div className="flex gap-2">
                    <button onClick={() => handleStatusUpdate('converted')} className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        Converted
                    </button>
                    <button onClick={() => handleStatusUpdate('ignored')} className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        Ignore
                    </button>
                </div>
                <button 
                    onClick={handleSend}
                    disabled={isSending || !replyText.trim()}
                    className="px-8 py-3 bg-white text-midnight rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-white/5 hover:scale-95 transition-all disabled:opacity-50"
                >
                    {isSending ? 'Sending...' : 'Send WhatsApp'}
                </button>
            </div>
        </div>
    );
};

export default LeadReplyCard;
