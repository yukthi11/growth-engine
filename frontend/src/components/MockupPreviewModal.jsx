import React, { useState, useEffect } from 'react';
import { generateMockup } from '../api/client';

const MockupPreviewModal = ({ lead, isOpen, onClose, onMockupGenerated }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [mockupUrl, setMockupUrl] = useState(null);
    const [error, setError] = useState(null);
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        if (isOpen && lead) {
            setMockupUrl(lead.mockup_url || null);
            setError(null);
            setCopySuccess(false);
        }
    }, [isOpen, lead]);

    if (!isOpen || !lead) return null;

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await generateMockup(lead.id);
            setMockupUrl(result.mockup_url);
            if (onMockupGenerated && !lead.mockup_url) {
                // Let the parent know so it can update the local lead state if desired
                onMockupGenerated(result.mockup_url);
            }
        } catch (err) {
            console.error('Failed to generate mockup:', err);
            setError('Generation failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyUrl = async () => {
        if (!mockupUrl) return;
        try {
            await navigator.clipboard.writeText(mockupUrl);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy text:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen p-4">
                <div className="fixed inset-0 bg-midnight/90 backdrop-blur-xl animate-in fade-in duration-200" onClick={onClose}></div>

                <div className="relative bg-midnight-lighter border border-violet-500/20 rounded-[32px] shadow-[0_0_100px_rgba(139,92,246,0.15)] max-w-4xl w-full p-8 animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-600/10 border border-violet-600/20 rounded-full text-[10px] font-black uppercase tracking-widest text-violet-400 mb-3">
                                Pitch Asset
                            </div>
                            <h3 className="text-2xl font-black text-white tracking-tighter">
                                Website Mockup for {lead.business_name}
                            </h3>
                            <p className="text-slate-400 text-xs font-medium mt-1">
                                Send this preview to the lead to show them what their new website could look like.
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {/* Preview Area */}
                    <div className="bg-midnight rounded-2xl border border-white/5 aspect-[1200/630] w-full flex flex-col items-center justify-center overflow-hidden relative shadow-inner mb-6 group">
                        {mockupUrl ? (
                            <img 
                                src={mockupUrl} 
                                alt={`Mockup for ${lead.business_name}`} 
                                className="w-full h-full object-cover animate-in fade-in duration-500"
                            />
                        ) : isLoading ? (
                            <div className="flex flex-col items-center justify-center text-violet-400 space-y-4">
                                <svg className="animate-spin h-10 w-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-xs font-black uppercase tracking-widest animate-pulse">Rendering Design...</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-slate-500 space-y-3">
                                <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs font-black uppercase tracking-widest opacity-50">No preview generated yet</span>
                            </div>
                        )}
                        
                        {/* Overlay actions on hover for image */}
                        {mockupUrl && (
                            <div className="absolute inset-0 bg-midnight/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                                <a 
                                    href={mockupUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    Open Full Size
                                </a>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl text-center">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                        <div className="text-[10px] text-slate-500 font-bold">
                            Tip: Right-click the image and select "Copy image" to paste directly into WhatsApp.
                        </div>
                        <div className="flex gap-3">
                            {!mockupUrl ? (
                                <button
                                    onClick={handleGenerate}
                                    disabled={isLoading}
                                    className="px-8 py-3 bg-violet-600 text-white font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg shadow-violet-600/20 hover:bg-violet-500 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2"
                                >
                                    {isLoading ? 'Generating...' : 'Generate Preview ✨'}
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isLoading}
                                        className="px-6 py-3 border border-white/10 text-slate-300 font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-white/5 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {isLoading ? 'Regenerating...' : 'Regenerate'}
                                    </button>
                                    <button
                                        onClick={handleCopyUrl}
                                        className={`px-8 py-3 font-black uppercase text-[11px] tracking-widest rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                                            copySuccess 
                                                ? 'bg-emerald-500 text-midnight shadow-emerald-500/20' 
                                                : 'bg-violet-600 text-white shadow-violet-600/20 hover:bg-violet-500'
                                        }`}
                                    >
                                        {copySuccess ? (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                                Copied!
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                Copy Link
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MockupPreviewModal;
