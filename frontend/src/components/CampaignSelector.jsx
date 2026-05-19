import React from 'react';

const CampaignSelector = ({ campaigns, selectedCampaign, onChange, onDelete, isDeleting = false, minimal }) => {
    if (minimal) {
        return (
            <div className="relative group flex items-center gap-2">
                <div className="relative flex-1">
                    <select
                        value={selectedCampaign || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className="appearance-none block w-full pl-3 pr-8 py-2 text-xs font-bold text-slate-300 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all cursor-pointer hover:border-white/20"
                    >
                        <option value="" className="bg-midnight text-white">All Leads</option>
                        {campaigns.map((campaign) => (
                            <option key={campaign.id} value={campaign.id} className="bg-midnight text-white">
                                {campaign.name}
                            </option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-500 group-hover:text-violet-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
                {selectedCampaign && (
                    <button
                        onClick={onDelete}
                        disabled={isDeleting}
                        className="p-2 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-colors disabled:opacity-30"
                        title="Delete Campaign"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="relative w-full max-w-sm">
            <div className="mb-1.5 flex items-center justify-between gap-3 ml-1">
                <label htmlFor="campaign-select" className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Active Campaign
                </label>
                <button
                    type="button"
                    onClick={onDelete}
                    disabled={!selectedCampaign || isDeleting}
                    className="inline-flex items-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-400 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
            </div>
            <div className="relative group">
                <select
                    id="campaign-select"
                    value={selectedCampaign || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="appearance-none block w-full pl-4 pr-12 py-3 text-base font-semibold text-white bg-midnight-lighter border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all cursor-pointer hover:border-white/20"
                >
                    <option value="" className="bg-midnight text-white">All Leads</option>
                    {campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id} className="bg-midnight text-white">
                            {campaign.name}
                        </option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-500 group-hover:text-violet-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default CampaignSelector;
