export const passwordRules = [
    { label: '8-12 characters', test: (password) => /^.{8,12}$/.test(password) },
    { label: 'Uppercase (A-Z)', test: (password) => /[A-Z]/.test(password) },
    { label: 'Lowercase (a-z)', test: (password) => /[a-z]/.test(password) },
    { label: 'Numbers (0-9)', test: (password) => /[0-9]/.test(password) },
    { label: 'Special Characters (.-*:;!_&$#@)', test: (password) => /[.\-*:;!_&$#@]/.test(password) }
];

export const validatePassword = (password) => {
    const hasOnlyAllowedCharacters = /^[A-Za-z0-9.\-*:;!_&$#@]+$/.test(password);
    return passwordRules.every((rule) => rule.test(password)) && hasOnlyAllowedCharacters;
};

export const passwordRequirementsHtml = () => passwordRules
    .map((rule) => `<li>${rule.label}</li>`)
    .join('');

export const generateDefaultPassword = (fullName = '') => {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    let surname = parts.length > 0 ? parts[parts.length - 1] : 'User';
    surname = surname.replace(/[^a-zA-Z]/g, '');
    if (!surname) surname = 'User';
    
    surname = surname.charAt(0).toUpperCase() + surname.slice(1).toLowerCase();
    let defaultPass = `${surname}_2026`;
    
    if (defaultPass.length < 8) {
        const needed = 8 - defaultPass.length;
        defaultPass = `${surname}${'x'.repeat(needed)}_2026`;
    } else if (defaultPass.length > 12) {
        const maxSurnameLen = 12 - 5;
        const truncatedSurname = surname.slice(0, maxSurnameLen);
        defaultPass = `${truncatedSurname}_2026`;
    }
    
    return defaultPass;
};

