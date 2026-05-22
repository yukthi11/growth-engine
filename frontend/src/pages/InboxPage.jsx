import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getPendingReplies, getLeadThread, sendManualReply, updateLead, draftEmail, getCompany } from '../api/client';
import axios from 'axios';
import { io } from 'socket.io-client';

// ─── Constants ────────────────────────────────────────────────
const API = 'http://127.0.0.1:5000';

const INTENT_STYLE = {
    interested: { label: 'Interested', bg: 'rgba(16,185,129,0.12)', color: '#34D399', border: 'rgba(16,185,129,0.25)' },
    pricing: { label: 'Pricing', bg: 'rgba(245,158,11,0.12)', color: '#FBBF24', border: 'rgba(245,158,11,0.25)' },
    inquiry: { label: 'Inquiry', bg: 'rgba(6,182,212,0.12)', color: '#22D3EE', border: 'rgba(6,182,212,0.25)' },
    not_interested: { label: 'Not Interested', bg: 'rgba(239,68,68,0.12)', color: '#F87171', border: 'rgba(239,68,68,0.25)' },
    unclear: { label: 'Unclear', bg: 'rgba(100,116,139,0.12)', color: '#94A3B8', border: 'rgba(100,116,139,0.2)' },
};

const isBase64 = (str) => {
    if (!str || typeof str !== 'string') return false;
    return str.startsWith('/9j/') || str.startsWith('iVBORw0KGgo') ||
        (str.length > 200 && /^[a-zA-Z0-9+/=]+$/.test(str.substring(0, 60)));
};

