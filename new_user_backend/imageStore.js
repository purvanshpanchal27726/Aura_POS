const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const uploadsRoot = path.join(__dirname, 'Images');
const variants = ['original', 'web', 'mobile', 'thumb'];

const mimeExtensions = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

const ensureVariantFolders = () => {
  variants.forEach((variant) => {
    fs.mkdirSync(path.join(uploadsRoot, variant), { recursive: true });
  });
};

const sanitizeName = (name = 'item-image') => {
  const base = path.basename(name).replace(/\.[^.]+$/, '');
  return base
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'item-image';
};

const parseDataUri = (value) => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const extension = mimeExtensions[mime] || 'png';
  return {
    mime,
    extension,
    buffer: Buffer.from(match[2], 'base64')
  };
};

const getPublicBaseUrl = (req) => {
  const host = req.get('host') || '';
  const protocol = (req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' || (!host.includes('localhost') && !host.includes('127.0.0.1'))) ? 'https' : 'http';
  return `${protocol}://${host}`;
};

const toPublicUrl = (req, variant, filename) => (
  `${getPublicBaseUrl(req)}/Images/${variant}/${filename}`
);

const isStoredImageRecord = (value) => {
  if (!value || typeof value !== 'string') return false;
  try {
    const parsed = JSON.parse(value);
    return parsed && parsed.kind === 'item-image-v1';
  } catch (err) {
    return false;
  }
};

const normalizeVariantPayload = (variantValue) => {
  if (!variantValue) return null;
  if (typeof variantValue === 'string') return variantValue;
  if (typeof variantValue === 'object') {
    return variantValue.dataUri || variantValue.base64 || variantValue.value || null;
  }
  return null;
};

const saveImagePayload = async (payload, req) => {
  ensureVariantFolders();

  const originalName = sanitizeName(payload.originalName || payload.filename || 'item-image');
  const token = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  
  const sourceVariants = payload.variants && typeof payload.variants === 'object'
    ? payload.variants
    : { original: payload.dataUri || payload.base64 || payload.image };

  let fallbackDataUri = normalizeVariantPayload(sourceVariants.original);
  if (!fallbackDataUri) {
    fallbackDataUri = variants
      .map((variant) => normalizeVariantPayload(sourceVariants[variant]))
      .find(Boolean);
  }

  if (!fallbackDataUri) {
    throw new Error('Invalid image data. Please upload a valid image file.');
  }

  const parsed = parseDataUri(fallbackDataUri);
  if (!parsed) {
    throw new Error('Invalid image format.');
  }

  const filename = `${originalName}-${token}.${parsed.extension}`;

  // 1. Save original image first
  const originalPath = path.join(uploadsRoot, 'original', filename);
  fs.writeFileSync(originalPath, parsed.buffer);

  // 2. Generate and resize other variants with Jimp
  try {
    const jimpImage = await Jimp.read(parsed.buffer);

    // Web variant: max 800px
    const webImg = jimpImage.clone();
    if (webImg.width > 800 || webImg.height > 800) {
      if (webImg.width > webImg.height) {
        webImg.resize({ w: 800 });
      } else {
        webImg.resize({ h: 800 });
      }
    }
    const webPath = path.join(uploadsRoot, 'web', filename);
    await webImg.write(webPath);

    // Mobile variant: max 400px
    const mobImg = jimpImage.clone();
    if (mobImg.width > 400 || mobImg.height > 400) {
      if (mobImg.width > mobImg.height) {
        mobImg.resize({ w: 400 });
      } else {
        mobImg.resize({ h: 400 });
      }
    }
    const mobPath = path.join(uploadsRoot, 'mobile', filename);
    await mobImg.write(mobPath);

    // Thumb variant: max 150px
    const thumbImg = jimpImage.clone();
    if (thumbImg.width > 150 || thumbImg.height > 150) {
      if (thumbImg.width > thumbImg.height) {
        thumbImg.resize({ w: 150 });
      } else {
        thumbImg.resize({ h: 150 });
      }
    }
    const thumbPath = path.join(uploadsRoot, 'thumb', filename);
    await thumbImg.write(thumbPath);
  } catch (err) {
    console.error('Jimp resizing failed, falling back to writing original file for all variants:', err.message);
    variants.forEach((v) => {
      if (v === 'original') return;
      const vPath = path.join(uploadsRoot, v, filename);
      fs.writeFileSync(vPath, parsed.buffer);
    });
  }

  // Return the simple path string (e.g. /Images/web/filename.jpg)
  return `/Images/web/${filename}`;
};

const resolveImageForStorage = async (rawImage, existingImage, req) => {
  if (rawImage === undefined) return existingImage;
  if (rawImage === null || rawImage === '') return null;

  if (typeof rawImage === 'object' && rawImage.keepExisting) {
    return existingImage || null;
  }

  if (typeof rawImage === 'string') {
    // Return Base64 directly to save in Postgres (bypasses Render ephemeral storage)
    if (rawImage.startsWith('data:image/')) {
      return rawImage;
    }
    return rawImage;
  }

  if (typeof rawImage === 'object') {
    // If HTML payload, extract the base64 directly
    const originalDataUri = rawImage.variants?.original?.dataUri;
    if (originalDataUri && originalDataUri.startsWith('data:image/')) {
      return originalDataUri;
    }
    return await saveImagePayload(rawImage, req);
  }

  return existingImage;
};

const publicImageFields = (storedImage, req) => {
  if (!storedImage) {
    return {
      image: null,
      image_url: null,
      image_variants: null
    };
  }

  // Handle Base64 strings natively stored in the DB
  if (typeof storedImage === 'string' && storedImage.startsWith('data:image/')) {
    return {
      image: storedImage,
      image_url: storedImage,
      image_variants: null
    };
  }

  // 1. If it's the old JSON format, parse it first (safe from path string manipulation)
  if (isStoredImageRecord(storedImage)) {
    const parsed = JSON.parse(storedImage);
    const mappedVariants = {};

    Object.entries(parsed.variants || {}).forEach(([variant, data]) => {
      if (!data) return;
      let pathVal = data.path;
      if (typeof pathVal === 'string') {
        pathVal = pathVal.replace(/\\/g, '/');
        const idx = pathVal.indexOf('Images/');
        if (idx !== -1) {
          pathVal = '/' + pathVal.slice(idx);
        }
      }
      mappedVariants[variant] = {
        ...data,
        path: pathVal,
        url: data.url || (pathVal ? `${getPublicBaseUrl(req)}${pathVal}` : null)
      };
    });

    const preferred =
      mappedVariants.web ||
      mappedVariants.mobile ||
      mappedVariants.thumb ||
      mappedVariants.original ||
      null;

    return {
      image: preferred ? preferred.url : null,
      image_url: preferred ? preferred.url : null,
      image_variants: mappedVariants
    };
  }

  // 2. Otherwise, treat as a simple path string, and apply robust path normalization
  let normalizedImage = storedImage;
  if (typeof normalizedImage === 'string') {
    normalizedImage = normalizedImage.replace(/\\/g, '/');
    const idx = normalizedImage.indexOf('Images/');
    if (idx !== -1) {
      normalizedImage = '/' + normalizedImage.slice(idx);
    }
  }

  if (typeof normalizedImage === 'string' && normalizedImage.startsWith('/Images/')) {
    const basename = path.basename(normalizedImage);
    const mappedVariants = {};
    
    // Extract actual variant directory if specified in the path, otherwise default to 'web'
    const parts = normalizedImage.split('/');
    const currentVariant = (parts.length >= 3 && variants.includes(parts[2])) ? parts[2] : 'web';
    
    variants.forEach((v) => {
      mappedVariants[v] = {
        url: `${getPublicBaseUrl(req)}/Images/${v}/${basename}`,
        path: `/Images/${v}/${basename}`,
        mime: 'image/jpeg'
      };
    });

    const preferredUrl = `${getPublicBaseUrl(req)}/Images/${currentVariant}/${basename}`;

    return {
      image: preferredUrl,
      image_url: preferredUrl,
      image_variants: mappedVariants
    };
  }

  // Default fallback for legacy paths/urls
  return {
    image: storedImage,
    image_url: storedImage,
    image_variants: null
  };
};

const decorateItem = (row, req) => ({
  ...row,
  ...publicImageFields(row.image, req)
});

const deleteStoredImage = (storedImage) => {
  if (!storedImage) return;

  if (isStoredImageRecord(storedImage)) {
    try {
      const parsed = JSON.parse(storedImage);
      Object.values(parsed.variants || {}).forEach((variant) => {
        if (!variant || !variant.path) return;
        
        // Convert web path to server path, handling different formats
        let relativePath = variant.path.replace(/^\/+/, '');
        // If it starts with uploads/items, map to that
        let diskPath = path.join(__dirname, relativePath);
        if (fs.existsSync(diskPath)) {
          fs.unlinkSync(diskPath);
        }
      });
    } catch (err) {
      console.warn('Unable to remove stored image files:', err.message);
    }
  } else if (typeof storedImage === 'string' && storedImage.startsWith('/Images/')) {
    try {
      const basename = path.basename(storedImage);
      variants.forEach((v) => {
        const diskPath = path.join(uploadsRoot, v, basename);
        if (fs.existsSync(diskPath)) {
          fs.unlinkSync(diskPath);
        }
      });
    } catch (err) {
      console.warn('Unable to remove stored image files:', err.message);
    }
  }
};

module.exports = {
  uploadsRoot,
  resolveImageForStorage,
  decorateItem,
  deleteStoredImage
};
