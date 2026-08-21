const fs = require('fs');

const path = 'new_user_web/bonrix_display.js';
let content = fs.readFileSync(path, 'utf8');

// The original file had functions _sendCanvasToDevice, sendBonrixWelcome, etc.
// We slice the file at `async function _sendCanvasToDevice()`
const parts = content.split('async function _sendCanvasToDevice()');
if (parts.length === 2) {
    const newTail = `async function _sendCommand(cmdString) {
    if (!window.bonrixWriter) return;
    try {
        const encoder = new TextEncoder();
        await window.bonrixWriter.write(encoder.encode(cmdString + '\\n'));
    } catch (e) {
        console.error(e);
    }
}

window.sendBonrixWelcome = async function() {
    await _sendCommand('WelcomeScreen**store@upi');
};

window.sendBonrixQR = async function(amount, upiId, upiUrl) {
    await _sendCommand(\`DisplayQRCodeScreen**\${upiUrl}**\${amount}**\${upiId}\`);
};

window.sendBonrixSuccess = async function(amount) {
    const txId = 'TXN' + Math.floor(Math.random()*10000);
    const orderNo = 'ORD' + Math.floor(Math.random()*100);
    const date = new Date().toISOString().split('T')[0];
    await _sendCommand(\`DisplaySuccessQRCodeScreen**\${txId}**\${orderNo}**\${date}**\${amount}\`);
};
`;

    fs.writeFileSync(path, parts[0] + newTail, 'utf8');
} else {
    console.error("Could not find split point");
}
