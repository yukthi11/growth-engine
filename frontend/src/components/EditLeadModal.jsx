import React, { useState, useEffect } from 'react';
import { updateLead } from '../api/client';

const EditLeadModal = ({ lead, campaigns, isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        business_name: '',
        contact_name: '',
        email_address: '',
        phone: '',
        campaign_id: '',
        status: '',
        website: '',
        location_normalized: '',
        instagram_username: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && lead) {
            setFormData({
                business_name: lead.business_name || '',
                contact_name: lead.contact_name || '',
                email_address: lead.email_address || '',
                phone: lead.phone || '',
                campaign_id: lead.campaign_id || '',
                status: lead.status || 'new',
                website: lead.website || '',
                location_normalized: lead.location_normalized || '',
                instagram_username: lead.instagram_username || ''
            });
        }
    }, [isOpen, lead]);

    if (!isOpen || !lead) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await updateLead(lead.id, formData);
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to update lead:', err);
            alert('Lead correction failed. Please check inputs.');
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
                            Database Modification
                        </div>
                        <h3 className="text-3xl font-black text-white tracking-tighter italic">Edit Prospect</h3>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Refining Lead ID: {lead.id}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Business Identity</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.business_name}
                                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-sans"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Communication Email</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email_address}
                                    onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
                                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-sans text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Contact Phone</label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-sans text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Pipeline Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all text-sm appearance-none"
                                >
                                    <option value="new" className="bg-midnight">New</option>
                                    <option value="contacted" className="bg-midnight">Contacted</option>
                                    <option value="replied" className="bg-midnight">Replied</option>
                                    <option value="interested" className="bg-midnight">Interested</option>
                                    <option value="closed" className="bg-midnight">Closed</option>
                                    <option value="rejected" className="bg-midnight">Rejected</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Website URL</label>
                                <input
                                    type="text"
                                    placeholder="e.g. www.business.com"
                                    value={formData.website}
                                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-sans text-sm"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Location (City/Area)</label>
                                    <input
                                        type="text"
                                        placeholder="Bangalore, etc"
                                        value={formData.location_normalized}
                                        onChange={(e) => setFormData({ ...formData, location_normalized: e.target.value })}
                                        className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-sans text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Instagram (@handle)</label>
                                    <input
                                        type="text"
                                        placeholder="@username"
                                        value={formData.instagram_username}
                                        onChange={(e) => setFormData({ ...formData, instagram_username: e.target.value })}
                                        className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-sans text-sm"
                                    />
                                </div>
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
                                {isSubmitting ? 'Correcting...' : 'Apply Modifications'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditLeadModal;
