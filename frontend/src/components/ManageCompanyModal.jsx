import React, { useState, useEffect } from 'react';
import { updateCompany, createCompany } from '../api/client';

const ManageCompanyModal = ({ isOpen, onClose, company, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        overview: '',
        goal: '',
        whatsapp_number: '',
        instagram_id: '',
        smtp_password: ''
    });

    useEffect(() => {
        if (company) {
            setFormData({
                name: company.name || '',
                email: company.email || '',
                overview: company.overview || '',
                goal: company.goal || '',
                whatsapp_number: company.whatsapp_number || '',
                instagram_id: company.instagram_id || '',
                smtp_password: company.smtp_password || ''
            });
        } else {
            setFormData({
                name: '',
                email: '',
                overview: '',
                goal: '',
                whatsapp_number: '',
                instagram_id: '',
                smtp_password: '',
                whatsapp_template: '',
                email_subject_template: '',
                email_body_template: ''
            });
        }
    }, [company, isOpen]);

    const [saveStatus, setSaveStatus] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaveStatus('saving');
        try {
            if (company?.id) {
                await updateCompany(company.id, formData);
            } else {
                await createCompany(formData);
            }
            setSaveStatus('success');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1000);
        } catch (err) {
            console.error('Save company failed:', err);
            setSaveStatus('error');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-midnight/60 animate-in fade-in duration-300">
            <div className="bg-midnight-lighter border border-white/10 w-full max-w-2xl rounded-[40px] shadow-2xl p-10 relative overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 to-indigo-600"></div>
                
                <header className="flex justify-between items-start mb-10">
                    <div>
                        <h2 className="text-3xl font-black text-white italic tracking-tight uppercase leading-none">
                            {company ? 'Workspace Configuration' : 'Register New Company'}
                        </h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">
                            {company ? 'Update intelligence context for AI personalization' : 'Initialize a new growth territory'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Company Name</label>
                        <input
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-lg"
                            placeholder="e.g. Revive Bangalore"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-2">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Admin Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                                placeholder="hello@company.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">App Password</label>
                                <span className="text-[9px] font-bold text-violet-400 italic">Gmail/SMTP Only</span>
                            </div>
                            <input
                                type="password"
                                value={formData.smtp_password}
                                onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                                className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all font-mono"
                                placeholder="•••• •••• •••• ••••"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Overview / Niche</label>
                        <textarea
                            value={formData.overview}
                            onChange={(e) => setFormData({ ...formData, overview: e.target.value })}
                            className="w-full bg-white/5 border border-white/5 rounded-3xl px-5 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all min-h-[100px]"
                            placeholder="Describe what your company does and who you target..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Primary Growth Goal</label>
                        <input
                            value={formData.goal}
                            onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                            placeholder="e.g. Increase weekend walk-ins by 40%"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">WhatsApp #</label>
                            <input
                                value={formData.whatsapp_number}
                                onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                                className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                                placeholder="+91 XXXX XXXX"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Instagram ID</label>
                            <input
                                value={formData.instagram_id}
                                onChange={(e) => setFormData({ ...formData, instagram_id: e.target.value })}
                                className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                                placeholder="@handle"
                            />
                        </div>
                    </div>

                    <div className="pt-6 space-y-4">
                        <button
                            type="submit"
                            disabled={saveStatus === 'saving'}
                            className={`w-full py-5 rounded-2xl font-black uppercase text-[12px] tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3
                                ${saveStatus === 'saving' ? 'bg-white/10 text-slate-500 cursor-not-allowed' : 
                                  saveStatus === 'success' ? 'bg-emerald-500 text-white' :
                                  saveStatus === 'error' ? 'bg-rose-600 text-white' :
                                  'bg-white text-midnight hover:scale-[0.98]'}
                            `}
                        >
                            {saveStatus === 'saving' ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                                    Synchronizing...
                                </>
                            ) : saveStatus === 'success' ? (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                    Configuration Saved
                                </>
                            ) : saveStatus === 'error' ? (
                                'Failed to Save'
                            ) : (
                                'Save Configuration'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManageCompanyModal;
