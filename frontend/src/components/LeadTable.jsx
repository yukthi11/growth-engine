import React from 'react';
import LeadRow from './LeadRow';

const LeadTable = ({ leads, onUpdate, onViewMessages, onEdit, onDelete, onOpenOutreachStatus, onGenerateProposal }) => {
    if (!leads || leads.length === 0) {
        return (
            <div className="bg-midnight-lighter px-8 py-20 text-center border border-white/5 rounded-3xl premium-shadow flex flex-col items-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                    <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Quiet in this territory</h3>
                <p className="text-slate-500 mt-2 max-w-xs mx-auto font-medium uppercase text-[10px] tracking-widest">
                    No leads discovered yet for this workspace.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-midnight-lighter rounded-3xl premium-shadow border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/5">
                    <thead>
                        <tr className="bg-white/5">
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Business</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Email</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Phone</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Website</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Location</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Score</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Outreach DNA</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Outreach</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-widest w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {leads.map((lead) => (
                            <LeadRow
                                key={lead.id}
                                lead={lead}
                                onUpdate={onUpdate}
                                onViewMessages={onViewMessages}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onOpenOutreachStatus={onOpenOutreachStatus}
                                onGenerateProposal={onGenerateProposal}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LeadTable;
