const nlp = require('compromise');
const { faker } = require('@faker-js/faker');

// Global dictionary to maintain consistent replacements across the session
const redactionMap = new Map();

/**
 * Retrieves or generates a consistent fake replacement for a given string.
 * @param {string} originalStr - The PII string to replace.
 * @param {string} entityType - The type of PII (e.g., 'email', 'person').
 * @returns {string} - The fake replacement string.
 */
function getReplacement(originalStr, entityType) {
    const key = originalStr.toLowerCase().trim();
    
    // Return existing fake data if we've seen this string before
    if (redactionMap.has(key)) {
        return redactionMap.get(key);
    }

    let fakeData = '';
    switch (entityType) {
        case 'email':
            fakeData = faker.internet.email();
            break;
        case 'phone':
            // Generate an international phone style
            fakeData = faker.phone.number({ style: 'international' });
            break;
        case 'ssn':
            // Custom SSN format
            fakeData = `${faker.string.numeric(3)}-${faker.string.numeric(2)}-${faker.string.numeric(4)}`;
            break;
        case 'cc':
            fakeData = faker.finance.creditCardNumber();
            break;
        case 'ip':
            fakeData = faker.internet.ip();
            break;
        case 'dob':
            const fakeDate = faker.date.birthdate();
            // Standard MM/DD/YYYY format
            fakeData = `${String(fakeDate.getMonth() + 1).padStart(2, '0')}/${String(fakeDate.getDate()).padStart(2, '0')}/${fakeDate.getFullYear()}`;
            break;
        case 'person':
            fakeData = faker.person.fullName();
            break;
        case 'company':
            fakeData = faker.company.name();
            break;
        case 'address':
            fakeData = faker.location.streetAddress();
            break;
        default:
            fakeData = faker.string.alphanumeric(10);
    }
    
    // Store it for consistency
    redactionMap.set(key, fakeData);
    return fakeData;
}

/**
 * Redacts PII from the given text using Regex and NLP.
 * @param {string} text - The original text.
 * @returns {string} - The redacted text.
 */
function redactText(text) {
    let redacted = text;

    // --- 1. Regex-Based Redactions (High Accuracy for Structured Data) ---

    // Emails
    redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, 
        (match) => getReplacement(match, 'email')
    );

    // Phones (Handles international like +91 and standard formats)
    redacted = redacted.replace(/(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, 
        (match) => getReplacement(match, 'phone')
    );

    // SSN (XXX-XX-XXXX)
    redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, 
        (match) => getReplacement(match, 'ssn')
    );

    // Credit Cards (15-16 digits common patterns)
    redacted = redacted.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b|\b\d{4}[-\s]?\d{6}[-\s]?\d{5}\b/g, 
        (match) => getReplacement(match, 'cc')
    );

    // IP Addresses
    redacted = redacted.replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, 
        (match) => getReplacement(match, 'ip')
    );

    // Dates of Birth (MM/DD/YYYY or DD/MM/YYYY combinations)
    redacted = redacted.replace(/\b(?:0[1-9]|1[0-2]|[12]\d|3[01])[-/](?:0[1-9]|1[0-2]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g, 
        (match) => getReplacement(match, 'dob')
    );

    // --- 2. NLP-Based Redactions (For Unstructured Data) ---
    // Using 'compromise' to find people, organizations, and places
    
    const doc = nlp(redacted);
    
    // A function to filter out common false positives (like standard vocab)
    const isValidEntity = (str) => {
        const lower = str.toLowerCase();
        // Discard very short strings and common business terms that NLP might misclassify
        if (str.length <= 2) return false;
        const falsePositives = ['order', 'ticket', 'invoice', 'date', 'total', 'amount', 'client', 'customer'];
        return !falsePositives.includes(lower);
    };

    // Replace People
    const people = doc.people().out('array');
    people.forEach(person => {
        if (isValidEntity(person)) {
            const replacement = getReplacement(person, 'person');
            // We use standard string replacement with word boundaries on the main string 
            // since compromise doc.match() can sometimes fail with special characters.
            // Escape special chars for regex
            const safePerson = person.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${safePerson}\\b`, 'g');
            redacted = redacted.replace(regex, replacement);
        }
    });

    // Refresh doc for subsequent passes to avoid replacing replaced text
    let docOrgs = nlp(redacted);
    
    // Replace Organizations (Companies)
    const orgs = docOrgs.organizations().out('array');
    orgs.forEach(org => {
        if (isValidEntity(org)) {
            const replacement = getReplacement(org, 'company');
            const safeOrg = org.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${safeOrg}\\b`, 'g');
            redacted = redacted.replace(regex, replacement);
        }
    });

    let docPlaces = nlp(redacted);

    // Replace Places (Addresses/Cities)
    const places = docPlaces.places().out('array');
    places.forEach(place => {
        if (isValidEntity(place)) {
            const replacement = getReplacement(place, 'address');
            const safePlace = place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${safePlace}\\b`, 'g');
            redacted = redacted.replace(regex, replacement);
        }
    });

    return redacted;
}

module.exports = {
    redactText,
    getReplacement,
    redactionMap
};
