import React, { useState, useEffect } from 'react';
import { createLead } from '../api/client';

const AddLeadModal = ({ companyId, campaigns, defaultCampaignId, isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        business_name: '',
        contact_name: '',
        email_address: '',
        phone: '', // Re-added
        source: 'manual',
        campaign_id: defaultCampaignId || '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData(prev => ({
                ...prev,
                campaign_id: defaultCampaignId || ''
            }));
        }
    }, [isOpen, defaultCampaignId]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createLead({
                ...formData,
                company_id: companyId,
                campaign_id: formData.campaign_id || null
            });
            onSuccess();
            onClose();
            setFormData({
                business_name: '',
                contact_name: '',
                email_address: '',
                phone: '',
                source: 'manual',
                campaign_id: '',
            });
        } catch (err) {
            console.error('Failed to create lead:', err);
            alert('Lead entry failed. Verify data integrity.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen p-4">
                <div className="fixed inset-0 bg-midnight/80 backdrop-blur-xl animate-in" onClick={onClose}></div>

                <div className="relative bg-midnight-lighter border border-white/10 rounded-[40px] shadow-2xl max-w-lg w-full p-10 animate-in premium-shadow">
                    <div className="mb-10 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-600/10 border border-violet-600/20 rounded-full text-[10px] font-black uppercase tracking-widest text-violet-400 mb-4">
                            Manual Lead Injection
                        </div>
                        <h3 className="text-3xl font-black text-white tracking-tighter italic">Acquire Lead</h3>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Populate the Growth Pipeline</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Business Identity</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Acme Studio"
                                    value={formData.business_name}
                                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-sans"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Principal Lead Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. John Wick"
                                    value={formData.contact_name}
                                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-sans"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-full">
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Communication Email</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="lead@example.com"
                                    value={formData.email_address}
                                    onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
                                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-sans text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Contact Phone</label>
                                <input
                                    type="text"
                                    placeholder="+91 99999 00000"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-sans text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Active Campaign</label>
                                <select
                                    value={formData.campaign_id}
                                    onChange={(e) => setFormData({ ...formData, campaign_id: e.target.value })}
                                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all text-sm appearance-none"
                                >
                                    <option value="" className="bg-midnight">Unassigned</option>
                                    {campaigns.map(c => <option key={c.id} value={c.id} className="bg-midnight">{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-6">
                            <button type="button" onClick={onClose} className="px-8 py-4 border border-white/10 text-slate-500 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white/5 transition-all">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-violet-600 text-white font-black uppercase text-[11px] tracking-widest rounded-2xl shadow-xl shadow-violet-600/20 hover:bg-violet-500 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Injecting...' : 'Confirm Acquisition'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AddLeadModal;
