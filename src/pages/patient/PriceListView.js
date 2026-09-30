import { getPricelist } from '../../utils/storage';
import React, { useState, useEffect, useMemo } from 'react';
import { RiSearchLine, RiCloseLine, RiMoneyDollarCircleLine, RiPriceTag3Line } from 'react-icons/ri';

const romanToInt = (roman) => {
    if (!roman) return 0;
    const romanMap = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let num = 0;
    for (let i = 0; i < roman.length; i++) {
        const current = romanMap[roman[i].toUpperCase()];
        const next = romanMap[roman[i + 1]?.toUpperCase()];
        if (next && current < next) {
            num -= current;
        } else {
            num += current;
        }
    }
    return num;
};

const getCategorySortValue = (categoryString) => {
    const match = categoryString.match(/^([IVXLCDM]+)[.\s]/i);
    if (match) {
        return romanToInt(match[1]);
    }
    return Infinity; 
};

const formatPrice = (priceVal) => {
    if (!priceVal && priceVal !== 0) return 'TBA';
    const str = String(priceVal).replace(/[₱,]/g, '').trim();
    const num = parseFloat(str);
    if (!isNaN(num)) {
        return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    return `₱${priceVal}`;
};

const PriceListView = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [priceData, setPriceData] = useState([]);

    const theme = {
        beige: '#f5f5dc',
        gold: '#d4af37',
        goldDark: '#b8860b',
        cardBg: '#fffdf5'
    };

    useEffect(() => {
        const loadAndGroup = async () => {
            const raw = await getPricelist();
            if (raw && raw.length > 0) {
                const grouped = raw.reduce((acc, item) => {
                    const found = acc.find(c => c.category === item.category);
                    if (found) {
                        found.items.push({ name: item.name, price: item.price });
                    } else {
                        acc.push({ category: item.category, items: [{ name: item.name, price: item.price }] });
                    }
                    return acc;
                }, []);

                const sortedGrouped = grouped.sort((a, b) => {
                    const valA = getCategorySortValue(a.category);
                    const valB = getCategorySortValue(b.category);
                    return valA - valB;
                });

                sortedGrouped.forEach(section => {
                    section.items.sort((a, b) => a.name.localeCompare(b.name));
                });

                setPriceData(sortedGrouped);
            }
        };

        loadAndGroup();

        window.addEventListener('storage', loadAndGroup);
        window.addEventListener('doc_dental_db_updated', loadAndGroup);
        return () => {
            window.removeEventListener('storage', loadAndGroup);
            window.removeEventListener('doc_dental_db_updated', loadAndGroup);
        };
    }, []);

    const filteredData = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return priceData
            .map(cat => {
                if (!query) return cat;
                const matchesCategory = cat.category.toLowerCase().includes(query);
                const matchingItems = cat.items.filter(i => 
                    i.name.toLowerCase().includes(query) || String(i.price).toLowerCase().includes(query)
                );
                if (matchesCategory) return cat;
                if (matchingItems.length > 0) return { ...cat, items: matchingItems };
                return null;
            })
            .filter(Boolean);
    }, [priceData, searchTerm]);

    return (
        <div className="container-fluid animate__animated animate__fadeIn pb-5" style={{ backgroundColor: theme.beige, minHeight: '100vh', paddingTop: '30px' }}>
            <div className="row justify-content-center">
                <div className="col-lg-10 col-xl-8">
                    
                    {/* Header */}
                    <div className="text-center mb-4">
                        <img src="/dental-logo.png" alt="Clinic Logo" className="img-fluid mb-2" style={{ maxWidth: '100px', height: 'auto' }} />
                        <h2 className="fw-bold mt-2 mb-1" style={{ color: theme.goldDark, letterSpacing: '3px' }}>Clinical Services &amp; Price List</h2>
                        <p className="text-muted small">Standard service rates and procedural fees</p>
                        <div style={{ width: '60px', height: '4px', backgroundColor: theme.gold, margin: '10px auto', borderRadius: '2px' }}></div>
                    </div>

                    {/* Search Bar */}
                    <div className="input-group mb-4 shadow-sm rounded-pill overflow-hidden border bg-white">
                        <span className="input-group-text border-0 bg-transparent ps-3">
                            <RiSearchLine style={{ color: theme.goldDark, fontSize: '1.2rem' }}/>
                        </span>
                        <input 
                            type="text" 
                            className="form-control border-0 bg-transparent py-2 shadow-none" 
                            placeholder="Search procedure name or price..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                className="btn btn-light border-0 px-3"
                                type="button"
                                onClick={() => setSearchTerm('')}
                                title="Clear Search"
                            >
                                <RiCloseLine />
                            </button>
                        )}
                    </div>

                    {/* Pricelist Card */}
                    <div className="card border-0 shadow-lg rounded-4 overflow-hidden" style={{ backgroundColor: theme.cardBg }}>
                        <div className="card-body p-4 p-md-5">
                            {filteredData.length > 0 ? filteredData.map((section, idx) => (
                                <div key={idx} className="mb-5 last-mb-0">
                                    <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom" style={{ borderColor: 'rgba(212, 175, 55, 0.3)' }}>
                                        <RiPriceTag3Line style={{ color: theme.goldDark }} />
                                        <h5 className="fw-bold mb-0" style={{ color: theme.goldDark }}>
                                            {section.category}
                                        </h5>
                                    </div>
                                    <div className="d-flex flex-column gap-1">
                                        {section.items.map((item, i) => (
                                            <div 
                                                key={i} 
                                                className="d-flex justify-content-between py-2 px-2 rounded-2 border-bottom align-items-center"
                                                style={{ borderColor: 'rgba(212, 175, 55, 0.15)', transition: 'background-color 0.15s ease' }}
                                                onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.06)'}
                                                onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <span className="text-dark fw-medium" style={{ fontSize: '0.96rem' }}>{item.name}</span>
                                                <span className="fw-bold text-nowrap ms-3" style={{ color: theme.goldDark, fontSize: '1rem' }}>
                                                    {formatPrice(item.price)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-5 text-muted">
                                    <RiMoneyDollarCircleLine size={48} className="text-muted opacity-50 mb-2" />
                                    <p className="mb-2 fw-medium">No procedures found matching your search.</p>
                                    {searchTerm && (
                                        <button 
                                            className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                                            onClick={() => setSearchTerm('')}
                                        >
                                            Clear Search
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-center mt-4">
                        <p className="text-muted small mb-0">
                            * Prices are subject to change depending on clinical evaluation and specific procedural requirements.
                        </p>
                    </div>
                </div>
            </div>
            <style>{`
                .last-mb-0:last-child { margin-bottom: 0 !important; }
            `}</style>
        </div>
    );
};

export default PriceListView;
