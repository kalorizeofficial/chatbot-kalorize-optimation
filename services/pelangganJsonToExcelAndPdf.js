const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { sendFile } = require('./sendFileService');

/**
 * Fungsi untuk mengubah JSON ke Excel dan PDF, lalu mengirim file PDF ke pengguna.
 * @param {object} sock Instance socket WhatsApp.
 * @param {string} jsonFilePath Path file JSON input.
 * @param {string} phoneNumber Nomor telepon pengguna.
 * @returns {Promise<void>}
 */
async function pelangganJsonToExcelAndPdf(sock, jsonFilePath, phoneNumber) {
    try {
        if (!fs.existsSync(jsonFilePath)) {
            throw new Error(`File JSON tidak ditemukan: ${jsonFilePath}`);
        }

        // Baca file JSON
        const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));

        // Tentukan folder output
        const outputFolder = './outputFiles';
        fs.mkdirSync(outputFolder, { recursive: true });

        // Tentukan nama file Excel dan PDF
        const baseName = path.basename(jsonFilePath, '.json');
        const excelFilePath = path.join(outputFolder, `${baseName}.xlsx`);
        const pdfFilePath = path.join(outputFolder, `${baseName}.pdf`);

        // Konversi JSON ke Excel (tetap sama seperti sebelumnya)
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Menu Bulanan');
        worksheet.columns = [
            { header: 'Hari Ke', key: 'Hari Ke', width: 10 },
            { header: 'Makan Ke', key: 'Makan Ke', width: 10 },
            { header: 'Karbohidrat', key: 'Karbohidrat', width: 15 },
            { header: 'Protein', key: 'Protein', width: 15 },
            { header: 'Sayuran', key: 'Sayuran', width: 15 },
            { header: 'Pelengkap', key: 'Pelengkap', width: 15 },
            { header: 'Total Harga', key: 'Total Harga', width: 15 }
        ];
        jsonData.forEach(row => worksheet.addRow(row));
        await workbook.xlsx.writeFile(excelFilePath);

        // Konversi JSON ke PDF dengan tabel terpisah
        const doc = new PDFDocument();
        const pdfStream = fs.createWriteStream(pdfFilePath);
        doc.pipe(pdfStream);

        doc.fontSize(16).text('Menu Bulanan', { align: 'center' });
        doc.moveDown();

        // Kelompokkan data berdasarkan Hari Ke
        const groupedData = jsonData.reduce((acc, curr) => {
            const hariKe = curr['Hari Ke'];
            if (!acc[hariKe]) {
                acc[hariKe] = [];
            }
            acc[hariKe].push(curr);
            return acc;
        }, {});

        // Fungsi helper untuk membuat tabel
        function createTable(doc, data, startX, startY, cellWidth, rowHeight) {
            const headers = ['Makan Ke', 'Karbohidrat', 'Protein', 'Sayuran', 'Pelengkap', 'Total Harga'];
            
            // Gambar header
            headers.forEach((header, i) => {
                doc.rect(startX + (i * cellWidth), startY, cellWidth, rowHeight).stroke();
                doc.text(header,
                    startX + (i * cellWidth) + 5,
                    startY + 5,
                    { width: cellWidth - 10 }
                );
            });

            // Gambar data
            data.forEach((row, rowIndex) => {
                const y = startY + ((rowIndex + 1) * rowHeight);
                headers.forEach((header, colIndex) => {
                    const value = header === 'Total Harga' 
                        ? `Rp${row[header].toLocaleString()}`
                        : row[header];
                    
                    doc.rect(startX + (colIndex * cellWidth), y, cellWidth, rowHeight).stroke();
                    doc.text(String(value),
                        startX + (colIndex * cellWidth) + 5,
                        y + 5,
                        { width: cellWidth - 10 }
                    );
                });
            });

            return startY + ((data.length + 1) * rowHeight) + 20;
        }

        // Buat tabel untuk setiap hari
        let currentY = 100;
        const pageHeight = 700;
        const cellWidth = 85;
        const rowHeight = 40;

        Object.entries(groupedData).forEach(([hariKe, data]) => {
            // Cek apakah perlu halaman baru
            if (currentY + (data.length + 1) * rowHeight > pageHeight) {
                doc.addPage();
                currentY = 50;
            }

            doc.fontSize(14).text(`Hari Ke ${hariKe}`, 50, currentY);
            currentY += 30;

            currentY = createTable(doc, data, 50, currentY, cellWidth, rowHeight);
            currentY += 20;
        });

        doc.end();
        await new Promise(resolve => pdfStream.on('finish', resolve));

        console.log('Excel dan PDF berhasil dibuat.');

        // Kirim PDF ke pengguna
        await sendFile(sock, phoneNumber, pdfFilePath);

        console.log(`File PDF telah dikirim ke nomor: ${phoneNumber}`);
    } catch (error) {
        console.error('Error dalam proses jsonToExcelAndPdf:', error);
        throw error;
    }
}

module.exports = { pelangganJsonToExcelAndPdf };