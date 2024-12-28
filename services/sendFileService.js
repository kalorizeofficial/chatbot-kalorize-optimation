const fs = require('fs');
const path = require('path');

/**
 * Fungsi untuk mengirim file ke pengguna melalui WhatsApp.
 * @param {object} sock Instance socket WhatsApp.
 * @param {string} phoneNumber Nomor telepon pengguna.
 * @param {string} filePath Path file yang akan dikirim.
 * @returns {Promise<void>}
 */
async function sendFile(sock, phoneNumber, filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);

        await sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, {
            document: fileBuffer,
            mimetype: 'application/pdf',
            fileName: path.basename(filePath),
        });

        console.log(`File ${filePath} berhasil dikirim ke ${phoneNumber}`);
    } catch (error) {
        console.error('Error saat mengirim file:', error);
        throw error;
    }
}

module.exports = { sendFile };
