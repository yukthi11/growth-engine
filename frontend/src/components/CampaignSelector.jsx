import React, { useState, useRef, useEffect } from 'react';
import { updateCampaign } from '../api/client';

// ── Inline rename input — shared by both layout variants ────────────────────
const InlineRename = ({ campaign, onRenamed }) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(campaign.name);
    const [saving, setSaving] = useState(false);
    const inputRef = useRef(null);

    // Keep local value in sync if parent swaps campaign
    useEffect(() => {
        setValue(campaign.name);
        setEditing(false);
    }, [campaign.id, campaign.name]);

    const handleSave = async () => {
        const trimmed = value.trim();
        if (!trimmed || trimmed === campaign.name) {
            setValue(campaign.name);
            setEditing(false);
            return;
        }
        setSaving(true);
        try {
            await updateCampaign(campaign.id, { name: trimmed });
            onRenamed(campaign.id, trimmed);
        } catch (err) {
            console.error('[CampaignSelector] Rename failed:', err);
            setValue(campaign.name); // revert on error
        } finally {
            setSaving(false);
            setEditing(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') { setValue(campaign.name); setEditing(false); }
    };

    if (editing) {
        return (
            <input
                ref={inputRef}
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                disabled={saving}
                className="bg-transparent border-b border-violet-500 text-white text-xs font-bold focus:outline-none w-32 disabled:opacity-50"
                title="Press Enter to save, Escape to cancel"
            />
        );
    }

    return (
        <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-slate-500 hover:text-violet-400 transition-colors"
            title="Rename campaign"
        >
            <svg className="w-3 h-3 opacity-40 hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
        </button>
    );
};

// ── Main Component ───────────────────────────────────────────────────────────
const CampaignSelector = ({ campaigns, selectedCampaign, onChange, onDelete, onRenamed, isDeleting = false, minimal }) => {
    const activeCampaign = campaigns.find(c => String(c.id) === String(selectedCampaign));

    const handleRenamed = (id, newName) => {
        if (onRenamed) onRenamed(id, newName);
    };

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

                {/* Rename button — only visible when a campaign is selected */}
                {activeCampaign && (
                    <InlineRename campaign={activeCampaign} onRenamed={handleRenamed} />
                )}

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
                <div className="flex items-center gap-2">
                    <label htmlFor="campaign-select" className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Active Campaign
                    </label>
                    {activeCampaign && (
                        <InlineRename campaign={activeCampaign} onRenamed={handleRenamed} />
                    )}
                </div>
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
