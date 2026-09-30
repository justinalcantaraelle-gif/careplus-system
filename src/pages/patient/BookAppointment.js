import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    RiCalendarCheckLine, RiTimeLine, RiServiceLine, 
    RiMessage2Line, RiCheckboxCircleLine, RiFileList3Line, RiArrowLeftLine, RiInformationLine,
    RiArrowLeftSLine, RiArrowRightSLine, RiCloseLine, RiLockLine, RiAlertLine,
    RiPriceTag3Line, RiCheckLine, RiArrowDownSLine, RiArrowUpSLine,
    RiBuilding4Line, RiStethoscopeLine
} from 'react-icons/ri';
import Swal from 'sweetalert2';
import { readDatabase, writeDatabase, readSession, getPricelist, checkAndCompletePastAppointments } from '../../utils/storage';
import { addUserNotification, addAppointmentNotification } from '../../utils/notificationStore';
import { addAuditLog } from '../../services/auditLogger';
import { sortAppointmentsBySchedule } from '../../utils/appointmentSort';
import { sendAppointmentStatusEmail } from '../../utils/emailService';
import { broadcastRealtimeEvent } from '../../utils/realtimeClient';
import { CLINIC_BRANCHES, CLINIC_DOCTORS } from '../../utils/careplusData';

export const bracesColorHex = {
    Blue: '#1f4ed8', 'Sky Blue': '#4dabf7', Torquoise: '#40c3ff', Black: '#000000',
    'Light Green': '#90ee90', 'Mint Green': '#3eb489', Teal: '#008080', Green: '#008000',
    'Light Orange': '#ffb347', Orange: '#ff7750', White: '#ffffff', Transparent: '#eeeeee',
    Silver: '#c0c0c0', Brown: '#8b4513', Gold: '#d4af37', Yellow: '#ffff00',
    'Dark Violet': '#9400d3', 'Light Purple': '#d8bfd8', Violet: '#8a2be2', 'Light Pink': '#ffb6c1',
    Pink: '#ff69b4', Red: '#ff0000', 'Dark Red': '#8b0000', 'Pearl Blue': '#6a5acd',
    Gray: '#808080', Pearl: '#f5f5f5', Cream: '#fffdd0', Ruby: '#9b111e',
    'Dark Blue': '#00008b', 'Metallic Blue': '#4682b4', 'Dark Green': '#006400', 'Neon Orange': '#ff5f1f',
    'Red Orange': '#ff4500', 'Neon Pink': '#ff1493', Purple: '#800080', 'Neon Yellow': '#ffff33',
    'Metallic Green': '#3cb371', 'Baby Blue': '#89cff0', Nacarat: '#ff4f00', 'Pale Blue': '#a2cffe', Maroon: '#800000'
};
const toDateInputValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

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

const getEstimatedDuration = (category, name) => {
    if (!category || !name) return '';
    const cat = category.toUpperCase();
    const sName = name.toUpperCase();

    if (
        (cat.includes("PROPHYLAXIS") && sName.includes("HEAVY")) ||
        (cat.includes("EXTRACTION") && (sName.includes("DIFFICULT") || sName.includes("ODONTECTOMY"))) ||
        (cat.includes("RESTORATION") && sName.includes("VENEER")) ||
        cat.includes("ROOT CANAL") ||
        cat.includes("WHITENING") ||
        cat.includes("ORTHODONTIC")
    ) {
        return "Approx. 1 to 1.5 hours";
    }

    if (
        cat.includes("CONSULTATION") || 
        (cat.includes("PROPHYLAXIS") && sName.includes("MILD")) ||
        (cat.includes("RESTORATION") && sName.includes("TEMPORARY")) ||
        cat.includes("FLOURIDE") || cat.includes("OP/")
    ) {
        return "Approx. 30 mins";
    }

    return "Approx. 30 to 45 mins";
};

