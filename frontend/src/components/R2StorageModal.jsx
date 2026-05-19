import React, { useState, useEffect } from 'react';

export default function R2StorageModal() {
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                // Check if snoozed
                const snoozedUntil = localStorage.getItem('r2_snooze_until');
                if (snoozedUntil && new Date(snoozedUntil) > new Date()) {
                    return; // Still snoozed
                }

                const res = await fetch('http://localhost:5000/api/r2/status');
                if (!res.ok) return;
                
                const data = await res.json();
                
                // Show modal if warning or critical
                if (data.status === 'warn' || data.status === 'critical') {
                    setStatusData(data);
                    setIsVisible(true);
                }
            } catch (err) {
                console.error('Failed to fetch R2 status:', err);
            }
        };

        checkStatus();
    }, []);

    if (!isVisible || !statusData) return null;

    const isCritical = statusData.status === 'critical';
    const mainColor = isCritical ? '#E24B4A' : '#EF9F27'; // Red vs Amber
    const bgColor = isCritical ? 'rgba(226, 75, 74, 0.1)' : 'rgba(239, 159, 39, 0.1)';
    const badgeText = isCritical ? '🚨 Critical — billing imminent' : '⚠ Storage warning';
    const titleText = isCritical 
        ? `R2 storage at ${statusData.pctUsed}% — billing starts soon` 
        : `R2 storage at ${statusData.pctUsed}% — action needed soon`;

    const remainingMB = ((statusData.freeLimitGB * 1024) - (statusData.usedGB * 1024)).toFixed(0);

    const handleSnooze = () => {
        const tomorrow = new Date();
        tomorrow.setHours(tomorrow.getHours() + 24);
        localStorage.setItem('r2_snooze_until', tomorrow.toISOString());
        setIsVisible(false);
    };

    const handleCleanup = async () => {
        setLoading(true);
        setError(null);
        try {
            const maxAge = isCritical ? 7 : 30;
            const res = await fetch('http://localhost:5000/api/r2/cleanup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maxAgeDays: maxAge })
            });

            if (!res.ok) throw new Error('Cleanup request failed');

            const data = await res.json();
            setResult(data);
            
            // Optionally update current status
            setStatusData(prev => ({ ...prev, usedGB: data.newUsageGB, pctUsed: (data.newUsageGB / prev.freeLimitGB) * 100 }));
        } catch (err) {
            console.error('Cleanup failed:', err);
            setError('Failed to run cleanup. Please try again or check server logs.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, fontFamily: 'sans-serif'
        }}>
            <div style={{
                background: '#1a1a1a', border: `1px solid ${mainColor}`,
                borderRadius: '12px', width: '500px', maxWidth: '90%', padding: '24px',
                color: '#fff', boxShadow: `0 8px 32px ${bgColor}`
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{
                        background: mainColor, color: '#fff', padding: '4px 8px',
                        borderRadius: '4px', fontSize: '12px', fontWeight: 'bold'
                    }}>
                        {badgeText}
                    </div>
                </div>

                <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#fff' }}>
                    {titleText}
                </h2>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
                    <div style={{ width: `${Math.min(statusData.pctUsed, 100)}%`, height: '100%', background: mainColor, transition: 'width 0.3s ease' }}></div>
                </div>

                {/* Body Content */}
                {result ? (
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                        <p style={{ margin: 0, color: '#4ade80' }}>✅ Cleanup complete.</p>
                        <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#aaa' }}>
                            Deleted: {result.deleted} objects<br/>
                            Freed: {(result.freedBytes / (1024*1024)).toFixed(2)} MB<br/>
                            New Usage: {result.newUsageGB} GB
                        </p>
                    </div>
                ) : (
                    <>
                        <p style={{ fontSize: '14px', color: '#ccc', lineHeight: '1.5', marginBottom: '20px' }}>
                            {isCritical ? (
                                <>You have used {statusData.usedGB} GB. You are {remainingMB} MB away from Cloudflare starting to charge your card. Run a cleanup immediately to stay on the free tier.</>
                            ) : (
                                <>You have used {statusData.usedGB} GB of your 10 GB free limit. At your current rate you will hit the limit in approximately {statusData.daysEstimate} days. No charges yet — but if you exceed 10 GB, Cloudflare will begin billing at $0.015/GB.</>
                            )}
                        </p>

                        {/* Steps Box */}
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                            <ul style={{ margin: 0, paddingLeft: '20px', color: '#ddd', fontSize: '13px', lineHeight: '1.6' }}>
                                {isCritical ? (
                                    <>
                                        <li>Delete all mockups older than 7 days immediately</li>
                                        <li>Set TTL to 3 days for all new mockup uploads going forward</li>
                                        <li>Add a card to Cloudflare only if you intentionally want to scale</li>
                                    </>
                                ) : (
                                    <>
                                        <li>Enable auto-delete: set a 7-day TTL on R2 objects</li>
                                        <li>Run a manual cleanup: delete all mockups older than 30 days now</li>
                                        <li>Monitor weekly: check usage every Monday in your R2 dashboard</li>
                                    </>
                                )}
                            </ul>
                        </div>
                    </>
                )}

                {error && <p style={{ color: '#E24B4A', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    {result ? (
                        <button onClick={() => setIsVisible(false)} style={{
                            padding: '10px 20px', borderRadius: '6px', cursor: 'pointer',
                            background: '#333', color: '#fff', border: 'none', fontWeight: 'bold'
                        }}>
                            Close
                        </button>
                    ) : (
                        <>
                            <button onClick={handleSnooze} style={{
                                padding: '10px 16px', borderRadius: '6px', cursor: 'pointer',
                                background: 'transparent', color: '#aaa', border: '1px solid #444'
                            }}>
                                Remind me tomorrow
                            </button>
                            <button onClick={handleCleanup} disabled={loading} style={{
                                padding: '10px 20px', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer',
                                background: mainColor, color: '#fff', border: 'none', fontWeight: 'bold'
                            }}>
                                {loading ? 'Running...' : (isCritical ? 'Run cleanup now' : 'Enable auto-delete now')}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
