const mongoose = require('mongoose');

function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function toNumber(value) {
    if (value === undefined || value === null || value === '') return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
}

module.exports = { isValidId, escapeRegex, cleanText, toNumber };
