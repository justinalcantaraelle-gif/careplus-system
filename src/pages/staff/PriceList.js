import React, { useState, useEffect } from 'react';
import { 
    RiEdit2Line, RiDeleteBinLine, RiAddLine, RiSave3Line, 
    RiCloseLine, RiSearchLine, RiPriceTag3Line 
} from 'react-icons/ri';
import Swal from 'sweetalert2';
import { addAuditLog } from '../../services/auditLogger';
import { getPricelist, writePricelist } from '../../utils/storage';

const romanToInt = (roman) => {
    if (!roman) return 0;
    const romanMap = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let num = 0;
    for (let i = 0; i < roman.length; i++) {
        const current = romanMap[roman[i].toUpperCase()];
        const next = romanMap[roman[i + 1]?.toUpperCase()];
        if (next && current < next) num -= current;
        else num += current;
    }
    return num;
};

const getCategorySortValue = (categoryString) => {
    const match = categoryString.match(/^([IVXLCDM]+)[.\s]/i);
    return match ? romanToInt(match[1]) : Infinity;
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

const PriceList = () => {
    const [priceData, setPriceData] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isEditing, setIsEditing] = useState(null);
    const [editForm, setEditForm] = useState({ category: '', name: '', price: '' });

    const theme = {
        beige: '#f5f5dc',
        gold: '#d4af37',
        goldDark: '#b8860b',
        cardBg: '#fffdf5'
    };

    useEffect(() => {
        const loadPrices = async () => {
            const dbPrices = await getPricelist();
            setPriceData(Array.isArray(dbPrices) ? dbPrices : []);
        };
        loadPrices();

        window.addEventListener('storage', loadPrices);
        window.addEventListener('doc_dental_db_updated', loadPrices);
        return () => {
            window.removeEventListener('storage', loadPrices);
            window.removeEventListener('doc_dental_db_updated', loadPrices);
        };
    }, []);

    const updateStorage = (newData) => {
        setPriceData(newData);
        writePricelist(newData);
        window.dispatchEvent(new Event('storage'));
    };

    const handleAdd = () => {
        Swal.fire({
            title: 'Add Clinical Procedure',
            background: theme.cardBg,
            html: `
                <div class="text-start">
                    <label class="small fw-bold text-muted mb-1">Category Roman Numeral & Title:</label>
                    <input id="swal-cat" class="swal2-input mb-3 mt-0 w-100" placeholder="e.g. XI. NEW SERVICES">
                    <label class="small fw-bold text-muted mb-1">Procedure / Treatment Name:</label>
                    <input id="swal-name" class="swal2-input mb-3 mt-0 w-100" placeholder="e.g. Dental Deep Scaling">
                    <label class="small fw-bold text-muted mb-1">Standard Fee (PHP):</label>
                    <input id="swal-price" class="swal2-input mb-1 mt-0 w-100" placeholder="e.g. 1500">
                </div>
            `,
            confirmButtonColor: theme.goldDark,
            confirmButtonText: 'Add to Pricelist',
            showCancelButton: true,
            preConfirm: () => {
                const category = document.getElementById('swal-cat').value.trim();
                const name = document.getElementById('swal-name').value.trim();
                const price = document.getElementById('swal-price').value.trim();
                if (!category || !name || !price) {
                    Swal.showValidationMessage('All fields (Category, Name, and Price) are required.');
                    return false;
                }
                return { category, name, price };
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                const newItem = { ...result.value, id: Date.now() };
                updateStorage([...priceData, newItem]);
                addAuditLog('Added Price List Item', `${newItem.name} (${newItem.category}) - ${newItem.price}`);
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Procedure added successfully',
                    showConfirmButton: false,
                    timer: 1500
                });
            }
        });
    };

    const handleSaveEdit = (id) => {
        if (!editForm.name.trim() || !editForm.category.trim() || !editForm.price.trim()) {
            return Swal.fire('Error', 'Fields cannot be blank.', 'warning');
        }
        const originalItem = priceData.find(item => item.id === id);
        const updated = priceData.map(item => item.id === id ? { ...item, ...editForm } : item);
        updateStorage(updated);
        addAuditLog('Updated Price List Item', `${originalItem?.name || 'Procedure'} updated to ${editForm.name} - ${editForm.price}`);
        setIsEditing(null);
    };

    const handleKeyDown = (e, id) => {
        if (e.key === 'Enter') {
            handleSaveEdit(id);
        } else if (e.key === 'Escape') {
            setIsEditing(null);
        }
    };

    const handleDelete = (id) => {
        const itemToDelete = priceData.find(item => item.id === id);
        Swal.fire({
            title: 'Delete Procedure?',
            text: `Are you sure you want to remove "${itemToDelete?.name || 'this procedure'}" from the pricelist?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it'
        }).then((result) => {
            if (result.isConfirmed) {
                updateStorage(priceData.filter(item => item.id !== id));
                addAuditLog('Deleted Price List Item', `${itemToDelete?.name || 'Procedure'} was removed from the price list.`);
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Procedure removed',
                    showConfirmButton: false,
                    timer: 1500
                });
            }
        });
    };

    const filteredAndSorted = priceData
        .filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(item.price).toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            const valA = getCategorySortValue(a.category);
            const valB = getCategorySortValue(b.category);
            return valA !== valB ? valA - valB : a.name.localeCompare(b.name);
        });

    return (
        <div className="container-fluid py-4 animate__animated animate__fadeIn" style={{ backgroundColor: theme.beige, minHeight: '100vh' }}>
            <div className="card border-0 shadow-lg rounded-4" style={{ backgroundColor: theme.cardBg }}>
                <div className="card-body p-4 p-md-5">
                    <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3 mb-4">
                        <div>
                            <h3 className="fw-bold mb-1" style={{ color: theme.goldDark }}>Staff Price Management</h3>
                            <p className="text-muted small mb-0">Updates made here immediately reflect on Patient Views and Appointment Booking.</p>
                        </div>
                        <div className="d-flex flex-column flex-sm-row gap-2 align-items-sm-center">
                            <div className="input-group input-group-sm border rounded-pill px-2 bg-white" style={{ minWidth: '240px', maxWidth: '320px' }}>
                                <span className="input-group-text bg-transparent border-0"><RiSearchLine className="text-muted" /></span>
                                <input 
                                    type="text" 
                                    className="form-control border-0 bg-transparent shadow-none" 
                                    placeholder="Search procedure..." 
                                    value={searchTerm}
                                    onChange={(e)=>setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button className="btn btn-sm btn-link text-muted p-0 pe-2" onClick={() => setSearchTerm('')}>
                                        <RiCloseLine />
                                    </button>
                                )}
                            </div>
                            <button className="doc-btn doc-btn-warning shadow-sm flex-shrink-0" onClick={handleAdd}>
                                <RiAddLine size={18}/> Add Procedure
                            </button>
                        </div>
                    </div>

                    <div className="table-responsive">
                        <table className="table table-hover align-middle">
                            <thead style={{ backgroundColor: 'rgba(212, 175, 55, 0.1)' }}>
                                <tr className="small text-uppercase" style={{ color: theme.goldDark }}>
                                    <th style={{ width: '25%' }}>Category</th>
                                    <th style={{ width: '45%' }}>Service / Treatment Name</th>
                                    <th style={{ width: '18%' }}>Fee (PHP)</th>
                                    <th className="text-center" style={{ width: '12%' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSorted.length > 0 ? filteredAndSorted.map(item => (
                                    <tr key={item.id}>
                                        <td className="small fw-bold">
                                            {isEditing === item.id ? (
                                                <input 
                                                    className="form-control form-control-sm" 
                                                    value={editForm.category} 
                                                    onChange={e => setEditForm({...editForm, category: e.target.value})}
                                                    onKeyDown={e => handleKeyDown(e, item.id)}
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className="badge rounded-pill bg-light text-dark border px-3 py-1">{item.category}</span>
                                            )}
                                        </td>
                                        <td className="text-dark fw-medium">
                                            {isEditing === item.id ? (
                                                <input 
                                                    className="form-control form-control-sm" 
                                                    value={editForm.name} 
                                                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                                                    onKeyDown={e => handleKeyDown(e, item.id)}
                                                />
                                            ) : (
                                                item.name
                                            )}
                                        </td>
                                        <td className="fw-bold" style={{ color: theme.goldDark }}>
                                            {isEditing === item.id ? (
                                                <input 
                                                    className="form-control form-control-sm" 
                                                    value={editForm.price} 
                                                    onChange={e => setEditForm({...editForm, price: e.target.value})}
                                                    onKeyDown={e => handleKeyDown(e, item.id)}
                                                />
                                            ) : (
                                                formatPrice(item.price)
                                            )}
                                        </td>
                                        <td className="text-center">
                                            {isEditing === item.id ? (
                                                <div className="d-flex gap-1 justify-content-center">
                                                    <button className="doc-btn doc-btn-success doc-btn-sm shadow-sm" onClick={() => handleSaveEdit(item.id)} title="Save (Enter)" style={{ padding: '4px 8px' }}>
                                                        <RiSave3Line size={14}/>
                                                    </button>
                                                    <button className="doc-btn doc-btn-neutral doc-btn-sm shadow-sm" onClick={() => setIsEditing(null)} title="Cancel (Esc)" style={{ padding: '4px 8px' }}>
                                                        <RiCloseLine size={14}/>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="d-flex gap-1 justify-content-center">
                                                    <button 
                                                        className="doc-btn doc-btn-info doc-btn-sm shadow-sm" 
                                                        style={{ padding: '4px 8px' }}
                                                        onClick={() => { setIsEditing(item.id); setEditForm(item); }}
                                                        title="Edit Procedure"
                                                    >
                                                        <RiEdit2Line size={14}/>
                                                    </button>
                                                    <button 
                                                        className="doc-btn doc-btn-danger doc-btn-sm shadow-sm" 
                                                        style={{ padding: '4px 8px' }}
                                                        onClick={() => handleDelete(item.id)}
                                                        title="Delete Procedure"
                                                    >
                                                        <RiDeleteBinLine size={14}/>
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" className="text-center py-5 text-muted">
                                            <RiPriceTag3Line size={36} className="text-muted opacity-50 mb-2" />
                                            <p className="mb-0 fw-medium">
                                                {searchTerm ? `No procedures match "${searchTerm}".` : 'No procedures recorded in the pricelist.'}
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PriceList;
