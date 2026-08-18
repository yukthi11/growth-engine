import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import RegionPanel from './RegionPanel';
import { getGeoStats } from '../../api/client';

// ─── Custom pulsing marker icon ───────────────────────────────────────
const createPulsingIcon = (leadsCount) => {
    const size = Math.min(20 + Math.sqrt(leadsCount) * 4, 48);
    return L.divIcon({
        className: 'custom-marker',
        html: `
            <div style="
                position: relative;
                width: ${size}px;
                height: ${size}px;
            ">
                <div style="
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    background: rgba(139, 92, 246, 0.3);
                    animation: markerPulse 2s ease-in-out infinite;
                "></div>
                <div style="
                    position: absolute;
                    inset: 4px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
                    border: 2px solid rgba(255,255,255,0.3);
                    box-shadow: 0 0 15px rgba(139, 92, 246, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <span style="
                        color: white;
                        font-size: ${Math.max(9, size / 4)}px;
                        font-weight: 900;
                        font-family: 'Outfit', 'Inter', sans-serif;
                    ">${leadsCount}</span>
                </div>
            </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
};

// ─── Map animation controller ─────────────────────────────────────────
const MapController = ({ flyTo }) => {
    const map = useMap();
    useEffect(() => {
        if (flyTo) {
            map.flyTo(flyTo.coords, flyTo.zoom, {
                duration: 1.5,
                easeLinearity: 0.25,
            });
        }
    }, [flyTo, map]);
    return null;
};

// ─── Main Component ───────────────────────────────────────────────────
const MapCommandCenter = ({ companyId }) => {
    const [geoData, setGeoData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRegion, setSelectedRegion] = useState(null);
    const [flyTo, setFlyTo] = useState(null);

    // Fetch geo stats from backend
    useEffect(() => {
        if (!companyId) return;
        const fetchGeoData = async () => {
            setIsLoading(true);
            try {
                const data = await getGeoStats(companyId);
                setGeoData(data);
            } catch (err) {
                console.error('Failed to fetch geo stats:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchGeoData();
    }, [companyId]);

    // Process campaigns into map markers (lat/lng are geocoded server-side, see geo-stats endpoint)
    const markers = useMemo(() => {
        return geoData
            .filter(campaign => campaign.lat != null && campaign.lng != null)
            .map(campaign => ({
                ...campaign,
                coords: [campaign.lat, campaign.lng],
                responseRate: campaign.total_leads > 0
                    ? Math.round((campaign.responded / campaign.total_leads) * 100)
                    : 0,
            }));
    }, [geoData]);

    const handleMarkerClick = useCallback((marker) => {
        setSelectedRegion(marker);
        setFlyTo({ coords: marker.coords, zoom: 12 });
    }, []);

    const handleClosePanel = useCallback(() => {
        setSelectedRegion(null);
        setFlyTo({ coords: [20, 78], zoom: 3 });
    }, []);

    const totalMappedLeads = useMemo(() =>
        markers.reduce((sum, m) => sum + m.total_leads, 0),
    [markers]);

    const unmappedCampaigns = useMemo(() =>
        geoData.length - markers.length,
    [geoData, markers]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[500px] rounded-[40px] border border-white/5 bg-white/[0.02]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Loading Command Center...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-600/10 border border-violet-600/20 rounded-full">
                        <svg className="h-3.5 w-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                        </svg>
                        <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">Geospatial Command Center</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Active Regions: <span className="text-violet-400">{markers.length}</span>
                        </span>
                    </div>
                    <div className="px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Mapped Leads: <span className="text-emerald-400">{totalMappedLeads.toLocaleString()}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Map Container */}
            <div className="relative rounded-[40px] overflow-hidden border border-white/5 premium-shadow" style={{ height: '520px' }}>
                {markers.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-midnight-lighter z-10">
                        <div className="text-4xl mb-4">🌍</div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight italic mb-2">No Mapped Campaigns Yet</h3>
                        <p className="text-sm font-bold text-slate-500 max-w-md text-center">
                            Once leads with a recognizable location come in, campaigns will appear here as geographic markers.
                        </p>
                    </div>
                ) : (
                    <MapContainer
                        center={[20, 78]}
                        zoom={3}
                        style={{ height: '100%', width: '100%', background: '#050811' }}
                        zoomControl={false}
                        attributionControl={false}
                    >
                        <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            subdomains="abcd"
                            maxZoom={19}
                        />
                        <MapController flyTo={flyTo} />
                        {markers.map((marker) => (
                            <Marker
                                key={marker.campaign_id}
                                position={marker.coords}
                                icon={createPulsingIcon(marker.total_leads)}
                                eventHandlers={{
                                    click: () => handleMarkerClick(marker),
                                }}
                            />
                        ))}
                    </MapContainer>
                )}

                {/* Region Panel overlay */}
                {selectedRegion && (
                    <RegionPanel
                        region={selectedRegion}
                        onClose={handleClosePanel}
                    />
                )}
            </div>

            {/* Unmapped campaigns notice */}
            {unmappedCampaigns > 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center gap-3">
                    <span className="text-amber-400 text-sm">⚠️</span>
                    <span className="text-[10px] font-black text-amber-400/70 uppercase tracking-widest">
                        {unmappedCampaigns} campaign{unmappedCampaigns > 1 ? 's' : ''} could not be mapped — their lead locations weren't recognized by the geocoder.
                    </span>
                </div>
            )}
        </div>
    );
};

export default MapCommandCenter;
