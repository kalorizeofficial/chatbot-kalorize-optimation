const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal');
const mysql = require('mysql2/promise');
const { pelangganMitraHandler } = require('./pelangganMitra');
require('dotenv').config();


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
        db = await mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            connectTimeout: 10000, // 10 detik
            acquireTimeout: 10000
        });

         

        console.log("Connected to database successfully");
    } catch (error) {
        console.error("Database connection failed:", error);
        // Tangani error pada koneksi
        db.on('error', async (err) => {
            console.error('Database connection error:', err);
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                console.log('Reconnecting to database...');
                db = await createPool();
            }
        });
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
                        await sock.sendMessage(message.key.remoteJid, { text: 'Berapa budget kamu untuk sekali makan? (dalam rupiah)\n\nMasukkan angka saja.\n*Contoh : 2000000*\n\n\nKetik *0* untuk membatalkan' });
                        userStep[from].step = 2;
                    } else if (userMessage === "2") {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Berapa budget kamu untuk sebulan? (dalam rupiah)\n\nMasukkan angka saja.\n*Contoh : 50000000*\n\n\nKetik *0* untuk membatalkan' });
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
                    await sock.sendMessage(message.key.remoteJid, { text: 'Berapa total porsi yang kamu sediakan untuk 1 menu makanan?\n\nMasukkan angka saja.\n*Contoh : 100*\n\n\nKetik *0* untuk membatalkan' });
                    userStep[from].step = 3;
                    break;

                case 3:
                    if (isNaN(userMessage)) {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Yah... Ada masalah nih..\nCoba lagi dan pastikan masukkan dalam bentuk angka saja ya.\n\n*Contoh : 100*\n\n\nKetik *0* untuk membatalkan' });
                        return;
                    }
                    userStep[from].numberOfPeople = userMessage;
                    
                    // Tetapkan nilai jumlah kombinasi menu menjadi 3 tanpa menanyakan pengguna
                    userStep[from].menuCombination = 3;
                    
                    const { totalBudget, numberOfPeople, menuCombination } = userStep[from];
                    const phoneNumber = from;

                    try {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Terima kasih, tunggu sebentar lagi disiapin...' });
                        const output = await runPythonScript(totalBudget, numberOfPeople, menuCombination, phoneNumber);
                        await sock.sendMessage(message.key.remoteJid, { text: `${output}` });
                    } catch (error) {
                        await sock.sendMessage(message.key.remoteJid, { text: 'Terjadi kesalahan saat menjalankan Kalorize Optimasi.' });
                    }

                    userStep[from].step = 0;
                    break;

                case 4:
                    // Step tambahan untuk opsi "Bulanan" (nanti bisa dikembangkan lebih lanjut)
                    await sock.sendMessage(message.key.remoteJid, { text: 'Opsi Bulanan masih dalam pengembangan. Ketik *0* untuk membatalkan.' });

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

function runPythonScript(totalBudget, numberOfPeople, menuCombination, phoneNumber) {
    return new Promise((resolve, reject) => {
        const token = process.env.API_TOKEN;
        const pythonProcess = spawn('python', [
            'menu_optimizer/menu_optimizer_local.py',
            totalBudget,
            numberOfPeople,
            menuCombination,
            phoneNumber,
            token
        ]);

        let dataToSend = '';
        pythonProcess.stdout.on('data', (data) => dataToSend += data.toString());
        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python error output: ${data}`);
            reject(data.toString());
        });
        pythonProcess.on('close', (code) => {
            if (code === 0) resolve(dataToSend);
            else reject(`Python script exited with code ${code}`);
        });
    });
}

// Mulai koneksi WhatsApp
connectToWhatsApp();
