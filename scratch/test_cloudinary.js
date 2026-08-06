const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'xzhmg1ek',
  api_key: '629518777443581',
  api_secret: 'XY7YwH2VKmqXQjBsBdO8BWynx0s',
  secure: true
});

async function testUpload() {
  try {
    console.log('Testing Cloudinary upload to cloud: xzhmg1ek...');
    // A small sample base64 1x1 transparent PNG / text
    const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSU5EUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const result = await cloudinary.uploader.upload(sampleBase64, {
      public_id: 'invoices/test_invoice_001',
      folder: 'pos_invoices',
      overwrite: true
    });

    console.log('✅ Cloudinary Upload Successful!');
    console.log('  └─ Public ID:', result.public_id);
    console.log('  └─ Secure URL:', result.secure_url);
    console.log('  └─ Format:', result.format);
  } catch (err) {
    console.error('❌ Cloudinary Upload Failed:', err.message);
  }
}

testUpload();
