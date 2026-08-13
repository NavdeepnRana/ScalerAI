const { Document, Packer, Paragraph, TextRun } = require('docx');

/**
 * Takes a plain text string (with newlines) and generates a Word .docx buffer.
 * @param {string} text - The redacted text to save as docx.
 * @returns {Promise<Buffer>} - The generated .docx as a buffer.
 */
async function generateDocxBuffer(text) {
    // Split the text into paragraphs based on newlines
    const lines = text.split('\n');
    
    // Create paragraph objects for each line
    const paragraphs = lines.map(line => {
        return new Paragraph({
            children: [
                new TextRun(line)
            ]
        });
    });

    // Create a new Document
    const doc = new Document({
        sections: [
            {
                properties: {},
                children: paragraphs,
            },
        ],
    });

    // Pack the document into a buffer
    const buffer = await Packer.toBuffer(doc);
    return buffer;
}

module.exports = {
    generateDocxBuffer
};
