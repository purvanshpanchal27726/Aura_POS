const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'xzhmg1ek',
  api_key: '629518777443581',
  api_secret: 'XY7YwH2VKmqXQjBsBdO8BWynx0s',
  secure: true
});

async function testUpload() {
  try {
    console.log('Testing Cloudinary raw upload to cloud: xzhmg1ek...');
    // Minimal valid PDF header base64 string
    const samplePdfDataUri = 'data:application/pdf;base64,JVBERi0xLjQKJSDi48jpCjEgMCBvYmoKPDwvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iaiA8PC9UeXBlIC9QYWdlcyAvQ291bnQgMSAvS2lkcyBbMyAwIFJdPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdPj4KZW5kb2JqCnhyZWYKMCA0CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDA0MDAwMDAxOSAwMDAwMCBuIAowMDQwMDAwMDY4IDAwMDAwIG4gCjAwNDAwMDAxMjIgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDQgL1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMTczCiUlRU9GCg==';
    
    const result = await cloudinary.uploader.upload(samplePdfDataUri, {
      public_id: 'test_invoice_pdf_001.pdf',
      folder: 'pos_invoices',
      resource_type: 'raw',
      overwrite: true
    });

    console.log('✅ Cloudinary Upload Successful!');
    console.log('  └─ Public ID:', result.public_id);
    console.log('  └─ Secure URL:', result.secure_url);
  } catch (err) {
    console.error('❌ Cloudinary Upload Failed:', err);
  }
}

testUpload();
