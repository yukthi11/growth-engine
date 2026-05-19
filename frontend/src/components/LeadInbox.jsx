import React from 'react';

const Icons = {
    Chat: () => <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
    Link: () => <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 11-5.656 5.656l-1.101-1.102" /></svg>
};

const LeadInbox = ({ replies }) => {
    const interestedReplies = replies.filter(r => r.sentiment?.toLowerCase() === 'interested');

    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 premium-shadow animate-in">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600/10 border border-indigo-500/20 p-3 rounded-2xl text-indigo-400">
                        <Icons.Chat />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight uppercase">Hot Leads Inbox</h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">AI Filtered Priority</p>
                    </div>
                </div>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">Live Monitor Active</span>
            </div>

            {interestedReplies.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[32px]">
                    <p className="text-slate-600 font-black text-xs uppercase tracking-widest">Scanning for high-intent replies...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {interestedReplies.map((reply) => (
                        <div key={reply.id} className="group p-6 bg-white/[0.03] border border-white/5 rounded-[32px] hover:bg-white/5 hover:border-violet-500/20 transition-all">
                            <div className="flex items-start justify-between gap-6">
                                <div className="space-y-3 flex-1">
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest bg-violet-600/10 px-3 py-1 rounded-full border border-violet-600/20">
                                            {reply.channel}
                                        </span>
                                        <span className="text-sm font-black text-white">{reply.lead?.business_name || 'Anonymous Studio'}</span>
                                    </div>
                                    <p className="text-slate-400 text-sm font-medium italic leading-relaxed">
                                        "{reply.message_text}"
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button className="flex items-center gap-2 px-6 py-2.5 bg-white text-midnight rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-95 transition-all">
                                        Reply Now
                                    </button>
                                    <button className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest">
                                        <Icons.Link /> Action Pack
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LeadInbox;
