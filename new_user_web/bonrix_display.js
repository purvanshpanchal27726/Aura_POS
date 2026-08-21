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

async function _sendCanvasToDevice() {
    if (!window.bonrixWriter) return;
    try { 
        const data = _canvasToRGB565();
        const chunkSize = 4096;
        for (let i = 0; i < data.length; i += chunkSize) {
            await window.bonrixWriter.write(data.subarray(i, i + chunkSize));
        }
    } catch (e) { console.error(e); }
}

window.sendBonrixWelcome = async function() {
    if (!window.bonrixWriter) return;
    try {
        await _downloadImageToCanvas('https://download.rechargegrid.in/download/general/image/jpeg/_home.jpg');
        await _sendCanvasToDevice();
    } catch (e) { console.error(e); }
};

window.sendBonrixQR = async function(amount, upiId, upiUrl) {
    if (!window.bonrixWriter) return;
    try {
        await _downloadImageToCanvas('https://download.rechargegrid.in/download/general/image/jpeg/_background.jpg');
        window.bonrixCtx.font = 'bold 33px Arial';
        window.bonrixCtx.fillStyle = 'black';
        const text = 'Rs. ' + parseFloat(amount).toFixed(2);
        window.bonrixCtx.fillText(text, (320 - window.bonrixCtx.measureText(text).width) / 2, 127);

        const qrCanvas = document.createElement('canvas');
        qrCanvas.width = 260; qrCanvas.height = 260;
        await new Promise((resolve) => {
            if (typeof QRCode !== 'undefined') { QRCode.toCanvas(qrCanvas, upiUrl, { width: 260, height: 260, margin: 1 }, resolve); }
            else resolve();
        });
        window.bonrixCtx.drawImage(qrCanvas, 30, 150);

        window.bonrixCtx.font = '20px Arial';
        const utext = 'UPI ID: ' + upiId;
        window.bonrixCtx.fillText(utext, (320 - window.bonrixCtx.measureText(utext).width) / 2, 430);
        await _sendCanvasToDevice();
    } catch (e) { console.error(e); }
};

window.sendBonrixSuccess = async function(amount) {
    if (!window.bonrixWriter) return;
    try {
        await _downloadImageToCanvas('https://download.rechargegrid.in/download/general/image/jpeg/_success.jpg');
        window.bonrixCtx.font = 'bold 34px Arial';
        window.bonrixCtx.fillStyle = 'black';
        const text = 'Rs. ' + parseFloat(amount).toFixed(2);
        window.bonrixCtx.fillText(text, (320 - window.bonrixCtx.measureText(text).width) / 2, 275);
        await _sendCanvasToDevice();
    } catch (e) { console.error(e); }
};
