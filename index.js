const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal');
const mysql = require('mysql2/promise');
const { pelangganMitraHandler } = require('./pelangganMitra');
require('dotenv').config();
const { sekaliMakanService } = require('./services/sekaliMakanService');
const { bulananMakanService } = require('./services/bulananMakanService');
const { jsonToExcelAndPdf } = require('./services/jsonToExcelAndPdf');



async function isPelangganMitra(phoneNumber, db) {
    try {
        const [rows] = await db.execute('SELECT * FROM pelanggan_mitras WHERE nomor_hp = ?', [phoneNumber]);
        return rows.length > 0;
    } catch (error) {
        console.error("Failed to execute query for pelanggan_mitra:", error);
        return false;
    }
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    // if (process.env.API_TOKEN !== '1|Q9P1qMQpm81dICAj5s8FK707tp1XtJBLLVSGBbHD1544cbf1') {
    //     console.error('Invalid API Token. Exiting...');
    //     process.exit(1);
    // }
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    // Coba koneksi ke database dengan penanganan error
    let db;
    try {
        db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
        });
        console.log("Connected to database successfully");
    } catch (error) {
        console.error("Database connection failed:", error);
        return;
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') console.log('Connected');
    });

    let userStep = {};

    async function isUserRegistered(phoneNumber) {
        try {
            const [rows] = await db.execute('SELECT * FROM mitras WHERE nomor_hp = ?', [phoneNumber]);
            return rows.length > 0;
        } catch (error) {
            console.error("Failed to execute query:", error);
            return false;
        }
    }

    async function getUserName(jid) {
        try {
            const [rows] = await db.execute('SELECT nama_mitra FROM mitras WHERE nomor_hp = ?', [jid]);
            return rows.length > 0 ? rows[0].nama_mitra : null;
        } catch (error) {
            console.error("Error fetching user name:", error);
            return null;
        }
    }

    sock.ev.on('messages.upsert', async (msg) => {
        if (msg.messages[0].key.fromMe) return;
        const message = msg.messages[0];
        if (!message.message) return;

        const from = message.key.remoteJid.replace('@s.whatsapp.net', '');
        const userMessage = message.message.conversation.trim();


        const isPelanggan = await isPelangganMitra(from, db);


        if (isPelanggan) {
            await pelangganMitraHandler(sock, message, db, userStep);
        } else {
            // Logika untuk mitra
            if (!(await isUserRegistered(from))) {
                await sock.sendMessage(message.key.remoteJid, { text: 'Maaf, nomor Anda belum terdaftar.' });
                return;
            }
            // Lanjutkan dengan handler mitra
            const userName = await getUserName(from);
            console.log(`Pesan dari ${from}: ${userMessage}`);

            if (!(await isUserRegistered(from))) {
                await sock.sendMessage(message.key.remoteJid, { text: 'Yah, Sepertinya kamu belum dapet akses nih...\n\nSilakan join jadi member dulu disini\n*+6285159165507*' });
                return;
            }

            if (userMessage === "0") {
                await sock.sendMessage(message.key.remoteJid, { text: 'Proses dibatalkan. Ketik "*halo*" untuk memulai kembali.' });
                userStep[from] = { step: 0 };
                return;
            }

            if (!userStep[from]) userStep[from] = { step: 0 };

            switch (userStep[from].step) {
                case 0:
                    await sock.sendMessage(message.key.remoteJid, {
                        text: `👋 Hai *${userName}* !! 🎉\nSelamat datang di Kalorize Chatbot.\nAku bakal bantu kamu untuk nentuin rekomendasi makanan katering yang sesuai dengan preferensi budget kamu.\n\nKamu mau rekomendasi menu yang mana?\n1 Sekali Makan\n2 Bulanan\n\nMasukkan angka saja.\n*Contoh : 1*\n\n\nKetik *0* untuk membatalkan`
                    });
                    userStep[from].step = 1;
                    break;

                case 1:
                    if (userMessage === "1") {
                        await sock.sendMessage(message.key.remoteJid, { text: ' Berapa total budget kamu untuk sekali menyediakan menu makanan? (dalam rupiah)\n\nMasukkan angka saja.\n*Contoh : 2000000*\n\n\nKetik *0* untuk membatalkan' });
                        userStep[from].step = 2;
                    } else if (userMessage === "2") {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Berapa total budget kamu untuk sekali menyediakan menu makanan? (dalam rupiah)\n\nMasukkan angka saja.\n*Contoh : 50000000*\n\n\nKetik *0* untuk membatalkan' });
                        userStep[from].step = 4; // Sediakan step untuk opsi "Bulanan" nanti
                    } else {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Yah... Ada masalah nih.\nCoba lagi dan pastikan inputannya sudah sesuai ya.\n\nKamu mau rekomendasi menu yang mana?\n1 Sekali Makan\n2 Bulanan\n\nMasukkan angka saja.\n*Contoh : 1*\n\n\nKetik *0* untuk membatalkan' });
                    }
                    break;

                case 2:
                    if (isNaN(userMessage)) {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Yah... Ada masalah nih..\nCoba lagi dan pastikan masukkan dalam bentuk angka saja ya.\n\n*Contoh : 2000000*\n\n\nKetik *0* untuk membatalkan' });
                        return;
                    }
                    userStep[from].totalBudget = userMessage;
                    await sock.sendMessage(message.key.remoteJid, { text: 'Berapa total porsi yang kamu sediakan untuk untuk sekali menyediakan menu makanan?\n\nMasukkan angka saja.\n*Contoh : 100*\n\n\nKetik *0* untuk membatalkan' });
                    userStep[from].step = 3;
                    break;

                case 3:
                    if (isNaN(userMessage)) {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Yah... Ada masalah nih..\nCoba lagi dan pastikan masukkan dalam bentuk angka saja ya.\n\n*Contoh : 100*\n\n\nKetik *0* untuk membatalkan' });
                        return;
                    }
                    userStep[from].jumlahPorsi = userMessage;
                    const { totalBudget, jumlahPorsi } = userStep[from];
                    const phoneNumber = from;
                
                    try {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Terima kasih, tunggu sebentar lagi disiapin...' });
                        const output = await sekaliMakanService(phoneNumber, process.env.API_TOKEN, jumlahPorsi, totalBudget);
                        await sock.sendMessage(message.key.remoteJid, { text: `Hasil optimasi:\n\n${output}` });
                
                        // Tambahkan opsi untuk ulangi tanpa input data baru
                        await sock.sendMessage(message.key.remoteJid, {
                            text: `Pilih opsi berikut:\n9. Ulangi tanpa input baru\n0. Selesai`
                        });
                
                        userStep[from].step = 9; // Set step untuk opsi ulangi
                    } catch (error) {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Terjadi kesalahan saat menjalankan Kalorize Optimasi.' });
                    }
                
                    break;
                
                case 9:
                    try {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Ulangi optimasi tanpa input data baru. Mohon tunggu...' });
                        const { totalBudget, jumlahPorsi } = userStep[from];
                        const phoneNumber = from;
                        const output = await sekaliMakanService(phoneNumber, process.env.API_TOKEN, jumlahPorsi, totalBudget);
                        await sock.sendMessage(message.key.remoteJid, { text: `Hasil optimasi (ulangi):\n\n${output}` });
                

                        await sock.sendMessage(message.key.remoteJid, {
                            text: `Pilih opsi berikut:\n9. Ulangi tanpa input baru\n0. Selesai`
                        });

                        // Kembali ke step sebelumnya
                        userStep[from].step = 9;
                    } catch (error) {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Terjadi kesalahan saat menjalankan ulang optimasi.' });
                    }
                    break;

                case 4:
                    if (isNaN(userMessage)) {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Input tidak valid. Masukkan angka saja.' });
                        return;
                    }
                    userStep[from].totalBudget = parseInt(userMessage); // Pastikan nilai diubah menjadi integer
                    console.log("Total Budget set to:", userStep[from].totalBudget); // Logging untuk debugging
                    await sock.sendMessage(message.key.remoteJid, { text: 'Berapa total porsi yang kamu sediakan untuk untuk sekali menyediakan menu makanan?\n\nMasukkan angka saja.\n*Contoh : 1000*\n\n\nKetik *0* untuk membatalkan' });
                    userStep[from].step = 5;
                    break;
                    

                case 5:
                    if (isNaN(userMessage)) {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Input tidak valid. Masukkan angka saja.' });
                        return;
                    }
                    userStep[from].jumlahPorsi = userMessage;
                    await sock.sendMessage(message.key.remoteJid, { text: 'Setiap berapa hari kamu mengulangi variasi menu makanan? (contoh: 2, 3, dst.)\n\nMasukkan angka saja.\n*Contoh : 20*\n\n\nKetik *0* untuk membatalkan' });
                    userStep[from].step = 6;
                    break;

                case 6:
                    if (isNaN(userMessage) || userMessage < 1 || userMessage > 30) {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Input tidak valid. Masukkan angka antara 1 dan 30.' });
                        return;
                    }
                    userStep[from].jumlahHariMenu = userMessage;
                    await sock.sendMessage(message.key.remoteJid, { text: ' ⁠Setiap berapa hari kamu mengulangi variasi menu makanan? (contoh: 2, 3, dst.)\n\nMasukkan angka saja.\n*Contoh : 3*\n\n\nKetik *0* untuk membatalkan' });
                    userStep[from].step = 7;
                    break;

                case 7:
                    if (isNaN(userMessage) || ![1, 2, 3].includes(parseInt(userMessage))) {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Input tidak valid. Masukkan angka 1, 2, atau 3.' });
                        return;
                    }
                    userStep[from].makanPerHari = parseInt(userMessage);
                
                    const { totalBudget: bulananBudget, jumlahPorsi: bulananPorsi, jumlahHariMenu, makanPerHari } = userStep[from];
                    const bulananPhoneNumber = from;
                
                    // Tambahkan validasi untuk memastikan totalBudget terisi
                    if (!bulananBudget || isNaN(bulananBudget)) {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Terjadi kesalahan. Budget tidak valid. Ulangi dari awal.' });
                        userStep[from].step = 0;
                        return;
                    }
                
                    console.log("Running bulananMakanService with parameters:");
                    console.log(`Phone Number: ${bulananPhoneNumber}`);
                    console.log(`Token: ${process.env.API_TOKEN}`);
                    console.log(`Jumlah Porsi: ${bulananPorsi}`);
                    console.log(`Budget: ${bulananBudget}`);
                    console.log(`Jumlah Hari Menu: ${jumlahHariMenu}`);
                    console.log(`Makan Per Hari: ${makanPerHari}`);
                
                    try {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Terima kasih, tunggu sebentar lagi disiapin...' });
                    
                        // Jalankan bulananMakanService
                        const jsonFilePath = await bulananMakanService(
                            bulananPhoneNumber,
                            process.env.API_TOKEN,
                            bulananPorsi,
                            bulananBudget,
                            jumlahHariMenu,
                            makanPerHari
                        );
                    
                        // Panggil jsonToExcelAndPdf untuk konversi JSON ke PDF dan kirim file
                        await jsonToExcelAndPdf(sock, jsonFilePath, bulananPhoneNumber);
                    
                        await sock.sendMessage(message.key.remoteJid, { text: 'File PDF berhasil dikirim. Periksa WhatsApp Anda.' });
                    } catch (error) {
                        console.error('Error during bulananMakanService execution:', error);
                        await sock.sendMessage(message.key.remoteJid, { text: 'Terjadi kesalahan saat mengolah data ke PDF.' });
                    }
                    
                
                    userStep[from].step = 0;
                    break;
                    
                

                default:
                    await sock.sendMessage(message.key.remoteJid, { text: 'Maaf, saya tidak mengerti. Coba ketik "halo" atau "info".' });
                    userStep[from].step = 0;
                    break;
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}



// Mulai koneksi WhatsApp
connectToWhatsApp();
