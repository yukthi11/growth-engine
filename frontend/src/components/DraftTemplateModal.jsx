import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { updateCompany } from '../api/client';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const DraftTemplateModal = ({ isOpen, onClose, company, campaignId, onSuccess }) => {
    const [formData, setFormData] = useState({
        whatsapp_template: '',
        email_subject_template: '',
        email_body_template: '',
        email_media_url: ''
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);
    const [channel, setChannel] = useState('whatsapp');
    const [isBulkSending, setIsBulkSending] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (company) {
            // Only force-refresh state if we are switching companies entirely
            // This prevents manual edits from being overwritten when dashboard refreshes background stats
            setFormData(prev => {
                if (prev.whatsapp_template && prev.whatsapp_template !== company.whatsapp_template) {
                    return prev; // Keep manual edit
                }
                return {
                    whatsapp_template: company.whatsapp_template || '',
                    email_subject_template: company.email_subject_template || '',
                    email_body_template: company.email_body_template || '',
                    email_media_url: company.email_media_url || ''
                };
            });
        }
    }, [company?.id, isOpen]); // Depend on ID, not full object

    const handleGenerateTemplates = async () => {
        if (!company?.id) return;
        setIsGenerating(true);
        try {
            const res = await fetch(`http://127.0.0.1:5000/companies/${company.id}/generate-template`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.waTemplate) {
                setFormData({
                    whatsapp_template: data.waTemplate,
                    email_subject_template: data.emailTemplate.subject,
                    email_body_template: data.emailTemplate.body,
                    email_media_url: formData.email_media_url // Retain existing URL
                });
            }
        } catch (err) {
            console.error('Template generation failed:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setSaveStatus('saving');
        try {
            // 1. Save the Master Template to the Company
            await updateCompany(company.id, formData);
            
            // 2. If a campaign is selected, overwrite all lead drafts in that campaign with this new master template
            if (campaignId) {
                await fetch(`http://127.0.0.1:5000/campaigns/${campaignId}/leads/update-all-drafts`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ outreach_draft: formData.whatsapp_template })
                });
            }

            setSaveStatus('success');
            setTimeout(() => {
                onSuccess();
                setSaveStatus(null);
            }, 1500);
        } catch (err) {
            console.error('Save template failed:', err);
            setSaveStatus('error');
        }
    };

    const handleBulkSend = async () => {
        if (!campaignId) return alert('Select a Growth Plan (Campaign) at the top of your dashboard first!');
        if (!window.confirm(`Initiate ${channel} dispatch for this campaign? (Paced human behavior active)`)) return;
        
        setIsBulkSending(true);
        try {
            // 1. AUTO-SAVE the blueprint first so their manual changes are used
            await updateCompany(company.id, formData);

            // 2. Trigger the bulk engine
            const res = await fetch(`http://127.0.0.1:5000/campaigns/${campaignId}/bulk-send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel, companyId: company.id })
            });
            const data = await res.json();
            alert(data.message);
        } catch (err) {
            console.error('Bulk send failed:', err);
            alert('Bulk dispatch failed to start.');
        } finally {
            setIsBulkSending(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const uploadData = new FormData();
        uploadData.append('file', file);

        setIsUploading(true);
        try {
            const res = await fetch(`http://127.0.0.1:5000/companies/${company.id}/upload-media`, {
                method: 'POST',
                body: uploadData
            });
            const data = await res.json();
            if (data.url) {
                setFormData(prev => ({ ...prev, email_media_url: data.url }));
            }
        } catch (err) {
            console.error('Upload failed:', err);
            alert('File upload failed.');
        } finally {
            setIsUploading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(3, 4, 7, 0.97)',
            backdropFilter: 'blur(50px)',
            padding: '24px'
        }}>
            <div style={{
                background: '#090b11',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                width: '100%',
                maxWidth: '1240px',
                height: '92vh',
                borderRadius: '40px',
                overflow: 'hidden',
                display: 'grid',
                gridTemplateColumns: '1fr 380px',
                position: 'relative',
                boxShadow: '0 0 150px rgba(0,0,0,1)',
                animation: 'modalSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Accent Line */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-600 via-indigo-400 to-cyan-400"></div>
                
                {/* Independent LEFT Column */}
                <div className="flex flex-col h-full border-r border-white/5 overflow-hidden">
                    <header className="px-8 py-5 border-b border-white/5 bg-white/[0.01] flex-shrink-0">
                        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Draft Outreach DNA</h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5 italic">Precision tools for modern scale</p>
                    </header>

                    <div className="flex-1 overflow-y-auto px-8 py-6 bg-black/40 custom-scrollbar">
                        {channel === 'whatsapp' ? (
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-baseline px-1">
                                        <label className="text-[11px] font-black text-violet-400 uppercase tracking-widest leading-none">WhatsApp Blueprint</label>
                                        <span className="text-[9px] font-bold text-slate-700 italic">Inject: {"{{business_name}}"}</span>
                                    </div>
                                    <textarea
                                        value={formData.whatsapp_template}
                                        onChange={(e) => setFormData({ ...formData, whatsapp_template: e.target.value })}
                                        className="w-full h-40 bg-white/5 border border-white/5 rounded-3xl px-6 py-6 text-white font-medium focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all text-base leading-relaxed placeholder:text-slate-800 resize-none custom-scrollbar"
                                        placeholder="e.g. Hey {{business_name}}! Love your niche..."
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-emerald-400 uppercase tracking-widest px-1">Live Mobile Preview</label>
                                    <div className="bg-[#0b141a] rounded-[32px] p-6 border border-white/5 shadow-2xl relative overflow-hidden">
                                        <div className="flex items-start gap-3 bg-[#202c33] p-4 rounded-2xl rounded-tl-none max-w-[85%] border-l-4 border-emerald-500 shadow-sm">
                                            <p className="text-[13px] text-[#e9edef] leading-relaxed whitespace-pre-wrap">
                                                {formData.whatsapp_template.replace(/\{\{business_name\}\}/g, company?.name || 'Business') || 'Message preview will appear here...'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-violet-400 uppercase tracking-widest px-1 leading-none">Email Subject Line</label>
                                    <input
                                        value={formData.email_subject_template}
                                        onChange={(e) => setFormData({ ...formData, email_subject_template: e.target.value })}
                                        className="w-full bg-white/5 border border-white/5 rounded-[22px] px-6 py-4 text-white font-bold focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all text-base tracking-tight placeholder:text-slate-800"
                                        placeholder="Mumbai Opportunity"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-[11px] font-black text-violet-400 uppercase tracking-widest leading-none">Email Body & Richards</label>
                                        <label className={`cursor-pointer text-[9px] font-black uppercase tracking-tight px-3 py-1.5 rounded-lg border border-white/10 transition-all ${isUploading ? 'bg-white/5 text-slate-600 animate-pulse' : 'bg-white/5 text-slate-400 hover:bg-violet-500/10 hover:text-violet-300 active:scale-95'}`}>
                                            {isUploading ? 'Uploading...' : '📁 Attach Hero Image'}
                                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                                        </label>
                                    </div>
                                    
                                    <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden focus-within:ring-1 focus-within:ring-violet-500/30 transition-all quill-container min-h-[300px]">
                                        <ReactQuill
                                            theme="snow"
                                            value={formData.email_body_template}
                                            onChange={(val) => setFormData({ ...formData, email_body_template: val })}
                                            placeholder="Write your email strategy..."
                                            modules={{
                                                toolbar: [
                                                    ['bold', 'italic', 'underline'],
                                                    [{ 'list': 'bullet' }],
                                                    [{ 'align': [] }],
                                                    ['link', 'clean']
                                                ]
                                            }}
                                            className="h-full text-white"
                                        />
                                    </div>
                                </div>

                                {formData.email_media_url && (
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-black text-amber-400 uppercase tracking-widest px-1">Attached Media</label>
                                        <div className="relative group rounded-3xl overflow-hidden border border-white/10 bg-black/40 aspect-video flex items-center justify-center">
                                            <img src={formData.email_media_url} className="w-full h-full object-contain p-4" alt="Media" />
                                            <button onClick={() => setFormData(p => ({ ...p, email_media_url: '' }))} className="absolute top-4 right-4 p-2 bg-black/60 text-rose-400 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Independent RIGHT Column */}
                <div className="flex flex-col h-full bg-black/60 overflow-hidden">
                    <div className="p-8 border-b border-white/5 flex justify-end">
                        <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 transition-all border border-white/5 hover:scale-110 active:scale-90">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-10 py-12 custom-scrollbar space-y-12">
                        {/* Intelligence Deck */}
                        <div className="space-y-4">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-1">Intelligence</span>
                            <button 
                                type="button" 
                                onClick={handleGenerateTemplates}
                                disabled={isGenerating}
                                className={`w-full flex items-center justify-center gap-3 px-8 py-6 rounded-[28px] text-[11px] font-black uppercase tracking-widest transition-all
                                    ${isGenerating ? 'bg-white/5 text-slate-600 animate-pulse cursor-not-allowed' : 'bg-violet-600 text-white hover:bg-violet-500 shadow-[0_15px_40px_rgba(124,58,237,0.2)] active:scale-95'}
                                `}
                            >
                                {isGenerating ? 'Drafting Intelligence...' : '✨ Magic AI Draft'}
                            </button>
                        </div>

                        {/* Batch Control Section */}
                        <div className="space-y-8">
                            <div className="flex flex-col gap-1 px-1">
                                <span style={{ color: '#E2E8F0', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Communication Hub</span>
                                <span style={{ color: '#475569', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>Human-Like Pacing Active</span>
                            </div>

                            <div className="bg-white/[0.03] p-1.5 rounded-[22px] flex gap-1.5 border border-white/5">
                                {['whatsapp', 'email'].map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setChannel(c)}
                                        style={{
                                            flex: 1, padding: '12px 0', fontSize: 10, fontWeight: 900, borderRadius: '16px', border: 'none', cursor: 'pointer',
                                            background: channel === c ? (c === 'whatsapp' ? '#10B981' : '#6366F1') : 'transparent',
                                            color: channel === c ? '#fff' : '#475569', textTransform: 'uppercase', transition: 'all 0.3s'
                                        }}
                                    >
                                        {c}
                                     </button>
                                ))}
                            </div>


                            <button 
                                type="button"
                                onClick={handleBulkSend}
                                disabled={isBulkSending || !campaignId}
                                className={`w-full py-7 rounded-[32px] text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3
                                    ${isBulkSending || !campaignId ? 'bg-white/5 text-slate-700' : 'bg-white text-midnight hover:bg-slate-100 shadow-xl active:scale-95'}
                                `}
                            >
                                {isBulkSending ? 'Initiating Queue...' : `Send to All (${channel})`}
                            </button>
                            
                            {!campaignId && isBulkSending ? (
                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-6 space-y-4">
                                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] text-center leading-tight italic">
                                        Campaign Architecture Required
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-500 text-center leading-relaxed">
                                        Please select a target Growth Plan from the Top-Right dropdown of your dashboard before initiating dispatch.
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        {/* Save Section Inside Sidebar Scroll */}
                        <div className="pt-10 border-t border-white/5">
                            <button
                                onClick={() => handleSubmit()}
                                disabled={saveStatus === 'saving'}
                                className={`w-full py-6 rounded-[30px] font-black uppercase text-[10px] tracking-[0.3em] transition-all active:scale-95 flex items-center justify-center gap-3
                                    ${saveStatus === 'saving' ? 'bg-white/10 text-slate-500' : 
                                      saveStatus === 'success' ? 'bg-emerald-500 text-white' :
                                      'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}
                                `}
                            >
                                {saveStatus === 'saving' ? 'Saving...' : 
                                 saveStatus === 'success' ? 'Blueprint Locked' : 
                                 'Save Design Strategy'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes modalSlideUp {
                    from { opacity: 0; transform: translateY(60px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.3); }
                
                .quill-container .ql-toolbar {
                    background: rgba(255,255,255,0.02);
                    border: none !important;
                    border-bottom: 1px solid rgba(255,255,255,0.05) !important;
                    padding: 12px !important;
                }
                .quill-container .ql-container {
                    border: none !important;
                    font-family: inherit !important;
                    font-size: 0.95rem !important;
                    height: calc(100% - 45px) !important;
                }
                .quill-container .ql-editor {
                    min-height: 200px;
                    padding: 24px !important;
                    color: #fff !important;
                }
                .quill-container .ql-editor.ql-blank::before {
                    color: #334155 !important;
                    font-style: normal !important;
                }
                .quill-container .ql-stroke { stroke: #94a3b8 !important; }
                .quill-container .ql-fill { fill: #94a3b8 !important; }
                .quill-container .ql-picker { color: #94a3b8 !important; }
            `}</style>
        </div>,
        document.body
    );
};

export default DraftTemplateModal;
