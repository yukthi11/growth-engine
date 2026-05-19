import React from 'react';

// Custom SVG Icons to avoid library crashes
const Icons = {
    Automation: () => <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    Leads: () => <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    Discovery: () => <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    Reporting: () => <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    Inbox: () => <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
};

const NavItem = ({ icon: Icon, label, active, onClick, badge }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group ${
            active 
            ? 'bg-violet-600/20 text-violet-400 border border-violet-500/20 shadow-lg shadow-violet-500/10' 
            : 'text-slate-500 hover:text-white hover:bg-white/5'
        }`}
    >
        <div className={`p-1 rounded-lg ${active ? 'bg-violet-500/10' : ''}`}>
            <Icon />
        </div>
        <span className={`text-sm font-black tracking-tight ${active ? 'text-white' : ''}`}>{label}</span>
        {badge > 0 && (
            <span className="ml-auto min-w-[18px] h-[18px] px-1.5 bg-violet-600 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                {badge}
            </span>
        )}
        {active && !badge && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></div>}
    </button>
);

const SideNav = ({ activeTab, onTabChange, isOpen, setIsOpen, badgeCount, onManageCompany }) => {
    const [showProfileMenu, setShowProfileMenu] = React.useState(false);

    return (
        <aside className={`fixed top-0 left-0 bottom-0 w-72 bg-midnight/80 backdrop-blur-2xl border-r border-white/5 z-[100] transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-8 h-full flex flex-col">
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20 border border-white/10">
                            <span className="text-white font-black text-xl italic tracking-tighter">G</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-white italic leading-none tracking-tighter uppercase">Growth</h1>
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Command Hub</span>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 text-slate-500 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <nav className="flex-1 space-y-2 overflow-y-auto no-scrollbar pr-2">
                    <div className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] mb-4 ml-4">Automation Hub</div>
                    <NavItem icon={Icons.Automation} label="Dashboard" active={activeTab === 'automation'} onClick={() => onTabChange('automation')} />
                    <NavItem icon={Icons.Leads} label="Lead Database" active={activeTab === 'leads'} onClick={() => onTabChange('leads')} />
                    <NavItem icon={Icons.Discovery} label="Intelligence" active={activeTab === 'discovery'} onClick={() => onTabChange('discovery')} />
                    
                    <div className="mt-8 pt-8 border-t border-white/5 space-y-2">
                        <div className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] mb-4 ml-4">Advanced Stats</div>
                        <NavItem icon={Icons.Reporting} label="Performance" active={activeTab === 'stats'} onClick={() => onTabChange('stats')} />
                        <NavItem icon={Icons.Inbox} label="Reply Inbox" active={activeTab === 'inbox'} onClick={() => onTabChange('inbox')} badge={badgeCount} />
                    </div>
                </nav>

                <div className="mt-auto pt-6 border-t border-white/5 relative">
                    {showProfileMenu && (
                        <div className="absolute bottom-full left-0 right-0 mb-4 bg-[#0a0f1d] border border-white/10 rounded-[28px] shadow-2xl p-2 z-[200] animate-in fade-in slide-in-from-bottom-4 duration-300">
                             <button
                                onClick={() => { onManageCompany(false); setShowProfileMenu(false); }}
                                className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all"
                            >
                                Workspace Settings
                            </button>
                            <button
                                onClick={() => { onManageCompany(true); setShowProfileMenu(false); }}
                                className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-2xl transition-all"
                            >
                                + Add Company
                            </button>
                        </div>
                    )}
                    <div 
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className="flex items-center gap-3 px-4 py-3 text-slate-500 bg-white/5 rounded-2xl border border-white/5 cursor-pointer hover:bg-violet-600/10 transition-all group"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[10px] font-black text-white shadow-lg group-hover:scale-110 transition-transform">Y</div>
                        <div className="flex flex-col items-start overflow-hidden">
                            <span className="text-xs font-black text-white">Yukthi S.</span>
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none">Enterprise</span>
                        </div>
                        <div className={`ml-auto transition-transform duration-300 ${showProfileMenu ? 'rotate-180 text-violet-400' : 'text-slate-700'}`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default SideNav;
