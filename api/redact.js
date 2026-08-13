const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { redactText } = require('../redactor');
const { generateDocxBuffer } = require('../documentGenerator');

// Disable Vercel's default body parser so Multer can read the multipart stream
module.exports.config = {
    api: {
        bodyParser: false,
    },
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const isPDF = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
        const isTXT = file.mimetype === 'text/plain' || file.originalname.toLowerCase().endsWith('.txt');
        const isDOCX = file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.originalname.toLowerCase().endsWith('.docx');
        
        if (isPDF || isTXT || isDOCX) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type (${file.mimetype}). Only PDF, TXT, and DOCX are allowed.`));
        }
    }
});

// Helper to run express middleware in Vercel API routes
function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        await runMiddleware(req, res, upload.single('document'));

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        let originalText = '';
        const fileExt = req.file.originalname.toLowerCase().split('.').pop();
        
        if (fileExt === 'pdf' || req.file.mimetype === 'application/pdf') {
            const pdfData = await pdfParse(req.file.buffer);
            originalText = pdfData.text;
        } else if (fileExt === 'txt' || req.file.mimetype === 'text/plain') {
            originalText = req.file.buffer.toString('utf8');
        } else if (fileExt === 'docx' || req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const docxData = await mammoth.extractRawText({ buffer: req.file.buffer });
            originalText = docxData.value;
        } else {
            return res.status(400).json({ error: 'Unsupported file type.' });
        }

        // Redact PII
        const redactedText = redactText(originalText);

        // Generate Word Document
        const docxBuffer = await generateDocxBuffer(redactedText);

        // Return docx file
        res.setHeader('Content-Disposition', 'attachment; filename=redacted_document.docx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(docxBuffer);

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ 
            error: 'An error occurred while processing the document.', 
            details: error.message 
        });
    }
};
