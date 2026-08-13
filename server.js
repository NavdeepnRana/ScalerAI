const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');
const { redactText } = require('./redactor');
const { generateDocxBuffer } = require('./documentGenerator');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup static file serving for the frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Setup Multer for memory storage (we process the file and don't need to save it to disk)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const isPDF = file.mimetype === 'application/pdf';
        const isTXT = file.mimetype === 'text/plain' || file.originalname.toLowerCase().endsWith('.txt');
        const isDOCX = file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.originalname.toLowerCase().endsWith('.docx');
        
        if (isPDF || isTXT || isDOCX) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type (${file.mimetype}). Only PDF, TXT, and DOCX are allowed.`));
        }
    }
});

// API endpoint to redact PII
app.post('/api/redact', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        let originalText = '';

        // Extract text based on file type
        if (req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
            const pdfData = await pdfParse(req.file.buffer);
            originalText = pdfData.text;
        } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || req.file.originalname.toLowerCase().endsWith('.docx')) {
            const docxData = await mammoth.extractRawText({ buffer: req.file.buffer });
            originalText = docxData.value;
        } else {
            originalText = req.file.buffer.toString('utf-8');
        }

        if (!originalText || originalText.trim() === '') {
            return res.status(400).json({ error: 'Could not extract text or file is empty.' });
        }

        // Run the core redaction logic
        const redactedText = redactText(originalText);

        // Generate the Word document buffer
        const docxBuffer = await generateDocxBuffer(redactedText);

        // Set headers for file download
        res.setHeader('Content-Disposition', 'attachment; filename=redacted_document.docx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        
        // Send the generated docx back to the client
        res.send(docxBuffer);

    } catch (error) {
        console.error('Error during redaction:', error);
        res.status(500).json({ error: 'An error occurred while processing the document.', details: error.message });
    }
});

// Global error handler to catch multer errors and return JSON
app.use((err, req, res, next) => {
    console.error('Global Error Handler:', err);
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
