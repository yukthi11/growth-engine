import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import RegionPanel from './RegionPanel';
import { getGeoStats } from '../../api/client';

// ─── Known location coordinates (expandable dictionary) ───────────────
const LOCATION_COORDS = {
    // Singapore
    'singapore': [1.3521, 103.8198],
    'sentosa': [1.2494, 103.8303],
    'marina bay': [1.2814, 103.8585],
    'orchard': [1.3048, 103.8318],
    'jurong': [1.3329, 103.7436],
    'changi': [1.3644, 103.9915],
    'tampines': [1.3496, 103.9568],
    'woodlands': [1.4382, 103.7891],
    'bugis': [1.3009, 103.8554],
    'chinatown': [1.2836, 103.8443],
    // India
    'mumbai': [19.0760, 72.8777],
    'delhi': [28.6139, 77.2090],
    'bangalore': [12.9716, 77.5946],
    'bengaluru': [12.9716, 77.5946],
    'chennai': [13.0827, 80.2707],
    'hyderabad': [17.3850, 78.4867],
    'pune': [18.5204, 73.8567],
    'kolkata': [22.5726, 88.3639],
    'jaipur': [26.9124, 75.7873],
    'ahmedabad': [23.0225, 72.5714],
    'goa': [15.2993, 74.1240],
    'kochi': [9.9312, 76.2673],
    // UAE
    'dubai': [25.2048, 55.2708],
    'abu dhabi': [24.4539, 54.3773],
    // USA
    'new york': [40.7128, -74.0060],
    'los angeles': [34.0522, -118.2437],
    'san francisco': [37.7749, -122.4194],
    'miami': [25.7617, -80.1918],
    'chicago': [41.8781, -87.6298],
    // UK
    'london': [51.5074, -0.1278],
    'manchester': [53.4808, -2.2426],
    // Australia
    'sydney': [-33.8688, 151.2093],
    'melbourne': [-37.8136, 144.9631],
    // Southeast Asia
    'bangkok': [13.7563, 100.5018],
    'kuala lumpur': [3.1390, 101.6869],
    'jakarta': [-6.2088, 106.8456],
    'ho chi minh': [10.8231, 106.6297],
    'manila': [14.5995, 120.9842],
    // Others
    'tokyo': [35.6762, 139.6503],
    'hong kong': [22.3193, 114.1694],
    'toronto': [43.6532, -79.3832],
    'paris': [48.8566, 2.3522],
    'berlin': [52.5200, 13.4050],
};

/**
 * Attempts to geocode a campaign name / location string by matching against
 * the known LOCATION_COORDS dictionary. Returns [lat, lng] or null.
 */
const geocodeCampaignName = (name, topLocation) => {
    const searchStrings = [name, topLocation].filter(Boolean).map(s => s.toLowerCase());

    for (const str of searchStrings) {
        // Try exact match first
        if (LOCATION_COORDS[str]) return LOCATION_COORDS[str];

        // Try partial match — check if any known location key is contained in the string
        for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
            if (str.includes(key)) return coords;
        }
    }
    return null;
};

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

    // Process campaigns into map markers
    const markers = useMemo(() => {
        return geoData
            .map(campaign => {
                const coords = geocodeCampaignName(campaign.campaign_name, campaign.top_location);
                if (!coords) return null;
                return {
                    ...campaign,
                    coords,
                    responseRate: campaign.total_leads > 0
                        ? Math.round((campaign.responded / campaign.total_leads) * 100)
                        : 0,
                };
            })
            .filter(Boolean);
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
                            Run intelligence searches with location keywords (e.g., "Resorts in Sentosa, Singapore") and they'll appear here as geographic markers.
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
                        {unmappedCampaigns} campaign{unmappedCampaigns > 1 ? 's' : ''} could not be mapped — add location keywords to campaign names for better coverage.
                    </span>
                </div>
            )}
        </div>
    );
};

export default MapCommandCenter;
