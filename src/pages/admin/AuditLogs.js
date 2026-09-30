import React, { useState, useEffect, useMemo } from 'react';
import { 
    RiFileList3Line, RiSearchLine, RiTimeLine, RiShieldKeyholeLine,
    RiShieldUserLine, RiEdit2Line, RiEyeLine, RiDeleteBin5Line, RiAddCircleLine,
    RiPulseLine, RiPieChartLine, RiRefreshLine, RiArrowUpLine, RiCalendarEventLine,
    RiDownloadLine
} from 'react-icons/ri';
import { readDatabase } from '../../utils/storage';
import { exportAuditLogsToCsv } from '../../utils/dataExport';

const colors = { 
    gold: '#D4AF37', 
    goldDark: '#B8860B',
    beige: '#F5F5DC', 
    cardBg: '#fffdf9',
    auth: '#3b82f6',
    viewing: '#06b6d4',
    creating: '#10b981',
    updating: '#f59e0b',
    deleting: '#ef4444',
    other: '#64748b'
};

const getLocalDateString = (d) => {
    if (!d || isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getTodayStr = () => getLocalDateString(new Date());

const AuditLogs = () => {
    
    const [logs, setLogs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [selectedDate, setSelectedDate] = useState(getTodayStr()); // 'YYYY-MM-DD' or '' for all dates
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const [lastRefreshed, setLastRefreshed] = useState(new Date());

    useEffect(() => {
        const loadLogs = () => {
            const db = readDatabase({});
            setLogs(db.audit_logs || db.auditLogs || []);
            setLastRefreshed(new Date());
        };

        loadLogs();

        const handleStorage = (event) => {
            if (!event.key || event.key === 'doc_dental_db') loadLogs();
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener('auditLogsUpdated', loadLogs);
        window.addEventListener('doc_dental_db_updated', loadLogs);
        // Fallback sync timer (real-time updates handled by events)
        const refreshTimer = setInterval(loadLogs, 30000);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('auditLogsUpdated', loadLogs);
            window.removeEventListener('doc_dental_db_updated', loadLogs);
            clearInterval(refreshTimer);
        };
    }, []);

    // Helper for log date parsing
    const parseLogDate = (log) => {
        if (!log) return new Date();
        if (log.timestamp) {
            const d = new Date(log.timestamp);
            if (!isNaN(d.getTime())) return d;
        }
        if (log.createdAt) {
            const d = new Date(log.createdAt);
            if (!isNaN(d.getTime())) return d;
        }
        if (log.id && typeof log.id === 'number' && log.id > 1000000000000) {
            return new Date(log.id);
        }
        return new Date();
    };

    // Helper to format log timestamp into clean local date and time string
    const formatLogDateTime = (log) => {
        if (!log) return '';
        const d = parseLogDate(log);
        if (!d || isNaN(d.getTime())) return log.timestamp || 'N/A';
        return d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    // Categorization logic for actions
    const getLogCategory = (action) => {
        const text = String(action || '').toLowerCase();
        if (text.includes('login') || text.includes('logout') || text.includes('sign') || text.includes('otp')) return 'Auth';
        if (text.includes('viewed') || text.includes('opened') || text.includes('print') || text.includes('download')) return 'Viewing';
        if (text.includes('created') || text.includes('added') || text.includes('new') || text.includes('generated')) return 'Creating';
        if (text.includes('updated') || text.includes('set') || text.includes('approved') || text.includes('revoked') || text.includes('changed') || text.includes('reset') || text.includes('disabled') || text.includes('enabled') || text.includes('made')) return 'Updating';
        if (text.includes('deleted') || text.includes('removed')) return 'Deleting';
        return 'Other';
    };

    // Date and action-filtered logs (excluding system/other background noise)
    const rangeFilteredLogs = useMemo(() => {
        return logs.filter(log => {
            const isUserAction = getLogCategory(log.action) !== 'Other';
            if (!isUserAction) return false;
            if (!selectedDate) return true;
            const date = parseLogDate(log);
            return getLocalDateString(date) === selectedDate;
        });
    }, [logs, selectedDate]);

    // Formatted label for chosen date
    const formattedSelectedDate = useMemo(() => {
        if (!selectedDate) return 'All Dates';
        if (selectedDate === getTodayStr()) return 'Today';
        const parts = selectedDate.split('-');
        if (parts.length === 3) {
            const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        return selectedDate;
    }, [selectedDate]);

    // Categories with counts
    const categories = [
        { id: 'All', label: 'All Activities', count: rangeFilteredLogs.length },
        { id: 'Auth', label: 'Sign In / Out', count: rangeFilteredLogs.filter(l => getLogCategory(l.action) === 'Auth').length },
        { id: 'Viewing', label: 'Record Views', count: rangeFilteredLogs.filter(l => getLogCategory(l.action) === 'Viewing').length },
        { id: 'Creating', label: 'Creations', count: rangeFilteredLogs.filter(l => getLogCategory(l.action) === 'Creating').length },
        { id: 'Updating', label: 'Updates', count: rangeFilteredLogs.filter(l => getLogCategory(l.action) === 'Updating').length },
        { id: 'Deleting', label: 'Deletions', count: rangeFilteredLogs.filter(l => getLogCategory(l.action) === 'Deleting').length }
    ];

    // Filter logs based on search and selected category
    const filteredLogs = rangeFilteredLogs.filter(log => {
        const formattedDate = formatLogDateTime(log);
        const matchesSearch = [
            log.timestamp,
            formattedDate,
            log.user,
            log.userName,
            log.role,
            log.action,
            log.details,
            log.target
        ].some(value => String(value || '').toLowerCase().includes(searchTerm.toLowerCase()));

        if (activeCategory === 'All') return matchesSearch;
        return matchesSearch && getLogCategory(log.action) === activeCategory;
    });

    // Timeline aggregation data for Area Chart
    const timelineData = useMemo(() => {
        if (selectedDate) {
            // Group by 2-hour intervals for the selected date (00:00, 02:00, ..., 22:00)
            const buckets = Array.from({ length: 12 }, (_, i) => {
                const hour = i * 2;
                const label = `${String(hour).padStart(2, '0')}:00`;
                return { label, hourStart: hour, hourEnd: hour + 2, count: 0, auth: 0, viewing: 0, creating: 0, updating: 0, deleting: 0, other: 0 };
            });

            logs.forEach(log => {
                const d = parseLogDate(log);
                if (getLocalDateString(d) === selectedDate) {
                    const hour = d.getHours();
                    const bIndex = Math.floor(hour / 2);
                    if (buckets[bIndex]) {
                        buckets[bIndex].count += 1;
                        const cat = getLogCategory(log.action);
                        if (cat === 'Auth') buckets[bIndex].auth += 1;
                        else if (cat === 'Viewing') buckets[bIndex].viewing += 1;
                        else if (cat === 'Creating') buckets[bIndex].creating += 1;
                        else if (cat === 'Updating') buckets[bIndex].updating += 1;
                        else if (cat === 'Deleting') buckets[bIndex].deleting += 1;
                        else buckets[bIndex].other += 1;
                    }
                }
            });
            return buckets;
        } else {
            // Group into 8 historical segments when viewing All dates
            const total = logs.length;
            if (total === 0) return [];
            const buckets = Array.from({ length: 8 }, (_, i) => ({
                label: `Phase ${i + 1}`,
                count: 0, auth: 0, viewing: 0, creating: 0, updating: 0, deleting: 0, other: 0
            }));

            const sortedLogs = [...logs].sort((a, b) => parseLogDate(a) - parseLogDate(b));
            const chunkSize = Math.ceil(total / 8);

            sortedLogs.forEach((log, idx) => {
                const bIndex = Math.min(Math.floor(idx / chunkSize), 7);
                if (buckets[bIndex]) {
                    buckets[bIndex].count += 1;
                    const cat = getLogCategory(log.action);
                    if (cat === 'Auth') buckets[bIndex].auth += 1;
                    else if (cat === 'Viewing') buckets[bIndex].viewing += 1;
                    else if (cat === 'Creating') buckets[bIndex].creating += 1;
                    else if (cat === 'Updating') buckets[bIndex].updating += 1;
                    else if (cat === 'Deleting') buckets[bIndex].deleting += 1;
                    else buckets[bIndex].other += 1;
                }
            });
            return buckets;
        }
    }, [logs, selectedDate]);

    // Category distribution counts for Donut Chart
    const categoryCounts = useMemo(() => {
        const counts = { Auth: 0, Viewing: 0, Creating: 0, Updating: 0, Deleting: 0, Other: 0 };
        rangeFilteredLogs.forEach(l => {
            const cat = getLogCategory(l.action);
            if (counts[cat] !== undefined) counts[cat] += 1;
            else counts.Other += 1;
        });
        return counts;
    }, [rangeFilteredLogs]);

    const totalRangeLogs = rangeFilteredLogs.length || 1;

    // Helper for category badge styling
    const getBadgeStyle = (action) => {
        const cat = getLogCategory(action);
        switch (cat) {
            case 'Auth': return 'bg-primary-subtle text-primary border border-primary-subtle';
            case 'Viewing': return 'bg-info-subtle text-info border border-info-subtle';
            case 'Creating': return 'bg-success-subtle text-success border border-success-subtle';
            case 'Updating': return 'bg-warning-subtle text-warning border border-warning-subtle';
            case 'Deleting': return 'bg-danger-subtle text-danger border border-danger-subtle';
            default: return 'bg-secondary-subtle text-secondary border border-secondary-subtle';
        }
    };

    // Helper for category icon mapping
    const getCategoryIcon = (action) => {
        const cat = getLogCategory(action);
        switch (cat) {
            case 'Auth': return <RiShieldUserLine className="me-1" />;
            case 'Viewing': return <RiEyeLine className="me-1" />;
            case 'Creating': return <RiAddCircleLine className="me-1" />;
            case 'Updating': return <RiEdit2Line className="me-1" />;
            case 'Deleting': return <RiDeleteBin5Line className="me-1" />;
            default: return <RiFileList3Line className="me-1" />;
        }
    };

    // Build SVG Path for Timeline Graph
    const graphWidth = 600;
    const graphHeight = 160;
    const padding = 30;

    const maxCount = useMemo(() => {
        const max = Math.max(...timelineData.map(d => d.count), 5);
        return Math.ceil(max / 5) * 5;
    }, [timelineData]);

    const points = useMemo(() => {
        if (timelineData.length === 0) return [];
        const stepX = (graphWidth - 2 * padding) / (timelineData.length - 1 || 1);
        return timelineData.map((d, index) => {
            const x = padding + index * stepX;
            const y = graphHeight - padding - (d.count / maxCount) * (graphHeight - 2 * padding);
            return { x, y, ...d };
        });
    }, [timelineData, maxCount]);

    // Path generators
    const linePath = useMemo(() => {
        if (points.length === 0) return '';
        return points.reduce((acc, point, i) => {
            if (i === 0) return `M ${point.x},${point.y}`;
            const prev = points[i - 1];
            const cpX1 = prev.x + (point.x - prev.x) / 2;
            const cpY1 = prev.y;
            const cpX2 = prev.x + (point.x - prev.x) / 2;
            const cpY2 = point.y;
            return `${acc} C ${cpX1},${cpY1} ${cpX2},${cpY2} ${point.x},${point.y}`;
        }, '');
    }, [points]);

    const areaPath = useMemo(() => {
        if (points.length === 0) return '';
        const bottomY = graphHeight - padding;
        const firstX = points[0].x;
        const lastX = points[points.length - 1].x;
        return `${linePath} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
    }, [linePath, points]);

    // Donut SVG parameters (Calculates 100% of User Actions, excluding system/other background noise)
    const donutSegments = useMemo(() => {
        const catList = [
            { key: 'Auth', label: 'Auth / Security', color: colors.auth, count: categoryCounts.Auth, icon: <RiShieldUserLine /> },
            { key: 'Viewing', label: 'Record Views', color: colors.viewing, count: categoryCounts.Viewing, icon: <RiEyeLine /> },
            { key: 'Creating', label: 'Creations', color: colors.creating, count: categoryCounts.Creating, icon: <RiAddCircleLine /> },
            { key: 'Updating', label: 'Updates', color: colors.updating, count: categoryCounts.Updating, icon: <RiEdit2Line /> },
            { key: 'Deleting', label: 'Deletions', color: colors.deleting, count: categoryCounts.Deleting, icon: <RiDeleteBin5Line /> }
        ];

        const meaningfulTotal = catList.reduce((sum, item) => sum + item.count, 0);
        const validTotal = meaningfulTotal > 0 ? meaningfulTotal : 1;
        let cumulativePercent = 0;
        return catList.map(cat => {
            const rawPercent = meaningfulTotal > 0 ? (cat.count / validTotal) * 100 : 0;
            const strokeDasharray = `${rawPercent} ${100 - rawPercent}`;
            const strokeDashoffset = -cumulativePercent;
            cumulativePercent += rawPercent;
            const formattedPct = rawPercent % 1 === 0 ? rawPercent.toFixed(0) : rawPercent.toFixed(1);
            return { ...cat, percentVal: rawPercent, percentStr: formattedPct, strokeDasharray, strokeDashoffset, totalActions: meaningfulTotal };
        });
    }, [categoryCounts]);

    return (
        <div className="p-4 p-md-5 w-100 animate__animated animate__fadeIn" style={{ backgroundColor: colors.beige, minHeight: '100vh' }}>
            
            {/* Page Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <h2 className="fw-bold mb-0" style={{ color: colors.goldDark }}>System Audit Logs</h2>
                        <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1 d-inline-flex align-items-center gap-1 shadow-sm">
                            <span className="spinner-grow spinner-grow-sm text-success" role="status" style={{ width: '8px', height: '8px' }}></span>
                            LIVE ANALYTICS
                        </span>
                    </div>
                    <p className="text-muted mb-0">Real-time system event metrics, user activity velocity, and analytics graphs.</p>
                </div>
                
                <div className="d-flex align-items-center gap-3 flex-wrap justify-content-md-end">
                    {/* Date Picker Selector - Fixed Size Box */}
                    <div className="d-flex align-items-center bg-white rounded-pill shadow-sm px-3" style={{ width: '330px', height: '42px', border: `1.5px solid ${colors.gold}` }}>
                        <RiCalendarEventLine className="fs-5 me-2" style={{ color: colors.goldDark, flexShrink: 0 }} />
                        <span className="fw-bold small text-secondary me-1" style={{ flexShrink: 0 }}>Date:</span>
                        <input 
                            type="date" 
                            className="form-control form-control-sm border-0 shadow-none bg-transparent fw-bold text-dark px-0"
                            style={{ cursor: 'pointer', color: colors.goldDark, flex: 1, minWidth: 0, fontSize: '13px' }}
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                        {selectedDate !== getTodayStr() && (
                            <button 
                                type="button"
                                className="doc-btn doc-btn-neutral doc-btn-sm py-0 px-2 ms-1"
                                style={{ fontSize: '11px', flexShrink: 0, minHeight: '26px' }}
                                onClick={() => setSelectedDate(getTodayStr())}
                                title="Reset to Today"
                            >
                                Today
                            </button>
                        )}
                        {selectedDate && (
                            <button 
                                type="button"
                                className="doc-btn doc-btn-neutral doc-btn-sm py-0 px-2 ms-1"
                                style={{ fontSize: '11px', flexShrink: 0, minHeight: '26px' }}
                                onClick={() => setSelectedDate('')}
                                title="Show All Logs"
                            >
                                All
                            </button>
                        )}
                    </div>

                    {/* Search Bar - Identical Fixed Size Box */}
                    <div className="d-flex align-items-center bg-white rounded-pill shadow-sm px-3" style={{ width: '330px', height: '42px', border: `1.5px solid ${colors.gold}` }}>
                        <RiSearchLine className="fs-5 text-muted me-2" style={{ flexShrink: 0 }} />
                        <input 
                            type="text" 
                            className="form-control form-control-sm border-0 shadow-none bg-transparent px-0 text-dark" 
                            style={{ fontSize: '13.5px' }}
                            placeholder="Search logs..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Download Logs CSV */}
                    <button
                        type="button"
                        className="btn btn-outline-dark rounded-pill px-3 shadow-sm d-flex align-items-center gap-2 fw-semibold text-nowrap"
                        style={{ height: '42px', border: `1.5px solid ${colors.goldDark}` }}
                        onClick={() => {
                            const fileName = selectedDate 
                                ? `DocDental_Audit_Logs_${selectedDate}.csv` 
                                : `DocDental_Audit_Logs_All.csv`;
                            exportAuditLogsToCsv(filteredLogs, fileName);
                        }}
                        title="Download audit logs as CSV"
                    >
                        <RiDownloadLine size={18} />
                        <span>Download Logs (CSV)</span>
                    </button>
                </div>
            </div>

            {/* REAL-TIME DATA ANALYTICS DASHBOARD GRAPH ROW */}
            <div className="row g-4 mb-4">
                
                {/* Graph 1: Real-Time System Activity Timeline (Curved Area Chart) */}
                <div className="col-12 col-lg-7 col-xl-8">
                    <div className="card border-0 shadow-sm p-4 h-100 position-relative overflow-hidden" style={{ borderRadius: '20px', backgroundColor: colors.cardBg }}>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <div className="d-flex align-items-center gap-2">
                                <div className="p-2 rounded-3 text-white shadow-sm" style={{ backgroundColor: colors.goldDark }}>
                                    <RiPulseLine size={22} />
                                </div>
                                <div>
                                    <h6 className="fw-bold mb-0 text-dark">Real-Time Event Velocity</h6>
                                    <small className="text-muted">
                                        {selectedDate ? `Activity frequency for ${formattedSelectedDate}` : 'Activity frequency across all time'} • <span className="text-success fw-semibold">Auto-refreshing (2s)</span>
                                    </small>
                                </div>
                            </div>

                            <div className="text-end">
                                <span className="fs-4 fw-bold text-dark">{rangeFilteredLogs.length}</span>
                                <small className="d-block text-muted" style={{ fontSize: '11px' }}>Events recorded</small>
                            </div>
                        </div>

                        {/* Interactive SVG Area Chart */}
                        <div className="position-relative w-100" style={{ height: '200px' }}>
                            <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} className="w-100 h-100 overflow-visible">
                                <defs>
                                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={colors.gold} stopOpacity="0.45" />
                                        <stop offset="100%" stopColor={colors.gold} stopOpacity="0.02" />
                                    </linearGradient>
                                    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                                        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor={colors.goldDark} floodOpacity="0.3" />
                                    </filter>
                                </defs>

                                {/* Grid Lines */}
                                {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                                    const y = padding + pct * (graphHeight - 2 * padding);
                                    return (
                                        <line 
                                            key={idx} 
                                            x1={padding} 
                                            y1={y} 
                                            x2={graphWidth - padding} 
                                            y2={y} 
                                            stroke="#e2e8f0" 
                                            strokeDasharray="4 4" 
                                            strokeWidth="1"
                                        />
                                    );
                                })}

                                {/* Area Path */}
                                {areaPath && <path d={areaPath} fill="url(#areaGradient)" />}

                                {/* Curved Line Path */}
                                {linePath && (
                                    <path 
                                        d={linePath} 
                                        fill="none" 
                                        stroke={colors.goldDark} 
                                        strokeWidth="3" 
                                        strokeLinecap="round"
                                        filter="url(#shadow)"
                                    />
                                )}

                                {/* Data Points */}
                                {points.map((pt, idx) => (
                                    <g key={idx} className="chart-point-group" style={{ cursor: 'pointer' }}>
                                        <circle 
                                            cx={pt.x} 
                                            cy={pt.y} 
                                            r={hoveredPoint?.label === pt.label ? "7" : "4.5"}
                                            fill={hoveredPoint?.label === pt.label ? colors.goldDark : "#ffffff"}
                                            stroke={colors.goldDark}
                                            strokeWidth="2.5"
                                            onMouseEnter={() => setHoveredPoint(pt)}
                                            onMouseLeave={() => setHoveredPoint(null)}
                                            style={{ transition: 'all 0.2s ease' }}
                                        />
                                        {/* X Axis Label */}
                                        <text 
                                            x={pt.x} 
                                            y={graphHeight - 8} 
                                            textAnchor="middle" 
                                            fill="#64748b" 
                                            fontSize="10"
                                            fontWeight="600"
                                        >
                                            {pt.label}
                                        </text>
                                    </g>
                                ))}
                            </svg>

                            {/* Floating Tooltip when hovering chart points */}
                            {hoveredPoint && (
                                <div 
                                    className="position-absolute shadow-lg rounded-3 p-2 text-white animate__animated animate__fadeIn"
                                    style={{
                                        left: `${Math.min(Math.max((hoveredPoint.x / graphWidth) * 100, 10), 85)}%`,
                                        top: `${Math.max((hoveredPoint.y / graphHeight) * 100 - 35, 5)}%`,
                                        transform: 'translate(-50%, -100%)',
                                        backgroundColor: '#1f1b18',
                                        zIndex: 10,
                                        fontSize: '11px',
                                        pointerEvents: 'none',
                                        border: `1px solid ${colors.gold}`
                                    }}
                                >
                                    <div className="fw-bold mb-1 border-bottom pb-1 text-warning d-flex justify-content-between gap-3">
                                        <span>{hoveredPoint.label}</span>
                                        <span>{hoveredPoint.count} Events</span>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <span>Auth: <strong>{hoveredPoint.auth}</strong></span>
                                        <span>Views: <strong>{hoveredPoint.viewing}</strong></span>
                                        <span>Updates: <strong>{hoveredPoint.updating}</strong></span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sparkline analytics footer note */}
                        <div className="d-flex align-items-center justify-content-between mt-2 pt-2 border-top text-muted" style={{ fontSize: '11px' }}>
                            <span className="d-flex align-items-center gap-1">
                                <RiRefreshLine className="spin-slow" /> Updated at {lastRefreshed.toLocaleTimeString()}
                            </span>
                            <span className="badge bg-light text-dark border">
                                Peak Interval Volume: {maxCount} events
                            </span>
                        </div>
                    </div>
                </div>

                {/* Graph 2: Real-Time Category Distribution (Donut & Composition Chart) */}
                <div className="col-12 col-lg-5 col-xl-4">
                    <div className="card border-0 shadow-sm p-4 h-100" style={{ borderRadius: '20px', backgroundColor: colors.cardBg }}>
                        <div className="d-flex align-items-center gap-2 mb-3">
                            <div className="p-2 rounded-3 bg-primary-subtle text-primary">
                                <RiPieChartLine size={20} />
                            </div>
                            <div>
                                <h6 className="fw-bold mb-0 text-dark">Category Distribution</h6>
                                <small className="text-muted">Breakdown by activity classification</small>
                            </div>
                        </div>

                        <div className="d-flex align-items-center justify-content-center my-2 position-relative">
                            {/* SVG Donut Chart */}
                            <svg viewBox="0 0 36 36" className="w-100" style={{ maxWidth: '150px', transform: 'rotate(-90deg)' }}>
                                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#f1f5f9" strokeWidth="4.5" />
                                {donutSegments.map((seg, idx) => (
                                    <circle
                                        key={idx}
                                        cx="18"
                                        cy="18"
                                        r="15.9155"
                                        fill="none"
                                        stroke={seg.color}
                                        strokeWidth="4.5"
                                        strokeDasharray={seg.strokeDasharray}
                                        strokeDashoffset={seg.strokeDashoffset}
                                        style={{ transition: 'all 0.5s ease' }}
                                    />
                                ))}
                            </svg>
                            <div className="position-absolute text-center">
                                <span className="fs-4 fw-bold text-dark d-block leading-tight">{donutSegments[0]?.totalActions || 0}</span>
                                <small className="text-muted" style={{ fontSize: '10px' }}>User Actions</small>
                            </div>
                        </div>

                        {/* Legend Progress Breakdown (100% data representation) */}
                        <div className="mt-3">
                            {donutSegments.map((item, idx) => (
                                <div key={idx} className="mb-2">
                                    <div className="d-flex justify-content-between align-items-center small mb-1">
                                        <span className="d-flex align-items-center gap-1 text-secondary" style={{ fontSize: '12px' }}>
                                            <span style={{ color: item.color }}>{item.icon}</span>
                                            {item.label}
                                        </span>
                                        <span className="fw-bold text-dark" style={{ fontSize: '12px' }}>
                                            {item.count} <span className="text-muted font-monospace">({item.percentStr}%)</span>
                                        </span>
                                    </div>
                                    <div className="progress" style={{ height: '4px', backgroundColor: '#f1f5f9' }}>
                                        <div 
                                            className="progress-bar rounded-pill" 
                                            role="progressbar" 
                                            style={{ width: `${item.percentVal}%`, backgroundColor: item.color, transition: 'width 0.5s ease' }} 
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>

            {/* KPI METRICS OVERVIEW STRIP */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm p-3 d-flex flex-row align-items-center gap-3" style={{ borderRadius: '14px', backgroundColor: colors.cardBg }}>
                        <div className="p-3 rounded-4 bg-primary-subtle text-primary">
                            <RiShieldUserLine size={24} />
                        </div>
                        <div>
                            <div className="text-muted fw-bold text-uppercase" style={{ fontSize: '11px' }}>Access Events</div>
                            <div className="fs-4 fw-bold text-dark">{categoryCounts.Auth}</div>
                            <div className="text-success small d-flex align-items-center" style={{ fontSize: '11px' }}>
                                <RiArrowUpLine /> {rangeFilteredLogs.length ? ((categoryCounts.Auth / totalRangeLogs) * 100).toFixed(0) : 0}% of total
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm p-3 d-flex flex-row align-items-center gap-3" style={{ borderRadius: '14px', backgroundColor: colors.cardBg }}>
                        <div className="p-3 rounded-4 bg-info-subtle text-info">
                            <RiEyeLine size={24} />
                        </div>
                        <div>
                            <div className="text-muted fw-bold text-uppercase" style={{ fontSize: '11px' }}>Clinical Views</div>
                            <div className="fs-4 fw-bold text-dark">{categoryCounts.Viewing}</div>
                            <div className="text-info small d-flex align-items-center" style={{ fontSize: '11px' }}>
                                Inspection & prints
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm p-3 d-flex flex-row align-items-center gap-3" style={{ borderRadius: '14px', backgroundColor: colors.cardBg }}>
                        <div className="p-3 rounded-4 bg-warning-subtle text-warning">
                            <RiEdit2Line size={24} style={{ color: '#ff8c00' }} />
                        </div>
                        <div>
                            <div className="text-muted fw-bold text-uppercase" style={{ fontSize: '11px' }}>Data Modifies</div>
                            <div className="fs-4 fw-bold text-dark">{categoryCounts.Updating + categoryCounts.Creating}</div>
                            <div className="text-warning small d-flex align-items-center" style={{ fontSize: '11px' }}>
                                Writes & edits
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm p-3 d-flex flex-row align-items-center gap-3" style={{ borderRadius: '14px', backgroundColor: colors.cardBg }}>
                        <div className="p-3 rounded-4 bg-danger-subtle text-danger">
                            <RiDeleteBin5Line size={24} />
                        </div>
                        <div>
                            <div className="text-muted fw-bold text-uppercase" style={{ fontSize: '11px' }}>Critical Deletions</div>
                            <div className="fs-4 fw-bold text-dark">{categoryCounts.Deleting}</div>
                            <div className="text-danger small d-flex align-items-center" style={{ fontSize: '11px' }}>
                                Removed records
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Categories Filter Tabs */}
            <div className="d-flex flex-wrap gap-2 mb-4">
                {categories.map((cat) => {
                    const isActive = activeCategory === cat.id;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`doc-btn ${isActive ? 'doc-btn-warning' : 'doc-btn-neutral'} shadow-sm`}
                            style={{
                                fontSize: '13px',
                                ...(isActive && { backgroundColor: '#fffbeb', borderColor: '#fde047', color: '#a16207', fontWeight: 700 })
                            }}
                        >
                            {cat.label}
                            <span className={`badge rounded-pill ${isActive ? 'bg-white text-dark border' : 'bg-light text-secondary border'}`}>
                                {cat.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Logs Table Card */}
            <div className="card border-0 shadow-sm rounded-4 bg-white overflow-hidden">
                <div className="p-4 border-bottom d-flex align-items-center gap-2">
                    <RiShieldKeyholeLine className="fs-5 fw-bold text-dark" />
                    <h5 className="fw-bold mb-0 text-dark">Activity Log History</h5>
                    <span className="badge ms-auto bg-light text-muted border">
                        {filteredLogs.length} Records Shown
                    </span>
                </div>
                
                <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                        <thead className="bg-light">
                            <tr style={{ fontSize: '12px' }}>
                                <th className="p-4 fw-bold border-0 text-muted">Date &amp; Time</th>
                                <th className="fw-bold border-0 text-muted">User Details</th>
                                <th className="fw-bold border-0 text-muted">Category</th>
                                <th className="fw-bold border-0 text-muted">Action Log</th>
                                <th className="fw-bold border-0 text-muted">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.length > 0 ? (
                                filteredLogs.map((log, index) => (
                                    <tr key={index} style={{ fontSize: '13.5px' }}>
                                        <td className="p-4 text-dark fw-bold" style={{ whiteSpace: 'nowrap' }}>
                                            <RiTimeLine className="text-warning me-2 fs-5 align-middle" />
                                            <span className="align-middle">{formatLogDateTime(log)}</span>
                                        </td>
                                        <td className="text-muted fw-medium">
                                            <div className="text-dark fw-bold">{log.userName || log.adminName || 'System'}</div>
                                            <div className="small text-secondary">{log.user || 'system'} {log.role ? `(${log.role})` : ''}</div>
                                        </td>
                                        <td>
                                            <span className={`badge px-3 py-2 rounded-pill d-inline-flex align-items-center ${getBadgeStyle(log.action)}`}>
                                                {getCategoryIcon(log.action)}
                                                {getLogCategory(log.action)}
                                            </span>
                                        </td>
                                        <td className="fw-semibold text-dark">{log.action}</td>
                                        <td className="text-muted small" style={{ maxWidth: '300px', wordBreak: 'break-word' }}>
                                            {log.details || log.target}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="text-center p-5 text-muted" style={{ minHeight: '200px' }}>
                                        <RiFileList3Line className="fs-1 text-light mb-3 d-block mx-auto" />
                                        {searchTerm ? "No logs match your search." : "No system activity found in this category."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default AuditLogs;

