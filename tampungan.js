
==========================================================================================================================================================

menubBulananService.js

const fs = require('fs');
const { spawn } = require('child_process');
const jsonToExcelAndPdf = require('./jsonToExcelAndPdf'); // Import layanan JSON ke Excel dan PDF

function menuBulananService(phoneNumber, token, jumlahPorsi, budget, makanPerHari, jsonFilePath, excelFilePath, pdfFilePath) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [
            './bulanan/menu_bulanan.py',
            phoneNumber,
            token,
            jumlahPorsi,
            budget,
            makanPerHari
        ]);

        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            console.log(`Python Output: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', async (code) => {
            if (code === 0) {
                try {
                    // Convert JSON ke Excel dan PDF
                    jsonToExcelAndPdf(jsonFilePath, excelFilePath, pdfFilePath);
                    resolve(pdfFilePath);
                } catch (error) {
                    reject(`Error during JSON to Excel/PDF conversion: ${error.message}`);
                }
            } else {
                reject(`Python script exited with code ${code}: ${errorOutput}`);
            }
        });
    });
}

module.exports = { menuBulananService };


==========================================================================================================================================================

menu_bulanan.py

import itertools
import random
import json
import sys
import requests

def load_menu_data(phone_number, token):
    # Data default jika API tidak dapat diakses
    default_data = [
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Tempe goreng", "Total Harga": 16000},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Tahu goreng", "Total Harga": 16500},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Kerupuk", "Total Harga": 15500},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Sambal terasi", "Total Harga": 17000},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Sambal bajak", "Total Harga": 18000},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Serundeng", "Total Harga": 15500},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Lalapan segar", "Total Harga": 16000},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis kangkung", "Pelengkap": "Tempe mendoan", "Total Harga": 17000},
        {"Karbohidrat": "Nasi putih", "Protein": "Ayam goreng", "Sayuran": "Tumis bayam", "Pelengkap": "Tempe goreng", "Total Harga": 15500}
    ]

    try:
        # Coba akses data API
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f'http://127.0.0.1/api/mitra/json/{phone_number}', headers=headers)
        response.raise_for_status()
        data = response.json()

        # Periksa apakah data dari API valid
        if data.get('success', False):
            return data.get('data', {}).get('menu_data', default_data)
    except (requests.exceptions.RequestException, ValueError) as e:
        print(f"Error accessing API: {e}")

    # Gunakan data default jika API gagal
    return default_data

def filter_data(menu_data, harga_per_porsi):
    return [item for item in menu_data if item["Total Harga"] <= harga_per_porsi]

def run_optimizer(phone_number, token, jumlah_porsi, budget, jumlah_hari_menu, makan_per_hari):
    # Ambil data dari API atau fallback ke data default
    menu_data = load_menu_data(phone_number, token)

    # Kalkulasi harga per porsi
    harga_per_porsi = budget / jumlah_porsi

    # Filter makanan berdasarkan harga per porsi
    filtered_data = filter_data(menu_data, harga_per_porsi)

    # Acak hasil
    random.shuffle(filtered_data)

    # Pilih jumlah hari menu unik
    best_menus = filtered_data[:jumlah_hari_menu]

    # Duplikasi menu unik untuk memenuhi jumlah makan (30 hari * makan_per_hari)
    total_makan = 30 * makan_per_hari
    menu = best_menus * (total_makan // jumlah_hari_menu) + best_menus[:(total_makan % jumlah_hari_menu)]

    # Tambahkan kolom "Hari Ke" dan "Makan Ke"
    for i, row in enumerate(menu):
        row["Hari Ke"] = (i // makan_per_hari) + 1
        row["Makan Ke"] = (i % makan_per_hari) + 1

    # Filter hanya untuk 30 hari
    menu_30_hari = [row for row in menu if row["Hari Ke"] <= 30]

    return menu_30_hari

if __name__ == "__main__":
    if len(sys.argv) != 7:
        print("Usage: python script.py <phone_number> <token> <jumlah_porsi> <budget> <jumlah_hari_menu> <makan_per_hari>")
        sys.exit(1)

    phone_number = sys.argv[1]
    token = sys.argv[2]
    jumlah_porsi = int(sys.argv[3])
    budget = int(sys.argv[4])
    jumlah_hari_menu = int(sys.argv[5])
    makan_per_hari = int(sys.argv[6])

    output_file = f"menu_bulanan_{phone_number}.json"

    try:
        result = run_optimizer(phone_number, token, jumlah_porsi, budget, jumlah_hari_menu, makan_per_hari)
        with open(output_file, 'w') as f:
            json.dump(result, f, indent=4)
        print(f"Output berhasil disimpan ke file {output_file}")
    except Exception as e:
        print(f"Terjadi kesalahan: {e}")


==========================================================================================================================================================

#jsonToExcelAndPdf.js

const fs = require('fs');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');

function jsonToExcelAndPdf(jsonFilePath, excelFilePath, pdfFilePath) {
    return new Promise((resolve, reject) => {
        const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
        const groupedData = jsonData.reduce((acc, item) => {
            const day = item['Hari Ke'];
            if (!acc[day]) acc[day] = [];
            acc[day].push(item);
            return acc;
        }, {});

        const workbook = xlsx.utils.book_new();
        const pdfDoc = new PDFDocument({
            margins: {
                top: 30,
                bottom: 30,
                left: 50,
                right: 50
            }
        });

        const pdfStream = fs.createWriteStream(pdfFilePath);
        pdfDoc.pipe(pdfStream);

        // Add title
        pdfDoc.fontSize(16).text('Menu Bulanan', { align: 'center' });
        pdfDoc.moveDown(1);

        // Table configuration
        const headers = ['Makan ke', 'Karbohidrat', 'Protein', 'Sayuran', 'Pelengkap', 'Harga'];
        const colWidths = [60, 100, 100, 100, 100, 80];
        const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
        const startX = (pdfDoc.page.width - tableWidth) / 2;
        const rowHeight = 25;

        Object.keys(groupedData).forEach((day, dayIndex) => {
            // Center align "Hari Ke" header
            pdfDoc.fontSize(14)
                .text(`Hari Ke ${day}`, {
                    align: 'right',
                    continued: false
                });
            pdfDoc.moveDown(0.5);

            let currentY = pdfDoc.y;
            let currentX = startX;

            // Draw table headers
            pdfDoc.lineWidth(1);
            
            // Header background
            pdfDoc.fillColor('#f0f0f0')
                .rect(startX, currentY, tableWidth, rowHeight)
                .fill();

            // Header text
            pdfDoc.fillColor('#000000');
            headers.forEach((header, i) => {
                pdfDoc.fontSize(10)
                    .text(header,
                        currentX + 5,
                        currentY + 6,
                        { width: colWidths[i], align: 'left' }
                    );
                currentX += colWidths[i];
            });

            // Draw header lines
            pdfDoc.strokeColor('#000000')
                .moveTo(startX, currentY)
                .lineTo(startX + tableWidth, currentY)
                .stroke();

            currentY += rowHeight;

            // Add data rows
            let makanCounter = 1;
            const sheetData = [headers];

            groupedData[day].forEach((row) => {
                currentX = startX;
                
                // Add row data to Excel
                const rowData = [
                    makanCounter,
                    row['Karbohidrat'],
                    row['Protein'],
                    row['Sayuran'],
                    row['Pelengkap'],
                    row['Total Harga']
                ];
                sheetData.push(rowData);

                // Draw row in PDF
                rowData.forEach((cell, i) => {
                    pdfDoc.fontSize(10)
                        .text(cell.toString(),
                            currentX + 5,
                            currentY + 6,
                            { width: colWidths[i], align: 'left' }
                    );
                    currentX += colWidths[i];
                });

                // Draw row lines
                pdfDoc.strokeColor('#cccccc')
                    .moveTo(startX, currentY)
                    .lineTo(startX + tableWidth, currentY)
                    .stroke();

                currentY += rowHeight;
                makanCounter++;
            });

            // Draw final line
            pdfDoc.strokeColor('#000000')
                .moveTo(startX, currentY)
                .lineTo(startX + tableWidth, currentY)
                .stroke();

            // Draw vertical lines
            let vertX = startX;
            pdfDoc.strokeColor('#000000');
            for (let i = 0; i <= headers.length; i++) {
                pdfDoc.moveTo(vertX, currentY - (rowHeight * makanCounter))
                    .lineTo(vertX, currentY)
                    .stroke();
                if (i < headers.length) vertX += colWidths[i];
            }

            // Add spacing between tables
            pdfDoc.moveDown(0.8);

            // Add Excel sheet
            const worksheet = xlsx.utils.aoa_to_sheet(sheetData);
            xlsx.utils.book_append_sheet(workbook, worksheet, `Hari ke ${day}`);

            // Check if we need a new page
            if (pdfDoc.y > 700) {
                pdfDoc.addPage();
            }
        });

        pdfDoc.end();
        xlsx.writeFile(workbook, excelFilePath);

        pdfStream.on('finish', () => {
            console.log(`File Excel berhasil dibuat: ${excelFilePath}`);
            console.log(`File PDF berhasil dibuat: ${pdfFilePath}`);
            resolve();
        });

        pdfStream.on('error', (error) => {
            console.error('Error during PDF creation:', error);
            reject(error);
        });
    });
}

module.exports = jsonToExcelAndPdf;




==========================================================================================================================================================

case 4:
                    if (isNaN(userMessage)) {
                        await sock.sendMessage(message.key.remoteJid, {
                            text: 'Yah... Ada masalah nih..\nCoba lagi dan pastikan masukkan dalam bentuk angka saja ya.\n\n*Contoh : 50000000*\n\n\nKetik *0* untuk membatalkan'
                        });
                        return;
                    }
                    userStep[from].totalBudget = userMessage;
                    await sock.sendMessage(message.key.remoteJid, {
                        text: 'Berapa total porsi yang kamu sediakan untuk menu makanan dalam satu bulan?\n\nMasukkan angka saja.\n*Contoh : 100*\n\n\nKetik *0* untuk membatalkan'
                    });
                    userStep[from].step = 5;
                    break;
                
                case 5:
                    if (isNaN(userMessage)) {
                        await sock.sendMessage(message.key.remoteJid, {
                            text: 'Yah... Ada masalah nih..\nCoba lagi dan pastikan masukkan dalam bentuk angka saja ya.\n\n*Contoh : 100*\n\n\nKetik *0* untuk membatalkan'
                        });
                        return;
                    }
                    userStep[from].jumlahPorsi = userMessage;
                    await sock.sendMessage(message.key.remoteJid, {
                        text: 'Berapa kali makan per hari yang kamu inginkan? (1/2/3)\n\nMasukkan angka saja.\n*Contoh : 3*\n\n\nKetik *0* untuk membatalkan'
                    });
                    userStep[from].step = 6;
                    break;
                
                case 6:
                    if (![1, 2, 3].includes(Number(userMessage))) {
                        await sock.sendMessage(message.key.remoteJid, {
                            text: 'Yah... Ada masalah nih..\nCoba lagi dan pastikan input adalah 1, 2, atau 3.\n\n*Contoh : 3*\n\n\nKetik *0* untuk membatalkan'
                        });
                        return;
                    }
                    userStep[from].makanPerHari = Number(userMessage);
                
                    const { totalBudget: budgetBulanan, jumlahPorsi: porsiBulanan, makanPerHari } = userStep[from];
                    const phoneNumberBulanan = from;
                
                    try {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Terima kasih, tunggu sebentar lagi disiapin...' });
                
                        // Jalankan layanan untuk menghasilkan JSON, Excel, dan PDF
                        const jsonFilePath = `menu_bulanan_${phoneNumberBulanan}.json`;
                        const excelFilePath = `menu_bulanan_${phoneNumberBulanan}.xlsx`;
                        const pdfFilePath = `menu_bulanan_${phoneNumberBulanan}.pdf`;
                
                        // Panggil layanan untuk membuat file
                        await menuBulananService(
                            phoneNumberBulanan,
                            process.env.API_TOKEN,
                            porsiBulanan,
                            budgetBulanan,
                            makanPerHari,
                            jsonFilePath,
                            excelFilePath,
                            pdfFilePath
                        );
                
                        // Tunggu hingga file PDF selesai ditulis
                        await new Promise((resolve, reject) => {
                            const interval = setInterval(() => {
                                if (fs.existsSync(pdfFilePath) && fs.statSync(pdfFilePath).size > 0) {
                                    clearInterval(interval);
                                    resolve();
                                }
                            }, 1000); // Periksa setiap 100ms
                
                            setTimeout(() => {
                                clearInterval(interval);
                                reject(new Error('File PDF tidak selesai ditulis tepat waktu.'));
                            }, 5000); // Timeout setelah 5 detik
                        });
                
                        // Kirim file PDF ke pengguna
                        const pdfBuffer = fs.readFileSync(pdfFilePath);
                        await sock.sendMessage(message.key.remoteJid, {
                            document: pdfBuffer,
                            mimetype: 'application/pdf',
                            fileName: `Menu_Bulanan_${phoneNumberBulanan}.pdf`
                        });
                
                        await sock.sendMessage(message.key.remoteJid, { text: 'Menu bulanan berhasil dikirim!' });
                    } catch (error) {
                        console.error('Error during menuBulananService:', error);
                        await sock.sendMessage(message.key.remoteJid, {
                            text: 'Terjadi kesalahan saat menjalankan Kalorize Optimasi untuk menu bulanan.'
                        });
                    }
                    userStep[from].step = 0;
                    break;
                    