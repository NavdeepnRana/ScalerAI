const { redactText } = require('./redactor');

// --- Evaluation Configuration ---
const sampleText = `
Hello, my name is Alice Smith and you can reach me at alice.smith88@example.com or call me at +1 800-555-0199. 
I am currently employed at Microsoft Corporation and my office is located in Seattle. 
For verification, my SSN is 987-65-4321 and my credit card number is 4111 1111 1111 1111. 
I was born on 12/25/1985. My server IP is 192.168.1.1.
Please check the attached order and invoice for more details regarding the ticket date.
`;

// Define the exact strings that represent actual PII in the sample text
const groundTruthPII = [
    'Alice Smith', 
    'alice.smith88@example.com', 
    '+1 800-555-0199', 
    'Microsoft Corporation', 
    'Seattle', 
    '987-65-4321', 
    '4111 1111 1111 1111', 
    '12/25/1985', 
    '192.168.1.1'
];

// Define standard vocabulary that should NOT be redacted (to check for false positives)
const groundTruthNonPII = [
    'order', 
    'invoice', 
    'ticket', 
    'date'
];

console.log("=== PII Redaction Evaluation ===");
console.log("Running redaction engine...\n");

// Run the redactor
const redactedText = redactText(sampleText);

console.log("--- Original Text ---");
console.log(sampleText.trim());
console.log("\n--- Redacted Text ---");
console.log(redactedText.trim());
console.log("\n--------------------------------");

// --- Calculate Metrics ---
let TP = 0; // True Positives: PII correctly redacted
let FN = 0; // False Negatives: PII missed (still in text)
let FP = 0; // False Positives: Non-PII mistakenly redacted (missing from text)
let TN = 0; // True Negatives: Non-PII correctly left alone (still in text)

// Check PII
groundTruthPII.forEach(pii => {
    // If the original PII is NO LONGER in the redacted text, it was successfully redacted.
    if (!redactedText.includes(pii)) {
        TP++;
    } else {
        console.warn(`[MISS] Failed to redact PII: "${pii}"`);
        FN++;
    }
});

// Check Non-PII
groundTruthNonPII.forEach(nonPii => {
    // If the Non-PII is NO LONGER in the redacted text, it was mistakenly redacted.
    if (!redactedText.includes(nonPii)) {
        console.warn(`[FALSE POSITIVE] Mistakenly redacted standard word: "${nonPii}"`);
        FP++;
    } else {
        TN++;
    }
});

// Calculate final scores
const precision = TP + FP > 0 ? (TP / (TP + FP)) : 0;
const recall = TP + FN > 0 ? (TP / (TP + FN)) : 0;
const accuracy = (TP + TN + FP + FN) > 0 ? ((TP + TN) / (TP + TN + FP + FN)) : 0;

console.log("\n=== Evaluation Results ===");
console.log(`True Positives (TP): ${TP}`);
console.log(`False Negatives (FN): ${FN}`);
console.log(`False Positives (FP): ${FP}`);
console.log(`True Negatives (TN): ${TN}`);
console.log("--------------------------------");
console.log(`Precision: ${(precision * 100).toFixed(2)}%`);
console.log(`Recall:    ${(recall * 100).toFixed(2)}%`);
console.log(`Accuracy:  ${(accuracy * 100).toFixed(2)}%`);