const BookAppointment = () => {
    const navigate = useNavigate();
    const session = readSession() || {};
    const [services, setServices] = useState([]);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isReviewing, setIsReviewing] = useState(false); 
    const [bookedSlots, setBookedSlots] = useState([]); 
    const [unavailableDates, setUnavailableDates] = useState([]);
    const [showMyAppointments, setShowMyAppointments] = useState(() => {
        const flag = sessionStorage.getItem('show_my_appointments_on_load');
        if (flag === 'true') {
            sessionStorage.removeItem('show_my_appointments_on_load');
            return true;
        }
        return false;
    });
    const [myAppointments, setMyAppointments] = useState([]);
    const [bannedUntil, setBannedUntil] = useState(null);
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    
    const [booking, setBooking] = useState({
        branch: session.branch || CLINIC_BRANCHES[0].name,
        doctor: CLINIC_DOCTORS[0].name,
        category: '',
        service: '',
        duration: '',
        date: '',
        time: '',
        notes: '',
        braceColor: ''
    });
    const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
    const serviceDropdownRef = useRef(null);

    const theme = {
        beige: '#f5f5dc',
        gold: '#d4af37',
        goldDark: '#b8860b',
        cardBg: '#fffdf5'
    };

    const dynamicTimeSlots = useMemo(() => {
        let intervalMins = 60; 
        
        if (booking.duration.includes('30 mins') || booking.duration.includes('30 to 45 mins')) {
            intervalMins = 30;
        }

        const slots = [];
        const formatTime = (totalMins) => {
            const h = Math.floor(totalMins / 60);
            const m = totalMins % 60;
            const ampm = h >= 12 ? 'PM' : 'AM';
            let displayH = h > 12 ? h - 12 : h;
            if (displayH === 0) displayH = 12;
            const hStr = displayH < 10 ? `0${displayH}` : `${displayH}`;
            const mStr = m < 10 ? `0${m}` : `${m}`;
            return `${hStr}:${mStr} ${ampm}`;
        };

        for (let m = 9 * 60; m < 12 * 60; m += intervalMins) {
            slots.push(formatTime(m));
        }
        for (let m = 13 * 60; m < 17 * 60; m += intervalMins) {
            slots.push(formatTime(m));
        }
        
        return slots;
    }, [booking.duration]);

    const loadMyAppointments = useCallback(() => {
        let db = readDatabase() || { appointments: [], users: [] };

        const { db: updatedDb, updated } = checkAndCompletePastAppointments(db);
        if (updated) {
            db = updatedDb;
            writeDatabase(db);
        }

        const sessionEmail = session?.email?.toLowerCase();
        const sessionName = (session?.name || session?.fullName || '').trim().toLowerCase();

        const patientAppointments = sortAppointmentsBySchedule(
            (db.appointments || []).filter((appointment) => {
                const appointmentEmail = appointment.patientEmail?.toLowerCase();
                const appointmentName = (appointment.patientName || appointment.fullName || '').trim().toLowerCase();

                return (sessionEmail && appointmentEmail === sessionEmail) ||
                    (sessionName && appointmentName === sessionName);
            })
        );

        setMyAppointments(patientAppointments);

        // Load ban details
        const patientUser = (db.users || []).find(u => u.email?.toLowerCase() === sessionEmail);
        if (patientUser?.bannedUntil) {
            setBannedUntil(patientUser.bannedUntil);
        } else {
            setBannedUntil(null);
        }
    }, [session?.email, session?.fullName, session?.name]);

    const getStatusStyle = (status) => {
        if (status === 'Approved') return { backgroundColor: '#dff3e5', color: '#1f7a3a' };
        if (status === 'Completed') return { backgroundColor: '#e1ecff', color: '#2457a6' };
        if (status === 'Cancelled' || status === 'Declined') return { backgroundColor: '#fde2e2', color: '#a52727' };
        return { backgroundColor: '#fff3cd', color: '#8a6500' };
    };

    const handleQuickReschedule = (app) => {
        setBooking({
            category: app.category || '',
            service: app.service || app.treatment || '',
            duration: app.duration || getEstimatedDuration(app.category, app.service),
            date: '',
            time: '',
            notes: app.notes || '',
            braceColor: app.braceColor || app.color || app.bracesColor || ''
        });
        setIsSubmitted(false);
        setIsReviewing(false);
        setShowMyAppointments(false);

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: `Prefilled: ${app.service || 'Appointment'}. Please choose a new date and time.`,
            showConfirmButton: false,
            timer: 3500
        });

        setTimeout(() => {
            const calendarEl = document.getElementById('booking-calendar-step');
            if (calendarEl) {
                calendarEl.scrollIntoView({ behavior: 'smooth' });
            }
        }, 200);
    };

    useEffect(() => {
        const loadServices = async () => {
            let rawData = await getPricelist();
            if (rawData && rawData.length > 0) {
                const sortedData = [...rawData].sort((a, b) => {
                    const valA = getCategorySortValue(a.category);
                    const valB = getCategorySortValue(b.category);
                    
                    if (valA !== valB) {
                        return valA - valB;
                    }
                    return (a.name || a.service || '').localeCompare(b.name || b.service || '');
                });

                setServices(sortedData);
            }
        };
        loadServices();

        window.addEventListener('storage', loadServices);
        window.addEventListener('doc_dental_db_updated', loadServices);
        return () => {
            window.removeEventListener('storage', loadServices);
            window.removeEventListener('doc_dental_db_updated', loadServices);
        };
    }, []);

    const groupedServices = useMemo(() => {
        if (!services || services.length === 0) return [];
        const grouped = services.reduce((acc, item) => {
            const catName = item.category || 'General Procedures';
            const itemName = item.name || item.service || '';
            if (!itemName) return acc;

            const found = acc.find(c => c.category === catName);
            if (found) {
                if (!found.items.some(i => i.name === itemName)) {
                    found.items.push({ name: itemName, category: catName });
                }
            } else {
                acc.push({ category: catName, items: [{ name: itemName, category: catName }] });
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

        return sortedGrouped;
    }, [services]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(event.target)) {
                setIsServiceDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectService = (serviceName, categoryName) => {
        const estimatedTime = getEstimatedDuration(categoryName, serviceName);
        setBooking(prev => ({
            ...prev,
            service: serviceName,
            category: categoryName,
            duration: estimatedTime,
            time: ''
        }));
    };


    useEffect(() => {
        const loadUnavailableDates = () => {
            const db = readDatabase() || {};
            setUnavailableDates(Array.isArray(db.unavailableDates) ? db.unavailableDates : []);
        };

        loadUnavailableDates();
        window.addEventListener('storage', loadUnavailableDates);
        return () => window.removeEventListener('storage', loadUnavailableDates);
    }, []);

    useEffect(() => {
        if (sessionStorage.getItem('show_my_appointments_on_load') === 'true') {
            sessionStorage.removeItem('show_my_appointments_on_load');
            setShowMyAppointments(true);
        }
    }, []);

    // 5-Minute Booking Session Inactivity & Prompt Management
    useEffect(() => {
        if (isSubmitted || showMyAppointments) return;

        let promptTimer = null;
        let countdownInterval = null;

        const cancelAndRedirectToDashboard = () => {
            setBooking({
                category: '',
                service: '',
                duration: '',
                date: '',
                time: '',
                notes: '',
                braceColor: ''
            });
            setIsReviewing(false);
            
            Swal.fire({
                title: 'Booking Cancelled',
                text: 'Your booking session ended. Redirecting you back to your Patient Dashboard...',
                icon: 'info',
                timer: 2000,
                showConfirmButton: false,
                confirmButtonColor: theme.goldDark
            });

            setTimeout(() => {
                navigate('/patient');
            }, 800);
        };

        const startSessionTimer = () => {
            if (promptTimer) clearTimeout(promptTimer);
            if (countdownInterval) clearInterval(countdownInterval);

            // 5 minutes = 300,000 milliseconds
            promptTimer = setTimeout(() => {
                let timerSeconds = 60;

                Swal.fire({
                    title: 'Booking Session Notice',
                    html: `
                        <div style="font-family: inherit; text-align: left;">
                            <p style="font-size: 15px; color: #444; margin-bottom: 15px; line-height: 1.6;">
                                You have been on the appointment booking page for <strong>5 minutes</strong> without completing your reservation.
                            </p>
                            <p style="font-size: 14px; color: #666; margin-bottom: 15px;">
                                Would you like to continue booking your appointment, or return to your dashboard?
                            </p>
                            <div style="background-color: #fdf8eb; border: 1.5px solid #d4af37; padding: 12px; border-radius: 10px; font-weight: bold; color: #b8860b; font-size: 14px; text-align: center;">
                                Returning to dashboard in <span id="session-timeout-countdown" style="font-size: 20px; font-weight: 800; color: #dc3545;">60</span> seconds...
                            </div>
                        </div>
                    `,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, Continue Booking',
                    cancelButtonText: 'No, Return to Dashboard',
                    confirmButtonColor: theme.goldDark,
                    cancelButtonColor: '#6c757d',
                    allowOutsideClick: false,
                    didOpen: () => {
                        const countdownEl = document.getElementById('session-timeout-countdown');
                        countdownInterval = setInterval(() => {
                            timerSeconds -= 1;
                            if (countdownEl) countdownEl.textContent = timerSeconds;
                            if (timerSeconds <= 0) {
                                clearInterval(countdownInterval);
                                Swal.close();
                                cancelAndRedirectToDashboard();
                            }
                        }, 1000);
                    },
                    willClose: () => {
                        if (countdownInterval) clearInterval(countdownInterval);
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        // User chose to continue: restart 5-minute timer
                        startSessionTimer();
                    } else if (result.dismiss === Swal.DismissReason.cancel || result.dismiss === Swal.DismissReason.timer) {
                        cancelAndRedirectToDashboard();
                    }
                });
            }, 5 * 60 * 1000);
        };

        startSessionTimer();

        return () => {
            if (promptTimer) clearTimeout(promptTimer);
            if (countdownInterval) clearInterval(countdownInterval);
        };
    }, [isSubmitted, showMyAppointments]);

    useEffect(() => {
        loadMyAppointments();
        
        // Real-time polling interval (2s)
        const interval = setInterval(() => {
            loadMyAppointments();
        }, 2000);

        const handleDbUpdate = () => {
            loadMyAppointments();
        };

        window.addEventListener('storage', handleDbUpdate);
        window.addEventListener('doc_dental_db_updated', handleDbUpdate);
        window.addEventListener('notificationUpdated', handleDbUpdate);

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleDbUpdate);
            window.removeEventListener('doc_dental_db_updated', handleDbUpdate);
            window.removeEventListener('notificationUpdated', handleDbUpdate);
        };
    }, [loadMyAppointments]);

    useEffect(() => {
        if (booking.date) {
            const db = readDatabase() || { appointments: [] };
            const taken = (db.appointments || [])
                .filter(app => app.date === booking.date && app.status !== 'Cancelled')
                .map(app => app.time);
            
            setBookedSlots(taken);
            
            if (taken.includes(booking.time)) {
                setBooking(prev => ({ ...prev, time: '' }));
            }
        }
    }, [booking.date, booking.time]);

    const unavailableDateMap = useMemo(() => {
        return unavailableDates.reduce((map, item) => {
            if (item?.date) map[item.date] = item.reason || 'Unavailable';
            return map;
        }, {});
    }, [unavailableDates]);

    const calendarDays = useMemo(() => {
        const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
        const startDate = new Date(firstDay);
        startDate.setDate(firstDay.getDate() - firstDay.getDay());

        return Array.from({ length: 42 }, (_, index) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + index);
            return {
                date,
                iso: toDateInputValue(date),
                isCurrentMonth: date.getMonth() === calendarMonth.getMonth()
            };
        });
    }, [calendarMonth]);

    const moveCalendarMonth = (offset) => {
        setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const handleDateSelect = (dateIso, dayObj) => {
        const todayIso = toDateInputValue(new Date());

        if (dayObj && !dayObj.isCurrentMonth) {
            return Swal.fire({
                title: 'Different Month',
                text: 'Please navigate using the month arrows to select dates from other months.',
                icon: 'info',
                confirmButtonColor: theme.gold
            });
        }

        const disabledReason = unavailableDateMap[dateIso];

        if (disabledReason) {
            const escapeHtml = (unsafe) => {
                if (!unsafe) return '';
                return String(unsafe)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            };

            const formattedDate = new Date(dateIso.includes('T') ? dateIso : `${dateIso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            const isEmergency = String(disabledReason).toLowerCase().includes('emergency');
            return Swal.fire({
                title: isEmergency ? 'Clinic Emergency Closure' : 'Date Unavailable',
                html: `
                    <div class="text-start">
                        <p class="mb-2"><strong>Selected Date:</strong> ${escapeHtml(formattedDate)}</p>
                        <div class="alert alert-danger border border-danger-subtle p-3 mb-0" style="border-radius: 12px; background-color: #fdf2f2;">
                            <strong class="d-block mb-1 text-danger">${isEmergency ? 'Emergency Reason:' : 'Closure Reason:'}</strong>
                            <span class="fs-6 text-dark">${escapeHtml(disabledReason)}</span>
                        </div>
                    </div>
                `,
                icon: isEmergency ? 'error' : 'info',
                confirmButtonColor: theme.goldDark
            });
        }

        if (dateIso < todayIso) {
            return Swal.fire({
                title: 'Past Date',
                text: 'Appointments cannot be scheduled for past dates.',
                icon: 'warning',
                confirmButtonColor: theme.gold
            });
        }

        setBooking(prev => ({ ...prev, date: dateIso, time: '' }));
    };

    const handleProceedToReview = async (e) => {
        e.preventDefault();
        
        // Real-time ban validation before reviewing
        const dbNow = readDatabase() || {};
        const sessionEmail = session?.email?.toLowerCase();
        const me = (dbNow.users || []).find(u => u.email?.toLowerCase() === sessionEmail);
        if (me?.bannedUntil && new Date(me.bannedUntil) > new Date()) {
            setBannedUntil(me.bannedUntil);
            return Swal.fire({
                title: 'Booking Suspended',
                text: `Your booking privilege is currently suspended until ${new Date(me.bannedUntil).toLocaleDateString()}.`,
                icon: 'error',
                confirmButtonColor: '#dc3545'
            });
        }

        if (!booking.service) {
            return Swal.fire({
                title: 'Select a Service',
                text: 'Please select a procedure from the service list.',
                icon: 'warning',
                confirmButtonColor: theme.gold
            });
        }

        if (!booking.date) {
            return Swal.fire({
                title: 'Select a Date',
                text: 'Please choose an available appointment date.',
                icon: 'warning',
                confirmButtonColor: theme.gold
            });
        }

        const disabledReason = unavailableDateMap[booking.date];

        if (disabledReason) {
            return Swal.fire({
                title: 'Date Unavailable',
                text: disabledReason,
                icon: 'info',
                confirmButtonColor: theme.gold
            });
        }

        if (!booking.time) {
            return Swal.fire({
                title: 'Select a Time Slot',
                text: 'Please choose an available appointment time.',
                icon: 'warning',
                confirmButtonColor: theme.gold
            });
        }
        setIsReviewing(true);
    };

    const handleConfirmSubmit = () => {
        const db = readDatabase() || {};
        if (!db.appointments) db.appointments = [];

        // Real-time ban validation on final submit
        const sessionEmail = session?.email?.toLowerCase();
        const me = (db.users || []).find(u => u.email?.toLowerCase() === sessionEmail);
        if (me?.bannedUntil && new Date(me.bannedUntil) > new Date()) {
            setBannedUntil(me.bannedUntil);
            setIsReviewing(false);
            return Swal.fire({
                title: 'Booking Suspended',
                text: `Your booking privilege is currently suspended until ${new Date(me.bannedUntil).toLocaleDateString()}.`,
                icon: 'error',
                confirmButtonColor: '#dc3545'
            });
        }
        const blockedDate = (db.unavailableDates || []).find(item => item.date === booking.date);

        if (blockedDate) {
            setIsReviewing(false);
            return Swal.fire({
                title: 'Date Unavailable',
                text: blockedDate.reason || 'This date is unavailable for booking.',
                icon: 'info',
                confirmButtonColor: theme.gold
            });
        }

        const isSlotTaken = db.appointments.some(app => 
            app.date === booking.date && 
            app.time === booking.time && 
            app.status !== 'Cancelled'
        );

        if (isSlotTaken) {
            setIsReviewing(false); 
            return Swal.fire({
                title: 'Slot Taken',
                text: 'This time slot was just booked. Please choose another.',
                icon: 'error',
                confirmButtonColor: '#d33'
            });
        }

        const hasExistingOnDay = db.appointments.some(app => 
            app.patientEmail === session?.email && 
            app.date === booking.date && 
            app.status !== 'Cancelled'
        );

        if (hasExistingOnDay) {
            setIsReviewing(false); 
            return Swal.fire({
                title: 'Existing Appointment',
                text: 'You already have a booking request for this date.',
                icon: 'warning',
                confirmButtonColor: theme.gold
            });
        }

        const newAppointment = {
            ...booking,
            branch: booking.branch || session.branch || CLINIC_BRANCHES[0].name,
            doctor: booking.doctor || CLINIC_DOCTORS[0].name,
            id: Date.now(),
            patientEmail: session?.email || 'Guest',
            patientName: session?.fullName || session?.name || 'Guest',
            status: 'Pending',
            createdAt: new Date().toISOString()
        };

        db.appointments.push(newAppointment);

        let updatedDb = db;
        const braceColorText = newAppointment.braceColor ? ` (Brace Color: ${newAppointment.braceColor})` : '';
        const staffAdmins = (db.users || []).filter(u => ['staff', 'admin', 'superadmin'].includes((u.role || '').toLowerCase()));
        staffAdmins.forEach(sa => {
            updatedDb = addUserNotification(updatedDb, sa.email, {
                id: `booking-${newAppointment.id}-${sa.email}`,
                title: 'New Appointment Booked',
                message: `${newAppointment.patientName} has booked an appointment for ${newAppointment.service}${braceColorText} on ${newAppointment.date} at ${newAppointment.time}.`,
                date: new Date().toISOString(),
                read: false,
                type: 'booking_alert'
            });
        });

        writeDatabase(updatedDb);

        // Real-time broadcast to Admin, Staff, and SuperAdmin
        broadcastRealtimeEvent('appointment_created', {
            title: 'New Appointment Booked',
            message: `${newAppointment.patientName} has booked an appointment for ${newAppointment.service}${braceColorText} on ${newAppointment.date} at ${newAppointment.time}.`,
            appointmentId: newAppointment.id,
            targetRoles: ['admin', 'staff', 'superadmin']
        }, null, ['admin', 'staff', 'superadmin']);

        // Dispatch confirmation email to patient
        if (newAppointment.patientEmail && newAppointment.patientEmail.includes('@')) {
            sendAppointmentStatusEmail(newAppointment.patientEmail, newAppointment.patientName, {
                status: 'Pending',
                date: newAppointment.date,
                time: newAppointment.time,
                service: newAppointment.service || newAppointment.category
            }).catch(err => console.error('Booking confirmation email error:', err));
        }

        loadMyAppointments();

        Swal.fire({
            title: 'Appointment Booked!',
            text: 'Your appointment has been scheduled and is currently in Pending status.',
            icon: 'success',
            confirmButtonColor: theme.gold
        });

        setIsReviewing(false);
        setIsSubmitted(true);
    };

    const handleReset = () => {
        setBooking({ category: '', service: '', duration: '', date: '', time: '', notes: '' });
        setIsServiceDropdownOpen(false);
        setIsSubmitted(false);
        setIsReviewing(false);
    };

    const handleCancelAppointment = (id) => {
        Swal.fire({
            title: 'Cancel Appointment',
            input: 'textarea',
            inputLabel: 'Reason for cancellation',
            inputPlaceholder: 'Please tell us why you need to cancel this appointment...',
            inputAttributes: {
                'aria-label': 'Reason for cancellation'
            },
            showCancelButton: true,
            confirmButtonText: 'Cancel Appointment',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            preConfirm: (reason) => {
                if (!reason?.trim()) {
                    Swal.showValidationMessage('Please provide a reason for cancellation.');
                }
                return reason?.trim();
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const reason = result.value;
                let db = readDatabase() || { appointments: [] };
                let cancelledApp = null;

                const updatedAppointments = (db.appointments || []).map(app => {
                    if (app.id === id) {
                        cancelledApp = { 
                            ...app, 
                            status: 'Cancelled', 
                            declineReason: reason,
                            cancelReason: reason,
                            cancelledBy: 'Patient',
                            cancelledAt: new Date().toISOString()
                        };
                        return cancelledApp;
                    }
                    return app;
                });

                if (cancelledApp) {
                    db.appointments = updatedAppointments;

                    // 1. Add audit log
                    addAuditLog(
                        'Cancelled Appointment', 
                        `Patient ${cancelledApp.patientName} (${cancelledApp.patientEmail}) cancelled appointment scheduled for ${cancelledApp.date} at ${cancelledApp.time}. Reason: ${reason}`
                    );

                    // 2. Notify all Staff, Admin, and SuperAdmin
                    const staffAdmins = (db.users || []).filter(u => ['staff', 'admin', 'superadmin'].includes((u.role || '').toLowerCase()));
                    staffAdmins.forEach(sa => {
                        db = addUserNotification(db, sa.email, {
                            id: `cancel-alert-${cancelledApp.id}-${Date.now()}`,
                            title: 'Appointment Cancelled',
                            message: `Patient ${cancelledApp.patientName} has cancelled their appointment scheduled for ${cancelledApp.date} at ${cancelledApp.time}. Reason: ${reason}`,
                            date: new Date().toISOString(),
                            read: false,
                            type: 'booking_alert'
                        });
                    });

                    // Real-time broadcast to Admin, Staff, and SuperAdmin
                    broadcastRealtimeEvent('appointment_updated', {
                        title: 'Appointment Cancelled',
                        message: `Patient ${cancelledApp.patientName} has cancelled their appointment scheduled for ${cancelledApp.date} at ${cancelledApp.time}.`,
                        appointmentId: cancelledApp.id,
                        targetRoles: ['admin', 'staff', 'superadmin']
                    }, null, ['admin', 'staff', 'superadmin']);

                    // 2.5. Notify the Patient (Confirmation of Cancel)
                    const formattedDate = cancelledApp.date ? new Date(cancelledApp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'your requested date';
                    db = addAppointmentNotification(db, {
                        id: `cancel-confirm-${cancelledApp.id}-${Date.now()}`,
                        patientEmail: cancelledApp.patientEmail,
                        message: `Your appointment on ${formattedDate} at ${cancelledApp.time} was successfully cancelled.`,
                        type: 'Cancelled',
                        isRead: false,
                        timestamp: new Date().toISOString()
                    });

                    // 3. Write database
                    writeDatabase(db);

                    // 4. Dispatch cancellation email to patient
                    if (cancelledApp.patientEmail && cancelledApp.patientEmail.includes('@')) {
                        sendAppointmentStatusEmail(cancelledApp.patientEmail, cancelledApp.patientName, {
                            status: 'Cancelled',
                            date: formattedDate,
                            time: cancelledApp.time,
                            service: cancelledApp.service || cancelledApp.category,
                            reason: reason
                        }).catch(err => console.error('Cancellation email error:', err));
                    }

                    Swal.fire(
                        'Cancelled!',
                        'Your appointment has been cancelled.',
                        'success'
                    );

                    // Reload the modal list state
                    loadMyAppointments();
                }
            }
        });
    };

    const banUntilDate = bannedUntil ? new Date(bannedUntil) : null;
    const isBanned = banUntilDate && banUntilDate > new Date();
    const hasDidntCome = myAppointments.some(app => app.status === "Didn't Come");

    if (isBanned) {
        return (
            <div className="container py-5 animate__animated animate__fadeIn">
                <div className="row justify-content-center">
                    <div className="col-xl-11 col-lg-12 col-12">
                        <div className="card border-0 shadow-lg text-center p-5 animate__animated animate__shakeX" style={{ borderRadius: '30px', backgroundColor: theme.cardBg }}>
                            <div className="mb-4">
                                <RiLockLine size={80} style={{ color: '#dc3545' }} />
                            </div>
                            <h2 className="fw-bold mb-3" style={{ color: '#dc3545' }}>Booking Suspended</h2>
                            <p className="text-muted mb-4">
                                Your booking privilege has been temporarily suspended due to consecutive missed appointments ("Didn't Come").
                            </p>
                            <div className="p-4 rounded-4 mb-4 border bg-white shadow-sm text-center">
                                <div className="small text-muted mb-1">Restriction lifts on:</div>
                                <div className="fw-bold fs-5 text-dark">
                                    {banUntilDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                </div>
                            </div>
                            <p className="small text-muted mb-0">
                                Please reach out to the clinic administration if you have questions or need to dispute this booking restriction.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
        <div className="container py-5 animate__animated animate__fadeIn">
            <div className="row justify-content-center">
                <div className="col-xl-11 col-lg-12 col-12">
                    <div className="d-flex justify-content-end mb-3">
                        <button
                            type="button"
                            className="btn fw-bold d-flex align-items-center gap-2 px-4 py-2 shadow-sm"
                            style={{ color: theme.goldDark, backgroundColor: '#fffdf5', border: `1px solid ${theme.gold}`, borderRadius: '12px' }}
                            onClick={() => {
                                loadMyAppointments();
                                setShowMyAppointments(true);
                            }}
                        >
                            <RiFileList3Line /> My Appointments
                        </button>
                    </div>

                    {isSubmitted ? (
                        <div className="card border-0 shadow-lg text-center p-5 animate__animated animate__zoomIn" 
                             style={{ borderRadius: '30px', backgroundColor: theme.cardBg }}>
                            <div className="mb-4">
                                <RiCheckboxCircleLine size={80} style={{ color: '#28a745' }} />
                            </div>
                            <h2 className="fw-bold mb-3" style={{ color: theme.goldDark }}>Appointment Approved!</h2>
                            <p className="text-muted mb-4">
                                Your appointment for <strong>{booking.category ? `${booking.category}: ` : ''}{booking.service}</strong> has been confirmed.
                            </p>
                            
                            <div className="p-3 rounded-4 mb-4 border bg-white shadow-sm text-start">
                                <div className="small text-muted mb-1">Appointment Details:</div>
                                <div className="fw-bold"><RiCalendarCheckLine className="me-2 text-warning"/> {booking.date}</div>
                                <div className="fw-bold"><RiTimeLine className="me-2 text-warning"/> {booking.time} ({booking.duration})</div>
                            </div>

                            <div className="d-grid gap-2">
                                <button 
                                    className="btn py-3 rounded-pill fw-bold text-white shadow"
                                    style={{ backgroundColor: theme.gold }}
                                    onClick={handleReset}
                                >
                                    Book Another Appointment
                                </button>
                            </div>
                        </div>
                    ) : isReviewing ? (
                        <div className="card border-0 shadow-lg animate__animated animate__fadeInRight" 
                             style={{ borderRadius: '30px', backgroundColor: theme.cardBg }}>
                            <div className="card-body p-4 p-md-5">
                                <div className="text-center mb-4">
                                    <RiFileList3Line size={50} style={{ color: theme.gold }} />
                                    <h2 className="fw-bold mt-2" style={{ color: theme.goldDark }}>Review Details</h2>
                                    <p className="text-muted small">Please verify your appointment information</p>
                                </div>

                                <div className="p-4 rounded-4 mb-4 bg-white shadow-sm border border-warning-subtle">
                                    <div className="row g-3">
                                        <div className="col-12 border-bottom pb-2">
                                            <span className="small text-muted d-block mb-1"><RiServiceLine className="me-1"/> Service</span>
                                            <span className="fw-bold text-dark d-block">
                                                {booking.category ? `${booking.category}: ` : ''}{booking.service}
                                            </span>
                                            <span className="small text-muted mt-1"><RiTimeLine className="me-1"/> {booking.duration}</span>
                                        </div>
                                        <div className="col-6 border-bottom pb-2 pt-2">
                                            <span className="small text-muted d-block mb-1"><RiBuilding4Line className="me-1"/> Clinic Branch</span>
                                            <span className="fw-bold text-primary">{booking.branch || 'CarePlus Metro Branch'}</span>
                                        </div>
                                        <div className="col-6 border-bottom pb-2 pt-2">
                                            <span className="small text-muted d-block mb-1"><RiStethoscopeLine className="me-1"/> Attending Doctor</span>
                                            <span className="fw-bold text-dark">{booking.doctor || 'Dr. Robert Chen, MD'}</span>
                                        </div>
                                        <div className="col-6 border-bottom pb-2 pt-2">
                                            <span className="small text-muted d-block mb-1"><RiCalendarCheckLine className="me-1"/> Date</span>
                                            <span className="fw-bold text-dark">{booking.date}</span>
                                        </div>
                                        <div className="col-6 border-bottom pb-2 pt-2">
                                            <span className="small text-muted d-block mb-1"><RiTimeLine className="me-1"/> Time</span>
                                            <span className="fw-bold text-dark">{booking.time}</span>
                                        </div>
                                         <div className="col-12 pt-1">
                                             <span className="small text-muted d-block mb-1"><RiMessage2Line className="me-1"/> Notes/Concerns</span>
                                             <span className="text-dark fst-italic">
                                                 {booking.notes ? booking.notes : "None provided"}
                                             </span>
                                         </div>
                                     </div>
                                 </div>

                                 <div className="d-flex gap-3 mt-4">
                                     <button 
                                         className="btn btn-light py-3 rounded-pill fw-bold border shadow-sm w-50"
                                         onClick={() => setIsReviewing(false)}
                                     >
                                         <RiArrowLeftLine className="me-1" /> Back to Edit
                                     </button>
                                     <button 
                                         className="btn py-3 rounded-pill fw-bold text-white shadow w-50"
                                         style={{ backgroundColor: theme.gold }}
                                         onClick={handleConfirmSubmit}
                                     >
                                         Confirm Booking
                                     </button>
                                 </div>
                             </div>
                         </div>
                    ) : (
                        <div className="card border-0 shadow-lg animate__animated animate__fadeInLeft" style={{ borderRadius: '30px', backgroundColor: theme.cardBg }}>
                            <div className="card-body p-4 p-md-5">
                                <div className="text-center mb-4">
                                    <RiCalendarCheckLine size={50} style={{ color: theme.gold }} />
                                    <h2 className="fw-bold mt-2" style={{ color: theme.goldDark }}>Book an Appointment</h2>
                                    <p className="text-muted small">Select your preferred schedule and service</p>
                                </div>

                                {hasDidntCome && (
                                    <div className="alert alert-warning border-warning d-flex align-items-center gap-2 mb-4 animate__animated animate__fadeIn" role="alert" style={{ borderRadius: '12px', fontSize: '14px' }}>
                                        <RiAlertLine size={24} className="text-warning flex-shrink-0" />
                                        <div>
                                            <strong className="d-block mb-1">Warning: Missed Appointments Detected</strong>
                                            You have previously missed one or more scheduled clinical appointments (marked as "Didn't Come"). Please ensure you attend your upcoming appointments. Repeated missed visits will result in account booking restrictions.
                                        </div>
                                    </div>
                                )}

                                <form onSubmit={handleProceedToReview}>
                                    {/* CarePlus Multi-Branch and Doctor Selection */}
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold" style={{ color: theme.goldDark }}>
                                                <RiBuilding4Line className="me-1" /> CarePlus Clinic Branch *
                                            </label>
                                            <select
                                                className="form-select border-warning-subtle py-2 bg-white shadow-sm"
                                                value={booking.branch || CLINIC_BRANCHES[0].name}
                                                onChange={(e) => setBooking(prev => ({ ...prev, branch: e.target.value }))}
                                                required
                                            >
                                                {CLINIC_BRANCHES.map(b => (
                                                    <option key={b.id} value={b.name}>{b.name} ({b.tag})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold" style={{ color: theme.goldDark }}>
                                                <RiStethoscopeLine className="me-1" /> Attending Physician *
                                            </label>
                                            <select
                                                className="form-select border-warning-subtle py-2 bg-white shadow-sm"
                                                value={booking.doctor || CLINIC_DOCTORS[0].name}
                                                onChange={(e) => setBooking(prev => ({ ...prev, doctor: e.target.value }))}
                                                required
                                            >
                                                {CLINIC_DOCTORS.map(d => (
                                                    <option key={d.id} value={d.name}>{d.name} ({d.specialty})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="form-label small fw-bold" style={{ color: theme.goldDark }}>
                                            <RiServiceLine className="me-1"/> Select Service
                                        </label>

                                        <div className="position-relative" ref={serviceDropdownRef}>
                                            {/* Dropdown Input / Trigger */}
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => setIsServiceDropdownOpen(prev => !prev)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        setIsServiceDropdownOpen(prev => !prev);
                                                    }
                                                }}
                                                className="form-select border-warning-subtle py-2 d-flex justify-content-between align-items-center bg-white shadow-sm"
                                                style={{
                                                    cursor: 'pointer',
                                                    borderColor: isServiceDropdownOpen ? theme.gold : undefined,
                                                    boxShadow: isServiceDropdownOpen ? '0 0 0 0.25rem rgba(212, 175, 55, 0.25)' : undefined
                                                }}
                                            >
                                                <span className={booking.service ? "fw-semibold text-dark text-truncate me-2" : "text-muted"}>
                                                    {booking.service 
                                                        ? (booking.category ? `${booking.category}: ${booking.service}` : booking.service)
                                                        : 'Choose a procedure...'}
                                                </span>
                                                <span style={{ color: theme.goldDark, flexShrink: 0 }}>
                                                    {isServiceDropdownOpen ? <RiArrowUpSLine size={20} /> : <RiArrowDownSLine size={20} />}
                                                </span>
                                            </div>

                                            {/* Dropdown Menu Container */}
                                            {isServiceDropdownOpen && (
                                                <div 
                                                    className="card border rounded-4 shadow-lg position-absolute w-100 mt-1 animate__animated animate__fadeIn"
                                                    style={{ 
                                                        backgroundColor: theme.cardBg, 
                                                        borderColor: 'rgba(212, 175, 55, 0.35)',
                                                        maxHeight: '340px',
                                                        overflowY: 'auto',
                                                        zIndex: 1050
                                                    }}
                                                >
                                                    <div className="card-body p-3 p-md-4">
                                                        {groupedServices.length > 0 ? groupedServices.map((section, idx) => (
                                                            <div key={idx} className="mb-3 last-mb-0">
                                                                {/* Category Header */}
                                                                <div 
                                                                    className="d-flex align-items-center gap-2 mb-2 pb-1 border-bottom sticky-top" 
                                                                    style={{ 
                                                                        borderColor: 'rgba(212, 175, 55, 0.3)',
                                                                        backgroundColor: theme.cardBg,
                                                                        zIndex: 2,
                                                                        paddingTop: '2px'
                                                                    }}
                                                                >
                                                                    <RiPriceTag3Line style={{ color: theme.goldDark }} />
                                                                    <h6 className="fw-bold mb-0" style={{ color: theme.goldDark, fontSize: '0.92rem' }}>
                                                                        {section.category}
                                                                    </h6>
                                                                </div>

                                                                {/* Category Items */}
                                                                <div className="d-flex flex-column gap-1">
                                                                    {section.items.map((item, i) => {
                                                                        const isSelected = booking.service === item.name && (booking.category === section.category || !booking.category);
                                                                        return (
                                                                            <div 
                                                                                key={i} 
                                                                                role="button"
                                                                                tabIndex={0}
                                                                                onClick={() => {
                                                                                    handleSelectService(item.name, section.category);
                                                                                    setIsServiceDropdownOpen(false);
                                                                                }}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                                        e.preventDefault();
                                                                                        handleSelectService(item.name, section.category);
                                                                                        setIsServiceDropdownOpen(false);
                                                                                    }
                                                                                }}
                                                                                className="d-flex justify-content-between py-2 px-3 rounded-2 border-bottom align-items-center"
                                                                                style={{ 
                                                                                    borderColor: isSelected ? theme.goldDark : 'rgba(212, 175, 55, 0.15)', 
                                                                                    backgroundColor: isSelected ? 'rgba(212, 175, 55, 0.18)' : 'transparent',
                                                                                    cursor: 'pointer',
                                                                                    transition: 'all 0.15s ease' 
                                                                                }}
                                                                                onMouseOver={e => {
                                                                                    if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.08)';
                                                                                }}
                                                                                onMouseOut={e => {
                                                                                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                                                                }}
                                                                            >
                                                                                <span 
                                                                                    className={isSelected ? "fw-bold" : "text-dark fw-medium"} 
                                                                                    style={{ 
                                                                                        fontSize: '0.94rem', 
                                                                                        color: isSelected ? theme.goldDark : '#212529' 
                                                                                    }}
                                                                                >
                                                                                    {item.name}
                                                                                </span>
                                                                                {/* Checkmark where the select button originally was */}
                                                                                {isSelected && (
                                                                                    <RiCheckLine size={20} style={{ color: theme.goldDark, flexShrink: 0 }} />
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )) : (
                                                            <div className="text-center py-4 text-muted">
                                                                <p className="mb-0 fw-medium small">No procedures available.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <input type="hidden" name="selectedService" value={booking.service} />

                                        {booking.duration && (
                                            <div className="mt-2 small px-2 py-1 rounded" style={{ backgroundColor: 'rgba(212, 175, 55, 0.1)', color: theme.goldDark }}>
                                                <RiInformationLine className="me-1" /> Estimated chair time: <strong>{booking.duration}</strong>
                                            </div>
                                        )}
                                    </div>

                                    <div className="row">
                                        <div id="booking-calendar-step" className="col-md-6 mb-4">
                                            <label className="form-label small fw-bold" style={{ color: theme.goldDark }}>
                                                <RiCalendarCheckLine className="me-1"/> Preferred Date
                                            </label>
                                            <div className="border bg-white p-3" style={{ borderRadius: '14px' }}>
                                                <div className="d-flex align-items-center justify-content-between mb-3">
                                                    <button
                                                        type="button"
                                                        className="btn btn-light border rounded-circle p-0 d-flex align-items-center justify-content-center booking-calendar-nav-btn"
                                                        style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
                                                        onClick={() => moveCalendarMonth(-1)}
                                                        title="Previous month"
                                                    >
                                                        <RiArrowLeftSLine size={22} />
                                                    </button>
                                                    <span className="fw-bold text-dark">
                                                        {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="btn btn-light border rounded-circle p-0 d-flex align-items-center justify-content-center booking-calendar-nav-btn"
                                                        style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px' }}
                                                        onClick={() => moveCalendarMonth(1)}
                                                        title="Next month"
                                                    >
                                                        <RiArrowRightSLine size={22} />
                                                    </button>
                                                </div>
                                                <div className="booking-calendar-grid mb-2">
                                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                                        <div key={day} className="text-center text-muted small fw-bold">{day}</div>
                                                    ))}
                                                </div>
                                                <div className="booking-calendar-grid">
                                                     {calendarDays.map(day => {
                                                        const todayIso = toDateInputValue(new Date());
                                                        const isPast = day.iso < todayIso;
                                                        const unavailableReason = unavailableDateMap[day.iso];
                                                        const isUnavailable = Boolean(unavailableReason);
                                                        const isEmergency = isUnavailable && String(unavailableReason).toLowerCase().includes('emergency');
                                                        const isGeneralUnavailable = isUnavailable && !isEmergency;
                                                        const isSelected = booking.date === day.iso;
                                                        const isNativeDisabled = (isPast || !day.isCurrentMonth) && !isEmergency;

                                                        let btnBg = '#ffffff';
                                                        let btnBorder = '1.5px solid #e2d8c8';
                                                        let btnColor = '#1f1b18';
                                                        let btnShadow = 'none';

                                                        if (isSelected) {
                                                            btnBg = 'linear-gradient(135deg, #fef08a 0%, #fde047 100%)';
                                                            btnBorder = `2.5px solid ${theme.goldDark}`;
                                                            btnColor = '#1f1b18';
                                                            btnShadow = '0 3px 8px rgba(184, 134, 11, 0.3)';
                                                        } else if (isEmergency) {
                                                            btnBg = '#fee2e2';
                                                            btnBorder = '2px solid #dc2626';
                                                            btnColor = '#dc2626';
                                                            btnShadow = '0 2px 6px rgba(220, 38, 38, 0.3)';
                                                        } else if (isGeneralUnavailable) {
                                                            btnBg = '#cbd5e1';
                                                            btnBorder = '1.5px solid #64748b';
                                                            btnColor = '#1e293b';
                                                            btnShadow = '0 2px 4px rgba(100, 116, 139, 0.2)';
                                                        } else if (isNativeDisabled) {
                                                            btnBg = '#f1f5f9';
                                                            btnBorder = '1px solid #e2e8f0';
                                                            btnColor = '#94a3b8';
                                                        }

                                                         return (
                                                            <button
                                                                key={day.iso}
                                                                type="button"
                                                                disabled={isNativeDisabled}
                                                                className="btn btn-sm p-1 d-flex align-items-center justify-content-center transition-all"
                                                                style={{
                                                                    minHeight: '48px',
                                                                    borderRadius: '12px',
                                                                    border: btnBorder,
                                                                    background: btnBg,
                                                                    color: btnColor,
                                                                    fontSize: '15px',
                                                                    fontWeight: isEmergency || isGeneralUnavailable || isSelected ? '700' : '600',
                                                                    boxShadow: btnShadow,
                                                                    cursor: isNativeDisabled ? 'not-allowed' : 'pointer',
                                                                    opacity: day.isCurrentMonth ? 1 : 0.4
                                                                }}
                                                                onClick={() => handleDateSelect(day.iso, day)}
                                                                title={isEmergency ? `Emergency Closure: ${unavailableReason}` : isGeneralUnavailable ? `Clinic Disabled Date: ${unavailableReason}` : day.iso}
                                                            >
                                                                {day.date.getDate()}
                                                            </button>
                                                        );
                                                    })}
                                                 </div>

                                                {booking.date && (
                                                    <div className="small mt-2 text-center" style={{ color: theme.goldDark }}>
                                                        Selected Date: <strong>{booking.date}</strong>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="col-md-6 mb-4">
                                            <label className="form-label small fw-bold" style={{ color: theme.goldDark }}>
                                                <RiTimeLine className="me-1"/> Preferred Time
                                            </label>
                                            <div className="d-grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                                                {dynamicTimeSlots.map(slot => {
                                                    const isBooked = bookedSlots.includes(slot);
                                                    const isSelected = booking.time === slot;

                                                    return (
                                                        <button
                                                            key={slot}
                                                            type="button"
                                                            disabled={!booking.service || !booking.date || isBooked}
                                                            className="btn btn-sm fw-semibold"
                                                            style={{
                                                                minHeight: '48px',
                                                                borderRadius: '12px',
                                                                border: isSelected ? `2px solid ${theme.goldDark}` : '1px solid #e2d8c8',
                                                                backgroundColor: isBooked || !booking.service || !booking.date ? '#e9ecef' : isSelected ? '#fff3cd' : '#fffdf8',
                                                                color: isBooked || !booking.service || !booking.date ? '#9aa0a6' : '#1f1b18',
                                                                fontSize: '14.5px',
                                                                padding: '8px 12px',
                                                                cursor: isBooked || !booking.service || !booking.date ? 'not-allowed' : 'pointer'
                                                            }}
                                                            onClick={() => setBooking({...booking, time: slot})}
                                                            title={isBooked ? 'This time is already occupied' : slot}
                                                        >
                                                            {slot} {isBooked ? '(Occupied)' : ''}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {!booking.date && (
                                                <div className="small text-muted mt-2">Pick a date first to check available times.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="form-label small fw-bold" style={{ color: theme.goldDark }}>
                                            <RiMessage2Line className="me-1"/> Message / Concerns (Optional)
                                        </label>
                                        <textarea 
                                            className="form-control" 
                                            rows="3" 
                                            placeholder="Tell us about your dental concern..."
                                            value={booking.notes}
                                            onChange={(e) => setBooking({...booking, notes: e.target.value})}
                                        ></textarea>
                                    </div>

                                    <button 
                                        type="submit" 
                                        className="btn w-100 py-3 rounded-pill fw-bold text-white shadow"
                                        style={{ backgroundColor: theme.gold }}
                                    >
                                        Review Booking
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        {showMyAppointments && (
            <div className="my-appointments-backdrop">
                <section className="my-appointments-modal bg-white shadow-lg border">
                    <div className="d-flex justify-content-between align-items-start gap-3 mb-4">
                        <div>
                            <h4 className="fw-bold mb-1" style={{ color: theme.goldDark }}>My Appointments</h4>
                            <p className="text-muted small mb-0">Your current and past booking records.</p>
                        </div>
                        <button
                            type="button"
                            className="btn btn-light border rounded-circle d-flex align-items-center justify-content-center p-0"
                            style={{ width: '38px', height: '38px', minWidth: '38px', minHeight: '38px' }}
                            onClick={() => setShowMyAppointments(false)}
                            title="Close"
                        >
                            <RiCloseLine size={20} />
                        </button>
                    </div>

                    {myAppointments.length > 0 ? (
                        <div className="d-flex flex-column gap-3">
                            {myAppointments.map((appointment) => (
                                <div key={appointment.id || `${appointment.date}-${appointment.time}`} className="border p-3 bg-light" style={{ borderRadius: '12px' }}>
                                    <div className="d-flex flex-row align-items-start justify-content-between gap-2 mb-2">
                                        <div style={{ minWidth: 0 }}>
                                            <div className="fw-bold text-dark text-break">
                                                {appointment.category ? `${appointment.category}: ` : ''}{appointment.service || 'General Checkup'}
                                            </div>
                                            <div className="small text-muted text-nowrap mt-1">
                                                <RiCalendarCheckLine className="me-1" /> {appointment.date || 'N/A'}
                                                <span className="mx-2">|</span>
                                                <RiTimeLine className="me-1" /> {appointment.time || 'TBA'}
                                            </div>
                                        </div>
                                        <span
                                            className="badge flex-shrink-0 text-nowrap px-3 py-2 ms-2"
                                            style={{ ...getStatusStyle(appointment.status), borderRadius: '999px' }}
                                        >
                                            {appointment.status || 'Pending'}
                                        </span>
                                    </div>
                                    {appointment.notes && (
                                        <div className="small text-muted mt-2">
                                            <RiMessage2Line className="me-1" /> {appointment.notes}
                                        </div>
                                    )}
                                    {appointment.declineReason && (
                                        <div className="small text-danger mt-2">
                                            Reason: {appointment.declineReason}
                                        </div>
                                    )}
                                    {((appointment.status === 'Cancelled' || appointment.status === 'Declined') && (appointment.cancelledDueToEmergency || String(appointment.declineReason || '').toLowerCase().includes('emergency') || Boolean(appointment.emergencyReason))) && (
                                        <div className="mt-3 d-flex align-items-center justify-content-between flex-wrap gap-2 pt-2 border-top">
                                            <span className="badge bg-danger text-white rounded-pill px-2 py-1" style={{ fontSize: '11px' }}>
                                                Emergency Closure
                                            </span>
                                            <button
                                                type="button"
                                                className="btn btn-danger btn-sm rounded-pill px-3 fw-bold d-inline-flex align-items-center gap-1 shadow-sm"
                                                onClick={() => handleQuickReschedule(appointment)}
                                            >
                                                <RiCalendarCheckLine size={14} /> Reschedule Appointment
                                            </button>
                                        </div>
                                    )}
                                    {(appointment.status === 'Approved' || appointment.status === 'Pending') && (
                                        <div className="mt-3 text-end">
                                            <button
                                                type="button"
                                                className="btn btn-outline-danger btn-sm rounded-pill px-3"
                                                onClick={() => handleCancelAppointment(appointment.id)}
                                            >
                                                Cancel Appointment
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-muted py-5">
                            <RiFileList3Line size={48} className="mb-3 opacity-50" />
                            <h6 className="fw-bold">No appointments yet</h6>
                            <p className="small mb-0">Your booked appointments will appear here.</p>
                        </div>
                    )}
                </section>
            </div>
        )}
        <style>{`
                .last-mb-0:last-child { margin-bottom: 0 !important; }
                .booking-calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, minmax(0, 1fr));
                    gap: 6px;
                }
                .my-appointments-backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: 1050;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    background: rgba(31, 27, 24, 0.45);
                }
                .my-appointments-modal {
                    width: min(760px, 100%);
                    max-height: calc(100vh - 48px);
                    overflow: auto;
                    border-radius: 18px;
                    padding: 24px;
                }
            `}</style>
        </>
    );
};

export default BookAppointment;
