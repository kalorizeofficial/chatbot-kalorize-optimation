const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    // Menampilkan QR code
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('connected');
        }
    });

    // Menangani pesan yang diterima
    sock.ev.on('messages.upsert', async (msg) => {
        if (msg.messages[0].key.fromMe) return;
        const message = msg.messages[0];
        if (!message.message) return;

        const from = message.key.remoteJid; // ID pengirim
        const userMessage = message.message.conversation; // Pesan dari user

        console.log(Pesan dari ${from}: ${userMessage});

        // Logika penanganan input dari pengguna
        if (userMessage.toLowerCase() === 'halo') {
            await sock.sendMessage(from, { text:'Halo! Selamat datang di Kalorize ChatBot Optimasi. \n\nUntuk menggunakan fungsi ini, Anda bisa mengetikkan format berikut: \n\n"optimasi <nominal uang> <jumlah porsi> <jumlah kombinasi menu makanan>" \n\n*Contoh:* \noptimasi 2000000 100 10' });
        } else if (userMessage.toLowerCase() === 'info') {
            await sock.sendMessage(from, { text: 'Ini adalah bot WhatsApp Kalorize yang digunakan untuk memberikan rekomendasi menu makanan yang cocok untuk Anda berdasarkan nominal uang, porsi, dan jumlah varian menu yang ingin ditampilkan.\n\nTerima kasih.'
 });
        } else if (userMessage.startsWith('optimasi')) {
            // Misal: pengguna mengetik "hitungan 1000 5 3"
            const args = userMessage.split(' ').slice(1); // Ambil argumen setelah "hitungan"
            if (args.length !== 3) {
                await sock.sendMessage(from, { text: 'Format yang benar: optimasi <totalBudget> <numberOfPeople> <menuCombination>' });
                return;
            }

            const [totalBudget, numberOfPeople, menuCombination] = args;

            try {
                const output = await runPythonScript(totalBudget, numberOfPeople, menuCombination);
                await sock.sendMessage(from, { text: ${output} });
            } catch (error) {
                await sock.sendMessage(from, { text: 'Terjadi kesalahan saat menjalankan Kalorize Optimation.' });
            }
        } else {
            await sock.sendMessage(from, { text: 'Maaf, saya tidak mengerti. Coba ketik "halo" atau "info".' });
        }
    });

    // Simpan kredensial
    sock.ev.on('creds.update', saveCreds);
}

function runPythonScript(totalBudget, numberOfPeople, menuCombination) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', ['menu_optimizer/menu_optimizer_local.py', totalBudget, numberOfPeople, menuCombination]);

        let dataToSend = '';

        pythonProcess.stdout.on('data', (data) => {
            dataToSend += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(stderr: ${data});
            reject(data.toString());
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                resolve(dataToSend);
            } else {
                reject(Python script exited with code ${code});
            }
        });
    });
}

// Mulai koneksi WhatsApp
connectToWhatsApp();