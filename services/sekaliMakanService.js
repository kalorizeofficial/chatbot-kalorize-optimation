const { spawn } = require('child_process');

function sekaliMakanService(phoneNumber, token, jumlahPorsi, budget) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [
            'sekali_makan/menu_sekali_makan.py',
            phoneNumber,
            token,
            jumlahPorsi,
            budget
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
                resolve(dataToSend);
            } else {
                reject(`Python script exited with code ${code}`);
            }
        });
    });
}

module.exports = { sekaliMakanService };
