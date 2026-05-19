import React from 'react';

const Icons = {
    Mail: () => <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    WhatsApp: () => <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 21a9 9 0 11-18 0 9 9 0 0118 0zm-5-9h10" /></svg>,
    Clock: () => <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Edit: () => <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
};

const SequenceStep = ({ step, isLast }) => (
    <div className="relative pl-8 pb-8 transition-all">
        {/* Timeline Line */}
        {!isLast && <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-gradient-to-b from-violet-600/30 to-indigo-600/10 rounded-full"></div>}
        
        {/* Step Marker */}
        <div className="absolute left-0 top-2 w-[24px] h-[24px] bg-gradient-to-br from-violet-600 to-indigo-700 rounded-full flex items-center justify-center border-2 border-midnight shadow-lg shadow-violet-500/20 z-10 text-[10px] font-black text-white italic">
            {step.step_order}
        </div>

        {/* Step Card */}
        <div className="p-6 bg-white/[0.04] border border-white/5 rounded-[32px] hover:bg-white/[0.06] hover:border-violet-500/20 transition-all premium-shadow group">
            <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                    <span className="p-2 bg-white/5 rounded-xl text-violet-400 group-hover:text-white transition-colors">
                        {step.type === 'email' ? <Icons.Mail /> : <Icons.WhatsApp />}
                    </span>
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">{step.type} Outreach</h4>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-1">
                        <Icons.Clock /> Delay: {step.delay_days}d
                    </span>
                </div>
                <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all">
                    <Icons.Edit />
                </button>
            </div>
            
            <div className="bg-midnight/50 p-4 rounded-2xl border border-white/5">
                 <p className="text-[10px] text-slate-500 italic line-clamp-2 leading-relaxed">
                    {step.body}
                </p>
            </div>
        </div>
    </div>
);

const SequenceVisualizer = ({ steps }) => {
    return (
        <div className="space-y-0 animate-in">
            {steps.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[32px] opacity-20">
                    <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">No sequence payload detected...</p>
                </div>
            ) : (
                steps.sort((a, b) => a.step_order - b.step_order).map((step, index) => (
                    <SequenceStep key={step.id} step={step} isLast={index === steps.length - 1} />
                ))
            )}
        </div>
    );
};

export default SequenceVisualizer;