const relativeTime = (ts) => {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

// ─── Sub-components ───────────────────────────────────────────

const IntentBadge = ({ intent }) => {
    const s = INTENT_STYLE[intent] || INTENT_STYLE.unclear;
    return (
        <span style={{
            background: s.bg, color: s.color, border: `1px solid ${s.border}`,
            borderRadius: '999px', fontSize: '9px', fontWeight: 900,
            padding: '2px 8px', letterSpacing: '0.08em', textTransform: 'uppercase',
            whiteSpace: 'nowrap',
        }}>
            {s.label}
        </span>
    );
};

const LeadListItem = ({ lead, selected, onClick, hasUnread }) => (
    <button
        onClick={onClick}
        style={{
            width: '100%', textAlign: 'left',
            padding: '14px 18px',
            background: selected ? 'rgba(124,58,237,0.10)' : 'transparent',
            borderLeft: selected ? '3px solid #7C3AED' : '3px solid transparent',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            transition: 'all 0.15s',
            cursor: 'pointer',
        }}
        onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
        onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                {hasUnread && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7C3AED', flexShrink: 0 }} />
                )}
                <span style={{
                    color: '#F1F5F9', fontWeight: 900, fontSize: 13,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: 160,
                }}>
                    {lead.business_name}
                </span>
            </div>
            <span style={{ color: '#475569', fontSize: 10, flexShrink: 0, paddingTop: 1 }}>
                {relativeTime(lead.latest_at)}
            </span>
        </div>
        <p style={{
            color: '#64748B', fontSize: 11, margin: '4px 0',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
            {isBase64(lead.latest_message) ? '[Media]' : ((lead.latest_message || '').replace(/{{mockup_url}}/g, '').trim() || (lead.email_address ? `Email: ${lead.email_address}` : 'No messages yet'))}
        </p>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <IntentBadge intent={lead.latest_intent} />
            {lead.has_failed_delivery && (
                <span style={{
                    background: 'rgba(239,68,68,0.12)',
                    color: '#F87171',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: '999px',
                    fontSize: '9px',
                    fontWeight: 900,
                    padding: '2px 8px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                }}>
                    delivery failed
                </span>
            )}
            {lead.reply_count > 1 && (
                <span style={{ color: '#7C3AED', fontSize: 9, fontWeight: 900 }}>
                    {lead.reply_count} msgs
                </span>
            )}
        </div>
        {lead.has_failed_delivery && lead.latest_failed_reason && (
            <p style={{
                color: '#FCA5A5',
                fontSize: 10,
                margin: '4px 0 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}>
                Reason: {lead.latest_failed_reason}
            </p>
        )}
    </button>
);

const MessageBubble = ({ msg }) => {
    const isSent = msg.type === 'sent';
    const text = isBase64(msg.text) ? '[Lead sent an image]' : (msg.text || '').replace(/{{mockup_url}}/g, '').trim();

    if (msg.type === 'system') {
        return (
            <div style={{ textAlign: 'center', margin: '8px 0' }}>
                <span style={{ color: '#475569', fontSize: 10, fontWeight: 700 }}>{text}</span>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', justifyContent: isSent ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{ maxWidth: '72%' }}>
                <div style={{
                    background: isSent ? '#1E1040' : '#13131A',
                    border: `1px solid ${isSent ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: isSent ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    padding: '10px 14px',
                }}>
                    <p style={{ color: '#E2E8F0', fontSize: 13, lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>
                        {text}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, justifyContent: isSent ? 'flex-end' : 'flex-start' }}>
                    <span style={{
                        color: msg.channel === 'whatsapp' ? '#10B981' : '#6366F1',
                        fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                        background: msg.channel === 'whatsapp' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                        padding: '1px 5px', borderRadius: 4, letterSpacing: '0.04em'
                    }}>
                        {msg.channel || 'whatsapp'}
                    </span>
                    <span style={{ color: '#475569', fontSize: 10 }}>
                        {isSent ? '🤖 Devi' : '👤'}
                        {' · '}{new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                    {!isSent && msg.intent && msg.intent !== 'unclear' && <IntentBadge intent={msg.intent} />}
                </div>
            </div>
        </div>
    );
};

// ─── Main InboxPage ───────────────────────────────────────────
const InboxPage = ({ companyId, socket: externalSocket, initialLead, onLeadChange, onOpenDraftModal, campaignId, campaigns }) => {
    const [filter, setFilter] = useState('all'); // all | replied | flagged
    const [leads, setLeads] = useState([]);
    const [channel, setChannel] = useState('whatsapp'); // whatsapp | email
    const [unreadIds, setUnreadIds] = useState(new Set());
    const [selectedLead, setSelectedLead] = useState(null);
    const [thread, setThread] = useState([]);
    const [draft, setDraft] = useState('');
    const [draftText, setDraftText] = useState('');
    const [subjectText, setSubjectText] = useState('');
    const [emailPreviewData, setEmailPreviewData] = useState(null);
    const [leadData, setLeadData] = useState(null); // Full lead record incl. mockup_url, gap_pillar
    const [mockupPreviewUrl, setMockupPreviewUrl] = useState(null);
    const [isMockupLoading, setIsMockupLoading] = useState(false); // { subject, body, mockupUrl }
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [isLoadingThread, setIsLoadingThread] = useState(false);
    const [isDraftLoading, setIsDraftLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [toast, setToast] = useState(null);
    const [showLeadInfo, setShowLeadInfo] = useState(false);
    const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
    const [company, setCompany] = useState(null);
    const threadEndRef = useRef(null);
    const textareaRef = useRef(null);

    // ── Auto-scroll ────────────────────────────────────────────
    useEffect(() => { threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread]);

    // ── Auto-resize textarea ───────────────────────────────────
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [draftText]);

    // ── Load lead list ─────────────────────────────────────────
    useEffect(() => {
        if (!companyId) return;
        fetchLeadList();
        fetchCompany();
    }, [companyId]);

    const fetchCompany = async () => {
        try {
            const data = await getCompany(companyId);
            setCompany(data);
        } catch (err) {
            console.error('Failed to fetch company:', err);
        }
    };

    // ── Handle Initial Lead ────────────────────────────────────
    useEffect(() => {
        if (initialLead && !isLoadingList) {
            const lId = initialLead.id || initialLead.lead_id;
            // BREAK LOOP: Only select if not already selected
            if (selectedLead?.lead_id === lId) return;

            const exists = leads.find(l => l.lead_id === lId);
            if (exists) {
                handleSelectLead(exists);
            } else {
                const tempLead = {
                    lead_id: lId,
                    business_name: initialLead.business_name,
                    phone: initialLead.phone,
                    email_address: initialLead.email_address,
                    latest_message: 'Start outreach',
                    latest_intent: 'unclear',
                    latest_at: new Date().toISOString(),
                    reply_count: 0
                };
                setLeads(prev => [tempLead, ...prev]);
                handleSelectLead(tempLead);
            }
        }
    }, [initialLead, isLoadingList]);

    const fetchDraft = useCallback(async (lead) => {
        if (!lead) return;
        setIsDraftLoading(true);
        setDraft('');
        try {
            const res = await axios.post(`${API}/leads/${lead.lead_id}/suggest-reply`, {});
            setDraft((res.data.suggestedReply || '').replace(/{{mockup_url}}/g, '').trim());
        } catch {
            setDraft('Hi! Would you be free for a quick call to discuss this further?');
        } finally {
            setIsDraftLoading(false);
        }
    }, [companyId]);

    // ── Socket real-time ───────────────────────────────────────
    useEffect(() => {
        if (!externalSocket) return;
        const handler = (data) => {
            setLeads(prev => {
                const exists = prev.find(l => l.lead_id === data.leadId);
                const updated = exists
                    ? prev.map(l => l.lead_id === data.leadId
                        ? { ...l, latest_message: data.message, latest_intent: data.intent, latest_at: data.repliedAt, reply_count: (l.reply_count || 1) + 1 }
                        : l)
                    : [{
                        lead_id: data.leadId,
                        business_name: data.businessName,
                        phone: data.phone,
                        email_address: data.emailAddress,
                        latest_message: data.message,
                        latest_intent: data.intent,
                        latest_at: data.repliedAt,
                        reply_count: 1
                    }, ...prev];
                return updated;
            });

            setSelectedLead(current => {
                if (current?.lead_id === data.leadId) {
                    setThread(prev => {
                        // PREVENT DUPLICATES: Check if this message ID (or text+timestamp combo) is already in thread
                        const exists = prev.some(m => (m.id && m.id === data.id) || (m.timestamp === data.repliedAt && m.text === data.message));
                        if (exists) return prev;

                        return [...prev, {
                            id: data.id,
                            type: 'received', text: data.message,
                            timestamp: data.repliedAt, intent: data.intent,
                        }];
                    });
                    // Mark as unread
                    setUnreadIds(s => new Set([...s, data.leadId]));
                    showToast(`${data.businessName} just replied`);
                }
                return current;
            });
        };
        externalSocket.on('new_reply', handler);
        return () => externalSocket.off('new_reply', handler);
    }, [externalSocket, fetchDraft]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3500);
    };

    const fetchLeadList = async () => {
        setIsLoadingList(true);
        try {
            const data = await getPendingReplies(companyId);
            // The API now returns unique leads with aggregated stats
            const processedLeads = data.map(r => ({
                lead_id: r.lead_id, 
                business_name: r.business_name,
                phone: r.phone, 
                email_address: r.email_address,
                latest_message: r.message,
                latest_intent: r.intent || 'unclear', 
                latest_at: r.created_at,
                reply_count: r.reply_count || 1, 
                lead_status: r.lead_status,
                has_failed_delivery: !!r.has_failed_delivery,
                latest_failed_reason: r.latest_failed_reason || '',
            }));
            setLeads(processedLeads);
        } catch (err) {
            console.error('[InboxPage] fetchLeadList failed:', err);
        } finally {
            setIsLoadingList(false);
        }
    };

    const fetchThread = async (leadId) => {
        setIsLoadingThread(true);
        setThread([]);
        try {
            // 1. Pull existing history from DB
            const data = await getLeadThread(leadId);
            setThread(data);

            // 2. TRIGGER LIVE SYNC (Background)
            // This pulls in any 'lost' history from WhatsApp for THIS specific lead only
            const syncRes = await axios.post(`${API}/replies/sync/${leadId}`);
            if (syncRes.data.success && syncRes.data.history.length > 0) {
                // Return fresh thread if new messages were found
                const fresh = await getLeadThread(leadId);
                setThread(fresh);
            }
        } catch (err) {
            console.error('[InboxPage] sync/thread failed:', err);
        } finally {
            setIsLoadingThread(false);
        }
    };

    const handleSelectLead = useCallback(async (lead) => {
        setSelectedLead(lead);
        if (onLeadChange) onLeadChange(lead);
        setShowLeadInfo(false);
        setDraftText(''); // Clear draft when switching leads
        setEmailPreviewData(null); // Clear email preview when switching leads
        setMockupPreviewUrl(null);
        setLeadData(null);
        setUnreadIds(s => { const n = new Set(s); n.delete(lead.lead_id); return n; });
        await fetchThread(lead.lead_id);
        setSubjectText(''); // Clear old subject
        // Default channel to email if no phone, or whatsapp if available
        if (!lead.phone && lead.email_address) setChannel('email');
        else setChannel('whatsapp');

        // Fetch full lead data — then auto-generate mockup for Presence leads
        try {
            const fullRes = await axios.get(`${API}/leads/${lead.lead_id}`);
            const full = fullRes.data;
            setLeadData(full);
            if (full.gap_pillar === 'presence') {
                setIsMockupLoading(true);
                const mockRes = await axios.post(`${API}/leads/${lead.lead_id}/generate-mockup`);
                setMockupPreviewUrl(mockRes.data.mockup_url || null);
            }
        } catch (e) {
            console.warn('[InboxPage] Could not fetch/generate mockup:', e.message);
        } finally {
            setIsMockupLoading(false);
        }
    }, [onLeadChange]);

    const handleSend = async () => {
        if (!draftText.trim() || !selectedLead || isSending) return;
        const msgText = draftText.trim();
        setIsSending(true);

        // Optimistic update
        const optimistic = { type: 'sent', text: msgText, timestamp: new Date().toISOString(), status: 'sending', channel };
        setThread(prev => [...prev, optimistic]);
        setDraftText('');

        try {
            await sendManualReply(selectedLead.lead_id, msgText, channel, subjectText, channel === 'whatsapp' ? mockupPreviewUrl : null);
            setSubjectText('');
            // Refresh thread to confirm
            await fetchThread(selectedLead.lead_id);
            // Pre-load next AI draft
            fetchDraft(selectedLead);
        } catch (err) {
            console.error('[InboxPage] send failed:', err);
            setThread(prev => prev.filter(m => m !== optimistic));
            setDraftText(msgText); // restore
            showToast(`Failed to send ${channel}.`);
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
            console.error('[InboxPage] action failed:', err);
        }
    };

    // ── Filter leads ───────────────────────────────────────────
    const filteredLeads = leads.filter(l => {
        if (filter === 'replied') return l.lead_status === 'replied';
        if (filter === 'flagged') return ['interested', 'pricing'].includes(l.latest_intent);
        return true;
    });

    // ─────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────
    return (
        <div style={{ display: 'flex', width: '100%', height: '100%', maxHeight: '100%', background: '#0A0A0F', position: 'relative', overflow: 'hidden', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)' }}>

            {/* ── Toast ─────────────────────────────────────────── */}
            {toast && (
                <div style={{
                    position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
                    background: '#1A1A2E', border: '1px solid rgba(124,58,237,0.4)',
                    color: '#E2E8F0', borderRadius: 12, padding: '10px 20px',
                    fontSize: 12, fontWeight: 700, zIndex: 9999,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    animation: 'fadeIn 0.2s ease',
                }}>
                    💬 {toast}
                </div>
            )}

            {/* ══════════════════════════════════════════════════
                LEFT PANEL
            ══════════════════════════════════════════════════ */}
            <div style={{
                width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column',
                background: '#13131A', borderRight: '1px solid rgba(255,255,255,0.06)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{ padding: '16px 18px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <h2 style={{ color: '#F1F5F9', fontWeight: 900, fontSize: 16, margin: 0, letterSpacing: '-0.02em' }}>
                                Inbox
                            </h2>
                            {leads.length > 0 && (
                                <span style={{
                                    background: '#7C3AED', color: '#fff', borderRadius: '999px',
                                    fontSize: 10, fontWeight: 900, padding: '2px 8px', minWidth: 20, textAlign: 'center',
                                }}>
                                    {leads.length}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => onOpenDraftModal && onOpenDraftModal()}
                            style={{
                                background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
                                color: '#7C3AED', fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                                padding: '5px 10px', borderRadius: 8, cursor: 'pointer', letterSpacing: '0.05em'
                            }}
                        >
                            Bulk message
                        </button>
                    </div>

                    {/* Filter Tabs */}
                    <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3 }}>
                        {['all', 'replied', 'flagged'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                style={{
                                    flex: 1, padding: '5px 0', borderRadius: 8, fontSize: 10,
                                    fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em',
                                    background: filter === f ? '#7C3AED' : 'transparent',
                                    color: filter === f ? '#fff' : '#64748B',
                                    cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                                }}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lead List */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {isLoadingList ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                            <div style={{ width: 28, height: 28, border: '3px solid rgba(124,58,237,0.2)', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        </div>
                    ) : filteredLeads.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
                            <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
                            <p style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                {filter === 'all' ? 'No active conversations' : `No ${filter} leads`}
                            </p>
                        </div>
                    ) : (
                        filteredLeads.map(lead => (
                            <LeadListItem
                                key={lead.lead_id}
                                lead={lead}
                                selected={selectedLead?.lead_id === lead.lead_id}
                                hasUnread={unreadIds.has(lead.lead_id)}
                                onClick={() => handleSelectLead(lead)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════
                RIGHT PANEL
            ══════════════════════════════════════════════════ */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                {!selectedLead ? (
                    /* Empty state */
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                        <div style={{
                            width: 64, height: 64, background: 'rgba(124,58,237,0.08)',
                            border: '1px solid rgba(124,58,237,0.15)', borderRadius: 20,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                        }}>💬</div>
                        <p style={{ color: '#64748B', fontSize: 13, fontWeight: 700 }}>Select a conversation to begin</p>
                        <p style={{ color: '#334155', fontSize: 11 }}>AI-drafted replies are generated automatically</p>
                    </div>
                ) : (
                    <>
                        {/* ── Conversation Header ────────────────────────── */}
                        <div style={{
                            padding: '10px 24px', background: '#13131A',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                        }}>
                            <div>
                                <h3 style={{ color: '#F1F5F9', fontWeight: 900, fontSize: 15, margin: 0 }}>
                                    {selectedLead.business_name}
                                </h3>
                                <p style={{ color: '#475569', fontSize: 11, margin: '2px 0 0' }}>
                                    {selectedLead.phone}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <IntentBadge intent={selectedLead.latest_intent} />
                                <button onClick={() => handleAction('converted')} style={{
                                    padding: '6px 14px', borderRadius: 10, fontSize: 10, fontWeight: 900,
                                    border: '1px solid rgba(16,185,129,0.35)', color: '#34D399',
                                    background: 'rgba(16,185,129,0.08)', cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
                                }}>
                                    Converted
                                </button>
                                <button onClick={() => handleAction('ignored')} style={{
                                    padding: '6px 14px', borderRadius: 10, fontSize: 10, fontWeight: 900,
                                    border: '1px solid rgba(239,68,68,0.3)', color: '#F87171',
                                    background: 'rgba(239,68,68,0.08)', cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
                                }}>
                                    Ignore
                                </button>
                                <button onClick={() => setShowLeadInfo(s => !s)} style={{
                                    padding: '6px 14px', borderRadius: 10, fontSize: 10, fontWeight: 900,
                                    border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8',
                                    background: showLeadInfo ? 'rgba(255,255,255,0.07)' : 'transparent', cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
                                }}>
                                    Lead Info
                                </button>
                            </div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* ── Thread ──────────────────────────────────── */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

                                {/* Visual Proof Preview Card — shown for all Presence leads */}
                                {(mockupPreviewUrl || isMockupLoading) && (
                                    <div style={{
                                        marginBottom: 20, borderRadius: 14, overflow: 'hidden',
                                        border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)'
                                    }}>
                                        <div style={{
                                            padding: '10px 14px', display: 'flex', alignItems: 'center',
                                            justifyContent: 'space-between',
                                            borderBottom: '1px solid rgba(99,102,241,0.15)', background: 'rgba(99,102,241,0.08)'
                                        }}>
                                            <span style={{ fontSize: 9, fontWeight: 900, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                🖼 Visual Proof Mockup
                                            </span>
                                            {mockupPreviewUrl && (
                                                <button
                                                    onClick={() => { navigator.clipboard.writeText(mockupPreviewUrl); showToast('Mockup URL copied!'); }}
                                                    style={{ background: 'none', border: '1px solid rgba(99,102,241,0.3)', color: '#818CF8', fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 6, cursor: 'pointer' }}
                                                >Copy URL</button>
                                            )}
                                        </div>
                                        {isMockupLoading ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '20px 16px' }}>
                                                <div style={{ width: 18, height: 18, border: '2px solid rgba(99,102,241,0.2)', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                                <span style={{ fontSize: 11, color: '#475569', fontWeight: 700 }}>Generating mockup…</span>
                                            </div>
                                        ) : (
                                            <div>
                                                {/* Browser chrome bar */}
                                                <div style={{ background: '#F1F5F9', borderBottom: '1px solid rgba(99,102,241,0.15)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ display: 'flex', gap: 5 }}>
                                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
                                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
                                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                                                    </div>
                                                    <div style={{ flex: 1, background: '#fff', border: '1px solid #CBD5E1', borderRadius: 5, padding: '2px 8px', fontSize: 9, color: '#64748B', fontWeight: 600 }}>
                                                        {selectedLead.business_name?.toLowerCase().replace(/\s+/g, '-')}.in
                                                    </div>
                                                </div>
                                                <img
                                                    src={mockupPreviewUrl}
                                                    alt="Website Mockup"
                                                    style={{ width: '100%', display: 'block', maxHeight: 240, objectFit: 'cover', objectPosition: 'top' }}
                                                    onError={e => { e.target.style.display = 'none'; }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {isLoadingThread ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
                                        <div style={{ width: 28, height: 28, border: '3px solid rgba(124,58,237,0.2)', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    </div>
                                ) : (() => {
                                    const filtered = thread.filter(msg => {
                                        if (msg.type === 'system') return true;
                                        const msgChannel = msg.channel || 'whatsapp';
                                        return msgChannel === channel;
                                    });

                                    if (filtered.length === 0) {
                                        return (
                                            <div style={{ textAlign: 'center', color: '#334155', fontSize: 12, paddingTop: 60 }}>
                                                No {channel} history yet — start the outreach below
                                            </div>
                                        );
                                    }

                                    return filtered.map((msg, i) => <MessageBubble key={i} msg={msg} />);
                                })()}
                                <div ref={threadEndRef} />
                            </div>

                            {/* ── Lead Info Drawer ─────────────────────────── */}
                            {showLeadInfo && (
                                <div style={{
                                    width: 260, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)',
                                    background: '#13131A', overflowY: 'auto', padding: 20,
                                }}>
                                    <h4 style={{ color: '#94A3B8', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16 }}>
                                        Lead Signals
                                    </h4>
                                    {[
                                        ['Phone', selectedLead.phone],
                                        ['Email', selectedLead.email_address],
                                        ['Status', selectedLead.lead_status],
                                        ['Intent', selectedLead.latest_intent],
                                        ['Messages', selectedLead.reply_count || 0],
                                    ].map(([k, v]) => (
                                        <div key={k} style={{ marginBottom: 14 }}>
                                            <p style={{ color: '#475569', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 3px' }}>{k}</p>
                                            <p style={{ color: '#CBD5E1', fontSize: 11, fontWeight: 700, margin: 0, wordBreak: 'break-all' }}>{v || '—'}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Send Bar ─────────────────────────────────────── */}
                        <div style={{
                            padding: '12px 24px 14px', background: '#13131A',
                            borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
                        }}>
                            {/* Toolbar: AI + Channels */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ color: '#64748B', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        {isDraftLoading ? '✨ AI...' : '✨ AI Draft'}
                                    </span>
                                    {draft && !draftText && (
                                        <button
                                            onClick={() => setDraftText(draft.replace(/{{mockup_url}}/g, '').trim())}
                                            style={{
                                                background: 'rgba(124,58,237,0.1)', color: '#7C3AED',
                                                border: '1px solid rgba(124,58,237,0.2)', padding: '2px 8px', borderRadius: 6,
                                                fontSize: 9, fontWeight: 900, cursor: 'pointer'
                                            }}
                                        >
                                            USE DRAFT
                                        </button>
                                    )}
                                    <button onClick={() => fetchDraft(selectedLead)} disabled={isDraftLoading} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}>
                                        Regenerate
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (!selectedLead || isDraftLoading) return;
                                            setIsDraftLoading(true);
                                            try {
                                                if (channel === 'email') {
                                                    const res = await draftEmail(selectedLead.lead_id);
                                                    if (res.body) setDraftText(res.body);
                                                    if (res.subject) setSubjectText(res.subject);
                                                    // Use the explicitly returned mockup_url (much more reliable than regexing the body)
                                                    setEmailPreviewData({ subject: res.subject, body: res.body, mockupUrl: res.mockup_url || null });
                                                } else {
                                                    const res = await axios.post(`${API}/leads/${selectedLead.lead_id}/suggest-reply`, {});
                                                    if (res.data.suggestedReply) setDraftText(res.data.suggestedReply.replace(/{{mockup_url}}/g, '').trim());
                                                }
                                            } catch (err) {
                                                console.error('Draft generation failed:', err);
                                                showToast(`Failed to generate ${channel} draft.`);
                                            } finally {
                                                setIsDraftLoading(false);
                                            }
                                        }}
                                        disabled={isDraftLoading}
                                        style={{
                                            background: channel === 'whatsapp' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                                            border: `1px solid ${channel === 'whatsapp' ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)'}`,
                                            color: channel === 'whatsapp' ? '#10B981' : '#6366F1',
                                            fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 6, cursor: 'pointer'
                                        }}
                                    >
                                        {isDraftLoading ? '✨ Drafting...' : channel === 'whatsapp' ? 'Draft WhatsApp' : '✉️ Draft Full Email'}
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    {['whatsapp', 'email'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setChannel(c)}
                                            style={{
                                                padding: '4px 8px', fontSize: 9, fontWeight: 900, borderRadius: 7, border: 'none', cursor: 'pointer',
                                                background: channel === c ? (c === 'whatsapp' ? '#10B981' : '#6366F1') : 'transparent',
                                                color: channel === c ? '#fff' : '#64748B', textTransform: 'uppercase'
                                            }}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── EMAIL PREVIEW MODE ─────────────────────────── */}
                            {channel === 'email' && emailPreviewData ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {/* Header label + dismiss */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 9, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>📧 Email Preview — What the recipient sees</span>
                                        <button
                                            onClick={() => { setEmailPreviewData(null); setDraftText(''); setSubjectText(''); }}
                                            style={{ background: 'none', border: 'none', color: '#475569', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}
                                        >✕ Close</button>
                                    </div>

                                    {/* Email card */}
                                    <div style={{
                                        background: '#F9FAFB', borderRadius: 14, overflow: 'hidden',
                                        border: '1px solid rgba(255,255,255,0.1)', maxHeight: 420, overflowY: 'auto'
                                    }}>
                                        {/* Email header */}
                                        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E5E7EB', background: '#fff' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <span style={{ fontSize: 11, color: '#6B7280' }}>From:</span>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{company?.name || 'Yukthi'} &lt;{company?.email || 'hello@growth.co'}&gt;</span>
                                                <span style={{ fontSize: 11, color: '#6B7280', margin: '0 4px' }}>·</span>
                                                <span style={{ fontSize: 11, color: '#6B7280' }}>To:</span>
                                                <span style={{ fontSize: 11, color: '#111827', fontWeight: 600 }}>{selectedLead.email_address || 'owner@business.in'}</span>
                                                <span style={{
                                                    background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0',
                                                    borderRadius: 999, fontSize: 9, fontWeight: 900, padding: '1px 8px', letterSpacing: '0.06em'
                                                }}>Personalised</span>
                                            </div>
                                            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{emailPreviewData.subject || subjectText}</div>
                                        </div>

                                        {/* Email body */}
                                        <div style={{ padding: '20px 18px', background: '#fff', fontFamily: 'Georgia, serif' }}>
                                            {(() => {
                                                const bodyText = emailPreviewData.body || '';
                                                // Use the explicitly-returned mockup URL (not parsed from body text)
                                                const imgUrl = emailPreviewData.mockupUrl || null;
                                                // Strip the raw URL from body text so it doesn't show as a plain string
                                                const cleanBody = imgUrl ? bodyText.replace(imgUrl, '').replace(/\n{3,}/g, '\n\n').trim() : bodyText;
                                                const paragraphs = cleanBody.split('\n').filter(p => p.trim());

                                                return (
                                                    <>
                                                        {paragraphs.map((p, i) => {
                                                            if (imgUrl && p.trim() === '') return null;
                                                            return (
                                                                <p key={i} style={{
                                                                    fontSize: 13.5, color: '#1F2937', lineHeight: 1.7,
                                                                    margin: '0 0 12px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                                                                }}>{p}</p>
                                                            );
                                                        })}

                                                        {imgUrl && (
                                                            <div style={{
                                                                margin: '16px 0', borderRadius: 10, overflow: 'hidden',
                                                                border: '1px solid #E5E7EB', background: '#F3F4F6'
                                                            }}>
                                                                {/* Fake browser chrome */}
                                                                <div style={{
                                                                    background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
                                                                    padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8
                                                                }}>
                                                                    <div style={{ display: 'flex', gap: 5 }}>
                                                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
                                                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} />
                                                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
                                                                    </div>
                                                                    <div style={{
                                                                        flex: 1, background: '#fff', border: '1px solid #D1D5DB',
                                                                        borderRadius: 6, padding: '3px 10px', fontSize: 10, color: '#6B7280'
                                                                    }}>{selectedLead.business_name?.toLowerCase().replace(/\s+/g, '-')}.in</div>
                                                                </div>
                                                                <img
                                                                    src={imgUrl}
                                                                    alt="Website Mockup"
                                                                    style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'cover', objectPosition: 'top' }}
                                                                    onError={e => { e.target.style.display = 'none'; }}
                                                                />
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Send + edit actions */}
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => setEmailPreviewData(null)}
                                            style={{
                                                padding: '8px 16px', borderRadius: 10, fontSize: 10, fontWeight: 900,
                                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#94A3B8', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em'
                                            }}
                                        >✏️ Edit Draft</button>
                                        <button
                                            onClick={handleSend}
                                            disabled={isSending}
                                            style={{
                                                padding: '8px 24px', borderRadius: 10, fontSize: 10, fontWeight: 900,
                                                background: isSending ? 'rgba(255,255,255,0.05)' : '#6366F1',
                                                color: isSending ? '#475569' : '#fff',
                                                border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em'
                                            }}
                                        >{isSending ? 'Sending...' : '🚀 Send Email'}</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                {/* Subject Area for Email */}
                                {channel === 'email' && (
                                    <div style={{ marginBottom: 10 }}>
                                        <input
                                            type="text"
                                            placeholder="Subject"
                                            value={subjectText}
                                            onChange={e => setSubjectText(e.target.value)}
                                            style={{
                                                width: '100%', boxSizing: 'border-box',
                                                background: '#0A0A0F', border: '1px solid rgba(99,102,241,0.2)',
                                                borderRadius: 14, padding: '10px 16px',
                                                color: '#E2E8F0', fontSize: 13, outline: 'none', fontFamily: 'inherit',
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Textarea Area */}
                                <div style={{ position: 'relative' }}>
                                    <textarea
                                        ref={textareaRef}
                                        value={draftText || ''}
                                        onChange={e => setDraftText(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Tab' && !draftText && draft && !isDraftLoading) {
                                                e.preventDefault();
                                                setDraftText(draft);
                                            }
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        placeholder={`Reply via ${channel}... (Click Draft for AI help)`}
                                        rows={2}
                                        style={{
                                            width: '100%', boxSizing: 'border-box',
                                            background: '#0A0A0F', border: `1px solid ${channel === 'whatsapp' ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)'}`,
                                            borderRadius: 14, padding: '12px 100px 12px 16px',
                                            color: '#E2E8F0', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit',
                                            minHeight: 52, maxHeight: 120, overflow: 'auto',
                                        }}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={isSending || !draftText.trim()}
                                        style={{
                                            position: 'absolute', right: 8, bottom: 8,
                                            padding: '7px 14px', borderRadius: 10,
                                            background: isSending || !draftText.trim() ? 'rgba(255,255,255,0.05)' : (channel === 'whatsapp' ? '#10B981' : '#6366F1'),
                                            color: isSending || !draftText.trim() ? '#475569' : '#fff',
                                            fontWeight: 900, fontSize: 10, cursor: 'pointer', border: 'none', textTransform: 'uppercase'
                                        }}
                                    >
                                        {isSending ? '...' : 'Send'}
                                    </button>
                                </div>
                                <div style={{ textAlign: 'right', marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#334155', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>
                                        {draft && !draftText && !isDraftLoading && '✨ Tip: Press TAB to use AI draft'}
                                    </span>
                                    <span style={{ color: draftText.length > 180 ? '#F87171' : '#334155', fontSize: 9, fontWeight: 700 }}>
                                        {draftText.length} / 200 CHARS
                                    </span>
                                </div>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* CSS animations */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
            `}</style>
        </div>
    );
};

export default InboxPage;
