import React, { useState } from 'react';
import { createCampaign } from '../api/client';

const CreateCampaignModal = ({ companyId, isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await createCampaign({ ...formData, company_id: companyId });
            onSuccess();
            onClose();
            setFormData({ name: '', description: '' });
        } catch (err) {
            console.error('Failed to create campaign:', err);
            alert('Error creating campaign. Please check inputs.');
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
                            Campaign Architecture
                        </div>
                        <h3 className="text-3xl font-black text-white tracking-tighter italic">Launch Strategy</h3>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1 italic">Define the boundary for new intelligence</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Strategy Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Q2 Market Expansion"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-sans"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 ml-1">Operational Objectives</label>
                                <textarea
                                    placeholder="What is the tactical goal of this outreach?"
                                    rows="3"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all font-sans"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="px-8 py-4 border border-white/10 text-slate-500 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white/5 transition-all"
                            >
                                Abort
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-violet-600 text-white font-black uppercase text-[11px] tracking-widest rounded-2xl shadow-xl shadow-violet-600/20 hover:bg-violet-500 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Architecting...' : 'Confirm Strategy'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateCampaignModal;
