import React, { useState, useEffect } from 'react';
import { getMessages, createMessage } from '../api/client';

const MessagePanel = ({ lead, isOpen, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [channel, setChannel] = useState('email');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (isOpen && lead) {
            fetchMessages();
            // Load AI draft as default message if no history exists yet
            if (lead.outreach_draft) {
                setNewMessage(lead.outreach_draft);
            } else {
                setNewMessage('');
            }
        }
    }, [isOpen, lead]);

    const fetchMessages = async () => {
        setIsLoading(true);
        try {
            const data = await getMessages(lead.id);
            setMessages(data);
        } catch (err) {
            console.error('Failed to fetch messages:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const getWhatsAppUrl = (phone, text) => {
        if (!phone) return null;
        const cleanPhone = phone.replace(/[^\d]/g, '');
        const encodedText = encodeURIComponent(text);
        return `https://wa.me/${cleanPhone}?text=${encodedText}`;
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        // If WhatsApp, open in new tab as well
        if (channel === 'whatsapp' && lead.phone) {
            const url = getWhatsAppUrl(lead.phone, newMessage);
            if (url) window.open(url, '_blank');
        }

        setIsSending(true);
        try {
            await createMessage({
                lead_id: lead.id,
                campaign_id: lead.campaign_id,
                channel,
                message_text: newMessage,
                status: channel === 'email' ? 'pending' : 'sent'
            });
            
            // Only clear if it was an on-the-fly message
            // fetchMessages will show the recorded outreach
            fetchMessages();
        } catch (err) {
            console.error('Failed to send message:', err);
            alert('Error sending message.');
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-midnight/40 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            ></div>

            <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-midnight-lighter shadow-[0_0_50px_rgba(0,0,0,0.5)] z-50 border-l border-white/5 flex flex-col transition-all duration-300 transform translate-x-0">
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></div>
                             <h3 className="text-xl font-black text-white leading-tight tracking-tight">{lead.business_name}</h3>
                        </div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Outreach Protocol — {lead.phone || 'No Phone'}</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-3 hover:bg-white/5 rounded-2xl transition-all text-slate-500 hover:text-white"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Message List */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-violet-500 border-t-transparent"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Retrieving Logs</span>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center gap-6">
                            <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center border border-white/5">
                                <svg className="w-8 h-8 text-slate-600 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-bold text-slate-400">Zero Communication Records</p>
                                <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Start the outreach cycle below</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-10 relative">
                            {/* Timeline line */}
                            <div className="absolute left-[15px] top-4 bottom-4 w-px bg-white/5"></div>
                            
                            {messages.map((msg) => (
                                <div key={msg.id} className="relative pl-10 animate-in slide-in-from-right-4 duration-500">
                                    {/* Timeline dot */}
                                    <div className={`absolute left-0 top-[6px] w-8 h-8 rounded-full flex items-center justify-center border-2 border-midnight-lighter z-10 ${
                                        msg.channel === 'email' ? 'bg-indigo-500' : 'bg-emerald-500'
                                    }`}>
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            {msg.channel === 'email' ? (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            ) : (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            )}
                                        </svg>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black text-white uppercase tracking-wider">
                                                {msg.channel}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                                                {new Date(msg.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                            </span>
                                        </div>
                                        <div className="bg-white/[0.03] p-5 rounded-[24px] border border-white/5 hover:border-white/10 transition-colors">
                                            <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed selection:bg-violet-500/30 font-medium">{msg.message_text}</p>
                                            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${msg.status === 'sent' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'}`}></div>
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{msg.status}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-8 bg-white/[0.02] border-t border-white/5">
                    <form onSubmit={handleSendMessage} className="space-y-6">
                        <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                            <button
                                type="button"
                                onClick={() => setChannel('email')}
                                className={`flex-1 py-3 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                                    channel === 'email' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 active:scale-[0.98]' : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                AI Email Service
                            </button>
                            <button
                                type="button"
                                onClick={() => setChannel('whatsapp')}
                                className={`flex-1 py-3 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                                    channel === 'whatsapp' ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20 active:scale-[0.98]' : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                Global WhatsApp
                            </button>
                        </div>

                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 rounded-[28px] blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
                            <textarea
                                rows="5"
                                placeholder={`Drafting intelligence for ${lead.business_name}...`}
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                className="relative w-full px-6 py-5 bg-midnight border border-white/10 rounded-[24px] focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all text-sm font-medium text-slate-100 placeholder:text-slate-700 resize-none shadow-inner"
                            />
                            
                            <button
                                type="submit"
                                disabled={isSending || !newMessage.trim()}
                                className={`absolute bottom-4 right-4 h-12 w-12 rounded-2xl shadow-2xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-20 disabled:scale-100 ${
                                    channel === 'email' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                                }`}
                            >
                                {isSending ? (
                                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                ) : (
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        
                        <div className="flex items-center justify-between px-2">
                             <div className="flex flex-col">
                                 <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Target Identity</span>
                                 <span className="text-[11px] font-bold text-slate-400">{lead.email_address || 'Unverified Identity'}</span>
                             </div>
                             {channel === 'whatsapp' && (
                                 <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                                     Direct Protocol Enabled
                                 </div>
                             )}
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default MessagePanel;
