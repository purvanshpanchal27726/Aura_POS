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

if (!process.env.ENCRYPTION_KEY) {
  console.error('CRITICAL: ENCRYPTION_KEY environment variable is not defined!');
  process.exit(1);
}

const db = require('./db');
const authMiddleware = require('./authMiddleware');

// Run auto-init database schema if empty
db.initDb();

const app = express();
app.enable('trust proxy');
app.get('/favicon.ico', (req, res) => res.status(204).end());
const PORT = process.env.PORT || 3000;

// Body parsing middleware
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Custom CORS handler — allows all localhost ports (Flutter dev server) + production
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const isLocalhost = origin.startsWith('http://localhost:') ||
                      origin.startsWith('http://127.0.0.1:') ||
                      origin.startsWith('http://10.') ||
                      origin.startsWith('http://192.168.') ||
                      origin === 'http://localhost:3000' ||
                      origin === 'https://possys-w2ip.onrender.com' ||
                      !origin;
  if (isLocalhost) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, ngrok-skip-browser-warning, x-client-id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Protect all stateful api endpoints under /api
app.use('/api', authMiddleware);

// Serve static frontend files with no-cache headers to prevent stale browser caching
app.use(express.static(path.join(__dirname, '../new_user_web'), {
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.html') || filepath.endsWith('.js') || filepath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));
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

const backupRoutes = require('./BackupAPI');
app.use('/api/backup', backupRoutes);
app.use('/api/Backup', backupRoutes);

const restaurantRoutes = require('./RestaurantAPI');
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/Restaurant', restaurantRoutes);

const hotelRoutes = require('./HotelAPI');
app.use('/api/hotel', hotelRoutes);
app.use('/api/Hotel', hotelRoutes);

const inventoryRoutes = require('./InventoryAPI');
app.use('/api/inventory', inventoryRoutes);

const poRoutes = require('./PurchaseOrderAPI');
app.use('/api/purchase-orders', poRoutes);

const employeeRoutes = require('./EmployeeAPI');
app.use('/api/employees', employeeRoutes);

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
    const explicitQueryCid = req.query.client_id;
    const isSuperAdmin = req.user && (parseInt(req.user.role_id) === 1 || req.user.role_id === '1');

    let cidFilter = '';
    let params = [];

    if (!isSuperAdmin) {
      const targetCid = req.user?.client_id || 1;
      cidFilter = ' WHERE client_id = $1';
      params = [targetCid];
    } else {
      if (explicitQueryCid && explicitQueryCid !== 'ALL' && explicitQueryCid !== '0') {
        cidFilter = ' WHERE client_id = $1';
        params = [parseInt(explicitQueryCid)];
      } else {
        // Super Admin global view: show all registered users and items
        cidFilter = '';
        params = [];
      }
    }

    const [users] = await db.execute(`SELECT COUNT(*) AS count FROM users${cidFilter}`, params);
    const [customers] = await db.execute(`SELECT COUNT(*) AS count FROM customers${cidFilter}`, params);
    const [items] = await db.execute(`SELECT COUNT(*) AS count FROM items${cidFilter}`, params);
    const [categories] = await db.execute(`SELECT COUNT(*) AS count FROM categories${cidFilter}`, params);
    const [units] = await db.execute(`SELECT COUNT(*) AS count FROM units${cidFilter}`, params);
    const [taxes] = await db.execute(`SELECT COUNT(*) AS count FROM taxes${cidFilter}`, params);

    // Live Sales & Orders Metrics
    const todayStr = new Date().toISOString().split('T')[0];
    let salesWhere = cidFilter ? `${cidFilter} AND sales_date >= $2` : ' WHERE sales_date >= $1';
    let salesParams = cidFilter ? [...params, todayStr] : [todayStr];

    const [todaySalesRow] = await db.execute(`SELECT COALESCE(SUM(total), 0) AS total_sales, COUNT(*) AS count FROM sales_master${salesWhere}`, salesParams).catch(() => [[{ total_sales: 0, count: 0 }]]);
    const [allSalesRow] = await db.execute(`SELECT COALESCE(SUM(total), 0) AS total_sales, COUNT(*) AS count FROM sales_master${cidFilter}`, params).catch(() => [[{ total_sales: 0, count: 0 }]]);

    const totalSalesAmount = parseFloat(todaySalesRow[0]?.total_sales || 0) || parseFloat(allSalesRow[0]?.total_sales || 0);
    const totalOrdersCount = parseInt(todaySalesRow[0]?.count || 0) || parseInt(allSalesRow[0]?.count || 0);
    const grossProfitAmount = totalSalesAmount * 0.35;

    // Low stock items count
    let lowStockWhere = cidFilter ? `${cidFilter} AND quantity <= 10` : ' WHERE quantity <= 10';
    const [lowStockRow] = await db.execute(`SELECT COUNT(*) AS count FROM items${lowStockWhere}`, params).catch(() => [[{ count: 0 }]]);

    // Recent Transactions list
    let recentSalesQuery = `
      SELECT sm.sales_bill_no, sm.sales_date, sm.total, COALESCE(CONCAT(c.first_name, ' ', c.last_name), 'Walk-in Customer') AS customer_name
      FROM sales_master sm
      LEFT JOIN customers c ON sm.customer_id = c.customer_id
      ${cidFilter}
      ORDER BY sm.sales_id DESC LIMIT 5
    `;
    const [recentTx] = await db.execute(recentSalesQuery, params).catch(() => [[]]);

    // Low stock item alerts
    let lowStockListQuery = `
      SELECT item_id, name, code, quantity FROM items
      ${cidFilter ? `${cidFilter} AND quantity <= 10` : ' WHERE quantity <= 10'}
      ORDER BY quantity ASC LIMIT 5
    `;
    const [lowStockItems] = await db.execute(lowStockListQuery, params).catch(() => [[]]);

    res.json({
      users: parseInt(users[0]?.count || 0),
      customers: parseInt(customers[0]?.count || 0),
      items: parseInt(items[0]?.count || 0),
      categories: parseInt(categories[0]?.count || 0),
      units: parseInt(units[0]?.count || 0),
      taxes: parseInt(taxes[0]?.count || 0),
      todaySales: totalSalesAmount,
      ordersCount: totalOrdersCount,
      grossProfit: grossProfitAmount,
      lowStockCount: parseInt(lowStockRow[0]?.count || 0),
      recentTransactions: recentTx || [],
      lowStockAlerts: lowStockItems || []
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
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
