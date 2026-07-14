const express = require('express');
const path = require('path');
const fs = require('fs');

// Load Render-specific environment variables if running on Render
if (process.env.RENDER === 'true') {
  const renderEnvPath = path.join(__dirname, '.env.render');
  if (fs.existsSync(renderEnvPath)) {
    require('dotenv').config({ path: renderEnvPath });
  } else {
    require('dotenv').config();
  }
} else {
  require('dotenv').config();
}

const db = require('./db');

// Run auto-init database schema if empty
db.initDb();

const app = express();
app.enable('trust proxy');
const PORT = process.env.PORT || 3000;

// Body parsing middleware
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Custom CORS handler
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, ngrok-skip-browser-warning, x-client-id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../new_user_web')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/Images', express.static(path.join(__dirname, 'Images')));

// Import and mount routes
const userRoutes = require('./UserAPI');
app.use('/api/users', userRoutes);
app.use('/api/User', userRoutes);

const roleRoutes = require('./RoleAPI');
app.use('/api/roles', roleRoutes);
app.use('/api/Role', roleRoutes);


const customerRoutes = require('./CustomerAPI');
app.use('/api/customers', customerRoutes);
app.use('/api/Customer', customerRoutes);

const unitRoutes = require('./UnitAPI');
app.use('/api/units', unitRoutes);
app.use('/api/Unit', unitRoutes);

const taxRoutes = require('./TaxAPI');
app.use('/api/taxes', taxRoutes);
app.use('/api/Tax', taxRoutes);

const categoryRoutes = require('./CategoryAPI');
app.use('/api/categories', categoryRoutes);
app.use('/api/Category', categoryRoutes);

const itemRoutes = require('./ItemAPI');
app.use('/api/items', itemRoutes);
app.use('/api/Item', itemRoutes);

const vendorRoutes = require('./VendorAPI');
app.use('/api/vendors', vendorRoutes);
app.use('/api/Vendor', vendorRoutes);

const salesRoutes = require('./SalesAPI');
app.use('/api/sales', salesRoutes);
app.use('/api/Sales', salesRoutes);

const purchaseRoutes = require('./PurchaseAPI');
app.use('/api/purchase', purchaseRoutes);
app.use('/api/Purchase', purchaseRoutes);

const permissionRoutes = require('./PermissionAPI');
app.use('/api/permissions', permissionRoutes);
app.use('/api/Permission', permissionRoutes);

const licenseRoutes = require('./LicenseAPI');
app.use('/api/license', licenseRoutes);
app.use('/api/License', licenseRoutes);

const clientRoutes = require('./ClientAPI');
app.use('/api/clients', clientRoutes);
app.use('/api/Client', clientRoutes);

const settingsRoutes = require('./SettingsAPI');
app.use('/api/settings', settingsRoutes);
app.use('/api/Settings', settingsRoutes);

const restaurantRoutes = require('./RestaurantAPI');
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/Restaurant', restaurantRoutes);

const eventBus = require('./eventBus');

// Real-Time Server-Sent Events Stream
app.get('/api/realtime-events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Keep-alive heartbeat every 15 seconds
  const heartbeat = setInterval(() => {
    res.write('event: keep-alive\ndata: {}\n\n');
  }, 15000);

  const eventListener = (data) => {
    res.write(`event: message\ndata: ${JSON.stringify(data)}\n\n`);
  };

  eventBus.on('broadcast', eventListener);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off('broadcast', eventListener);
  });
});


// Dashboard Statistics Route
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const db = require('./db');
    const [users] = await db.query('SELECT COUNT(*) AS count FROM users');
    const [customers] = await db.query('SELECT COUNT(*) AS count FROM customers');
    const [items] = await db.query('SELECT COUNT(*) AS count FROM items');
    const [categories] = await db.query('SELECT COUNT(*) AS count FROM categories');
    const [units] = await db.query('SELECT COUNT(*) AS count FROM units');
    const [taxes] = await db.query('SELECT COUNT(*) AS count FROM taxes');

    // NOTE: PostgreSQL COUNT(*) returns a string — must parseInt()
    res.json({
      users: parseInt(users[0].count) || 0,
      customers: parseInt(customers[0].count) || 0,
      items: parseInt(items[0].count) || 0,
      categories: parseInt(categories[0].count) || 0,
      units: parseInt(units[0].count) || 0,
      taxes: parseInt(taxes[0].count) || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 404 handler for unknown endpoints
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

const os = require('os');
app.listen(PORT, () => {
  const interfaces = os.networkInterfaces();
  let localIp = '127.0.0.1';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address;
        break;
      }
    }
  }
  console.log(`Server is running on:`);
  console.log(`- Local:   http://localhost:${PORT}`);
  console.log(`- Network: http://${localIp}:${PORT}`);
});
