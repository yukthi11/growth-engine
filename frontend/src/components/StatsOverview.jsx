import React from 'react';

const Icons = {
    Leads: () => <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    Play: () => <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Star: () => <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
    Chart: () => <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
};

const StatCard = ({ title, value, icon: Icon, colorClass, gradient }) => (
    <div className={`relative overflow-hidden rounded-[40px] border border-white/5 p-8 premium-shadow ${gradient}`}>
        <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    {title}
                </span>
                <span className="text-4xl font-black tracking-tight text-white mt-1">
                    {value}
                </span>
            </div>
            <div className={`flex h-14 w-14 items-center justify-center rounded-3xl ${colorClass} bg-white/5 border border-white/5`}>
                <Icon />
            </div>
        </div>
        <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-white/5 blur-3xl rounded-full"></div>
    </div>
);

const StatsOverview = ({ stats }) => {
    return (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 select-none animate-in">
            <StatCard
                title="Total Database"
                value={stats.totalLeads?.toLocaleString()}
                icon={Icons.Leads}
                colorClass="text-violet-400"
                gradient="bg-gradient-to-br from-violet-500/5 to-transparent"
            />
            <StatCard
                title="Active Pulse"
                value={stats.activeSequences?.toLocaleString()}
                icon={Icons.Play}
                colorClass="text-cyan-400"
                gradient="bg-gradient-to-br from-cyan-500/5 to-transparent"
            />
            <StatCard
                title="AI Interest"
                value={stats.interestedReplies?.toLocaleString()}
                icon={Icons.Star}
                colorClass="text-amber-400"
                gradient="bg-gradient-to-br from-amber-500/5 to-transparent"
            />
            <StatCard
                title="Growth Velocity"
                value={`${stats.successRate || 0}%`}
                icon={Icons.Chart}
                colorClass="text-rose-400"
                gradient="bg-gradient-to-br from-rose-500/5 to-transparent"
            />
        </div>
    );
};

export default StatsOverview;
