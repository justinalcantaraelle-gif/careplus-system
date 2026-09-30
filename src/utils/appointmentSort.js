const getAppointmentTimestamp = (appointment = {}) => {
    if (!appointment.date) return Number.POSITIVE_INFINITY;

    const time = appointment.time || '12:00 AM';
    const scheduledAt = Date.parse(`${appointment.date} ${time}`);

    if (!Number.isNaN(scheduledAt)) return scheduledAt;

    const dateOnly = Date.parse(appointment.date);
    return Number.isNaN(dateOnly) ? Number.POSITIVE_INFINITY : dateOnly;
};

export const sortAppointmentsBySchedule = (appointments = []) => {
    return [...appointments]
        .map((appointment, index) => ({ appointment, index }))
        .sort((a, b) => {
            const scheduleA = getAppointmentTimestamp(a.appointment);
            const scheduleB = getAppointmentTimestamp(b.appointment);
            const createdA = Date.parse(a.appointment.createdAt || '') || Number(a.appointment.id) || a.index;
            const createdB = Date.parse(b.appointment.createdAt || '') || Number(b.appointment.id) || b.index;

            return scheduleA - scheduleB || createdA - createdB || a.index - b.index;
        })
        .map(({ appointment }) => appointment);
};
