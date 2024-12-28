const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function bulananMakanService(phoneNumber, token, jumlahPorsi, budget, jumlahHariMenu, makanPerHari) {
    return new Promise((resolve, reject) => {
        // Path file JSON output
        const outputFolder = './outputJson';
        const filename = `output_bulanan_${phoneNumber}.json`;
        const filePath = path.join(outputFolder, filename);

        const pythonProcess = spawn('python', [
            'bulanan/menu_bulanan.py',
            phoneNumber,
            token,
            jumlahPorsi,
            budget,
            jumlahHariMenu,
            makanPerHari
        ]);

        let dataToSend = '';
        pythonProcess.stdout.on('data', (data) => {
            dataToSend += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python error output: ${data}`);
            reject(data.toString());
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`File JSON seharusnya dihasilkan di: ${filePath}`);
                // Cek apakah file JSON ada
                if (!fs.existsSync(filePath)) {
                    return reject(`File JSON tidak ditemukan di ${filePath}`);
                }

                // Baca file JSON yang dihasilkan
                fs.readFile(filePath, 'utf-8', (err, data) => {
                    if (err) {
                        reject(`Error membaca file JSON: ${err}`);
                    } else {
                        resolve(filePath); // Kirim path file JSON ke pengguna
                    }
                });
            } else {
                reject(`Python script exited with code ${code}`);
            }
        });
    });
}

module.exports = { bulananMakanService };
