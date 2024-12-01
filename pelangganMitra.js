const mysql = require('mysql2/promise');
const { spawn } = require('child_process');

async function getPelangganMitraDetails(phoneNumber, db) {
    try {
        const [rows] = await db.execute(`
            SELECT pm.nama_pelanggan, m.nama_mitra 
            FROM pelanggan_mitras pm
            INNER JOIN mitras m ON pm.id_mitra = m.id
            WHERE pm.nomor_hp = ?
        `, [phoneNumber]);

        if (rows.length > 0) {
            return {
                namaPelanggan: rows[0].nama_pelanggan,
                namaMitra: rows[0].nama_mitra
            };
        }
        return null;
    } catch (error) {
        console.error("Error fetching pelanggan mitra details:", error);
        return null;
    }
}

async function getMitraPhoneNumber(phoneNumber, db) {
    try {
        const [rows] = await db.execute(`
            SELECT m.nomor_hp
            FROM mitras m
            INNER JOIN pelanggan_mitras pm ON m.id = pm.id_mitra
            WHERE pm.nomor_hp = ?
        `, [phoneNumber]);

        if (rows.length > 0) {
            return rows[0].nomor_hp;
        }
        return null;
    } catch (error) {
        console.error("Error fetching mitra phone number:", error);
        return null;
    }
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

async function pelangganMitraHandler(sock, message, db, userStep) {
    const from = message.key.remoteJid.replace('@s.whatsapp.net', '');
    const userMessage = message.message.conversation.trim();
    const pelangganDetails = await getPelangganMitraDetails(from, db);

    if (!pelangganDetails) {
        await sock.sendMessage(message.key.remoteJid, { text: 'Maaf, nomor Anda belum terdaftar sebagai pelanggan mitra kami.' });
        return;
    }

    const { namaPelanggan, namaMitra } = pelangganDetails;

    if (!userStep[from]) {
        userStep[from] = { step: 0 };
    }

    switch (userStep[from].step) {
        case 0:
            await sock.sendMessage(message.key.remoteJid, {
                text: `👋 Hai *${namaPelanggan}*! 🎉\nSelamat datang di layanan pelanggan mitra *${namaMitra}*.\nAku akan bantu kamu menemukan rekomendasi menu sesuai budget kamu.\n\nKamu mau rekomendasi menu yang mana?\n1. Sekali Makan\n2. Bulanan\n\nMasukkan angka saja.\n*Contoh: 1*\n\nKetik *0* untuk membatalkan.`
            });
            userStep[from].step = 1;
            break;
    
        case 1:
            if (userMessage === "0") {
                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Proses dibatalkan. Terima kasih!'
                });
                userStep[from].step = 0; // Reset step
                return;
            }
    
            if (userMessage === "1") {
                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Berapa budget kamu untuk sekali makan? (dalam rupiah)\n\nMasukkan angka saja.\n*Contoh: 2000000*\n\nKetik *0* untuk membatalkan.'
                });
                userStep[from].step = 2;
            } else {
                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Yah... Ada masalah nih. Coba lagi dan pastikan inputannya sudah sesuai ya.\n\nKamu mau rekomendasi menu yang mana?\n1. Sekali Makan\n2. Bulanan\n\nMasukkan angka saja.\n*Contoh: 1*\n\nKetik *0* untuk membatalkan.'
                });
            }
            break;
    
        case 2:
            if (userMessage === "0") {
                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Proses dibatalkan. Terima kasih!'
                });
                userStep[from].step = 0; // Reset step
                return;
            }
    
            if (isNaN(userMessage)) {
                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Yah... Ada masalah nih. Pastikan masukkan angka saja ya.\n\n*Contoh: 2000000*\n\nKetik *0* untuk membatalkan.'
                });
                return;
            }
            userStep[from].totalBudget = userMessage;
            await sock.sendMessage(message.key.remoteJid, {
                text: 'Berapa total porsi yang kamu sediakan untuk 1 menu makanan?\n\nMasukkan angka saja.\n*Contoh: 100*\n\nKetik *0* untuk membatalkan.'
            });
            userStep[from].step = 3;
            break;
    
        case 3:
            if (userMessage === "0") {
                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Proses dibatalkan. Terima kasih!'
                });
                userStep[from].step = 0; // Reset step
                return;
            }
    
            if (isNaN(userMessage)) {
                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Yah... Ada masalah nih. Pastikan masukkan angka saja ya.\n\n*Contoh: 100*\n\nKetik *0* untuk membatalkan.'
                });
                return;
            }
            userStep[from].numberOfPeople = userMessage;
    
            const { totalBudget, numberOfPeople } = userStep[from];
            const nomor_mitra = await getMitraPhoneNumber(from, db);
    
            try {
                await sock.sendMessage(message.key.remoteJid, { text: 'Tunggu sebentar, sedang menyiapkan rekomendasi menu...' });
                const output = await runPythonScript(totalBudget, numberOfPeople, 3, nomor_mitra);
            
                // Simpan output Python untuk referensi
                userStep[from].menuOptions = output;
            
                await sock.sendMessage(message.key.remoteJid, {
                    text: `Berikut rekomendasi menu yang tersedia:\n\n${output}\n\nKetik angka untuk memilih menu yang Anda inginkan.\n*Contoh: 2*\n\nKetik *0* untuk membatalkan.\nKetik *9* untuk menjalankan ulang rekomendasi menu.`
                });
            
                userStep[from].step = 4;
            } catch (error) {
                await sock.sendMessage(message.key.remoteJid, { text: 'Terjadi kesalahan saat menjalankan optimasi menu.' });
            }
            break;
            
        case 4:
            if (userMessage === "0") {
                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Proses dibatalkan. Terima kasih!'
                });
                userStep[from].step = 0; // Reset step
                return;
            }
        
            if (userMessage === "9") {
                // Menjalankan ulang rekomendasi menu dengan parameter yang sama
                const { totalBudget, numberOfPeople } = userStep[from];
                await sock.sendMessage(message.key.remoteJid, { text: 'Tunggu sebentar, sedang menjalankan ulang rekomendasi menu...' });
               
                const nomor_mitra = await getMitraPhoneNumber(from, db);
                try {
                    const output = await runPythonScript(totalBudget, numberOfPeople, 3, nomor_mitra);
        
                    // Simpan output Python untuk referensi
                    userStep[from].menuOptions = output;
        
                    await sock.sendMessage(message.key.remoteJid, {
                        text: `Berikut rekomendasi menu yang tersedia:\n\n${output}\n\nKetik angka untuk memilih menu yang Anda inginkan.\n*Contoh: 2*\n\nKetik *0* untuk membatalkan.\nKetik *9* untuk menjalankan ulang rekomendasi menu.`
                    });
                } catch (error) {
                    await sock.sendMessage(message.key.remoteJid, { text: 'Terjadi kesalahan saat menjalankan optimasi menu.' });
                }
                return;
            }
        
            if (isNaN(userMessage) || parseInt(userMessage) < 1 || parseInt(userMessage) > 3) {
                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Pilihan tidak valid. Masukkan angka sesuai menu yang tersedia.\n*Contoh: 2*\n\nKetik *0* untuk membatalkan.\nKetik *9* untuk menjalankan ulang rekomendasi menu.'
                });
                return;
            }

            const chosenMenu = parseInt(userMessage);
            const mitraPhoneNumber = await getMitraPhoneNumber(from, db);

            console.log("Nomor pelanggan (from):", from); // Log nomor pelanggan
            console.log("Nomor HP mitra yang ditemukan:", mitraPhoneNumber); // Log nomor mitra yang ditemukan

            if (mitraPhoneNumber) {
                const menuOptions = userStep[from].menuOptions;
                console.log("Pilihan menu yang dikirim:", chosenMenu); // Log pilihan menu pelanggan
                console.log("Menu options yang tersedia:\n", menuOptions); // Log semua opsi menu

                await sock.sendMessage(mitraPhoneNumber + '@s.whatsapp.net', {
                    text: `Hai, *${namaMitra}*.\nPelanggan kamu dengan atas nama *${namaPelanggan}*\nMemilih menu ke *"${chosenMenu}"*\ndari hasil rekomendasi berikut ini:\n\n${menuOptions}\n\nSilakan tindak lanjuti pesanan ini.`
                });

                console.log("Pesan ke mitra berhasil dikirim ke:", mitraPhoneNumber); // Log konfirmasi pengiriman ke mitra

                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Pesanan Anda telah berhasil dikirimkan ke mitra. Terima kasih!'
                });

                console.log("Pesan konfirmasi ke pelanggan berhasil dikirim."); // Log konfirmasi pengiriman ke pelanggan
            } else {
                console.log("Nomor HP mitra tidak ditemukan untuk pelanggan:", from); // Log jika nomor mitra tidak ditemukan

                await sock.sendMessage(message.key.remoteJid, {
                    text: 'Maaf, tidak dapat menemukan nomor mitra. Hubungi admin untuk bantuan lebih lanjut.'
                });

                console.log("Pesan error ke pelanggan berhasil dikirim."); // Log konfirmasi pengiriman pesan error
            }

            userStep[from].step = 0;

            break;

        default:
            await sock.sendMessage(message.key.remoteJid, { text: 'Maaf, saya tidak mengerti. Coba ketik "halo" atau "info".' });
            userStep[from].step = 0;
            break;
    }
}


module.exports = { pelangganMitraHandler };
