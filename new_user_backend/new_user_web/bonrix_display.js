/**
 * Bonrix DQ11 7-inch Customer Display Driver (Web Serial API)
 */
window.bonrixSerialPort = null;
window.bonrixWriter = null;
window.bonrixCanvas = document.createElement('canvas');
window.bonrixCanvas.width = 320;
window.bonrixCanvas.height = 480;
window.bonrixCtx = window.bonrixCanvas.getContext('2d', { willReadFrequently: true });

window.bonrixSelectedBaudRate = 115200;

if ('serial' in navigator) {
    navigator.serial.addEventListener('connect', async (event) => {
        if (!window.bonrixSerialPort) {
            window.bonrixSerialPort = event.target;
            await _openBonrixPort(window.bonrixSelectedBaudRate);
        }
    });
    navigator.serial.addEventListener('disconnect', async (event) => {
        if (event.target === window.bonrixSerialPort) {
            if (window.bonrixWriter) { await window.bonrixWriter.close().catch(()=>{}); window.bonrixWriter = null; }
            window.bonrixSerialPort = null;
        }
    });
}

async function _openBonrixPort(baudRate) {
    try {
        try {
            await window.bonrixSerialPort.open({ baudRate: baudRate });
        } catch (err) {
            if (err.name !== 'InvalidStateError') throw err;
        }
        window.bonrixWriter = window.bonrixSerialPort.writable.getWriter();
        window.sendBonrixWelcome();
    } catch (e) { console.error('Error opening Bonrix port:', e); }
}

window.connectBonrixDisplay = async function(baudRate = 115200) {
    window.bonrixSelectedBaudRate = baudRate;
    if (!('serial' in navigator)) { alert('Web Serial API not supported!'); return; }
    try {
        if (window.bonrixSerialPort) {
            if (window.bonrixWriter) { await window.bonrixWriter.close().catch(()=>{}); window.bonrixWriter = null; }
            await window.bonrixSerialPort.close().catch(()=>{});
        }
        window.bonrixSerialPort = await navigator.serial.requestPort();
        await _openBonrixPort(window.bonrixSelectedBaudRate);
        alert('Connected to Customer Display at ' + window.bonrixSelectedBaudRate + ' baud!');
    } catch (e) { console.error(e); }
};

async function _downloadImageToCanvas(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            window.bonrixCtx.clearRect(0, 0, 320, 480);
            window.bonrixCtx.drawImage(img, 0, 0, 320, 480);
            resolve();
        };
        img.onerror = reject;
        img.src = url;
    });
}

function _canvasToRGB565() {
    const imageData = window.bonrixCtx.getImageData(0, 0, 320, 480);
    const data = imageData.data;
    const rgb565Data = new Uint8Array(320 * 480 * 2);
    let index = 0;
    for (let y = 480 - 1; y >= 0; y--) {
        for (let x = 0; x < 320; x++) {
            const p = (y * 320 + x) * 4;
            const r5 = (data[p] >> 3) & 0x1F, g6 = (data[p + 1] >> 2) & 0x3F, b5 = (data[p + 2] >> 3) & 0x1F;
            const rgb565 = (r5 << 11) | (g6 << 5) | b5;
            rgb565Data[index++] = (rgb565 >> 8) & 0xFF;
            rgb565Data[index++] = rgb565 & 0xFF;
        }
    }
    return rgb565Data;
}

async function _sendCommand(cmdString) {
    if (!window.bonrixWriter) return;
    try {
        const encoder = new TextEncoder();
        await window.bonrixWriter.write(encoder.encode(cmdString + '\n'));
    } catch (e) {
        console.error(e);
    }
}

window.sendBonrixWelcome = async function() {
    await _sendCommand('WelcomeScreen**store@upi');
};

window.sendBonrixQR = async function(amount, upiId, upiUrl) {
    await _sendCommand(`DisplayQRCodeScreen**${upiUrl}**${amount}**${upiId}`);
};

window.sendBonrixSuccess = async function(amount) {
    const txId = 'TXN' + Math.floor(Math.random()*10000);
    const orderNo = 'ORD' + Math.floor(Math.random()*100);
    const date = new Date().toISOString().split('T')[0];
    await _sendCommand(`DisplaySuccessQRCodeScreen**${txId}**${orderNo}**${date}**${amount}`);
};
