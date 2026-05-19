import React from 'react';

const CompanySelector = ({ companies, selectedCompany, onChange, minimal }) => {
    if (minimal) {
        return (
            <div className="relative group">
                <select
                    value={selectedCompany || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="appearance-none block w-full pl-3 pr-8 py-2 text-xs font-bold text-slate-300 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all cursor-pointer hover:border-white/20"
                >
                    <option value="" disabled>Select Company</option>
                    {companies.map((company) => (
                        <option key={company.id} value={company.id} className="bg-midnight text-white">
                            {company.name}
                        </option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-500 group-hover:text-violet-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full max-w-sm">
            <label htmlFor="company-select" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                Territory / Company
            </label>
            <div className="relative group">
                <select
                    id="company-select"
                    value={selectedCompany || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="appearance-none block w-full pl-4 pr-12 py-3 text-base font-semibold text-white bg-midnight-lighter border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all cursor-pointer hover:border-white/20"
                >
                    <option value="" disabled>Select a workspace...</option>
                    {companies.map((company) => (
                        <option key={company.id} value={company.id} className="bg-midnight text-white">
                            {company.name}
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

export default CompanySelector;
