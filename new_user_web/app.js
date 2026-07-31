document.addEventListener('DOMContentLoaded', () => {
  // Centralized Authenticated Fetch Helper
  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('pos_auth_token');
    const headers = { ...(options.headers || {}) };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const activeUserData = localStorage.getItem('pos_active_user');
    if (activeUserData) {
      try {
        const u = JSON.parse(activeUserData);
        if (u && u.client_id !== undefined && u.client_id !== null) {
          headers['x-client-id'] = u.client_id;
        }
      } catch (e) {}
    }
    if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    
    const res = await fetch(url, { ...options, headers });
    
    // Auto-handle expired or invalid JWT token (401 Unauthorized)
    if (res.status === 401 && !url.includes('/api/users/login')) {
      console.warn('Session expired or invalid token. Redirecting to login...');
      localStorage.removeItem('pos_auth_token');
      localStorage.removeItem('pos_active_user');
      const loginOverlay = document.getElementById('loginOverlay');
      if (loginOverlay) loginOverlay.style.display = 'flex';
      const mainContainer = document.getElementById('mainContainer');
      if (mainContainer) mainContainer.style.display = 'none';
    }
    return res;
  };
  // Global Application State Variables (Declared at top to prevent TDZ ReferenceErrors)
  let activeScreen = 'screenDashboard';
  let activeUser = null;
  let allUsersList = [];
  // allUsers hoisted to top
  let permissionsData = [];
  let allRolesList = [];
  // allRoles hoisted to top
  let allCustomers = [];
  let allUnits = [];
  let allTaxes = [];
  let allCategories = [];
  let allItems = [];
  let allVendors = [];
  let allPOs = [];
  let poCartItems = [];
  let allInventory = [];
  let allRooms = [];
  let allGuests = [];
  let allBookings = [];
  let activeBookingServices = [];
  // allTables hoisted to top
  let dashSalesChartObj = null;
  let dashCategoryChartObj = null;
  
  let allMenuCategories = [];
  let allMenuItems = [];
  let allRestOrders = [];
  let allEmployees = [];
  let allAttendance = [];
  let allClients = [];
  let statusToastTimeout = null;

  // 🌐 EXPOSE HOISTED MODAL FUNCTIONS DIRECTLY ON WINDOW OBJECT FOR INLINE ONCLICK HANDLERS
  window.openEmployeeModal = openEmployeeModal;
  window.openTableModal = openTableModal;
  window.openPoModal = openPoModal;
  window.openInvItemModal = openInvItemModal;
  window.openStockMovementModal = openStockMovementModal;
  window.openRoomModal = openRoomModal;
  window.openGuestModal = openGuestModal;
  window.openBookingModal = openBookingModal;
  window.openCategoryModal = openCategoryModal;
  window.openMenuItemModal = openMenuItemModal;
  window.openRestOrderModal = openRestOrderModal;
  window.deactivateEmployee = deactivateEmployee;
  window.deleteTable = deleteTable;


  // 🚀 GLOBAL CLICK DELEGATION: Guarantees "+ Register Employee", "+ Add Table", "+ Add Item", and Edit/Delete buttons ALWAYS respond even if script errors occur
  document.addEventListener('click', (e) => {
    const target = e.target.closest('button, .btn, .btn-emp-edit, .btn-emp-del, .btn-table-edit, .btn-table-delete');
    if (!target) return;

    if (target.id === 'btnNewEmployee') {
      e.preventDefault();
      openEmployeeModal();
    } else if (target.id === 'btnNewTable') {
      e.preventDefault();
      openTableModal();
    } else if (target.id === 'btnNewPO') {
      e.preventDefault();
      openPoModal();
    } else if (target.id === 'btnNewInvItem') {
      e.preventDefault();
      openInvItemModal();
    } else if (target.id === 'btnStockAdjust') {
      e.preventDefault();
      openStockMovementModal();
    } else if (target.id === 'btnNewRoom') {
      e.preventDefault();
      openRoomModal();
    } else if (target.id === 'btnNewGuest') {
      e.preventDefault();
      openGuestModal();
    } else if (target.id === 'btnNewBooking') {
      e.preventDefault();
      openBookingModal();
    } else if (target.classList.contains('btn-emp-edit')) {
      e.preventDefault();
      const id = target.getAttribute('data-id');
      if (id) openEmployeeModal(id);
    } else if (target.classList.contains('btn-emp-del')) {
      e.preventDefault();
      const id = target.getAttribute('data-id');
      if (id) deactivateEmployee(id);
    }
  });


  // ─────────────────────────────────────────────────────────────────────────
  // 🌐 PRODUCTION: Render.com backend URL
  // Update this if your Render service name changes.
  // When served BY the backend (same origin), baseUrl is '' (relative paths).
  // When opened as a file:// (standalone), it points to Render directly.
  // ─────────────────────────────────────────────────────────────────────────
  const RENDER_BACKEND_URL = 'https://possys-w2ip.onrender.com';
  // Utility to dynamically compute API URL
  const getApiUrl = (path = '') => {
    const isLocalFile = window.location.protocol === 'file:';
    const baseUrl = isLocalFile ? RENDER_BACKEND_URL : '';
    return `${baseUrl}${path}`;
  };

  // HTML5 Web Audio API Synth Engine for Cash Register Sound Feedback
  const AudioSynth = {
    ctx: null,
    init() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
    },
    beep(freq = 880, duration = 0.08, type = 'sine') {
      try {
        this.init();
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        console.warn('Audio synthesis warning:', e);
      }
    },
    playSuccess() {
      try {
        this.init();
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Arpeggio)
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.06, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.35);
        });
      } catch (e) {
        console.warn('Audio synthesis warning:', e);
      }
    },
    playError() {
      this.beep(220, 0.15, 'sawtooth');
      setTimeout(() => this.beep(180, 0.18, 'sawtooth'), 80);
    }
  };

  // Glassmorphic Toast Notification Alert Generator
  const showToast = (title, message, type = 'info', duration = 4500) => {
    let iconName = 'info';
    if (type === 'success') iconName = 'check_circle';
    if (type === 'warning') iconName = 'warning';
    if (type === 'danger') iconName = 'error';

    // Live update top persistent status bar
    updateSystemStatus(`${title}: ${message}`, iconName, type === 'danger');

    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    toast.innerHTML = `
      <div class="toast-icon"><span class="material-icons">${iconName}</span></div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 15);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  };

  // Global override of standard window.alert to show non-blocking glassmorphic toasts
  window.alert = (message) => {
    if (!message) return;
    const msgStr = message.toString();
    const msgLower = msgStr.toLowerCase();
    let type = 'info';
    let title = 'Notice';
    
    if (msgLower.includes('success') || msgLower.includes('recorded') || msgLower.includes('registered') || msgLower.includes('updated') || msgLower.includes('saved') || msgLower.includes('completed')) {
      type = 'success';
      title = 'Success';
      AudioSynth.playSuccess();
    } else if (msgLower.includes('error') || msgLower.includes('failed') || msgLower.includes('denied') || msgLower.includes('invalid') || msgLower.includes('cannot') || msgLower.includes('less than')) {
      type = 'danger';
      title = 'Error';
      AudioSynth.playError();
    } else if (msgLower.includes('warning') || msgLower.includes('choose') || msgLower.includes('select') || msgLower.includes('require')) {
      type = 'warning';
      title = 'Warning';
      AudioSynth.playError();
    }
    
    showToast(title, msgStr, type);
  };

  // Server-Sent Events Subscriber (Real-Time Live Sync)
  const initRealtimeSSE = () => {
    try {
      const token = localStorage.getItem('pos_auth_token') || '';
      if (!token) return;
      const sseUrl = getApiUrl(`/api/realtime-events?token=${encodeURIComponent(token)}`);
      const source = new EventSource(sseUrl);
      
      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'transaction') {
            const isSale = data.type === 'sales';
            const actionText = isSale ? 'Sale Checkout' : 'Inward Purchase';
            const toastAccent = isSale ? 'success' : 'info';
            
            showToast(
              `Live: ${actionText}`,
              `Bill: ${data.billNo} | Total: Rs.${parseFloat(data.total).toFixed(2)} | operator: ${data.operator}`,
              toastAccent
            );
            
            // Refresh stats if Dashboard screen is active
            const dbScreen = document.getElementById('screenDashboard');
            if (dbScreen && dbScreen.style.display === 'block') {
              fetchDashboardStats();
            }
            
            // Refresh listing if Receipts screen is active
            const recScreen = document.getElementById('screenReceipt');
            if (recScreen && recScreen.style.display === 'block') {
              fetchReceipts();
            }
          }
        } catch (e) {
          console.error('SSE JSON parse error:', e);
        }
      };

      source.onerror = () => {
        // Close EventSource stream on error to prevent infinite 401 reconnect loops
        try { source.close(); } catch (e) {}
      };
    } catch (e) {
      console.warn('Real-time updates not supported or blocked:', e);
    }
  };

  // Launch live-sync client listener
  initRealtimeSSE();


  const money = (value) => `Rs.${(parseFloat(value || 0)).toFixed(2)}`;

  const getItemImageSrc = (item, preferred = 'thumb') => {
    if (!item) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300';
    let src = item.image_url || item.image || '';

    if (src && (src.startsWith('http://') || src.startsWith('https://')) && !src.includes('download-')) {
      return src;
    }

    const name = (item.name || item.category_name || '').toLowerCase();
    if (name.includes('milk') || name.includes('amul') || name.includes('dairy')) {
      return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300';
    } else if (name.includes('pepsi') || name.includes('drink') || name.includes('beverage') || name.includes('coke')) {
      return 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=300';
    } else if (name.includes('rice') || name.includes('grain') || name.includes('basmati')) {
      return 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300';
    } else if (name.includes('rajbhog') || name.includes('sweet') || name.includes('snack')) {
      return 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=300';
    } else if (name.includes('thali') || name.includes('food') || name.includes('paneer')) {
      return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300';
    }

    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300';
  };

  const resizeImageDataUrl = (source, maxSize, mime = 'image/jpeg', quality = 0.86) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, width, height);
      resolve({
        dataUri: canvas.toDataURL(mime, quality),
        width,
        height
      });
    };
    image.onerror = () => reject(new Error('Unable to read selected image.'));
    image.src = source;
  });

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(new Error('Unable to read selected image.'));
    reader.readAsDataURL(file);
  });

  const buildWebImagePayload = async (file) => {
    const original = await readFileAsDataUrl(file);
    const variantMime = ['image/png', 'image/webp'].includes(file.type) ? file.type : 'image/jpeg';

    const [web, mobile, thumb] = await Promise.all([
      resizeImageDataUrl(original, 900, variantMime),
      resizeImageDataUrl(original, 520, variantMime),
      resizeImageDataUrl(original, 160, variantMime)
    ]);

    return {
      kind: 'item-image-v1',
      originalName: file.name,
      variants: {
        original: { dataUri: original },
        web,
        mobile,
        thumb
      }
    };
  };

  const userForm = document.getElementById('userForm');
  const userTableBody = document.getElementById('userTableBody');
  const userIdInput = document.getElementById('user_id');
  const submitBtn = userForm.querySelector('button[type="submit"]');

  const phone1Input = document.getElementById('phone_1');
  const phone2Input = document.getElementById('phone_2');
  const email1Input = document.getElementById('email_1');
  const email2Input = document.getElementById('email_2');

  const restrictToNumeric = (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  };

  if (phone1Input) {
    phone1Input.addEventListener('input', (e) => {
      restrictToNumeric(e);
      phone1Input.setCustomValidity('');
    });
  }
  if (phone2Input) {
    phone2Input.addEventListener('input', restrictToNumeric);
  }
  if (email1Input) {
    email1Input.addEventListener('input', () => {
      email1Input.setCustomValidity('');
    });
  }
  if (email2Input) {
    email2Input.addEventListener('input', () => {
      email2Input.setCustomValidity('');
    });
  }

  // allUsers hoisted to top

  async function fetchUsers() {
    try {
      const response = await authFetch(getApiUrl('/api/users'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch users');
        }
      allUsers = await response.json();
      renderUsers(allUsers);
    } catch (err) {
      console.error(err);
    }
  };

  const userModal = document.getElementById('userModal');
  const btnNewUser = document.getElementById('btnNewUser');
  const btnRefresh = document.getElementById('btnRefresh');
  const modalClose = document.getElementById('modalClose');
  const btnCancel = document.getElementById('btnCancel');
  
  const passwordInput = document.getElementById('password');
  const btnTogglePassword = document.getElementById('btnTogglePassword');

  if (btnTogglePassword && passwordInput) {
    btnTogglePassword.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      const icon = btnTogglePassword.querySelector('.material-icons');
      if (icon) {
        icon.textContent = type === 'password' ? 'visibility_off' : 'visibility';
      }
    });
  }

  // Navigation elements matching Flutter Scaffold & Drawer
  const btnMenu = document.getElementById('btnMenu');
  const sideDrawer = document.getElementById('sideDrawer');
  const appBarTitle = document.getElementById('appBarTitle');

  // Open side drawer menu
  if (btnMenu && sideDrawer) {
    btnMenu.addEventListener('click', () => {
      sideDrawer.style.display = 'flex';
    });
  }

  // Back button navigation to dashboard
  const btnBack = document.getElementById('btnBack');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      switchScreen('dashboard');
    });
  }

  // Close drawer overlay when clicking the outer scrim
  if (sideDrawer) {
    sideDrawer.addEventListener('click', (e) => {
      if (e.target === sideDrawer) {
        sideDrawer.style.display = 'none';
      }
    });
  }

  // List of all screen views
  const screens = {
    'dashboard': {
      menu: document.getElementById('menuDashboard'),
      view: document.getElementById('screenDashboard'),
      title: 'Dashboard',
      onTransition: () => fetchDashboardStats()
    },
    'user_listing': {
      menu: document.getElementById('menuUserListing'),
      view: document.getElementById('screenUserListing'),
      title: 'User Master'
    },
    'item': {
      menu: document.getElementById('menuItem'),
      view: document.getElementById('screenItem'),
      title: 'Item Master',
      onTransition: () => fetchItems()
    },
    'category': {
      menu: document.getElementById('menuCategory'),
      view: document.getElementById('screenCategory'),
      title: 'Category Master',
      onTransition: () => fetchCategories()
    },
    'unit': {
      menu: document.getElementById('menuUnit'),
      view: document.getElementById('screenUnit'),
      title: 'Base Unit Master',
      onTransition: () => fetchUnits()
    },
    'tax': {
      menu: document.getElementById('menuTax'),
      view: document.getElementById('screenTax'),
      title: 'Tax Master',
      onTransition: () => fetchTaxes()
    },
    'customer_listing': {
      menu: document.getElementById('menuCustomerListing'),
      view: document.getElementById('screenCustomerListing'),
      title: 'Customer Master',
      onTransition: () => fetchCustomers()
    },
    'vendor_listing': {
      menu: document.getElementById('menuVendorListing'),
      view: document.getElementById('screenVendorListing'),
      title: 'Vendor Master',
      onTransition: () => fetchVendors()
    },
    'company': {
      menu: document.getElementById('menuCompany'),
      view: document.getElementById('screenCompany'),
      title: 'Company Master'
    },
    'sales': {
      menu: document.getElementById('menuSales'),
      view: document.getElementById('screenSales'),
      title: 'Sales Billing',
      onTransition: () => fetchInvoiceSetup()
    },
    'purchase': {
      menu: document.getElementById('menuPurchase'),
      view: document.getElementById('screenPurchase'),
      title: 'Purchase Management'
    },
    'receipt': {
      menu: document.getElementById('menuReceipt'),
      view: document.getElementById('screenReceipt'),
      title: 'Receipts',
      onTransition: () => fetchReceipts()
    },
    'reports': {
      menu: document.getElementById('menuReports'),
      view: document.getElementById('screenReports'),
      title: 'Reports'
    },
    'settings': {
      menu: document.getElementById('menuSettings'),
      view: document.getElementById('screenSettings'),
      title: 'Setting',
      onTransition: () => {
        fetchPermissionMatrix();
        fetchPrinterSettings();
      }
    },
    'clients': {
      menu: document.getElementById('menuClients'),
      view: document.getElementById('screenClients'),
      title: 'Client Management',
      onTransition: () => fetchClients()
    },
    'rest_tables': {
      menu: document.getElementById('menuRestTables'),
      view: document.getElementById('screenRestTables'),
      title: 'Dine-in Tables',
      onTransition: () => fetchRestTables()
    },
    'rest_menu': {
      menu: document.getElementById('menuRestMenu'),
      view: document.getElementById('screenRestMenu'),
      title: 'Restaurant Menu',
      onTransition: () => loadRestMenuTab()
    },
    'rest_orders': {
      menu: document.getElementById('menuRestOrders'),
      view: document.getElementById('screenRestOrders'),
      title: 'Rest. Orders & KOT',
      onTransition: () => fetchRestOrders()
    },
    'rest_kds': {
      menu: document.getElementById('menuRestKds'),
      view: document.getElementById('screenRestKds'),
      title: 'Kitchen Queue (KDS)',
      onTransition: () => fetchKdsQueue()
    },
    'hotel_rooms': {
      menu: document.getElementById('menuHotelRooms'),
      view: document.getElementById('screenHotelRooms'),
      title: 'Hotel Rooms',
      onTransition: () => fetchHotelRooms()
    },
    'hotel_guests': {
      menu: document.getElementById('menuHotelGuests'),
      view: document.getElementById('screenHotelGuests'),
      title: 'Guest Registry',
      onTransition: () => fetchHotelGuests()
    },
    'hotel_bookings': {
      menu: document.getElementById('menuHotelBookings'),
      view: document.getElementById('screenHotelBookings'),
      title: 'Room Bookings & Check-in',
      onTransition: () => fetchHotelBookings()
    },
    'inventory': {
      menu: document.getElementById('menuInventory'),
      view: document.getElementById('screenInventory'),
      title: 'Stock Inventory',
      onTransition: () => fetchInventory()
    },
    'purchase_orders': {
      menu: document.getElementById('menuPurchaseOrders'),
      view: document.getElementById('screenPurchaseOrders'),
      title: 'Purchase Orders & GRN',
      onTransition: () => fetchPurchaseOrders()
    },
    'employees': {
      menu: document.getElementById('menuEmployees'),
      view: document.getElementById('screenEmployees'),
      title: 'Employee Directory',
      onTransition: () => fetchEmployees()
    },
    'attendance': {
      menu: document.getElementById('menuAttendance'),
      view: document.getElementById('screenAttendance'),
      title: 'Staff Attendance Sheet',
      onTransition: () => fetchAttendance()
    },
    'role_listing': {
      menu: document.getElementById('menuRoleListing'),
      view: document.getElementById('screenRoleListing'),
      title: 'Role Master',
      onTransition: () => fetchRoles()
    },
    'support': {
      menu: document.getElementById('menuSupport'),
      view: document.getElementById('screenSupport'),
      title: 'Support & Contact'
    },
    'license': {
      menu: document.getElementById('menuLicense'),
      view: document.getElementById('screenLicense'),
      title: 'License & AMC Management',
      onTransition: () => fetchLicenseDetails()
    },
    'barcode_studio': {
      menu: document.getElementById('menuBarcodeStudio'),
      view: document.getElementById('screenBarcodeStudio'),
      title: 'Barcode & Label Studio',
      onTransition: () => initBarcodeStudio()
    }
  };

  // RBAC Global State variables
  
  
  
  

  

  const dismissSystemStatusToast = () => {
    const toastElem = document.getElementById('systemStatusToast');
    if (toastElem) {
      toastElem.style.opacity = '0';
      setTimeout(() => {
        toastElem.style.display = 'none';
      }, 300);
    }
  };

  const systemStatusToastElem = document.getElementById('systemStatusToast');
  if (systemStatusToastElem) {
    systemStatusToastElem.addEventListener('click', dismissSystemStatusToast);
  }

  const updateSystemStatus = (msg, icon = 'check_circle', isError = false) => {
    const toastElem = document.getElementById('systemStatusToast');
    const toastIcon = document.getElementById('statusToastIcon');
    const toastMsg = document.getElementById('statusToastMessage');
    const toastTime = document.getElementById('statusToastTimestamp');

    if (toastMsg) {
      toastMsg.textContent = msg;
    }
    if (toastIcon) {
      toastIcon.textContent = icon;
      toastIcon.style.color = isError ? '#ef4444' : '#4ade80';
    }
    if (toastElem) {
      toastElem.style.display = 'flex';
      setTimeout(() => {
        toastElem.style.opacity = '1';
      }, 10);
      toastElem.style.background = isError 
        ? 'linear-gradient(90deg, #450a0a, #1e1b4b)' 
        : 'linear-gradient(90deg, #0f172a, #1e293b)';
      toastElem.style.borderColor = isError ? '#991b1b' : '#334155';
    }
    if (toastTime) {
      const now = new Date();
      toastTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // Auto-dismiss notification after 2.5 seconds
    if (statusToastTimeout) {
      clearTimeout(statusToastTimeout);
    }
    statusToastTimeout = setTimeout(() => {
      dismissSystemStatusToast();
    }, 2500);
  };

  const configureUserFormState = (userToEdit = null) => {
    const isSuperAdminUser = activeUser && (activeUser.role_id == 1 || activeUser.role_id === '1') && (!activeUser.client_id || activeUser.client_id === 'null' || activeUser.client_id === 'undefined');

    // 1. Role dropdown filtering: Hide Super Admin role for Client Admins
    const selectRole = document.getElementById('user_role_id');
    if (selectRole && allRolesList.length > 0) {
      const currentVal = userToEdit ? (userToEdit.role_id || '') : selectRole.value;
      const availableRoles = isSuperAdminUser
        ? allRolesList
        : allRolesList.filter(r => r.role_id != 1 && (r.name || '').toLowerCase() !== 'super admin');

      selectRole.innerHTML = '<option value="">Select Role</option>' + 
        availableRoles.map(r => `<option value="${r.role_id}">${r.name}</option>`).join('');

      if (currentVal) {
        selectRole.value = currentVal;
      }
    }

    // 2. Client Company (Tenant) field visibility & value locking
    const selectClient = document.getElementById('user_client_id');
    if (selectClient) {
      const clientFieldGroup = selectClient.closest('.form-field');
      if (isSuperAdminUser) {
        if (clientFieldGroup) clientFieldGroup.style.display = '';
        if (userToEdit) {
          selectClient.value = userToEdit.client_id || '';
        }
      } else {
        if (clientFieldGroup) clientFieldGroup.style.display = 'none';
        if (activeUser && activeUser.client_id) {
          selectClient.value = activeUser.client_id.toString();
        }
      }
    }
  };

  // Global fetch interceptor to append activeUser's client_id in x-client-id header and JWT token
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    const token = localStorage.getItem('pos_auth_token');
    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }
    if (activeUser && activeUser.client_id) {
      options.headers['x-client-id'] = activeUser.client_id.toString();
    }
    return originalFetch(url, options);
  };

  const moduleForScreen = (screenName) => {
    if (['user_listing', 'settings', 'role_listing'].includes(screenName)) return 1;
    if (screenName === 'customer_listing') return 2;
    if (['item', 'category', 'unit', 'tax', 'vendor_listing'].includes(screenName)) return 3;
    if (['sales', 'receipt'].includes(screenName)) return 4;
    if (screenName === 'purchase') return 5;
    if (screenName === 'reports') return 6;
    return null;
  };

  const isAdminRole = () => {
    if (!activeUser) return false;
    const roleName = (activeUser.role_name || activeUser.role || '').toString().toLowerCase();
    return activeUser.role_id == 1 || roleName.includes('admin') || roleName.includes('super');
  };

  const hasModulePermission = (moduleId) => {
    if (!moduleId) return true;
    if (!activeUser) return false;
    if (isAdminRole()) return true;
    if (Array.isArray(activeUser.clientModules) && activeUser.clientModules.includes('ALL')) return true;
    if (!permissionsData.length) return false;

    const roleId = activeUser.role_id;
    const perm = permissionsData.find(p => p.role_id == roleId && p.module_id == moduleId);
    return perm ? perm.allowed == 1 : false;
  };

  const checkScreenPermission = (screenName) => {
    if (!activeUser) return false;
    if (isAdminRole()) return true;
    return hasModulePermission(moduleForScreen(screenName));
  };

  const applyNavigationPermissions = () => {
    if (!activeUser) return;
    const moduleMenus = {
      1: [document.getElementById('menuUserListing')],
      2: [document.getElementById('menuCustomerListing')],
      3: [
        document.getElementById('menuItem'),
        document.getElementById('menuCategory'),
        document.getElementById('menuUnit'),
        document.getElementById('menuTax'),
        document.getElementById('menuVendorListing')
      ],
      4: [document.getElementById('menuSales')],
      5: [document.getElementById('menuPurchase')],
      6: [document.getElementById('menuReports')]
    };

    moduleMenus[1].push(document.getElementById('menuSettings'), document.getElementById('menuRoleListing'));
    moduleMenus[4].push(document.getElementById('menuReceipt'));

    Object.keys(moduleMenus).forEach(mId => {
      const allowed = hasModulePermission(parseInt(mId));
      moduleMenus[mId].forEach(menuEl => {
        if (menuEl) {
          menuEl.style.display = allowed ? 'flex' : 'none';
        }
      });
    });

    // Client-level module group gating
    const clientModules = activeUser.clientModules || ['ALL'];
    const hasAll = clientModules.includes('ALL');
    const hasKirana = hasAll || clientModules.includes('Kirana') || clientModules.includes('POS');

    // Super-Admin only view: Clients menu is only visible to super-admin (no client_id and clientModules = ALL)
    const menuClients = document.getElementById('menuClients');
    if (menuClients) {
      menuClients.style.display = (hasAll && !activeUser.client_id) ? 'flex' : 'none';
    }

    // Gate Kirana / POS menu items
    const kiranaMenus = [
      document.getElementById('menuSales'),
      document.getElementById('menuPurchase'),
      document.getElementById('menuReceipt'),
      document.getElementById('menuReports')
    ];

    if (!hasKirana) {
      kiranaMenus.forEach(menuEl => {
        if (menuEl) menuEl.style.display = 'none';
      });
    }

    // Gate Restaurant menu items
    const hasRestaurant = hasAll || clientModules.includes('Restaurant');
    const restMenus = [
      document.getElementById('menuRestTables'),
      document.getElementById('menuRestMenu'),
      document.getElementById('menuRestOrders'),
      document.getElementById('menuRestKds')
    ];

    restMenus.forEach(menuEl => {
      if (menuEl) {
        menuEl.style.display = hasRestaurant ? 'flex' : 'none';
      }
    });

    // Gate Hotel menu items
    const hasHotel = hasAll || clientModules.includes('Hotel');
    const hotelMenus = [
      document.getElementById('menuHotelRooms'),
      document.getElementById('menuHotelGuests'),
      document.getElementById('menuHotelBookings')
    ];

    hotelMenus.forEach(menuEl => {
      if (menuEl) {
        menuEl.style.display = hasHotel ? 'flex' : 'none';
      }
    });

    // Gate Inventory & PO menu items
    const invMenus = [
      document.getElementById('menuInventory'),
      document.getElementById('menuPurchaseOrders')
    ];
    invMenus.forEach(menuEl => {
      if (menuEl) {
        menuEl.style.display = hasKirana ? 'flex' : 'none';
      }
    });

    // Gate Employees & Attendance menu items
    const employeeMenus = [
      document.getElementById('menuEmployees'),
      document.getElementById('menuAttendance')
    ];
    employeeMenus.forEach(menuEl => {
      if (menuEl) {
        menuEl.style.display = 'flex';
      }
    });

    const masterGroup = document.getElementById('groupMasters');
    if (masterGroup) {
      if (!hasKirana) {
        masterGroup.style.display = 'none';
      } else {
        const visibleChild = Array.from(masterGroup.querySelectorAll('.drawer-submenu .drawer-item'))
          .some(item => item.style.display !== 'none');
        masterGroup.style.display = visibleChild ? 'block' : 'none';
      }
    }

    const activeScreenKey = Object.keys(screens).find(key => screens[key].view?.style.display === 'block');
    if (activeScreenKey) {
      const isKiranaScreen = ['item', 'category', 'unit', 'tax', 'vendor_listing', 'sales', 'purchase', 'receipt', 'reports'].includes(activeScreenKey);
      if (isKiranaScreen && !hasKirana) {
        switchScreen('dashboard');
      } else if (!checkScreenPermission(activeScreenKey)) {
        switchScreen('dashboard');
      }
    }

    // Update side drawer header text to show appropriate Role name
    const drawerHeader = document.querySelector('.drawer-header h2');
    if (drawerHeader) {
      const roleName = activeUser.role_name || 'User';
      drawerHeader.textContent = `${roleName} Menu`;
    }

    // Role-based UI gating: check if user can modify records dynamically per module permission
    const screenModuleMapping = {
      'screenUserListing': { btn: 'btnNewUser', mId: 1, table: 'screenUserListing' },
      'screenCustomerListing': { btn: 'btnNewCustomer', mId: 2, table: 'screenCustomerListing' },
      'screenItem': { btn: 'btnNewItem', mId: 3, table: 'screenItem' },
      'screenCategory': { btn: 'btnNewCategory', mId: 3, table: 'screenCategory' },
      'screenUnit': { btn: 'btnNewUnit', mId: 3, table: 'screenUnit' },
      'screenTax': { btn: 'btnNewTax', mId: 3, table: 'screenTax' },
      'screenVendorListing': { btn: 'btnNewVendor', mId: 3, table: 'screenVendorListing' },
      'screenRoleListing': { btn: 'btnNewRole', mId: 1, table: 'screenRoleListing' }
    };

    Object.entries(screenModuleMapping).forEach(([screenId, cfg]) => {
      const allowed = hasModulePermission(cfg.mId);
      const btn = document.getElementById(cfg.btn);
      if (btn) btn.style.display = allowed ? 'inline-flex' : 'none';
      const screen = document.getElementById(screenId);
      if (screen) {
        const table = screen.querySelector('table');
        if (table) {
          table.classList.toggle('read-only-view', !allowed);
        }
      }
    });

    // 3. Gate Dashboard Stats Cards visibility based on module permissions
    const cardModuleMapping = {
      'cardUsers': 1,
      'cardCustomers': 2,
      'cardItems': 3,
      'cardCategories': 3,
      'cardUnits': 3,
      'cardTaxes': 3
    };
    Object.entries(cardModuleMapping).forEach(([cardId, mId]) => {
      const card = document.getElementById(cardId);
      if (card) {
        card.style.display = hasModulePermission(mId) ? 'flex' : 'none';
      }
    });
  };

  async function fetchPermissionsAndUsers() {
    try {
      const permRes = await authFetch(getApiUrl('/api/permissions'));
      if (permRes.ok) {
        const data = await permRes.json();
        permissionsData = data.permissions;
        
        if (data.roles) {
          allRolesList = data.roles;
          configureUserFormState();
        }

        // Apply navigation permissions since permissionsData is loaded
        applyNavigationPermissions();
      }
      const usersRes = await authFetch(getApiUrl('/api/users'));
      if (usersRes.ok) {
        allUsersList = await usersRes.json();
        populateUserSelector();
      }
      fetchClients();
    } catch (err) {
      console.error('Error fetching permissions:', err);
    }
  };

  const populateUserSelector = () => {
    const selector = document.getElementById('activeUserSelector');
    if (!selector) return;
    
    selector.innerHTML = allUsersList.map(u => 
      `<option value="${u.user_id}">${u.username} (${u.role_name || 'User'})</option>`
    ).join('');
    
    if (allUsersList.length > 0) {
      activeUser = allUsersList[0];
      applyNavigationPermissions();
      const opField = document.getElementById('invoiceOperator');
      if (opField) opField.value = activeUser.username;
    }

    selector.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      activeUser = allUsersList.find(u => u.user_id == selectedId);
      applyNavigationPermissions();
      const opField = document.getElementById('invoiceOperator');
      if (opField) opField.value = activeUser.username;
      switchScreen('dashboard');
    });
  };

  // Toggles the active views and highlights drawer option accordingly
  const switchScreen = (screenName) => {
    if (!checkScreenPermission(screenName)) {
      alert('Access Denied: Your role does not have permission to access this module.');
      return;
    }

    // Toggle Back / Menu button visibility based on active page
    const btnBack = document.getElementById('btnBack');
    const btnMenu = document.getElementById('btnMenu');
    if (btnBack && btnMenu) {
      if (screenName === 'dashboard') {
        btnBack.style.display = 'none';
        btnMenu.style.display = 'inline-flex';
      } else {
        btnBack.style.display = 'inline-flex';
        btnMenu.style.display = 'none';
      }
    }

    Object.keys(screens).forEach(key => {
      const screen = screens[key];
      if (key === screenName) {
        if (screen.view) {
          screen.view.style.display = 'block';
          activeScreen = screen.view.id;
        }
        if (screen.menu) screen.menu.classList.add('active');
        if (appBarTitle) appBarTitle.textContent = screen.title;
        if (screen.onTransition) screen.onTransition();
      } else {
        if (screen.view) screen.view.style.display = 'none';
        if (screen.menu) screen.menu.classList.remove('active');
      }
    });

    // Highlight Mobile Bottom Navbar active tab
    const mobileNavItems = document.querySelectorAll('#mobileBottomNav .mobile-nav-item');
    mobileNavItems.forEach(item => {
      const target = item.getAttribute('data-target');
      if (target === screenName) {
        item.classList.add('active');
      } else if (target !== 'drawer') {
        item.classList.remove('active');
      }
    });

    // Automatically retract the drawer overlay upon tab click
    if (sideDrawer) {
      sideDrawer.style.display = 'none';
    }
  };

  // Chart objects hoisted to top of DOMContentLoaded

  const renderDashboardCharts = async () => {
    try {
      const salesCanvas = document.getElementById('dashSalesTrendChart');
      if (salesCanvas && typeof Chart !== 'undefined') {
        const salesRes = await authFetch(getApiUrl('/api/sales'));
        const salesData = salesRes.ok ? await salesRes.json() : [];
        
        const last7Days = [];
        const salesByDay = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          last7Days.push(dateStr);
          salesByDay[dateStr] = 0;
        }

        if (Array.isArray(salesData)) {
          salesData.forEach(sale => {
            const sDate = (sale.date || sale.created_at || '').substring(0, 10);
            if (salesByDay[sDate] !== undefined) {
              salesByDay[sDate] += parseFloat(sale.grand_total || sale.total || 0);
            }
          });
        }

        const chartLabels = last7Days.map(d => {
          const parts = d.split('-');
          return `${parts[2]}/${parts[1]}`;
        });
        const chartValues = last7Days.map(d => salesByDay[d]);

        try {
          const existing = Chart.getChart(salesCanvas) || Chart.getChart('dashSalesTrendChart');
          if (existing) existing.destroy();
          if (dashSalesChartObj) {
            try { dashSalesChartObj.destroy(); } catch (e) {}
            dashSalesChartObj = null;
          }
          const ctxSales = salesCanvas.getContext('2d');
          dashSalesChartObj = new Chart(ctxSales, {
            type: 'line',
            data: {
              labels: chartLabels,
              datasets: [{
                label: 'Daily Revenue (₹)',
                data: chartValues,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#2563eb',
                pointRadius: 4
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: { ticks: { callback: v => '₹' + v.toLocaleString('en-IN') } }
              }
            }
          });
        } catch (chartErr) {
          console.warn('Sales chart instantiate warning:', chartErr);
        }
      }

      const catCanvas = document.getElementById('dashCategoryChart');
      if (catCanvas && typeof Chart !== 'undefined') {
        const catRes = await authFetch(getApiUrl('/api/categories'));
        const catData = catRes.ok ? await catRes.json() : [];
        const catNames = Array.isArray(catData) ? catData.slice(0, 5).map(c => c.name || 'Category') : [];
        const catCounts = catNames.map((_, i) => (i + 1) * 20);

        try {
          const existingCat = Chart.getChart(catCanvas) || Chart.getChart('dashCategoryChart');
          if (existingCat) existingCat.destroy();
          if (dashCategoryChartObj) {
            try { dashCategoryChartObj.destroy(); } catch (e) {}
            dashCategoryChartObj = null;
          }
          const ctxCat = catCanvas.getContext('2d');
          dashCategoryChartObj = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
              labels: catNames.length > 0 ? catNames : ['General', 'Electronics', 'Grocery'],
              datasets: [{
                data: catCounts.length > 0 ? catCounts : [40, 30, 30],
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'],
                borderWidth: 2
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'right' } }
            }
          });
        } catch (chartErr) {
          console.warn('Category chart instantiate warning:', chartErr);
        }
      }
    } catch (err) {
      console.warn('Error rendering dashboard charts:', err);
    }
  };

  async function fetchDashboardStats() {
    try {
      const response = await authFetch(getApiUrl('/api/dashboard/stats'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch dashboard statistics');
        }
      const stats = await response.json();

      const uVal = document.getElementById('valUsers');
      const iVal = document.getElementById('valItems');
      const cVal = document.getElementById('valCategories');
      const unVal = document.getElementById('valUnits');
      const tVal = document.getElementById('valTaxes');
      const cuVal = document.getElementById('valCustomers');

      if (uVal) uVal.textContent = stats.users !== undefined ? stats.users : 0;
      if (iVal) iVal.textContent = stats.items !== undefined ? stats.items : 0;
      if (cVal) cVal.textContent = stats.categories !== undefined ? stats.categories : 0;
      if (unVal) unVal.textContent = stats.units !== undefined ? stats.units : 0;
      if (tVal) tVal.textContent = stats.taxes !== undefined ? stats.taxes : 0;
      if (cuVal) cuVal.textContent = stats.customers !== undefined ? stats.customers : 0;

      renderDashboardCharts();
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    }
  };

  const bindCardClicks = () => {
    const cardUser = document.getElementById('cardUsers');
    const cardItem = document.getElementById('cardItems');
    const cardCategory = document.getElementById('cardCategories');
    const cardUnit = document.getElementById('cardUnits');
    const cardTax = document.getElementById('cardTaxes');
    const cardCustomer = document.getElementById('cardCustomers');

    if (cardUser) cardUser.addEventListener('click', () => switchScreen('user_listing'));
    if (cardItem) cardItem.addEventListener('click', () => switchScreen('item'));
    if (cardCategory) cardCategory.addEventListener('click', () => switchScreen('category'));
    if (cardUnit) cardUnit.addEventListener('click', () => switchScreen('unit'));
    if (cardTax) cardTax.addEventListener('click', () => switchScreen('tax'));
    if (cardCustomer) cardCustomer.addEventListener('click', () => switchScreen('customer_listing'));

    const btnSale = document.getElementById('dashQuickSale');
    const btnItem = document.getElementById('dashQuickItem');
    const btnCustomer = document.getElementById('dashQuickCustomer');
    const btnReports = document.getElementById('dashQuickReports');

    if (btnSale) btnSale.addEventListener('click', () => switchScreen('sales'));
    if (btnItem) btnItem.addEventListener('click', () => {
      switchScreen('item');
      const btnNew = document.getElementById('btnNewItem');
      if (btnNew) btnNew.click();
    });
    if (btnCustomer) btnCustomer.addEventListener('click', () => {
      switchScreen('customer_listing');
      const btnNew = document.getElementById('btnNewCustomer');
      if (btnNew) btnNew.click();
    });
    if (btnReports) btnReports.addEventListener('click', () => switchScreen('reports'));
  };

  bindCardClicks();

  // Bind click event listeners to all navigation options
  Object.keys(screens).forEach(key => {
    const screen = screens[key];
    if (screen.menu) {
      screen.menu.addEventListener('click', () => switchScreen(key));
    }
  });

  // Toggle Masters Submenu
  const groupMasters = document.getElementById('groupMasters');
  if (groupMasters) {
    const header = groupMasters.querySelector('.drawer-group-header');
    if (header) {
      header.addEventListener('click', (e) => {
        groupMasters.classList.toggle('expanded');
      });
    }
  }

  // --- Master Table Live Filtering & Pagination Engine ---
  const paginateDataset = (list, currentPage, pageSize = 10) => {
    const total = list.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    const items = list.slice(start, end);
    return { items, total, start: total > 0 ? start + 1 : 0, end, safePage, totalPages };
  };

  let userSearchQuery = '';
  let userCurrentPage = 1;

  function renderUsers(users) {
    if (!userTableBody) return;

    const query = userSearchQuery.trim().toLowerCase();
    const filtered = users.filter(u => {
      const name = `${u.first_name || ''} ${u.middle_name || ''} ${u.last_name || ''}`.toLowerCase();
      const username = (u.username || '').toLowerCase();
      const role = (u.role_name || '').toLowerCase();
      const city = (u.city || '').toLowerCase();
      const phone = (u.phone_1 || '').toLowerCase();
      return !query || name.includes(query) || username.includes(query) || role.includes(query) || city.includes(query) || phone.includes(query);
    });

    const { items, total, start, end, safePage, totalPages } = paginateDataset(filtered, userCurrentPage, 10);
    userCurrentPage = safePage;

    const infoElem = document.getElementById('userPaginationInfo');
    const pageNumElem = document.getElementById('userPageNum');
    const prevBtn = document.getElementById('btnUserPrevPage');
    const nextBtn = document.getElementById('btnUserNextPage');

    if (infoElem) infoElem.textContent = `Showing ${start} to ${end} of ${total} entries`;
    if (pageNumElem) pageNumElem.textContent = `Page ${safePage} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = safePage <= 1;
    if (nextBtn) nextBtn.disabled = safePage >= totalPages;

    if (items.length === 0) {
      userTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">${query ? `No matching users found for "${query}"` : 'No users registered yet.'}</td>
        </tr>
      `;
      return;
    }

    userTableBody.innerHTML = items.map(user => {
      const name = [user.first_name, user.middle_name, user.last_name]
        .filter(part => part && part.trim() !== '')
        .join(' ');

      const location = [user.city, user.country]
        .filter(part => part && part.trim() !== '')
        .join(', ') || 'N/A';

      const contact = [user.phone_1, user.email_1]
        .filter(part => part && part.trim() !== '')
        .join(' | ') || 'N/A';

      return `
        <tr>
          <td>${user.display_id || user.user_id}</td>
          <td>${user.username}</td>
          <td>${name}</td>
          <td>${location}</td>
          <td>${contact}</td>
          <td><span class="badge badge-light" style="background-color:#f1f5f9; color:#475569; padding: 4px 8px; border-radius: 4px; font-weight: 500;">${user.role_name || 'User'}</span></td>
          <td>
            <div class="action-buttons">
              <button type="button" class="btn-icon btn-edit" data-id="${user.user_id}" title="Edit User">
                <span class="material-icons">edit</span>
              </button>
              <button type="button" class="btn-icon btn-delete" data-id="${user.user_id}" title="Delete User">
                <span class="material-icons">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  const userSearchInput = document.getElementById('userSearchInput');
  if (userSearchInput) {
    userSearchInput.addEventListener('input', (e) => {
      userSearchQuery = e.target.value;
      userCurrentPage = 1;
      renderUsers(allUsersList);
    });
  }
  const btnUserPrevPage = document.getElementById('btnUserPrevPage');
  if (btnUserPrevPage) {
    btnUserPrevPage.addEventListener('click', () => {
      userCurrentPage--;
      renderUsers(allUsersList);
    });
  }
  const btnUserNextPage = document.getElementById('btnUserNextPage');
  if (btnUserNextPage) {
    btnUserNextPage.addEventListener('click', () => {
      userCurrentPage++;
      renderUsers(allUsersList);
    });
  }

  userTableBody.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const deleteBtn = e.target.closest('.btn-delete');

    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      editUser(id);
    } else if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      deleteUser(id);
    }
  });

  const editUser = (id) => {
    const user = allUsers.find(u => u.user_id == id);
    if (!user) return;

    userIdInput.value = user.user_id;

    const fields = [
      'username', 'password', 'first_name', 'middle_name', 'last_name',
      'address_1', 'address_2', 'address_3', 'city', 'country',
      'phone_1', 'phone_2', 'email_1', 'email_2', 'created_by'
    ];

    fields.forEach(field => {
      const input = document.getElementById(field);
      if (input) {
        input.value = user[field] || '';
      }
    });

    configureUserFormState(user);

    // Hide username and password fields for edit mode
    const credentialSection = document.getElementById('credentialSection');
    if (credentialSection) {
      credentialSection.style.display = 'none';
    }

    const usernameInput = document.getElementById('username');
    if (usernameInput) {
      usernameInput.removeAttribute('required');
    }

    const passwordInput = document.getElementById('password');
    if (passwordInput) {
      passwordInput.removeAttribute('required');
    }

    // Update section title
    const formTitle = document.querySelector('.form-section h2');
    if (formTitle) {
      formTitle.textContent = 'Edit User';
    }

    submitBtn.textContent = 'Update User';

    // Show the modal overlay
    if (userModal) {
      userModal.style.display = 'flex';
    }
  };

  const deleteUser = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await authFetch(getApiUrl(`/api/users/${id}`), {
        method: 'DELETE'
      });

      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to delete user');
        }

      alert('User deleted successfully!');
      if (userIdInput.value === id) {
        closeModal();
      }
      fetchUsers();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const resetFormState = () => {
    userIdInput.value = '';
    submitBtn.textContent = 'Save User';

    // Show username and password fields for register mode
    const credentialSection = document.getElementById('credentialSection');
    if (credentialSection) {
      credentialSection.style.display = '';
    }

    const usernameInput = document.getElementById('username');
    if (usernameInput) {
      usernameInput.setAttribute('required', '');
    }

    const passwordInput = document.getElementById('password');
    if (passwordInput) {
      passwordInput.setAttribute('required', '');
      passwordInput.setAttribute('type', 'password');
    }

    configureUserFormState(null);

    if (btnTogglePassword) {
      const icon = btnTogglePassword.querySelector('.material-icons');
      if (icon) {
        icon.textContent = 'visibility_off';
      }
    }

    // Update section title
    const formTitle = document.querySelector('.form-section h2');
    if (formTitle) {
      formTitle.textContent = 'Register New User';
    }

    const createdByInput = document.getElementById('created_by');
    if (createdByInput) {
      createdByInput.value = 'System';
    }
  };

  const closeModal = () => {
    if (userModal) {
      userModal.style.display = 'none';
    }
    userForm.reset();
  };

  // Modal event listeners
  if (btnNewUser) {
    btnNewUser.addEventListener('click', () => {
      userForm.reset();
      if (userModal) {
        userModal.style.display = 'flex';
      }
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      fetchUsers();
    });
  }

  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', closeModal);
  }

  window.addEventListener('click', (e) => {
    if (e.target === userModal) {
      closeModal();
    }
  });

  userForm.addEventListener('reset', () => {
    resetFormState();
  });

  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Reset validations first
    if (phone1Input) phone1Input.setCustomValidity('');
    if (email1Input) email1Input.setCustomValidity('');
    if (email2Input) email2Input.setCustomValidity('');

    let isValid = true;

    // Validate phone number length matching Flutter constraint
    if (phone1Input && phone1Input.value.length !== 10) {
      phone1Input.setCustomValidity('Enter a valid phone number');
      isValid = false;
    }

    // Validate email format matching Flutter emailReg checks
    const emailReg = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (email1Input && email1Input.value.trim() !== '' && !emailReg.test(email1Input.value)) {
      email1Input.setCustomValidity('Enter a valid email address');
      isValid = false;
    }

    if (email2Input && email2Input.value.trim() !== '' && !emailReg.test(email2Input.value)) {
      email2Input.setCustomValidity('Enter a valid email address');
      isValid = false;
    }

    if (!isValid) {
      userForm.reportValidity();
      return;
    }

    const formData = new FormData(userForm);
    const data = Object.fromEntries(formData.entries());
    const id = userIdInput.value;

    const isSuperAdminUser = activeUser && (activeUser.role_id == 1 || activeUser.role_id === '1') && (!activeUser.client_id || activeUser.client_id === 'null' || activeUser.client_id === 'undefined');
    if (!isSuperAdminUser && activeUser && activeUser.client_id) {
      data.client_id = activeUser.client_id.toString();
    }

    const url = id ? getApiUrl(`/api/users/${id}`) : getApiUrl('/api/users');
    const method = id ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${id ? 'update' : 'register'} user`);
      }

      alert(`User ${id ? 'updated' : 'registered'} successfully!`);
      closeModal();
      fetchUsers();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  });

  // Customer Management Components
  const customerForm = document.getElementById('customerForm');
  const customerTableBody = document.getElementById('customerTableBody');
  const custIdInput = document.getElementById('cust_id');
  const custSubmitBtn = document.getElementById('btnCustomerSave');

  const custPhone1Input = document.getElementById('cust_phone_1');
  const custPhone2Input = document.getElementById('cust_phone_2');
  const custEmailInput = document.getElementById('cust_email');

  const customerModal = document.getElementById('customerModal');
  const btnNewCustomer = document.getElementById('btnNewCustomer');
  const btnRefreshCustomers = document.getElementById('btnRefreshCustomers');
  const customerModalClose = document.getElementById('customerModalClose');
  const btnCustomerCancel = document.getElementById('btnCustomerCancel');

  

  async function fetchCustomers() {
    try {
      const response = await authFetch(getApiUrl('/api/customers'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch customers');
        }
      allCustomers = await response.json();
      localStorage.setItem('pos_cached_customers', JSON.stringify(allCustomers));
      renderCustomers(allCustomers);
    } catch (err) {
      console.warn('Offline fallback for customers:', err);
      const cached = localStorage.getItem('pos_cached_customers');
      if (cached) {
        allCustomers = JSON.parse(cached);
        renderCustomers(allCustomers);
        showToast('Offline Mode', 'Loaded customer directory from local storage cache.', 'warning');
      }
    }
  };

  let custSearchQuery = '';
  let custCurrentPage = 1;

  function renderCustomers(list) {
    if (!customerTableBody) return;

    const query = custSearchQuery.trim().toLowerCase();
    const filtered = list.filter(c => {
      const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
      const phone = (c.phone_1 || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const city = (c.city || '').toLowerCase();
      return !query || fullName.includes(query) || phone.includes(query) || email.includes(query) || city.includes(query);
    });

    const { items, total, start, end, safePage, totalPages } = paginateDataset(filtered, custCurrentPage, 10);
    custCurrentPage = safePage;

    const infoElem = document.getElementById('custPaginationInfo');
    const pageNumElem = document.getElementById('custPageNum');
    const prevBtn = document.getElementById('btnCustPrevPage');
    const nextBtn = document.getElementById('btnCustNextPage');

    if (infoElem) infoElem.textContent = `Showing ${start} to ${end} of ${total} entries`;
    if (pageNumElem) pageNumElem.textContent = `Page ${safePage} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = safePage <= 1;
    if (nextBtn) nextBtn.disabled = safePage >= totalPages;

    if (items.length === 0) {
      customerTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">${query ? `No matching customers found for "${query}"` : 'No customers registered yet.'}</td>
        </tr>
      `;
      return;
    }

    customerTableBody.innerHTML = items.map(c => {
      const fullName = `${c.first_name} ${c.last_name}`;
      const address = c.address_2 ? `${c.address_1}, ${c.address_2}` : c.address_1;
      const location = `${c.city}, ${c.country}`;
      const contact = `${c.phone_1} | ${c.email}`;

      return `
        <tr>
          <td>${c.display_id || c.customer_id}</td>
          <td>${fullName}</td>
          <td>${address}</td>
          <td>${location}</td>
          <td>${contact}</td>
          <td>
            <div class="action-buttons">
              <button type="button" class="btn-icon btn-edit-customer" data-id="${c.customer_id}" title="Edit Customer">
                <span class="material-icons">edit</span>
              </button>
              <button type="button" class="btn-icon btn-delete-customer" data-id="${c.customer_id}" title="Delete Customer">
                <span class="material-icons">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  const custSearchInput = document.getElementById('custSearchInput');
  if (custSearchInput) {
    custSearchInput.addEventListener('input', (e) => {
      custSearchQuery = e.target.value;
      custCurrentPage = 1;
      renderCustomers(allCustomers);
    });
  }
  const btnCustPrevPage = document.getElementById('btnCustPrevPage');
  if (btnCustPrevPage) {
    btnCustPrevPage.addEventListener('click', () => {
      custCurrentPage--;
      renderCustomers(allCustomers);
    });
  }
  const btnCustNextPage = document.getElementById('btnCustNextPage');
  if (btnCustNextPage) {
    btnCustNextPage.addEventListener('click', () => {
      custCurrentPage++;
      renderCustomers(allCustomers);
    });
  }

  if (customerTableBody) {
    customerTableBody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.btn-edit-customer');
      const deleteBtn = e.target.closest('.btn-delete-customer');

      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        editCustomer(id);
      } else if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        deleteCustomer(id);
      }
    });
  }

  const editCustomer = (id) => {
    const c = allCustomers.find(item => item.customer_id == id);
    if (!c) return;

    custIdInput.value = c.customer_id;

    const fields = {
      'cust_first_name': 'first_name',
      'cust_last_name': 'last_name',
      'cust_address_1': 'address_1',
      'cust_address_2': 'address_2',
      'cust_city': 'city',
      'cust_country': 'country',
      'cust_phone_1': 'phone_1',
      'cust_phone_2': 'phone_2',
      'cust_email': 'email',
      'cust_created_by': 'created_by'
    };

    Object.keys(fields).forEach(domId => {
      const input = document.getElementById(domId);
      if (input) {
        input.value = c[fields[domId]] || '';
      }
    });

    const formTitle = document.querySelector('#customerModal .form-section h2');
    if (formTitle) {
      formTitle.textContent = 'Edit Customer Details';
    }

    custSubmitBtn.textContent = 'Update Customer';

    if (customerModal) {
      customerModal.style.display = 'flex';
    }
  };

  const deleteCustomer = async (id) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    try {
      const response = await authFetch(getApiUrl(`/api/customers/${id}`), {
        method: 'DELETE'
      });

      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to delete customer');
        }

      alert('Customer deleted successfully!');
      if (custIdInput.value === id) {
        closeCustomerModal();
      }
      fetchCustomers();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const resetCustomerFormState = () => {
    custIdInput.value = '';
    custSubmitBtn.textContent = 'Save Customer';

    const formTitle = document.querySelector('#customerModal .form-section h2');
    if (formTitle) {
      formTitle.textContent = 'Register New Customer';
    }

    const createdByInput = document.getElementById('cust_created_by');
    if (createdByInput) {
      createdByInput.value = activeUser ? activeUser.username : 'System';
    }
  };

  const closeCustomerModal = () => {
    if (customerModal) {
      customerModal.style.display = 'none';
    }
    customerForm.reset();
  };

  // Customer Modal & form triggers
  if (btnNewCustomer) {
    btnNewCustomer.addEventListener('click', () => {
      customerForm.reset();
      if (customerModal) {
        customerModal.style.display = 'flex';
      }
    });
  }

  if (btnRefreshCustomers) {
    btnRefreshCustomers.addEventListener('click', () => {
      fetchCustomers();
    });
  }

  if (customerModalClose) {
    customerModalClose.addEventListener('click', closeCustomerModal);
  }

  if (btnCustomerCancel) {
    btnCustomerCancel.addEventListener('click', closeCustomerModal);
  }

  window.addEventListener('click', (e) => {
    if (e.target === customerModal) {
      closeCustomerModal();
    }
  });

  if (customerForm) {
    customerForm.addEventListener('reset', () => {
      resetCustomerFormState();
    });

    if (custPhone1Input) {
      custPhone1Input.addEventListener('input', (e) => {
        restrictToNumeric(e);
        custPhone1Input.setCustomValidity('');
      });
    }
    if (custPhone2Input) {
      custPhone2Input.addEventListener('input', restrictToNumeric);
    }
    if (custEmailInput) {
      custEmailInput.addEventListener('input', () => {
        custEmailInput.setCustomValidity('');
      });
    }

    customerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (custPhone1Input) custPhone1Input.setCustomValidity('');
      if (custEmailInput) custEmailInput.setCustomValidity('');

      let isValid = true;
      const id = custIdInput.value;

      if (custPhone1Input && custPhone1Input.value.length !== 10) {
        custPhone1Input.setCustomValidity('Primary phone must be exactly 10 digits');
        isValid = false;
      } else if (custPhone1Input) {
        const phoneVal = custPhone1Input.value.trim();
        const duplicatePhone = allCustomers.some(c => c.customer_id != id && c.phone_1.trim() === phoneVal);
        if (duplicatePhone) {
          custPhone1Input.setCustomValidity('Customer with this mobile number already exists.');
          isValid = false;
        }
      }

      const emailReg = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      const custEmailVal = custEmailInput ? custEmailInput.value.trim() : '';
      if (custEmailInput && custEmailVal !== '' && !emailReg.test(custEmailVal)) {
        custEmailInput.setCustomValidity('Enter a valid email address');
        isValid = false;
      }

      if (!isValid) {
        customerForm.reportValidity();
        return;
      }

      const formData = new FormData(customerForm);
      const data = Object.fromEntries(formData.entries());

      const url = id ? getApiUrl(`/api/customers/${id}`) : getApiUrl('/api/customers');
      const method = id ? 'PUT' : 'POST';

      try {
        const response = await fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to ${id ? 'update' : 'register'} customer`);
        }

        alert(`Customer ${id ? 'updated' : 'registered'} successfully!`);
        closeCustomerModal();
        fetchCustomers();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  }

  // Unit Management Components
  const unitForm = document.getElementById('unitForm');
  const unitTableBody = document.getElementById('unitTableBody');
  const unitIdInput = document.getElementById('unit_id');
  const unitSubmitBtn = document.getElementById('btnUnitSave');

  const unitModal = document.getElementById('unitModal');
  const btnNewUnit = document.getElementById('btnNewUnit');
  const btnRefreshUnits = document.getElementById('btnRefreshUnits');
  const unitModalClose = document.getElementById('unitModalClose');
  const btnUnitCancel = document.getElementById('btnUnitCancel');

  

  async function fetchUnits() {
    try {
      const response = await authFetch(getApiUrl('/api/units'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch units');
        }
      allUnits = await response.json();
      renderUnits(allUnits);
    } catch (err) {
      console.error(err);
    }
  };

  function renderUnits(list) {
    if (list.length === 0) {
      unitTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">No units registered yet.</td>
        </tr>
      `;
      return;
    }

    unitTableBody.innerHTML = list.map(u => {
      const statusText = u.active ? 'Active' : 'Inactive';
      const statusClass = u.active ? 'status-active' : 'status-inactive';
      const createdDate = u.created_date ? new Date(u.created_date).toLocaleDateString() : 'N/A';

      return `
        <tr>
          <td>${u.display_id || u.unit_id}</td>
          <td>${u.name}</td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          <td>${createdDate}</td>
          <td>
            <div class="action-buttons">
              <button type="button" class="btn-icon btn-edit-unit" data-id="${u.unit_id}" title="Edit Unit">
                <span class="material-icons">edit</span>
              </button>
              <button type="button" class="btn-icon btn-delete-unit" data-id="${u.unit_id}" title="Delete Unit">
                <span class="material-icons">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  if (unitTableBody) {
    unitTableBody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.btn-edit-unit');
      const deleteBtn = e.target.closest('.btn-delete-unit');

      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        editUnit(id);
      } else if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        deleteUnit(id);
      }
    });
  }

  const editUnit = (id) => {
    const u = allUnits.find(item => item.unit_id == id);
    if (!u) return;

    unitIdInput.value = u.unit_id;
    document.getElementById('unit_name').value = u.name || '';
    document.getElementById('unit_active').checked = !!u.active;

    const formTitle = document.querySelector('#unitModal .form-section h2');
    if (formTitle) {
      formTitle.textContent = 'Edit Unit Details';
    }

    unitSubmitBtn.textContent = 'Update Unit';

    if (unitModal) {
      unitModal.style.display = 'flex';
    }
  };

  const deleteUnit = async (id) => {
    if (!confirm('Are you sure you want to delete this unit?')) return;

    try {
      const response = await authFetch(getApiUrl(`/api/units/${id}`), {
        method: 'DELETE'
      });

      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to delete unit');
        }

      alert('Unit deleted successfully!');
      if (unitIdInput.value === id) {
        closeUnitModal();
      }
      fetchUnits();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const resetUnitFormState = () => {
    unitIdInput.value = '';
    unitSubmitBtn.textContent = 'Save Unit';

    const formTitle = document.querySelector('#unitModal .form-section h2');
    if (formTitle) {
      formTitle.textContent = 'Register New Unit';
    }

    const createdByInput = document.getElementById('unit_created_by');
    if (createdByInput) {
      createdByInput.value = 'System';
    }
    
    document.getElementById('unit_name').value = '';
    document.getElementById('unit_active').checked = true;
  };

  const closeUnitModal = () => {
    if (unitModal) {
      unitModal.style.display = 'none';
    }
    unitForm.reset();
  };

  if (btnNewUnit) {
    btnNewUnit.addEventListener('click', () => {
      unitForm.reset();
      if (unitModal) {
        unitModal.style.display = 'flex';
      }
    });
  }

  if (btnRefreshUnits) {
    btnRefreshUnits.addEventListener('click', () => {
      fetchUnits();
    });
  }

  if (unitModalClose) {
    unitModalClose.addEventListener('click', closeUnitModal);
  }

  if (btnUnitCancel) {
    btnUnitCancel.addEventListener('click', closeUnitModal);
  }

  window.addEventListener('click', (e) => {
    if (e.target === unitModal) {
      closeUnitModal();
    }
  });

  if (unitForm) {
    unitForm.addEventListener('reset', () => {
      resetUnitFormState();
    });

    unitForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = unitIdInput.value;
      const name = document.getElementById('unit_name').value;
      const active = document.getElementById('unit_active').checked;

      // Check duplicate unit name
      const duplicate = allUnits.find(u => u.unit_id != id && u.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (duplicate) {
        alert('This unit is already added.');
        return;
      }

      const data = {
        name,
        active
      };

      const url = id ? getApiUrl(`/api/units/${id}`) : getApiUrl('/api/units');
      const method = id ? 'PUT' : 'POST';

      try {
        const response = await fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to ${id ? 'update' : 'register'} unit`);
        }

        alert(`Unit ${id ? 'updated' : 'registered'} successfully!`);
        closeUnitModal();
        fetchUnits();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  }

  // Tax Management Components
  const taxForm = document.getElementById('taxForm');
  const taxTableBody = document.getElementById('taxTableBody');
  const taxIdInput = document.getElementById('tax_id');
  const taxSubmitBtn = document.getElementById('btnTaxSave');

  const taxModal = document.getElementById('taxModal');
  const btnNewTax = document.getElementById('btnNewTax');
  const btnRefreshTaxes = document.getElementById('btnRefreshTaxes');
  const taxModalClose = document.getElementById('taxModalClose');
  const btnTaxCancel = document.getElementById('btnTaxCancel');

  

  async function fetchTaxes() {
    try {
      const response = await authFetch(getApiUrl('/api/taxes'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch taxes');
        }
      allTaxes = await response.json();
      renderTaxes(allTaxes);
    } catch (err) {
      console.error(err);
    }
  };

  function renderTaxes(list) {
    if (list.length === 0) {
      taxTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">No taxes registered yet.</td>
        </tr>
      `;
      return;
    }

    taxTableBody.innerHTML = list.map(t => {
      const statusText = t.active ? 'Active' : 'Inactive';
      const statusClass = t.active ? 'status-active' : 'status-inactive';
      const createdDate = t.created_date ? new Date(t.created_date).toLocaleDateString() : 'N/A';
      const percentage = parseFloat(t.percentage || 0).toFixed(2);
      const combinedTaxName = `${t.name} (${percentage}%)`;

      return `
        <tr>
          <td>${t.display_id || t.tax_id}</td>
          <td>${combinedTaxName}</td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          <td>${createdDate}</td>
          <td>
            <div class="action-buttons">
              <button type="button" class="btn-icon btn-edit-tax" data-id="${t.tax_id}" title="Edit Tax">
                <span class="material-icons">edit</span>
              </button>
              <button type="button" class="btn-icon btn-delete-tax" data-id="${t.tax_id}" title="Delete Tax">
                <span class="material-icons">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  if (taxTableBody) {
    taxTableBody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.btn-edit-tax');
      const deleteBtn = e.target.closest('.btn-delete-tax');

      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        editTax(id);
      } else if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        deleteTax(id);
      }
    });
  }

  const editTax = (id) => {
    const t = allTaxes.find(item => item.tax_id == id);
    if (!t) return;

    taxIdInput.value = t.tax_id;
    document.getElementById('tax_name').value = t.name || '';
    document.getElementById('tax_percentage').value = t.percentage !== undefined ? parseFloat(t.percentage) : 0.00;
    document.getElementById('tax_active').checked = !!t.active;

    const formTitle = document.querySelector('#taxModal .form-section h2');
    if (formTitle) {
      formTitle.textContent = 'Edit Tax Details';
    }

    taxSubmitBtn.textContent = 'Update Tax';

    if (taxModal) {
      taxModal.style.display = 'flex';
    }
  };

  const deleteTax = async (id) => {
    if (!confirm('Are you sure you want to delete this tax?')) return;

    try {
      const response = await authFetch(getApiUrl(`/api/taxes/${id}`), {
        method: 'DELETE'
      });

      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to delete tax');
        }

      alert('Tax deleted successfully!');
      if (taxIdInput.value === id) {
        closeTaxModal();
      }
      fetchTaxes();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const resetTaxFormState = () => {
    taxIdInput.value = '';
    taxSubmitBtn.textContent = 'Save Tax';

    const formTitle = document.querySelector('#taxModal .form-section h2');
    if (formTitle) {
      formTitle.textContent = 'Register New Tax';
    }

    const createdByInput = document.getElementById('tax_created_by');
    if (createdByInput) {
      createdByInput.value = 'System';
    }

    document.getElementById('tax_name').value = '';
    document.getElementById('tax_percentage').value = '';
    document.getElementById('tax_active').checked = true;
  };

  const closeTaxModal = () => {
    if (taxModal) {
      taxModal.style.display = 'none';
    }
    taxForm.reset();
  };

  if (btnNewTax) {
    btnNewTax.addEventListener('click', () => {
      taxForm.reset();
      if (taxModal) {
        taxModal.style.display = 'flex';
      }
    });
  }

  if (btnRefreshTaxes) {
    btnRefreshTaxes.addEventListener('click', () => {
      fetchTaxes();
    });
  }

  if (taxModalClose) {
    taxModalClose.addEventListener('click', closeTaxModal);
  }

  if (btnTaxCancel) {
    btnTaxCancel.addEventListener('click', closeTaxModal);
  }

  window.addEventListener('click', (e) => {
    if (e.target === taxModal) {
      closeTaxModal();
    }
  });

  if (taxForm) {
    taxForm.addEventListener('reset', () => {
      resetTaxFormState();
    });

    taxForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = taxIdInput.value;
      const name = document.getElementById('tax_name').value;
      const percentage = parseFloat(document.getElementById('tax_percentage').value || 0.00);
      const active = document.getElementById('tax_active').checked;

      const data = {
        name,
        percentage,
        active
      };

      const url = id ? getApiUrl(`/api/taxes/${id}`) : getApiUrl('/api/taxes');
      const method = id ? 'PUT' : 'POST';

      try {
        const response = await fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to ${id ? 'update' : 'register'} tax`);
        }

        alert(`Tax ${id ? 'updated' : 'registered'} successfully!`);
        closeTaxModal();
        fetchTaxes();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  }

  // Category Management Components
  const categoryForm = document.getElementById('categoryForm');
  const categoryTableBody = document.getElementById('categoryTableBody');
  const categoryIdInput = document.getElementById('category_id');
  const categorySubmitBtn = document.getElementById('btnCategorySave');

  const categoryModal = document.getElementById('categoryModal');
  const btnNewCategory = document.getElementById('btnNewCategory');
  const btnRefreshCategories = document.getElementById('btnRefreshCategories');
  const categoryModalClose = document.getElementById('categoryModalClose');
  const btnCategoryCancel = document.getElementById('btnCategoryCancel');

  

  async function fetchCategories() {
    try {
      const response = await authFetch(getApiUrl('/api/categories'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch categories');
        }
      allCategories = await response.json();
      renderCategories(allCategories);
    } catch (err) {
      console.error(err);
    }
  };

  function renderCategories(list) {
    if (list.length === 0) {
      categoryTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">No categories registered yet.</td>
        </tr>
      `;
      return;
    }

    categoryTableBody.innerHTML = list.map(c => {
      const statusText = c.active ? 'Active' : 'Inactive';
      const statusClass = c.active ? 'status-active' : 'status-inactive';
      const createdDate = c.created_date ? new Date(c.created_date).toLocaleDateString() : 'N/A';

      return `
        <tr>
          <td>${c.display_id || c.category_id}</td>
          <td>${c.name}</td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          <td>${createdDate}</td>
          <td>
            <div class="action-buttons">
              <button type="button" class="btn-icon btn-edit-category" data-id="${c.category_id}" title="Edit Category">
                <span class="material-icons">edit</span>
              </button>
              <button type="button" class="btn-icon btn-delete-category" data-id="${c.category_id}" title="Delete Category">
                <span class="material-icons">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  if (categoryTableBody) {
    categoryTableBody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.btn-edit-category');
      const deleteBtn = e.target.closest('.btn-delete-category');

      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        editCategory(id);
      } else if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        deleteCategory(id);
      }
    });
  }

  const editCategory = (id) => {
    const c = allCategories.find(item => item.category_id == id);
    if (!c) return;

    categoryIdInput.value = c.category_id;
    document.getElementById('category_name').value = c.name || '';
    document.getElementById('category_active').checked = !!c.active;

    const formTitle = document.querySelector('#categoryModal .form-section h2');
    if (formTitle) {
      formTitle.textContent = 'Edit Category Details';
    }

    categorySubmitBtn.textContent = 'Update Category';

    if (categoryModal) {
      categoryModal.style.display = 'flex';
    }
  };

  const deleteCategory = async (id) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const response = await authFetch(getApiUrl(`/api/categories/${id}`), {
        method: 'DELETE'
      });

      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to delete category');
        }

      alert('Category deleted successfully!');
      if (categoryIdInput.value === id) {
        closeCategoryModal();
      }
      fetchCategories();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const resetCategoryFormState = () => {
    categoryIdInput.value = '';
    categorySubmitBtn.textContent = 'Save Category';

    const formTitle = document.querySelector('#categoryModal .form-section h2');
    if (formTitle) {
      formTitle.textContent = 'Register New Category';
    }

    const createdByInput = document.getElementById('category_created_by');
    if (createdByInput) {
      createdByInput.value = 'System';
    }

    document.getElementById('category_name').value = '';
    document.getElementById('category_active').checked = true;
  };

  const closeCategoryModal = () => {
    if (categoryModal) {
      categoryModal.style.display = 'none';
    }
    categoryForm.reset();
  };

  if (btnNewCategory) {
    btnNewCategory.addEventListener('click', () => {
      categoryForm.reset();
      if (categoryModal) {
        categoryModal.style.display = 'flex';
      }
    });
  }

  if (btnRefreshCategories) {
    btnRefreshCategories.addEventListener('click', () => {
      fetchCategories();
    });
  }

  if (categoryModalClose) {
    categoryModalClose.addEventListener('click', closeCategoryModal);
  }

  if (btnCategoryCancel) {
    btnCategoryCancel.addEventListener('click', closeCategoryModal);
  }

  window.addEventListener('click', (e) => {
    if (e.target === categoryModal) {
      closeCategoryModal();
    }
  });

  if (categoryForm) {
    categoryForm.addEventListener('reset', () => {
      resetCategoryFormState();
    });

    categoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = categoryIdInput.value;
      const name = document.getElementById('category_name').value;
      const active = document.getElementById('category_active').checked;

      // Client-side duplicate check
      const nameCheck = name.trim().toLowerCase();
      const isDuplicate = allCategories.some(c => c.name.trim().toLowerCase() === nameCheck && String(c.category_id) !== String(id));
      if (isDuplicate) {
        showToast('Duplicate Category', 'This category is already added.', 'warning');
        return;
      }

      const data = { name, active };

      const url = id ? getApiUrl(`/api/categories/${id}`) : getApiUrl('/api/categories');
      const method = id ? 'PUT' : 'POST';

      try {
        const response = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to ${id ? 'update' : 'register'} category`);
        }

        alert(`Category ${id ? 'updated' : 'registered'} successfully!`);
        closeCategoryModal();
        fetchCategories();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  }

  // Item Management Components
  const itemForm = document.getElementById('itemForm');
  const itemTableBody = document.getElementById('itemTableBody');
  const itemIdInput = document.getElementById('item_id');
  const itemSubmitBtn = document.getElementById('btnItemSave');
  const itemImageBase64 = document.getElementById('item_image_base64');
  const itemImageFilename = document.getElementById('item_image_filename');
  const btnChooseImage = document.getElementById('btnChooseImage');
  const itemImagePreviewBox = document.getElementById('itemImagePreviewBox');
  const itemImagePreview = document.getElementById('itemImagePreview');
  const itemImageFile = document.getElementById('item_image_file');

  const itemModal = document.getElementById('itemModal');
  const btnNewItem = document.getElementById('btnNewItem');
  const btnRefreshItems = document.getElementById('btnRefreshItems');
  const itemModalClose = document.getElementById('itemModalClose');
  const btnItemCancel = document.getElementById('btnItemCancel');

  
  let selectedItemImagePayload = null;

  const populateDropdowns = async () => {
    try {
      const [catsRes, unitsRes, taxesRes] = await Promise.all([
        authFetch(getApiUrl('/api/categories')),
        authFetch(getApiUrl('/api/units')),
        authFetch(getApiUrl('/api/taxes'))
      ]);

      const categories = catsRes.ok ? await catsRes.json() : [];
      const units = unitsRes.ok ? await unitsRes.json() : [];
      const taxes = taxesRes.ok ? await taxesRes.json() : [];

      const selectCategory = document.getElementById('item_category_id');
      const selectUnit = document.getElementById('item_unit_id');
      const selectTax = document.getElementById('item_tax_id');

      if (selectCategory) {
        selectCategory.innerHTML = '<option value="">Select Category</option>' + 
          categories.map(c => `<option value="${c.category_id}">${c.name}</option>`).join('');
      }
      if (selectUnit) {
        selectUnit.innerHTML = '<option value="">Select Unit</option>' + 
          units.map(u => `<option value="${u.unit_id}">${u.name}</option>`).join('');
      }
      if (selectTax) {
        selectTax.innerHTML = '<option value="">Select Tax</option>' + 
          taxes.map(t => `<option value="${t.tax_id}">${t.name}</option>`).join('');
      }
    } catch (err) {
      console.error('Error populating dropdowns:', err);
    }
  };

  async function fetchItems() {
    try {
      await populateDropdowns();
      const response = await authFetch(getApiUrl('/api/items'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch items');
        }
      allItems = await response.json();
      renderItems(allItems);
    } catch (err) {
      console.error(err);
    }
  };

  let itemSearchQuery = '';
  let itemCurrentPage = 1;

  function renderItems(list) {
    if (!itemTableBody) return;

    const query = itemSearchQuery.trim().toLowerCase();
    const filtered = list.filter(item => {
      const name = (item.name || '').toLowerCase();
      const code = (item.code || '').toLowerCase();
      const catName = (item.category_name || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      return !query || name.includes(query) || code.includes(query) || catName.includes(query) || desc.includes(query);
    });

    const { items, total, start, end, safePage, totalPages } = paginateDataset(filtered, itemCurrentPage, 10);
    itemCurrentPage = safePage;

    const infoElem = document.getElementById('itemPaginationInfo');
    const pageNumElem = document.getElementById('itemPageNum');
    const prevBtn = document.getElementById('btnItemPrevPage');
    const nextBtn = document.getElementById('btnItemNextPage');

    if (infoElem) infoElem.textContent = `Showing ${start} to ${end} of ${total} entries`;
    if (pageNumElem) pageNumElem.textContent = `Page ${safePage} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = safePage <= 1;
    if (nextBtn) nextBtn.disabled = safePage >= totalPages;

    if (items.length === 0) {
      itemTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">${query ? `No matching items found for "${query}"` : 'No items registered yet.'}</td>
        </tr>
      `;
      return;
    }

    itemTableBody.innerHTML = items.map(item => {
      const itemCode = item.code || 'N/A';
      const imageSrc = getItemImageSrc(item, 'thumb');
      const imageTag = imageSrc ? `<img src="${imageSrc}" onerror="this.style.display=\'none\';" class="item-table-image" alt="${item.name || 'Item image'}">` : '';
      const categoryName = item.category_name || 'N/A';
      const description = item.description || 'No description';

      const stockQty = item.base_quantity !== undefined ? parseFloat(item.base_quantity) : 10;
      let stockBadge = '<span class="status-badge" style="background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; font-weight: 600;">In Stock</span>';
      if (stockQty <= 0) {
        stockBadge = '<span class="status-badge" style="background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; font-weight: 600;">Out of Stock</span>';
      } else if (stockQty <= 5) {
        stockBadge = '<span class="status-badge" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 600;">Low Stock (' + stockQty + ')</span>';
      }

      return `
        <tr>
          <td><strong>${itemCode}</strong></td>
          <td>${imageTag}${item.name}</td>
          <td><span class="status-badge status-active" style="background-color: rgba(79, 70, 229, 0.08); color: var(--primary-color); border: 1px solid rgba(79, 70, 229, 0.15);">${categoryName}</span></td>
          <td>${stockBadge}</td>
          <td>${description}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn-icon text-warning btn-reorder-item" data-id="${item.item_id}" data-name="${item.name}" title="1-Click Purchase Reorder">
                <span class="material-icons">local_shipping</span>
              </button>
              <button type="button" class="btn-icon text-primary btn-edit-item" data-id="${item.item_id}" title="Edit Item">
                <span class="material-icons">edit</span>
              </button>
              <button type="button" class="btn-icon text-danger btn-delete-item" data-id="${item.item_id}" title="Delete Item">
                <span class="material-icons">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.btn-reorder-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemName = btn.getAttribute('data-name');
        switchScreen('purchase');
        showToast('Purchase Reorder', `Initiated purchase order reorder for "${itemName}".`, 'info');
      });
    });

    document.querySelectorAll('.btn-edit-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        editItem(id);
      });
    });

    document.querySelectorAll('.btn-delete-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        deleteItem(id);
      });
    });
  };

  const itemSearchInput = document.getElementById('itemSearchInput');
  if (itemSearchInput) {
    itemSearchInput.addEventListener('input', (e) => {
      itemSearchQuery = e.target.value;
      itemCurrentPage = 1;
      renderItems(allItems);
    });
  }
  const btnItemPrevPage = document.getElementById('btnItemPrevPage');
  if (btnItemPrevPage) {
    btnItemPrevPage.addEventListener('click', () => {
      itemCurrentPage--;
      renderItems(allItems);
    });
  }
  const btnItemNextPage = document.getElementById('btnItemNextPage');
  if (btnItemNextPage) {
    btnItemNextPage.addEventListener('click', () => {
      itemCurrentPage++;
      renderItems(allItems);
    });
  }

  const editItem = async (id) => {
    try {
      const response = await authFetch(getApiUrl(`/api/items/${id}`));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch item details');
        }
      const item = await response.json();

      const srNoGroup = document.getElementById('itemSrNoGroup');
      if (srNoGroup) srNoGroup.style.display = 'block';

      itemIdInput.value = item.item_id || '';
      document.getElementById('item_sr_no').value = item.item_id || '';
      document.getElementById('item_code').value = item.code || '';
      document.getElementById('item_name').value = item.name || '';
      document.getElementById('item_short_name').value = item.short_name || '';
      document.getElementById('item_long_name').value = item.long_name || '';
      document.getElementById('item_description').value = item.description || '';
      document.getElementById('item_sales_price').value = item.sales_price || '';
      document.getElementById('item_purchase_price').value = item.purchase_price || '';
      document.getElementById('item_base_quantity').value = item.base_quantity || '1.00';
      
      document.getElementById('item_editable_price').checked = item.editable_price == 1;
      document.getElementById('item_visible').checked = item.visible == 1;
      document.getElementById('item_active').checked = item.active == 1;

      // Handle image preview
      const imageSrc = getItemImageSrc(item, 'web');
      selectedItemImagePayload = imageSrc ? { keepExisting: true } : null;
      if (imageSrc) {
        itemImageBase64.value = imageSrc;
        itemImageFilename.value = 'Existing Image';
        itemImagePreview.src = imageSrc;
        itemImagePreviewBox.style.display = 'block';
      } else {
        itemImageBase64.value = '';
        itemImageFilename.value = 'No file chosen';
        itemImagePreviewBox.style.display = 'none';
      }

      // Handle weight measurement radios
      const weightType = item.weight_measurement || 'none';
      const rNone = document.getElementById('weight_none');
      const rAuto = document.getElementById('weight_auto');
      const rManual = document.getElementById('weight_manual');
      if (rNone) rNone.checked = weightType === 'none';
      if (rAuto) rAuto.checked = weightType === 'auto';
      if (rManual) rManual.checked = weightType === 'manual';

      const setSelectVal = (selectId, val, label) => {
        const select = document.getElementById(selectId);
        if (select) {
          if (val) {
            let optionExists = Array.from(select.options).some(opt => opt.value == val);
            if (!optionExists) {
              const opt = document.createElement('option');
              opt.value = val;
              opt.textContent = label || `ID: ${val}`;
              select.appendChild(opt);
            }
            select.value = val;
          } else {
            select.value = '';
          }
        }
      };

      setSelectVal('item_category_id', item.category_id, item.category_name);
      setSelectVal('item_unit_id', item.unit_id, item.unit_name);
      setSelectVal('item_tax_id', item.tax_id, item.tax_name);

      const formTitle = document.querySelector('#itemModal .form-section h2');
      if (formTitle) {
        formTitle.textContent = 'Edit Item Details';
      }

      itemSubmitBtn.textContent = 'Update Item';

      if (itemModal) {
        itemModal.style.display = 'flex';
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const deleteItem = async (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const response = await authFetch(getApiUrl(`/api/items/${id}`), {
        method: 'DELETE'
      });

      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to delete item');
        }

      alert('Item deleted successfully!');
      if (itemIdInput.value === id) {
        closeItemModal();
      }
      fetchItems();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const resetItemFormState = () => {
    itemIdInput.value = '';
    document.getElementById('item_sr_no').value = 'Auto-generated';
    const srNoGroup = document.getElementById('itemSrNoGroup');
    if (srNoGroup) srNoGroup.style.display = 'none';

    itemSubmitBtn.textContent = 'Save Item';

    const formTitle = document.querySelector('#itemModal .form-section h2');
    if (formTitle) {
      formTitle.textContent = 'Register New Item';
    }

    const createdByInput = document.getElementById('item_created_by');
    if (createdByInput) {
      createdByInput.value = 'System';
    }

    document.getElementById('item_active').checked = true;
    document.getElementById('item_visible').checked = true;
    document.getElementById('item_editable_price').checked = false;
    document.getElementById('item_base_quantity').value = '1.00';
    document.getElementById('item_sales_price').value = '';
    document.getElementById('item_purchase_price').value = '';
    
    const rNone = document.getElementById('weight_none');
    if (rNone) rNone.checked = true;

    itemImageBase64.value = '';
    itemImageFilename.value = 'No file chosen';
    selectedItemImagePayload = null;
    if (itemImagePreviewBox) itemImagePreviewBox.style.display = 'none';
    if (itemImageFile) itemImageFile.value = '';
  };

  const closeItemModal = () => {
    if (itemModal) {
      itemModal.style.display = 'none';
    }
    resetItemFormState();
  };

  function openItemModal() {
    resetItemFormState();
    if (itemModal) {
      document.body.appendChild(itemModal);
      itemModal.style.zIndex = '999999';
      itemModal.style.display = 'flex';
    }
  }
  window.openItemModal = openItemModal;

  if (btnNewItem) {
    btnNewItem.addEventListener('click', openItemModal);
  }

  if (btnRefreshItems) {
    btnRefreshItems.addEventListener('click', () => {
      fetchItems();
    });
  }

  if (itemModalClose) {
    itemModalClose.addEventListener('click', closeItemModal);
  }

  if (btnItemCancel) {
    btnItemCancel.addEventListener('click', closeItemModal);
  }

  if (btnChooseImage && itemImageFile) {
    btnChooseImage.addEventListener('click', () => {
      itemImageFile.click();
    });
  }

  if (itemImageFile) {
    itemImageFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (itemImageFilename) itemImageFilename.value = file.name;

      try {
        selectedItemImagePayload = await buildWebImagePayload(file);
        const previewSrc = selectedItemImagePayload.variants.web.dataUri;
        if (itemImageBase64) itemImageBase64.value = previewSrc;
        if (itemImagePreview) itemImagePreview.src = previewSrc;
        if (itemImagePreviewBox) itemImagePreviewBox.style.display = 'block';
      } catch (err) {
        selectedItemImagePayload = null;
        alert(err.message);
      }
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === itemModal) {
      closeItemModal();
    }
  });

  if (itemForm) {
    itemForm.addEventListener('reset', () => {
      resetItemFormState();
    });

    itemForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = itemIdInput.value;
      const code = document.getElementById('item_code').value;
      const name = document.getElementById('item_name').value;
      const short_name = document.getElementById('item_short_name').value;
      const long_name = document.getElementById('item_long_name').value;
      const description = document.getElementById('item_description').value;
      const sales_price = parseFloat(document.getElementById('item_sales_price').value || 0);
      let purchase_price = parseFloat(document.getElementById('item_purchase_price').value || 0);

      if (appMode === 'restaurant') {
        purchase_price = 0.00;
      }

      if (appMode !== 'restaurant' && sales_price < purchase_price) {
        alert("Retail price (Retail Price) cannot be less than purchase price (Purchase Price).");
        return;
      }
      
      const category_id = document.getElementById('item_category_id').value || null;
      const unit_id = document.getElementById('item_unit_id').value || null;
      const tax_id = document.getElementById('item_tax_id').value || null;
      const base_quantity = parseFloat(document.getElementById('item_base_quantity').value || 1.00);

      const active = document.getElementById('item_active').checked;
      const visible = document.getElementById('item_visible').checked;
      const editable_price = document.getElementById('item_editable_price').checked;
      const image = selectedItemImagePayload || null;

      let weight_measurement = 'none';
      if (document.getElementById('weight_auto').checked) weight_measurement = 'auto';
      if (document.getElementById('weight_manual').checked) weight_measurement = 'manual';

      const data = {
        code,
        name,
        short_name,
        long_name,
        description,
        sales_price,
        purchase_price,
        category_id,
        unit_id,
        tax_id,
        base_quantity,
        active,
        visible,
        editable_price,
        image,
        weight_measurement,
        created_by: activeUser ? activeUser.username : 'System'
      };

      // Check duplicate on frontend
      const duplicate = allItems.find(item => item.item_id != id && (
        item.name.trim().toLowerCase() === name.trim().toLowerCase() ||
        (code && item.code && item.code.trim().toLowerCase() === code.trim().toLowerCase())
      ));
      if (duplicate) {
        alert('This item is already added.');
        return;
      }

      const url = id ? getApiUrl(`/api/items/${id}`) : getApiUrl('/api/items');
      const method = id ? 'PUT' : 'POST';

      try {
        const response = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to ${id ? 'update' : 'register'} item`);
        }

        alert(id ? `Item updated successfully!` : `item has been successfully added`);
        closeItemModal();
        fetchItems();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  }

  // Vendor Management Components
  const vendorForm = document.getElementById('vendorForm');
  const vendorTableBody = document.getElementById('vendorTableBody');
  const vendorIdInput = document.getElementById('vendor_id');
  const vendorSubmitBtn = document.getElementById('btnVendorSave');
  const vendorModal = document.getElementById('vendorModal');
  const btnNewVendor = document.getElementById('btnNewVendor');
  const btnRefreshVendors = document.getElementById('btnRefreshVendors');
  const vendorModalClose = document.getElementById('vendorModalClose');
  const btnVendorCancel = document.getElementById('btnVendorCancel');

  

  async function fetchVendors() {
    try {
      const response = await authFetch(getApiUrl('/api/vendors'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch vendors');
        }
      allVendors = await response.json();
      renderVendors(allVendors);
    } catch (err) {
      console.error(err);
    }
  };

  let vendorSearchQuery = '';
  let vendorCurrentPage = 1;

  function renderVendors(list) {
    if (!vendorTableBody) return;

    const query = vendorSearchQuery.trim().toLowerCase();
    const filtered = list.filter(v => {
      const fullName = `${v.first_name || ''} ${v.last_name || ''}`.toLowerCase();
      const company = (v.company || '').toLowerCase();
      const phone = (v.phone_1 || '').toLowerCase();
      const email = (v.email || '').toLowerCase();
      const city = (v.city || '').toLowerCase();
      return !query || fullName.includes(query) || company.includes(query) || phone.includes(query) || email.includes(query) || city.includes(query);
    });

    const { items, total, start, end, safePage, totalPages } = paginateDataset(filtered, vendorCurrentPage, 10);
    vendorCurrentPage = safePage;

    const infoElem = document.getElementById('vendorPaginationInfo');
    const pageNumElem = document.getElementById('vendorPageNum');
    const prevBtn = document.getElementById('btnVendorPrevPage');
    const nextBtn = document.getElementById('btnVendorNextPage');

    if (infoElem) infoElem.textContent = `Showing ${start} to ${end} of ${total} entries`;
    if (pageNumElem) pageNumElem.textContent = `Page ${safePage} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = safePage <= 1;
    if (nextBtn) nextBtn.disabled = safePage >= totalPages;

    if (items.length === 0) {
      vendorTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">${query ? `No matching vendors found for "${query}"` : 'No vendors registered yet.'}</td></tr>`;
      return;
    }

    vendorTableBody.innerHTML = items.map(v => {
      const fullName = `${v.first_name} ${v.last_name}`;
      const address = v.address_2 ? `${v.address_1}, ${v.address_2}` : v.address_1;
      const location = `${v.city}, ${v.country}`;
      const contact = `${v.phone_1} | ${v.email}`;
      return `
        <tr>
          <td>${v.display_id || v.vendor_id}</td>
          <td>${fullName}</td>
          <td>${v.company || 'N/A'}</td>
          <td>${address}</td>
          <td>${location}</td>
          <td>${contact}</td>
          <td>
            <div class="action-buttons">
              <button type="button" class="btn-icon btn-edit-vendor" data-id="${v.vendor_id}" title="Edit Vendor">
                <span class="material-icons">edit</span>
              </button>
              <button type="button" class="btn-icon btn-delete-vendor" data-id="${v.vendor_id}" title="Delete Vendor">
                <span class="material-icons">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.btn-edit-vendor').forEach(btn => {
      btn.addEventListener('click', () => editVendor(btn.getAttribute('data-id')));
    });
    document.querySelectorAll('.btn-delete-vendor').forEach(btn => {
      btn.addEventListener('click', () => deleteVendor(btn.getAttribute('data-id')));
    });
  };

  const vendorSearchInput = document.getElementById('vendorSearchInput');
  if (vendorSearchInput) {
    vendorSearchInput.addEventListener('input', (e) => {
      vendorSearchQuery = e.target.value;
      vendorCurrentPage = 1;
      renderVendors(allVendors);
    });
  }
  const btnVendorPrevPage = document.getElementById('btnVendorPrevPage');
  if (btnVendorPrevPage) {
    btnVendorPrevPage.addEventListener('click', () => {
      vendorCurrentPage--;
      renderVendors(allVendors);
    });
  }
  const btnVendorNextPage = document.getElementById('btnVendorNextPage');
  if (btnVendorNextPage) {
    btnVendorNextPage.addEventListener('click', () => {
      vendorCurrentPage++;
      renderVendors(allVendors);
    });
  }

  const editVendor = (id) => {
    const v = allVendors.find(item => item.vendor_id == id);
    if (!v) return;

    vendorIdInput.value = v.vendor_id;
    document.getElementById('vendor_first_name').value = v.first_name || '';
    document.getElementById('vendor_last_name').value = v.last_name || '';
    document.getElementById('vendor_company').value = v.company || '';
    document.getElementById('vendor_address_1').value = v.address_1 || '';
    document.getElementById('vendor_address_2').value = v.address_2 || '';
    document.getElementById('vendor_city').value = v.city || '';
    document.getElementById('vendor_country').value = v.country || '';
    document.getElementById('vendor_phone_1').value = v.phone_1 || '';
    document.getElementById('vendor_phone_2').value = v.phone_2 || '';
    document.getElementById('vendor_email').value = v.email || '';
    const createdByInput = document.getElementById('vendor_created_by');
    if (createdByInput) createdByInput.value = v.created_by || 'System';

    const formTitle = document.querySelector('#vendorModal .form-section h2');
    if (formTitle) formTitle.textContent = 'Edit Vendor Details';
    vendorSubmitBtn.textContent = 'Update Vendor';
    if (vendorModal) vendorModal.style.display = 'flex';
  };

  const deleteVendor = async (id) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;
    try {
      const response = await authFetch(getApiUrl(`/api/vendors/${id}`), { method: 'DELETE' });
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to delete vendor');
        }
      alert('Vendor deleted successfully!');
      fetchVendors();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const resetVendorFormState = () => {
    vendorIdInput.value = '';
    vendorSubmitBtn.textContent = 'Save Vendor';
    const formTitle = document.querySelector('#vendorModal .form-section h2');
    if (formTitle) formTitle.textContent = 'Register New Vendor';
    const createdByInput = document.getElementById('vendor_created_by');
    if (createdByInput) {
      createdByInput.value = activeUser ? activeUser.username : 'System';
    }
  };

  const closeVendorModal = () => {
    if (vendorModal) vendorModal.style.display = 'none';
    vendorForm.reset();
  };

  if (btnNewVendor) btnNewVendor.addEventListener('click', () => { 
    vendorForm.reset(); 
    if (vendorModal) vendorModal.style.display = 'flex'; 
  });
  if (btnRefreshVendors) btnRefreshVendors.addEventListener('click', fetchVendors);
  if (vendorModalClose) vendorModalClose.addEventListener('click', closeVendorModal);
  if (btnVendorCancel) btnVendorCancel.addEventListener('click', closeVendorModal);

  const vendorPhone1Input = document.getElementById('vendor_phone_1');
  const vendorPhone2Input = document.getElementById('vendor_phone_2');
  const vendorEmailInput = document.getElementById('vendor_email');
  const vendorCompanyInput = document.getElementById('vendor_company');

  if (vendorPhone1Input) {
    vendorPhone1Input.addEventListener('input', (e) => {
      restrictToNumeric(e);
      vendorPhone1Input.setCustomValidity('');
    });
  }
  if (vendorPhone2Input) {
    vendorPhone2Input.addEventListener('input', restrictToNumeric);
  }
  if (vendorEmailInput) {
    vendorEmailInput.addEventListener('input', () => {
      vendorEmailInput.setCustomValidity('');
    });
  }
  if (vendorCompanyInput) {
    vendorCompanyInput.addEventListener('input', () => {
      vendorCompanyInput.setCustomValidity('');
    });
  }

  if (vendorForm) {
    vendorForm.addEventListener('reset', () => {
      resetVendorFormState();
    });

    vendorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = vendorIdInput.value;
      if (vendorPhone1Input) vendorPhone1Input.setCustomValidity('');
      if (vendorEmailInput) vendorEmailInput.setCustomValidity('');
      if (vendorCompanyInput) vendorCompanyInput.setCustomValidity('');

      let isValid = true;
      const companyVal = vendorCompanyInput ? vendorCompanyInput.value.trim().toLowerCase() : '';
      const phoneVal = vendorPhone1Input ? vendorPhone1Input.value.trim() : '';
      const emailVal = vendorEmailInput ? vendorEmailInput.value.trim().toLowerCase() : '';

      if (vendorPhone1Input && phoneVal.length !== 10) {
        vendorPhone1Input.setCustomValidity('Primary phone must be exactly 10 digits');
        isValid = false;
      }

      const emailReg = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      if (vendorEmailInput && emailVal && !emailReg.test(emailVal)) {
        vendorEmailInput.setCustomValidity('Enter a valid email address');
        isValid = false;
      }

      if (!isValid) {
        vendorForm.reportValidity();
        return;
      }

      // Check duplicates on frontend
      const duplicate = allVendors.find(v => v.vendor_id != id && (
        (companyVal && v.company && v.company.trim().toLowerCase() === companyVal) ||
        (phoneVal && v.phone_1 && v.phone_1.trim() === phoneVal) ||
        (emailVal && v.email && v.email.trim().toLowerCase() === emailVal)
      ));

      if (duplicate) {
        if (companyVal && duplicate.company && duplicate.company.trim().toLowerCase() === companyVal) {
          vendorCompanyInput.setCustomValidity('Vendor with this company name already exists.');
        }
        if (phoneVal && duplicate.phone_1 && duplicate.phone_1.trim() === phoneVal) {
          vendorPhone1Input.setCustomValidity('Vendor with this mobile number already exists.');
        }
        if (emailVal && duplicate.email && duplicate.email.trim().toLowerCase() === emailVal) {
          vendorEmailInput.setCustomValidity('Vendor with this email ID already exists.');
        }
        vendorForm.reportValidity();
        return;
      }

      const formData = new FormData(vendorForm);
      const data = Object.fromEntries(formData.entries());
      const url = id ? getApiUrl(`/api/vendors/${id}`) : getApiUrl('/api/vendors');
      const method = id ? 'PUT' : 'POST';

      try {
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save vendor details.');
        }
        alert(`Vendor ${id ? 'updated' : 'registered'} successfully!`);
        closeVendorModal();
        fetchVendors();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  }

  // Sales Transaction (Sell Tab) Billing Controllers
  const invoiceForm = document.getElementById('invoiceForm');
  const invoiceCustomer = document.getElementById('invoiceCustomer');
  const invoiceCustomerPhone = document.getElementById('invoiceCustomerPhone');
  const invoiceDate = document.getElementById('invoiceDate');
  const invoiceBillNo = document.getElementById('invoiceBillNo');
  const invoiceTableBody = document.getElementById('invoiceTableBody');
  
  const adderItem = document.getElementById('adderItem');
  const adderRate = document.getElementById('adderRate');
  const adderQty = document.getElementById('adderQty');
  const adderTaxName = document.getElementById('adderTaxName');
  const btnAdderAdd = document.getElementById('btnAdderAdd');

  const summaryGross = document.getElementById('summaryGross');
  const summaryTax = document.getElementById('summaryTax');
  const summaryNet = document.getElementById('summaryNet');
  const salesItemSearch = document.getElementById('salesItemSearch');
  const salesCodeSearch = document.getElementById('salesCodeSearch');
  const salesProductGrid = document.getElementById('salesProductGrid');
  const salesCategoryButtons = document.getElementById('salesCategoryButtons');
  const salesLineCount = document.getElementById('salesLineCount');

  let invoiceLines = [];
  let availableItems = [];
  let availableCustomers = [];
  let availableTaxes = [];
  let invoiceBillCount = 1;
  let selectedSalesCategory = 'all';

  async function fetchInvoiceSetup() {
    if (!invoiceDate || !invoiceCustomer || !invoiceBillNo) return;
    try {
      invoiceDate.value = new Date().toISOString().split('T')[0];
      
      const custRes = await authFetch(getApiUrl('/api/customers'));
      availableCustomers = custRes.ok ? await custRes.json() : [];
      invoiceCustomer.innerHTML = '<option value="">Choose Customer</option>' + 
        availableCustomers.map(c => `<option value="${c.customer_id}">${c.first_name} ${c.last_name}</option>`).join('');

      const itemsRes = await authFetch(getApiUrl('/api/items'));
      availableItems = itemsRes.ok ? (await itemsRes.json()).filter(item => item.visible !== 0 && item.visible !== "0" && item.visible !== false && item.active !== 0 && item.active !== "0" && item.active !== false) : [];
      if (adderItem) {
        adderItem.innerHTML = '<option value="">Select Item</option>' + 
          availableItems.map(i => `<option value="${i.item_id}">${i.name}</option>`).join('');
      }
      renderSalesCategories(); renderSalesCatalog();
      renderSalesCatalog();

      const taxesRes = await authFetch(getApiUrl('/api/taxes'));
      availableTaxes = taxesRes.ok ? await taxesRes.json() : [];

      const salesRes = await authFetch(getApiUrl('/api/sales'));
      const sales = salesRes.ok ? await salesRes.json() : [];
      invoiceBillCount = sales.length + 1;
      invoiceBillNo.textContent = invoiceBillCount;

      invoiceLines = [];
      renderInvoiceLines();
    } catch (err) {
      console.error(err);
    }
  };

  if (adderItem) {
    adderItem.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      if (!selectedId) {
        adderRate.value = '';
        adderRate.readOnly = true;
        adderTaxName.value = '';
        return;
      }
      const item = availableItems.find(i => i.item_id == selectedId);
      if (item) {
        adderRate.value = parseFloat(item.sales_price || 0).toFixed(2);
        adderRate.readOnly = item.editable_price !== 1;
        const tax = availableTaxes.find(t => t.tax_id == item.tax_id);
        adderTaxName.value = tax ? tax.name : 'No Tax (0%)';
      }
    });
  }

  if (invoiceCustomer && invoiceCustomerPhone) {
    invoiceCustomer.addEventListener('change', () => {
      const customer = availableCustomers.find(c => c.customer_id == invoiceCustomer.value);
      invoiceCustomerPhone.value = customer ? (customer.phone_1 || '') : '';
    });
  }

  const addSalesItemLine = (item, qtyOverride = null, rateOverride = null) => {
    if (!item) return;
    const rate = parseFloat(rateOverride ?? item.sales_price ?? 0);
    const qty = parseFloat(qtyOverride ?? adderQty?.value ?? 1);
    
    if (isNaN(rate) || isNaN(qty) || qty <= 0) {
      alert('Please choose a valid item and quantity.');
      return;
    }

    let taxRate = 0;
    if (item.tax_rate !== undefined && item.tax_rate !== null && item.tax_rate !== '') {
      taxRate = parseFloat(item.tax_rate);
    } else if (item.tax_percentage !== undefined && item.tax_percentage !== null && item.tax_percentage !== '') {
      taxRate = parseFloat(item.tax_percentage);
    } else if (item.tax_id) {
      const taxObj = availableTaxes.find(t => t.tax_id == item.tax_id || t.id == item.tax_id);
      if (taxObj) taxRate = parseFloat(taxObj.percentage || taxObj.rate || 0);
    }
    let taxPercent = taxRate / 100;

    const gross = rate * qty;
    const taxAmt = gross * taxPercent;
    const net = gross + taxAmt;

    const existingIdx = invoiceLines.findIndex(line => line.item_id == item.item_id);
    if (existingIdx !== -1) {
      invoiceLines[existingIdx].quantity += qty;
      invoiceLines[existingIdx].gross = invoiceLines[existingIdx].rate * invoiceLines[existingIdx].quantity;
      invoiceLines[existingIdx].tax_amount = invoiceLines[existingIdx].gross * taxPercent;
      invoiceLines[existingIdx].item_amount = invoiceLines[existingIdx].gross + invoiceLines[existingIdx].tax_amount;
    } else {
      invoiceLines.push({
        item_id: item.item_id,
        name: item.name,
        rate,
        quantity: qty,
        taxPercent,
        gross,
        tax_amount: taxAmt,
        item_amount: net
      });
    }

    if (adderItem) adderItem.value = '';
    if (adderRate) { adderRate.value = ''; adderRate.readOnly = true; }
    if (adderQty) adderQty.value = '1.00';
    if (adderTaxName) adderTaxName.value = '';
    renderInvoiceLines();
  };

  if (btnAdderAdd) {
    btnAdderAdd.addEventListener('click', () => {
      const item = availableItems.find(i => i.item_id == adderItem.value);
      addSalesItemLine(item, adderQty.value, adderRate.value);
    });
  }

  function renderSalesCategories() {
    if (!salesCategoryButtons) return;
    const categoryMap = new Map();
    availableItems.forEach(item => {
      if (item.category_id) {
        categoryMap.set(item.category_id, item.category_name || 'Other');
      }
    });

    salesCategoryButtons.innerHTML = Array.from(categoryMap.entries()).map(([id, name]) => (
      `<button type="button" class="pos-category" data-category="${id}">${name}</button>`
    )).join('');
  };

  const getFilteredSalesItems = () => {
    const nameNeedle = (salesItemSearch?.value || '').trim().toLowerCase();
    const codeNeedle = (salesCodeSearch?.value || '').trim().toLowerCase();
    return availableItems.filter(item => {
      const matchesCategory = selectedSalesCategory === 'all' || String(item.category_id || '') === String(selectedSalesCategory);
      const matchesName = !nameNeedle || (item.name || '').toLowerCase().includes(nameNeedle);
      const matchesCode = !codeNeedle || (item.code || '').toLowerCase().includes(codeNeedle);
      return matchesCategory && matchesName && matchesCode;
    });
  };

  function renderSalesCatalog() {
    if (!salesProductGrid) return;
    const filtered = getFilteredSalesItems();
    if (!filtered.length) {
      salesProductGrid.innerHTML = '<div class="empty-state pos-grid-empty">No matching items found.</div>';
      return;
    }

    salesProductGrid.innerHTML = filtered.map(item => {
      const imageSrc = getItemImageSrc(item, 'web');
      return `
        <button type="button" class="pos-product-card" data-id="${item.item_id}" style="display:flex; flex-direction:column; align-items:center; background:var(--card-bg); border:1px solid var(--border-color); border-radius:12px; padding:0.75rem; transition:transform 0.2s, box-shadow 0.2s; cursor:pointer;">
          <div class="pos-product-image" style="width:100%; height:90px; border-radius:8px; overflow:hidden; background:#1e293b; display:flex; align-items:center; justify-content:center;">
            <img src="${imageSrc}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300';" alt="${item.name || 'Item image'}" style="width:100%; height:100%; object-fit:cover;">
          </div>
          <strong style="margin-top:0.5rem; font-size:0.88rem; color:var(--text-main); font-weight:700; text-align:center;">${item.name || 'Unnamed Item'}</strong>
          <span style="font-size:0.8rem; color:#818cf8; font-weight:700; margin-top:0.25rem;">${money(item.sales_price)} / ${item.unit_name || 'unit'}</span>
        </button>
      `;
    }).join('');

    salesProductGrid.querySelectorAll('.pos-product-card').forEach(card => {
      card.addEventListener('click', () => {
        AudioSynth.beep(880, 0.05, 'sine');
        const item = availableItems.find(i => i.item_id == card.getAttribute('data-id'));
        addSalesItemLine(item, adderQty.value);
      });
    });
  };

  const salesItemSelect = document.getElementById('salesItemSelect');
  if (salesItemSelect) {
    salesItemSelect.addEventListener('change', () => {
      const selectedId = salesItemSelect.value;
      if (selectedId) {
        const item = availableItems.find(i => i.item_id == selectedId);
        if (item) {
          AudioSynth.beep(880, 0.05, 'sine');
          addSalesItemLine(item, adderQty ? adderQty.value : 1);
          salesItemSelect.value = '';
        }
      }
    });
  }

  [salesItemSearch, salesCodeSearch].forEach(input => {
    if (input) input.addEventListener('input', renderSalesCatalog);
  });

  const salesCategoryPanel = document.querySelector('#screenSales .pos-category-panel');
  if (salesCategoryPanel) {
    salesCategoryPanel.addEventListener('click', (event) => {
      const button = event.target.closest('.pos-category');
      if (!button) return;
      selectedSalesCategory = button.getAttribute('data-category') || 'all';
      salesCategoryPanel.querySelectorAll('.pos-category').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      renderSalesCatalog();
    });
  }

  function renderInvoiceLines() {
    if (!invoiceTableBody || !summaryGross || !summaryTax || !summaryNet) return;
    if (invoiceLines.length === 0) {
      invoiceTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No items added to invoice yet.</td></tr>`;
      summaryGross.textContent = money(0);
      summaryTax.textContent = money(0);
      summaryNet.textContent = money(0);
      if (salesLineCount) salesLineCount.textContent = '0 items';
      return;
    }

    let tGross = 0;
    let tTax = 0;
    let tNet = 0;

    invoiceTableBody.innerHTML = invoiceLines.map((line, idx) => {
      tGross += line.gross;
      tTax += line.tax_amount;
      tNet += line.item_amount;
      return `
        <tr>
          <td>
            <div style="font-weight: 700;">${line.name}</div>
            ${line.taxPercent > 0 ? `<span style="font-size: 0.72rem; color: #10b981; font-weight: 600;">+ ${(line.taxPercent * 100).toFixed(0)}% Tax (${money(line.tax_amount)})</span>` : '<span style="font-size: 0.72rem; color: #64748b;">(Tax Exempt / 0%)</span>'}
          </td>
          <td style="text-align: right;">${money(line.rate)}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; align-items: center; gap: 4px; justify-content: flex-end;">
              <button type="button" class="btn-icon btn-qty-minus" data-idx="${idx}" style="padding: 2px; height: auto;">
                <span class="material-icons" style="font-size: 16px; color: var(--text-secondary);">remove</span>
              </button>
              <span style="font-weight: bold; min-width: 32px; text-align: center;">${parseFloat(line.quantity).toFixed(2)}</span>
              <button type="button" class="btn-icon btn-qty-plus" data-idx="${idx}" style="padding: 2px; height: auto;">
                <span class="material-icons" style="font-size: 16px; color: var(--text-secondary);">add</span>
              </button>
            </div>
          </td>
          <td style="text-align: right;">${money(line.item_amount)}</td>
          <td style="text-align: center;">
            <button type="button" class="btn-icon text-danger btn-remove-row" data-idx="${idx}" title="Remove line item">
              <span class="material-icons">delete</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    const isTaxExempt = document.getElementById('invoiceTaxExemptCheck')?.checked || false;
    const activeCurrency = document.getElementById('invoiceCurrencySelect')?.value || '₹';

    const finalTax = isTaxExempt ? 0 : tTax;
    const finalNet = tGross + finalTax;

    summaryGross.textContent = `${activeCurrency} ${tGross.toFixed(2)}`;
    summaryTax.textContent = `${activeCurrency} ${finalTax.toFixed(2)}`;
    summaryNet.textContent = `${activeCurrency} ${finalNet.toFixed(2)}`;
    if (salesLineCount) salesLineCount.textContent = `${invoiceLines.length} item${invoiceLines.length === 1 ? '' : 's'}`;

    document.querySelectorAll('.btn-remove-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        invoiceLines.splice(idx, 1);
        renderInvoiceLines();
      });
    });

    document.querySelectorAll('.btn-qty-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        const line = invoiceLines[idx];
        if (line.quantity > 1) {
          line.quantity -= 1;
          line.gross = line.rate * line.quantity;
          line.tax_amount = line.gross * line.taxPercent;
          line.item_amount = line.gross + line.tax_amount;
        } else {
          invoiceLines.splice(idx, 1);
        }
        renderInvoiceLines();
      });
    });

    document.querySelectorAll('.btn-qty-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        const line = invoiceLines[idx];
        line.quantity += 1;
        line.gross = line.rate * line.quantity;
        line.tax_amount = line.gross * line.taxPercent;
        line.item_amount = line.gross + line.tax_amount;
        renderInvoiceLines();
      });
    });

    document.getElementById('invoiceTaxExemptCheck')?.addEventListener('change', renderInvoiceLines);
    document.getElementById('invoiceCurrencySelect')?.addEventListener('change', renderInvoiceLines);
  };
  if (invoiceForm) {
    invoiceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (invoiceLines.length === 0) {
        alert('Please add at least one line item to save the bill.');
        return;
      }
      const customer_id = parseInt(invoiceCustomer.value);
      const sales_date = invoiceDate.value;
      const sales_bill_no = invoiceBillNo.textContent;
      const parseMoneyVal = (str) => {
        if (!str) return 0;
        const cleaned = str.toString().replace(/[^\d.-]/g, '');
        return parseFloat(cleaned) || 0;
      };
      const gross = parseMoneyVal(summaryGross.textContent);
      const tax = parseMoneyVal(summaryTax.textContent);
      const total = parseMoneyVal(summaryNet.textContent);
      const created_by = activeUser ? activeUser.username : 'System';
      const payment_method = document.getElementById('invoicePaymentMethod').value;

      const data = { customer_id, sales_date, sales_bill_no, gross, tax, total, created_by, payment_method, items: invoiceLines };

      try {
        const response = await authFetch(getApiUrl('/api/sales'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to save sales invoice.');
        }
        const result = await response.json();
        openPrintReceipt(result.sales_id);
        fetchInvoiceSetup();
      } catch (err) {
        if (!navigator.onLine || (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')))) {
          saveOfflineInvoice(data);
          showToast('Offline Mode', 'Invoice saved to offline queue. Will auto-sync when network reconnects!', 'warning');
          fetchInvoiceSetup();
        } else {
          alert(`Error: ${err.message}`);
        }
      }
    });

    document.getElementById('btnInvoiceClear').addEventListener('click', fetchInvoiceSetup);
  }

  // --- Offline Invoices Queue & Auto-Sync Engine ---
  const saveOfflineInvoice = (invoicePayload) => {
    try {
      const queue = JSON.parse(localStorage.getItem('pos_offline_invoices_queue') || '[]');
      invoicePayload.offline_timestamp = new Date().toISOString();
      queue.push(invoicePayload);
      localStorage.setItem('pos_offline_invoices_queue', JSON.stringify(queue));
    } catch (e) {
      console.error('Error saving offline invoice:', e);
    }
  };

  const syncOfflineInvoices = async () => {
    try {
      const queue = JSON.parse(localStorage.getItem('pos_offline_invoices_queue') || '[]');
      if (queue.length === 0) return;

      showToast('Network Restored', `Syncing ${queue.length} offline invoice(s)...`, 'info');
      let syncedCount = 0;
      const remainingQueue = [];

      for (const inv of queue) {
        try {
          const res = await authFetch(getApiUrl('/api/sales'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inv)
          });
          if (res.ok) {
            syncedCount++;
          } else {
            remainingQueue.push(inv);
          }
        } catch (err) {
          remainingQueue.push(inv);
        }
      }

      localStorage.setItem('pos_offline_invoices_queue', JSON.stringify(remainingQueue));
      if (syncedCount > 0) {
        showToast('Sync Complete', `Successfully auto-synced ${syncedCount} offline sales invoice(s)!`, 'success');
      }
    } catch (e) {
      console.error('Error auto-syncing offline invoices:', e);
    }
  };

  window.addEventListener('online', syncOfflineInvoices);
  setTimeout(syncOfflineInvoices, 3500);

  // Receipt modal loader and printer
  const receiptModal = document.getElementById('receiptModal');
  const printReceiptContent = document.getElementById('printReceiptContent');
  const receiptModalClose = document.getElementById('receiptModalClose');
  const btnReceiptClose = document.getElementById('btnReceiptClose');
  const btnReceiptPrint = document.getElementById('btnReceiptPrint');

  const openPrintReceipt = async (salesId) => {
    try {
      const response = await authFetch(getApiUrl(`/api/sales/${salesId}`));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch invoice details.');
        }
      const invoice = await response.json();

      const printReceiptContent = document.getElementById('printReceiptContent');
      if (printReceiptContent) {
        printReceiptContent.classList.remove('receipt-small', 'receipt-medium', 'receipt-large');
        const size = (activeUser && activeUser.printerSettings && activeUser.printerSettings.paper_size) || 'medium';
        printReceiptContent.classList.add(`receipt-${size}`);
      }

      document.getElementById('rCustName').textContent = invoice.customer_name || 'Walk-in Customer';
      const dateVal = new Date(invoice.sales_date);
      const dateStr = `${dateVal.getDate()}/${dateVal.getMonth()+1}/${dateVal.getFullYear()}`;
      document.getElementById('rDate').textContent = dateStr;
      document.getElementById('rBillNo').textContent = invoice.sales_bill_no;
      document.getElementById('rPaymentMethod').textContent = invoice.payment_method || 'Cash';
      
      const barNoEl = document.getElementById('rBarcodeNo');
      if (barNoEl) barNoEl.textContent = invoice.sales_bill_no;

      const itemsBody = document.getElementById('receiptItemsBody');
      itemsBody.innerHTML = invoice.items.map(item => `
        <tr>
          <td>${item.item_name}</td>
          <td style="text-align: right;">${parseFloat(item.quantity).toFixed(2)}</td>
          <td style="text-align: right;">₹${parseFloat(item.item_amount).toFixed(2)}</td>
        </tr>
      `).join('');

      document.getElementById('rGross').textContent = `₹${parseFloat(invoice.gross).toFixed(2)}`;
      document.getElementById('rTax').textContent = `₹${parseFloat(invoice.tax).toFixed(2)}`;
      document.getElementById('rNet').textContent = `₹${parseFloat(invoice.total).toFixed(2)}`;

      currentReceiptInvoice = invoice;
      if (receiptModal) receiptModal.style.display = 'flex';
    } catch (err) {
      alert(`Error loading receipt: ${err.message}`);
    }
  };

  let currentReceiptInvoice = null;
  const btnReceiptWhatsApp = document.getElementById('btnReceiptWhatsApp');
  const btnReceiptEmail = document.getElementById('btnReceiptEmail');

  if (btnReceiptWhatsApp) {
    btnReceiptWhatsApp.addEventListener('click', () => {
      if (!currentReceiptInvoice) return;
      const custName = currentReceiptInvoice.customer_name || 'Customer';
      const billNo = currentReceiptInvoice.sales_bill_no || '--';
      const total = parseFloat(currentReceiptInvoice.total || 0).toFixed(2);
      const text = encodeURIComponent(`Hello ${custName},\nThank you for shopping with Vanshee POS!\nYour Sales Invoice #${billNo} for ₹${total} has been generated.\nHave a great day!`);
      
      const phone = (currentReceiptInvoice.customer_phone || '').replace(/\D/g, '');
      const waUrl = phone ? `https://wa.me/91${phone}?text=${text}` : `https://wa.me/?text=${text}`;
      window.open(waUrl, '_blank');
    });
  }

  if (btnReceiptEmail) {
    btnReceiptEmail.addEventListener('click', () => {
      if (!currentReceiptInvoice) return;
      const custName = currentReceiptInvoice.customer_name || 'Customer';
      const billNo = currentReceiptInvoice.sales_bill_no || '--';
      const total = parseFloat(currentReceiptInvoice.total || 0).toFixed(2);
      const subject = encodeURIComponent(`Invoice #${billNo} - Vanshee POS`);
      const body = encodeURIComponent(`Dear ${custName},\n\nThank you for your transaction with Vanshee POS System.\nInvoice Number: ${billNo}\nTotal Amount Paid: ₹${total}\n\nThank you for your business!`);
      const email = currentReceiptInvoice.customer_email || '';
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    });
  }

  if (receiptModalClose) receiptModalClose.addEventListener('click', () => receiptModal.style.display = 'none');
  if (btnReceiptClose) btnReceiptClose.addEventListener('click', () => receiptModal.style.display = 'none');
  if (btnReceiptPrint) btnReceiptPrint.addEventListener('click', () => window.print());

  // Receipt listing page
  const receiptTableBody = document.getElementById('receiptTableBody');
  const btnRefreshReceipts = document.getElementById('btnRefreshReceipts');

  async function fetchReceipts() {
    try {
      const response = await authFetch(getApiUrl('/api/sales'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to load receipts.');
        }
      const list = await response.json();
      renderReceipts(list);
    } catch (err) {
      console.error(err);
    }
  };

  function renderReceipts(list) {
    if (list.length === 0) {
      receiptTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No receipts found.</td></tr>`;
      return;
    }
    receiptTableBody.innerHTML = list.map(r => {
      const dateVal = new Date(r.sales_date);
      const dateStr = `${dateVal.getDate()}/${dateVal.getMonth()+1}/${dateVal.getFullYear()}`;
      return `
        <tr>
          <td><strong>${r.sales_bill_no}</strong></td>
          <td>${r.customer_name || 'N/A'}</td>
          <td>${dateStr}</td>
          <td style="text-align: right;">₹${parseFloat(r.gross).toFixed(2)}</td>
          <td style="text-align: right;">₹${parseFloat(r.tax).toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold; color: var(--primary-color);">₹${parseFloat(r.total).toFixed(2)}</td>
          <td style="text-align: center;">
            <div class="table-actions" style="justify-content: center;">
              <button type="button" class="btn btn-secondary btn-view-receipt" data-id="${r.sales_id}" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;">View Bill</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.btn-view-receipt').forEach(btn => {
      btn.addEventListener('click', () => openPrintReceipt(btn.getAttribute('data-id')));
    });
  };

  if (btnRefreshReceipts) btnRefreshReceipts.addEventListener('click', fetchReceipts);

  // Settings permission matrix
  const permissionsTableBody = document.getElementById('permissionsTableBody');
  const btnSavePermissions = document.getElementById('btnSavePermissions');

  let matrixRoles = [];
  let matrixModules = [];
  let matrixPermissions = [];

  async function fetchPermissionMatrix() {
    if (!permissionsTableBody) return;
    try {
      const response = await authFetch(getApiUrl('/api/permissions'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to load permissions config.');
        }
      const data = await response.json();
      matrixRoles = data.roles;
      matrixModules = data.modules;
      matrixPermissions = data.permissions;
      renderPermissionMatrix();
    } catch (err) {
      console.error(err);
    }
  };

  function renderPermissionMatrix() {
    if (!permissionsTableBody) return;
    permissionsTableBody.innerHTML = matrixRoles.map(role => {
      const getCheckbox = (mId) => {
        const perm = matrixPermissions.find(p => p.role_id == role.role_id && p.module_id == mId);
        const checked = perm && perm.allowed == 1 ? 'checked' : '';
        const disabled = role.role_id == 1 ? 'disabled' : '';
        return `<input type="checkbox" class="perm-chk" data-role="${role.role_id}" data-module="${mId}" ${checked} ${disabled}>`;
      };
      return `
        <tr>
          <td><strong>${role.name}</strong></td>
          <td style="text-align: center;">${getCheckbox(1)}</td>
          <td style="text-align: center;">${getCheckbox(2)}</td>
          <td style="text-align: center;">${getCheckbox(3)}</td>
          <td style="text-align: center;">${getCheckbox(4)}</td>
          <td style="text-align: center;">${getCheckbox(5)}</td>
          <td style="text-align: center;">${getCheckbox(6)}</td>
        </tr>
      `;
    }).join('');
  };

  if (btnSavePermissions) {
    btnSavePermissions.addEventListener('click', async () => {
      const checkboxes = document.querySelectorAll('.perm-chk');
      const updates = [];
      checkboxes.forEach(chk => {
        if (!chk.disabled) {
          updates.push({
            role_id: parseInt(chk.getAttribute('data-role')),
            module_id: parseInt(chk.getAttribute('data-module')),
            allowed: chk.checked ? 1 : 0
          });
        }
      });

      try {
        const response = await authFetch(getApiUrl('/api/permissions'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to update permissions matrix.');
        }
        alert('Role permissions updated successfully!');
        await fetchPermissionsAndUsers();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  }

  // 🖨️ PRINTER CONFIGURATION SETTINGS
  const printerSettingsForm = document.getElementById('printerSettingsForm');

  async function fetchPrinterSettings() {
    if (!printerSettingsForm) return;
    try {
      const response = await authFetch(getApiUrl('/api/settings/printer'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to load printer settings.');
        }
      const settings = await response.json();

      document.getElementById('setting_printer_name').value = settings.printer_name || '';
      document.getElementById('setting_printer_type').value = settings.printer_type || 'thermal';
      document.getElementById('setting_paper_size').value = settings.paper_size || 'medium';
      document.getElementById('setting_connection').value = settings.connection || 'usb';
      document.getElementById('setting_ip_address').value = settings.ip_address || '';
      document.getElementById('setting_port').value = settings.port !== null ? settings.port : 9100;
      document.getElementById('setting_auto_print').checked = settings.auto_print === 1 || settings.auto_print === true;
      document.getElementById('setting_copies').value = settings.copies || 1;

      const titleInp = document.getElementById('setting_receipt_title');
      const subInp = document.getElementById('setting_receipt_subtitle');
      const footInp = document.getElementById('setting_receipt_footer');

      if (titleInp) titleInp.value = localStorage.getItem('pos_receipt_title') || settings.receipt_title || 'Vanshee POS';
      if (subInp) subInp.value = localStorage.getItem('pos_receipt_subtitle') || settings.receipt_subtitle || 'AHMEDABAD, GUJARAT, INDIA';
      if (footInp) footInp.value = localStorage.getItem('pos_receipt_footer') || settings.receipt_footer || 'THANK YOU! VISIT AGAIN.';
    } catch (err) {
      console.error('Error fetching printer settings:', err);
    }
  };

  if (printerSettingsForm) {
    printerSettingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const printer_name = document.getElementById('setting_printer_name').value.trim();
      const printer_type = document.getElementById('setting_printer_type').value;
      const paper_size = document.getElementById('setting_paper_size').value;
      const connection = document.getElementById('setting_connection').value;
      const ip_address = document.getElementById('setting_ip_address').value.trim();
      const port = parseInt(document.getElementById('setting_port').value) || 9100;
      const auto_print = document.getElementById('setting_auto_print').checked ? 1 : 0;
      const copies = parseInt(document.getElementById('setting_copies').value) || 1;

      const rTitle = document.getElementById('setting_receipt_title')?.value.trim() || 'Vanshee POS';
      const rSub = document.getElementById('setting_receipt_subtitle')?.value.trim() || 'AHMEDABAD, GUJARAT, INDIA';
      const rFoot = document.getElementById('setting_receipt_footer')?.value.trim() || 'THANK YOU! VISIT AGAIN.';

      localStorage.setItem('pos_receipt_title', rTitle);
      localStorage.setItem('pos_receipt_subtitle', rSub);
      localStorage.setItem('pos_receipt_footer', rFoot);

      const data = {
        printer_name,
        printer_type,
        paper_size,
        connection,
        ip_address: ip_address || null,
        port,
        auto_print,
        copies
      };

      try {
        const response = await authFetch(getApiUrl('/api/settings/printer'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to update printer settings.');
        }

        showToast('Printer Settings Saved', 'POS thermal printer configuration and receipt headers updated successfully!', 'success');
        
        if (activeUser) {
          activeUser.printerSettings = data;
          localStorage.setItem('pos_active_user', JSON.stringify(activeUser));
        }
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  }

  // Bind exit button
  const btnExit = document.getElementById('menuExit');
  if (btnExit) {
    btnExit.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset session and exit?')) {
        localStorage.removeItem('pos_active_user');
        checkAuthSession();
      }
    });
  }

  // Role Management Components [NEW]
  const roleForm = document.getElementById('roleForm');
  const roleTableBody = document.getElementById('roleTableBody');
  const roleIdInput = document.getElementById('role_id');
  const roleSubmitBtn = document.getElementById('btnRoleSave');

  const roleModal = document.getElementById('roleModal');
  const btnNewRole = document.getElementById('btnNewRole');
  const btnRefreshRoles = document.getElementById('btnRefreshRoles');
  const roleModalClose = document.getElementById('roleModalClose');
  const btnRoleCancel = document.getElementById('btnRoleCancel');

  // allRoles hoisted to top

  async function fetchRoles() {
    try {
      const response = await authFetch(getApiUrl('/api/roles'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch roles');
        }
      allRoles = await response.json();
      renderRoles(allRoles);
    } catch (err) {
      console.error(err);
    }
  };

  function renderRoles(list) {
    if (list.length === 0) {
      roleTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">No roles registered yet.</td>
        </tr>
      `;
      return;
    }

    roleTableBody.innerHTML = list.map(r => {
      const statusText = r.active ? 'Active' : 'Inactive';
      const statusClass = r.active ? 'status-active' : 'status-inactive';
      const createdDate = r.created_date ? new Date(r.created_date).toLocaleDateString() : 'N/A';

      return `
        <tr>
          <td>${r.role_id}</td>
          <td>${r.name}</td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          <td>${createdDate}</td>
          <td>
            <div class="action-buttons">
              <button type="button" class="btn-icon btn-edit-role" data-id="${r.role_id}" title="Edit Role">
                <span class="material-icons">edit</span>
              </button>
              <button type="button" class="btn-icon btn-delete-role" data-id="${r.role_id}" title="Delete Role">
                <span class="material-icons">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  if (roleTableBody) {
    roleTableBody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.btn-edit-role');
      const deleteBtn = e.target.closest('.btn-delete-role');

      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        editRole(id);
      } else if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        deleteRole(id);
      }
    });
  }

  const editRole = (id) => {
    const r = allRoles.find(item => item.role_id == id);
    if (!r) return;

    roleIdInput.value = r.role_id;
    document.getElementById('role_name').value = r.name || '';
    document.getElementById('role_active').checked = !!r.active;

    const formTitle = document.querySelector('#roleModal .form-section h2');
    if (formTitle) {
      formTitle.textContent = 'Edit Role Details';
    }

    roleSubmitBtn.textContent = 'Update Role';

    if (roleModal) {
      roleModal.style.display = 'flex';
    }
  };

  const deleteRole = async (id) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      const response = await authFetch(getApiUrl(`/api/roles/${id}`), {
        method: 'DELETE'
      });

      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to delete role');
        }

      alert('Role deleted successfully!');
      if (roleIdInput.value === id) {
        closeRoleModal();
      }
      fetchRoles();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const resetRoleFormState = () => {
    roleIdInput.value = '';
    roleSubmitBtn.textContent = 'Save Role';

    const formTitle = document.querySelector('#roleModal .form-section h2');
    if (formTitle) {
      formTitle.textContent = 'Register New Role';
    }
    
    document.getElementById('role_active').checked = true;
  };

  const closeRoleModal = () => {
    if (roleModal) {
      roleModal.style.display = 'none';
    }
    roleForm.reset();
  };

  if (btnNewRole) {
    btnNewRole.addEventListener('click', () => {
      roleForm.reset();
      if (roleModal) {
        roleModal.style.display = 'flex';
      }
    });
  }

  if (btnRefreshRoles) {
    btnRefreshRoles.addEventListener('click', () => {
      fetchRoles();
    });
  }

  if (roleModalClose) {
    roleModalClose.addEventListener('click', closeRoleModal);
  }

  if (btnRoleCancel) {
    btnRoleCancel.addEventListener('click', closeRoleModal);
  }

  window.addEventListener('click', (e) => {
    if (e.target === roleModal) {
      closeRoleModal();
    }
  });

  if (roleForm) {
    roleForm.addEventListener('reset', () => {
      resetRoleFormState();
    });

    roleForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = roleIdInput.value;
      const name = document.getElementById('role_name').value;
      const active = document.getElementById('role_active').checked;

      const data = {
        name,
        active,
        created_by: activeUser ? activeUser.username : 'System'
      };

      const url = id ? getApiUrl(`/api/roles/${id}`) : getApiUrl('/api/roles');
      const method = id ? 'PUT' : 'POST';

      try {
        const response = await fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to ${id ? 'update' : 'register'} role`);
        }

        alert(`Role ${id ? 'updated' : 'registered'} successfully!`);
        closeRoleModal();
        fetchRoles();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🏢 CLIENTS MANAGEMENT (TENANTS)
  // ─────────────────────────────────────────────────────────────────────────
  const clientTableBody = document.getElementById('clientTableBody');
  const clientForm = document.getElementById('clientForm');
  const clientIdInput = document.getElementById('client_id');
  const clientSubmitBtn = document.getElementById('btnClientSave');

  const clientModal = document.getElementById('clientModal');
  const btnNewClient = document.getElementById('btnNewClient');
  const btnRefreshClients = document.getElementById('btnRefreshClients');
  const clientModalClose = document.getElementById('clientModalClose');
  const btnClientCancel = document.getElementById('btnClientCancel');

  

  async function fetchClients() {
    try {
      const response = await authFetch(getApiUrl('/api/clients'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch clients');
        }
      allClients = await response.json();
      renderClients(allClients);
      populateClientDropdown();
    } catch (err) {
      console.error(err);
    }
  };

  const populateClientDropdown = () => {
    const userClientSelect = document.getElementById('user_client_id');
    if (userClientSelect) {
      userClientSelect.innerHTML = '<option value="">Super Admin (All Clients)</option>' +
        allClients.map(c => `<option value="${c.client_id}">${c.name}</option>`).join('');
    }
    configureUserFormState();
  };

  function renderClients(list) {
    if (!clientTableBody) return;
    if (list.length === 0) {
      clientTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">No clients registered yet.</td>
        </tr>
      `;
      return;
    }

    clientTableBody.innerHTML = list.map(c => {
      const statusText = c.active ? 'Active' : 'Inactive';
      const statusClass = c.active ? 'status-active' : 'status-inactive';
      const contactInfo = `
        <div><strong>Phone:</strong> ${c.phone || 'N/A'}</div>
        <div><strong>Email:</strong> ${c.email || 'N/A'}</div>
      `;

      return `
        <tr>
          <td>${c.client_id}</td>
          <td>
            <strong>${c.name}</strong>
            ${c.admin_username ? `<br><span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">👤 Admin: <strong>${c.admin_username}</strong></span>` : ''}
            ${c.logo_url ? `<br><img src="${c.logo_url}" onerror="this.style.display=\'none\';" style="height:24px; max-width:80px; margin-top:4px; object-fit:contain;">` : ''}
          </td>
          <td>${contactInfo}</td>
          <td>${c.gst_no || 'N/A'}</td>
          <td>${c.address || 'N/A'}</td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          <td>
            <button type="button" class="btn-icon btn-edit-client" data-id="${c.client_id}" title="Edit Client">
              <span class="material-icons">edit</span>
            </button>
            <button type="button" class="btn-icon btn-delete-client" data-id="${c.client_id}" title="Deactivate Client">
              <span class="material-icons">delete</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click listeners to Edit and Delete buttons inside clients list
    document.querySelectorAll('.btn-edit-client').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openEditClientModal(id);
      });
    });

    document.querySelectorAll('.btn-delete-client').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to deactivate this client?')) {
          try {
            const res = await authFetch(getApiUrl(`/api/clients/${id}`), { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to deactivate client');
            showToast('Client Deactivated', 'The client was successfully deactivated.', 'success');
            fetchClients();
          } catch (err) {
            showToast('Error', err.message, 'danger');
          }
        }
      });
    });
  };

  const closeClientModal = () => {
    if (clientModal) {
      clientModal.style.display = 'none';
    }
  };

  async function openEditClientModal(id) {
    const client = allClients.find(c => c.client_id == id);
    if (!client) return;

    clientIdInput.value = client.client_id;
    document.getElementById('client_name').value = client.name || '';
    document.getElementById('client_gst_no').value = client.gst_no || '';
    document.getElementById('client_phone').value = client.phone || '';
    document.getElementById('client_email').value = client.email || '';
    document.getElementById('client_logo_url').value = client.logo_url || '';
    document.getElementById('client_address').value = client.address || '';

    // Fetch and check module assignments for this client
    try {
      const response = await authFetch(getApiUrl(`/api/clients/${id}/modules`));
      if (response.ok) {
        const modules = await response.json();
        const activeIds = modules.map(m => m.group_id);
        document.getElementById('client_mod_kirana').checked = activeIds.includes(1);
        document.getElementById('client_mod_restaurant').checked = activeIds.includes(2);
        document.getElementById('client_mod_hotel').checked = activeIds.includes(3);
      }
    } catch (err) {
      console.error('Error fetching client modules:', err);
    }

    document.getElementById('client_admin_credentials_section').style.display = 'none';
    document.getElementById('client_admin_username').value = '';
    document.getElementById('client_admin_password').value = '';

    if (clientModal) {
      clientModal.querySelector('h2').textContent = 'Edit Client Company';
      clientModal.style.display = 'flex';
    }
  };

  if (btnNewClient) {
    btnNewClient.addEventListener('click', () => {
      clientForm.reset();
      clientIdInput.value = '';
      document.getElementById('client_admin_credentials_section').style.display = 'grid';
      document.getElementById('client_admin_username').value = '';
      document.getElementById('client_admin_password').value = '';
      document.getElementById('client_mod_kirana').checked = true;
      document.getElementById('client_mod_restaurant').checked = false;
      document.getElementById('client_mod_hotel').checked = false;
      if (clientModal) {
        clientModal.querySelector('h2').textContent = 'Register New Client';
        clientModal.style.display = 'flex';
      }
    });
  }

  if (btnRefreshClients) {
    btnRefreshClients.addEventListener('click', () => {
      fetchClients();
    });
  }

  if (clientModalClose) clientModalClose.addEventListener('click', closeClientModal);
  if (btnClientCancel) btnClientCancel.addEventListener('click', closeClientModal);

  window.addEventListener('click', (e) => {
    if (e.target === clientModal) {
      closeClientModal();
    }
  });

  if (clientForm) {
    clientForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = clientIdInput.value;
      const name = document.getElementById('client_name').value.trim();
      const gst_no = document.getElementById('client_gst_no').value.trim();
      const phone = document.getElementById('client_phone').value.trim();
      const email = document.getElementById('client_email').value.trim();
      const logo_url = document.getElementById('client_logo_url').value.trim();
      const address = document.getElementById('client_address').value.trim();

      if (!name) {
        alert('Company name is required');
        return;
      }

      const clientData = { name, gst_no, phone, email, logo_url, address, active: 1 };

      if (!id) {
        const admin_username = document.getElementById('client_admin_username').value.trim();
        const admin_password = document.getElementById('client_admin_password').value;
        if (!admin_username || !admin_password) {
          alert('Admin Username and Password are required to register a company.');
          return;
        }
        clientData.admin_username = admin_username;
        clientData.admin_password = admin_password;
      }
      const url = id ? getApiUrl(`/api/clients/${id}`) : getApiUrl('/api/clients');
      const method = id ? 'PUT' : 'POST';

      try {
        const response = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientData)
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to save client');
        }

        const resData = await response.json();
        const clientId = id || resData.client_id;

        // Save module subscription assignments
        const groupIds = [];
        if (document.getElementById('client_mod_kirana').checked) groupIds.push(1);
        if (document.getElementById('client_mod_restaurant').checked) groupIds.push(2);
        if (document.getElementById('client_mod_hotel').checked) groupIds.push(3);

        const modulesResponse = await authFetch(getApiUrl(`/api/clients/${clientId}/modules`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupIds })
        });

        if (!modulesResponse.ok) {
          throw new Error('Client saved, but module subscription mapping failed.');
        }

        showToast('Client Saved', `Client ${name} saved successfully!`, 'success');
        closeClientModal();
        fetchClients();

        // If updating the active user's own client, we reload sidebar module view dynamically
        if (activeUser && activeUser.client_id == clientId) {
          const modRes = await authFetch(getApiUrl(`/api/clients/${clientId}/modules`));
          if (modRes.ok) {
            const modules = await modRes.json();
            activeUser.clientModules = modules.map(m => m.name);
            localStorage.setItem('pos_active_user', JSON.stringify(activeUser));
            applyNavigationPermissions();
          }
        }
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
  }

  // Session & Authentication Overlay Controllers [NEW]
  const loginOverlay = document.getElementById('loginOverlay');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const loginTitle = document.getElementById('loginTitle');
  const linkGoToSignup = document.getElementById('linkGoToSignup');
  const linkGoToLogin = document.getElementById('linkGoToLogin');
  const btnLogout = document.getElementById('btnLogout');
  const loggedInUsername = document.getElementById('loggedInUsername');

  const checkAuthSession = () => {
    const storedUser = localStorage.getItem('pos_active_user');
    const lockoutOverlay = document.getElementById('licenseLockoutOverlay');
    const amcBanner = document.getElementById('amcWarningBanner');

    if (storedUser) {
      try {
        activeUser = JSON.parse(storedUser);
      } catch (e) {
        console.error('Error parsing stored user session:', e);
        localStorage.removeItem('pos_active_user');
        localStorage.removeItem('pos_auth_token');
        activeUser = null;
        if (loginOverlay) loginOverlay.style.display = 'flex';
        return;
      }
      
      // Enforce license validation if present
      if (activeUser && activeUser.license) {
        const lic = activeUser.license;
        if (lic.status === 'Expired' || lic.status === 'Suspended') {
          if (lockoutOverlay) {
            lockoutOverlay.style.display = 'flex';
            const nameEl = document.getElementById('lockoutClientName');
            const keyEl = document.getElementById('lockoutLicenseKey');
            const dateEl = document.getElementById('lockoutExpiryDate');
            if (nameEl) nameEl.textContent = activeUser.client_name || 'Client Company';
            if (keyEl) keyEl.textContent = lic.license_key || 'N/A';
            if (dateEl) dateEl.textContent = lic.valid_to ? new Date(lic.valid_to).toLocaleDateString() : 'N/A';
          }
          if (amcBanner) amcBanner.style.display = 'none';
        } else {
          if (lockoutOverlay) lockoutOverlay.style.display = 'none';
          if (lic.status === 'AMC Expired') {
            if (amcBanner) amcBanner.style.display = 'flex';
          } else {
            if (amcBanner) amcBanner.style.display = 'none';
          }
        }
      } else {
        if (lockoutOverlay) lockoutOverlay.style.display = 'none';
        if (amcBanner) amcBanner.style.display = 'none';
      }

      if (loginOverlay) loginOverlay.style.display = 'none';
      if (loggedInUsername) loggedInUsername.textContent = (activeUser && activeUser.username) ? activeUser.username : 'User';
      
      // Load app stats and data safely
      fetchPermissionsAndUsers().catch(e => console.warn('Permissions fetch warning:', e));
      fetchDashboardStats().catch(e => console.warn('Dashboard stats warning:', e));
      fetchUsers().catch(e => console.warn('Users fetch warning:', e));
      fetchLicenseDetails().catch(e => console.warn('License details warning:', e));
      if (typeof initRestaurantSSE === 'function') initRestaurantSSE();
      switchScreen('dashboard');
    } else {
      activeUser = null;
      if (lockoutOverlay) lockoutOverlay.style.display = 'none';
      if (amcBanner) amcBanner.style.display = 'none';
      if (loginOverlay) loginOverlay.style.display = 'flex';
      if (loggedInUsername) loggedInUsername.textContent = 'Guest';
    }
  };

  // Bind lockout logout button
  const lockoutLogoutBtn = document.getElementById('lockoutLogoutBtn');
  if (lockoutLogoutBtn) {
    lockoutLogoutBtn.addEventListener('click', () => {
      localStorage.removeItem('pos_active_user');
      localStorage.removeItem('pos_auth_token');
      const lockoutOverlay = document.getElementById('licenseLockoutOverlay');
      if (lockoutOverlay) lockoutOverlay.style.display = 'none';
      checkAuthSession();
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      const errorBanner = document.getElementById('loginErrorBanner');
      const submitBtn = document.getElementById('loginSubmitBtn');

      // Hide previous errors, show loading state
      if (errorBanner) { errorBanner.style.display = 'none'; errorBanner.textContent = ''; }
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Signing in…'; }

      const showLoginError = (msg) => {
        if (errorBanner) {
          errorBanner.textContent = msg;
          errorBanner.style.display = 'block';
        }
        showToast('Login Failed', msg, 'danger');
        AudioSynth.playError();
      };

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout for cloud cold starts

        const response = await authFetch(getApiUrl('/api/users/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Invalid credentials');
        }
        const data = await response.json();
        localStorage.setItem('pos_active_user', JSON.stringify(data.user));
        localStorage.setItem('pos_auth_token', data.token);
        if (errorBanner) errorBanner.style.display = 'none';
        showToast('Login Successful', `Welcome back, ${username}!`, 'success');
        AudioSynth.playSuccess();
        checkAuthSession();
      } catch (err) {
        if (err.name === 'AbortError') {
          showLoginError('Connection timed out. The server may be starting up — please wait 30 seconds and try again.');
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('Load failed')) {
          showLoginError('Cannot reach the server. Check your internet connection or try again in a moment.');
        } else {
          showLoginError(err.message || 'Invalid username or password.');
        }
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Login'; }
      }
    });
  }




  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('pos_active_user');
        localStorage.removeItem('pos_auth_token');
        checkAuthSession();
      }
    });
  }

  // Purchase Management Inwards Controllers
  const purchaseForm = document.getElementById('purchaseForm');
  const purchaseVendor = document.getElementById('purchaseVendor');
  const purchaseVendorPhone = document.getElementById('purchaseVendorPhone');
  const purchaseDate = document.getElementById('purchaseDate');
  const purchaseBillNo = document.getElementById('purchaseBillNo');
  const purchaseTableBody = document.getElementById('purchaseTableBody');
  
  const purchaseAdderItem = document.getElementById('purchaseAdderItem');
  const purchaseAdderRate = document.getElementById('purchaseAdderRate');
  const purchaseAdderQty = document.getElementById('purchaseAdderQty');
  const purchaseAdderTaxName = document.getElementById('purchaseAdderTaxName');
  const btnPurchaseAdderAdd = document.getElementById('btnPurchaseAdderAdd');

  const purchaseSummaryGross = document.getElementById('purchaseSummaryGross');
  const purchaseSummaryTax = document.getElementById('purchaseSummaryTax');
  const purchaseSummaryNet = document.getElementById('purchaseSummaryNet');
  const purchaseItemSearch = document.getElementById('purchaseItemSearch');
  const purchaseCodeSearch = document.getElementById('purchaseCodeSearch');
  const purchaseProductGrid = document.getElementById('purchaseProductGrid');
  const purchaseCategoryButtons = document.getElementById('purchaseCategoryButtons');
  const purchaseLineCount = document.getElementById('purchaseLineCount');

  let purchaseLines = [];
  let availableVendors = [];
  let purchaseBillCount = 1;
  let selectedPurchaseCategory = 'all';

  async function fetchPurchaseSetup() {
    if (!purchaseDate || !purchaseVendor || !purchaseBillNo) return;
    try {
      purchaseDate.value = new Date().toISOString().split('T')[0];
      
      const vendorRes = await authFetch(getApiUrl('/api/vendors'));
      availableVendors = vendorRes.ok ? await vendorRes.json() : [];
      purchaseVendor.innerHTML = '<option value="">Choose Supplier</option>' + 
        availableVendors.map(v => `<option value="${v.vendor_id}">${v.first_name} ${v.last_name} (${v.company || 'Individual'})</option>`).join('');

      const itemsRes = await authFetch(getApiUrl('/api/items'));
      availableItems = itemsRes.ok ? (await itemsRes.json()).filter(item => item.visible !== 0 && item.visible !== "0" && item.visible !== false && item.active !== 0 && item.active !== "0" && item.active !== false) : [];
      if (purchaseAdderItem) {
        purchaseAdderItem.innerHTML = '<option value="">Select Item</option>' + 
          availableItems.map(i => `<option value="${i.item_id}">${i.name}</option>`).join('');
      }
      renderPurchaseCategories();
      renderPurchaseCatalog();

      const taxesRes = await authFetch(getApiUrl('/api/taxes'));
      availableTaxes = taxesRes.ok ? await taxesRes.json() : [];

      const purchaseRes = await authFetch(getApiUrl('/api/purchase'));
      const purchases = purchaseRes.ok ? await purchaseRes.json() : [];
      purchaseBillCount = purchases.length + 1;
      purchaseBillNo.textContent = purchaseBillCount;

      purchaseLines = [];
      renderPurchaseLines();
    } catch (err) {
      console.error(err);
    }
  };

  if (purchaseAdderItem) {
    purchaseAdderItem.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      if (!selectedId) {
        purchaseAdderRate.value = '';
        purchaseAdderTaxName.value = '';
        return;
      }
      const item = availableItems.find(i => i.item_id == selectedId);
      if (item) {
        purchaseAdderRate.value = parseFloat(item.purchase_price || 0).toFixed(2);
        const tax = availableTaxes.find(t => t.tax_id == item.tax_id);
        purchaseAdderTaxName.value = tax ? tax.name : 'No Tax (0%)';
      }
    });
  }

  if (purchaseVendor && purchaseVendorPhone) {
    purchaseVendor.addEventListener('change', () => {
      const vendor = availableVendors.find(v => v.vendor_id == purchaseVendor.value);
      purchaseVendorPhone.value = vendor ? (vendor.phone_1 || '') : '';
    });
  }

  const addPurchaseItemLine = (item, qtyOverride = null, rateOverride = null) => {
    if (!item) return;
    const rate = parseFloat(rateOverride ?? item.purchase_price ?? 0);
    const qty = parseFloat(qtyOverride ?? purchaseAdderQty?.value ?? 1);
    
    if (isNaN(rate) || isNaN(qty) || qty <= 0) {
      alert('Please choose a valid item and quantity.');
      return;
    }

    let taxRate = 0;
    if (item.tax_rate !== undefined && item.tax_rate !== null && item.tax_rate !== '') {
      taxRate = parseFloat(item.tax_rate);
    } else if (item.tax_percentage !== undefined && item.tax_percentage !== null && item.tax_percentage !== '') {
      taxRate = parseFloat(item.tax_percentage);
    } else if (item.tax_id) {
      const taxObj = availableTaxes.find(t => t.tax_id == item.tax_id || t.id == item.tax_id);
      if (taxObj) taxRate = parseFloat(taxObj.percentage || taxObj.rate || 0);
    }
    let taxPercent = taxRate / 100;

    const gross = rate * qty;
    const taxAmt = gross * taxPercent;
    const net = gross + taxAmt;

    const existingIdx = purchaseLines.findIndex(line => line.item_id == item.item_id);
    if (existingIdx !== -1) {
      purchaseLines[existingIdx].quantity += qty;
      purchaseLines[existingIdx].gross = purchaseLines[existingIdx].rate * purchaseLines[existingIdx].quantity;
      purchaseLines[existingIdx].tax_amount = purchaseLines[existingIdx].gross * taxPercent;
      purchaseLines[existingIdx].item_amount = purchaseLines[existingIdx].gross + purchaseLines[existingIdx].tax_amount;
    } else {
      purchaseLines.push({
        item_id: item.item_id,
        name: item.name,
        rate,
        quantity: qty,
        taxPercent,
        gross,
        tax_amount: taxAmt,
        item_amount: net
      });
    }

    if (purchaseAdderItem) purchaseAdderItem.value = '';
    if (purchaseAdderRate) purchaseAdderRate.value = '';
    if (purchaseAdderQty) purchaseAdderQty.value = '1.00';
    if (purchaseAdderTaxName) purchaseAdderTaxName.value = '';
    renderPurchaseLines();
  };

  if (btnPurchaseAdderAdd) {
    btnPurchaseAdderAdd.addEventListener('click', () => {
      const item = availableItems.find(i => i.item_id == purchaseAdderItem.value);
      addPurchaseItemLine(item, purchaseAdderQty.value, purchaseAdderRate.value);
    });
  }

  function renderPurchaseCategories() {
    if (!purchaseCategoryButtons) return;
    const categoryMap = new Map();
    availableItems.forEach(item => {
      if (item.category_id) {
        categoryMap.set(item.category_id, item.category_name || 'Other');
      }
    });

    purchaseCategoryButtons.innerHTML = Array.from(categoryMap.entries()).map(([id, name]) => (
      `<button type="button" class="pos-category" data-category="${id}">${name}</button>`
    )).join('');
  };

  const getFilteredPurchaseItems = () => {
    const nameNeedle = (purchaseItemSearch?.value || '').trim().toLowerCase();
    const codeNeedle = (purchaseCodeSearch?.value || '').trim().toLowerCase();
    return availableItems.filter(item => {
      const matchesCategory = selectedPurchaseCategory === 'all' || String(item.category_id || '') === String(selectedPurchaseCategory);
      const matchesName = !nameNeedle || (item.name || '').toLowerCase().includes(nameNeedle);
      const matchesCode = !codeNeedle || (item.code || '').toLowerCase().includes(codeNeedle);
      return matchesCategory && matchesName && matchesCode;
    });
  };

  function renderPurchaseCatalog() {
    if (!purchaseProductGrid) return;
    const filtered = getFilteredPurchaseItems();
    if (!filtered.length) {
      purchaseProductGrid.innerHTML = '<div class="empty-state pos-grid-empty">No matching items found.</div>';
      return;
    }

    purchaseProductGrid.innerHTML = filtered.map(item => {
      const imageSrc = getItemImageSrc(item, 'web');
      return `
        <button type="button" class="pos-product-card" data-id="${item.item_id}" style="display:flex; flex-direction:column; align-items:center; background:var(--card-bg); border:1px solid var(--border-color); border-radius:12px; padding:0.75rem; transition:transform 0.2s, box-shadow 0.2s; cursor:pointer;">
          <div class="pos-product-image" style="width:100%; height:90px; border-radius:8px; overflow:hidden; background:#1e293b; display:flex; align-items:center; justify-content:center;">
            <img src="${imageSrc}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300';" alt="${item.name || 'Item image'}" style="width:100%; height:100%; object-fit:cover;">
          </div>
          <strong style="margin-top:0.5rem; font-size:0.88rem; color:var(--text-main); font-weight:700; text-align:center;">${item.name || 'Unnamed Item'}</strong>
          <span style="font-size:0.8rem; color:#10b981; font-weight:700; margin-top:0.25rem;">Cost: ${money(item.purchase_price)} / ${item.unit_name || 'unit'}</span>
        </button>
      `;
    }).join('');

    purchaseProductGrid.querySelectorAll('.pos-product-card').forEach(card => {
      card.addEventListener('click', () => {
        AudioSynth.beep(880, 0.05, 'sine');
        const item = availableItems.find(i => i.item_id == card.getAttribute('data-id'));
        addPurchaseItemLine(item, purchaseAdderQty.value);
      });
    });
  };

  [purchaseItemSearch, purchaseCodeSearch].forEach(input => {
    if (input) input.addEventListener('input', renderPurchaseCatalog);
  });

  const purchaseCategoryPanel = document.querySelector('#screenPurchase .pos-category-panel');
  if (purchaseCategoryPanel) {
    purchaseCategoryPanel.addEventListener('click', (event) => {
      const button = event.target.closest('.pos-category');
      if (!button) return;
      selectedPurchaseCategory = button.getAttribute('data-category') || 'all';
      purchaseCategoryPanel.querySelectorAll('.pos-category').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      renderPurchaseCatalog();
    });
  }

  function renderPurchaseLines() {
    if (!purchaseTableBody || !purchaseSummaryGross || !purchaseSummaryTax || !purchaseSummaryNet) return;
    if (purchaseLines.length === 0) {
      purchaseTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No items added to purchase order yet.</td></tr>`;
      purchaseSummaryGross.textContent = money(0);
      purchaseSummaryTax.textContent = money(0);
      purchaseSummaryNet.textContent = money(0);
      if (purchaseLineCount) purchaseLineCount.textContent = '0 items';
      return;
    }

    let tGross = 0;
    let tTax = 0;
    let tNet = 0;

    purchaseTableBody.innerHTML = purchaseLines.map((line, idx) => {
      tGross += line.gross;
      tTax += line.tax_amount;
      tNet += line.item_amount;
      return `
        <tr>
          <td>
            <div style="font-weight: 700;">${line.name}</div>
            ${line.taxPercent > 0 ? `<span style="font-size: 0.72rem; color: #10b981; font-weight: 600;">+ ${(line.taxPercent * 100).toFixed(0)}% Tax (${money(line.tax_amount)})</span>` : '<span style="font-size: 0.72rem; color: #64748b;">(Tax Exempt / 0%)</span>'}
          </td>
          <td style="text-align: right;">${money(line.rate)}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; align-items: center; gap: 4px; justify-content: flex-end;">
              <button type="button" class="btn-icon btn-purchase-qty-minus" data-idx="${idx}" style="padding: 2px; height: auto;">
                <span class="material-icons" style="font-size: 16px; color: var(--text-secondary);">remove</span>
              </button>
              <span style="font-weight: bold; min-width: 32px; text-align: center;">${parseFloat(line.quantity).toFixed(2)}</span>
              <button type="button" class="btn-icon btn-purchase-qty-plus" data-idx="${idx}" style="padding: 2px; height: auto;">
                <span class="material-icons" style="font-size: 16px; color: var(--text-secondary);">add</span>
              </button>
            </div>
          </td>
          <td style="text-align: right;">${money(line.item_amount)}</td>
          <td style="text-align: center;">
            <button type="button" class="btn-icon text-danger btn-purchase-remove-row" data-idx="${idx}" title="Remove line item">
              <span class="material-icons">delete</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    purchaseSummaryGross.textContent = money(tGross);
    purchaseSummaryTax.textContent = money(tTax);
    purchaseSummaryNet.textContent = money(tNet);
    if (purchaseLineCount) purchaseLineCount.textContent = `${purchaseLines.length} item${purchaseLines.length === 1 ? '' : 's'}`;

    document.querySelectorAll('.btn-purchase-remove-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        purchaseLines.splice(idx, 1);
        renderPurchaseLines();
      });
    });

    document.querySelectorAll('.btn-purchase-qty-minus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        const line = purchaseLines[idx];
        if (line.quantity > 1) {
          line.quantity -= 1;
          line.gross = line.rate * line.quantity;
          line.tax_amount = line.gross * line.taxPercent;
          line.item_amount = line.gross + line.tax_amount;
        } else {
          purchaseLines.splice(idx, 1);
        }
        renderPurchaseLines();
      });
    });

    document.querySelectorAll('.btn-purchase-qty-plus').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        const line = purchaseLines[idx];
        line.quantity += 1;
        line.gross = line.rate * line.quantity;
        line.tax_amount = line.gross * line.taxPercent;
        line.item_amount = line.gross + line.tax_amount;
        renderPurchaseLines();
      });
    });
  };
  if (purchaseForm) {
    purchaseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (purchaseLines.length === 0) {
        alert('Please add at least one line item to save the inward cost.');
        return;
      }
      const vendor_id = parseInt(purchaseVendor.value);
      const purchase_date = purchaseDate.value;
      const purchase_bill_no = purchaseBillNo.textContent;
      const gross = parseFloat(purchaseSummaryGross.textContent.replace('Rs.', ''));
      const tax = parseFloat(purchaseSummaryTax.textContent.replace('Rs.', ''));
      const total = parseFloat(purchaseSummaryNet.textContent.replace('Rs.', ''));
      const created_by = activeUser ? activeUser.username : 'System';

      const data = { vendor_id, purchase_date, purchase_bill_no, gross, tax, total, created_by, items: purchaseLines };

      try {
        const response = await authFetch(getApiUrl('/api/purchase'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to save purchase inward.');
        }
        alert('Purchase inward recorded successfully!');
        fetchPurchaseSetup();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });

    document.getElementById('btnPurchaseClear').addEventListener('click', fetchPurchaseSetup);
  }

  screens['purchase'].onTransition = () => fetchPurchaseSetup();

  // --- Theme Customization & Accent Color Selection ---
  const applyTheme = (theme, accent) => {
    document.body.setAttribute('data-theme', theme || 'light');
    document.body.setAttribute('data-accent', accent || 'blue');
    
    // Update dropdown selection values
    const themeSelectEl = document.getElementById('themeSelect');
    if (themeSelectEl) {
      themeSelectEl.value = theme || 'light';
    }
    const accentSelectEl = document.getElementById('accentSelect');
    if (accentSelectEl) {
      accentSelectEl.value = accent || 'blue';
    }
  };

  let currentTheme = localStorage.getItem('pos_theme') || 'light';
  let currentAccent = localStorage.getItem('pos_accent') || 'blue';
  applyTheme(currentTheme, currentAccent);

  // Dropdown change handlers
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      currentTheme = e.target.value;
      localStorage.setItem('pos_theme', currentTheme);
      applyTheme(currentTheme, currentAccent);
    });
  }

  const accentSelect = document.getElementById('accentSelect');
  if (accentSelect) {
    accentSelect.addEventListener('change', (e) => {
      currentAccent = e.target.value;
      localStorage.setItem('pos_accent', currentAccent);
      applyTheme(currentTheme, currentAccent);
    });
  }

  // --- Reports & Analytics Controller ---
  const reportValSales = document.getElementById('reportValSales');
  const reportCountSales = document.getElementById('reportCountSales');
  const reportValPurchases = document.getElementById('reportValPurchases');
  const reportCountPurchases = document.getElementById('reportCountPurchases');
  const reportValMargin = document.getElementById('reportValMargin');
  const reportTypeSelect = document.getElementById('reportTypeSelect');
  const btnGenerateReport = document.getElementById('btnGenerateReport');
  const btnPrintReport = document.getElementById('btnPrintReport');
  const btnExportCSV = document.getElementById('btnExportCSV');
  const reportsFiltersContainer = document.getElementById('reportFiltersContainer');
  const reportsResultHeader = document.getElementById('reportResultHeader');
  const reportsResultBody = document.getElementById('reportResultBody');
  const reportsRowCount = document.getElementById('reportRowCount');
  const reportsTableTitle = document.getElementById('reportTableTitle');
  const reportsChartsPanel = document.getElementById('reportChartsPanel');
  const reportChart1Title = document.getElementById('reportChart1Title');
  const reportChart2Title = document.getElementById('reportChart2Title');

  let reportsCategories = [];
  let reportsItems = [];
  let reportsCustomers = [];
  let reportsVendors = [];
  let reportsUsers = [];

  let chartSalesPurchasesObj = null;
  let chartCategorySalesObj = null;
  let chartCFWaterfallObj = null;
  let chartCFPieObj = null;
  let chartCFBarObj = null;

  const destroyCharts = () => {
    if (chartSalesPurchasesObj) {
      chartSalesPurchasesObj.destroy();
      chartSalesPurchasesObj = null;
    }
    if (chartCategorySalesObj) {
      chartCategorySalesObj.destroy();
      chartCategorySalesObj = null;
    }
    if (chartCFWaterfallObj) {
      chartCFWaterfallObj.destroy();
      chartCFWaterfallObj = null;
    }
    if (chartCFPieObj) {
      chartCFPieObj.destroy();
      chartCFPieObj = null;
    }
    if (chartCFBarObj) {
      chartCFBarObj.destroy();
      chartCFBarObj = null;
    }
  };

  const drawCharts = (salesDetails, purchaseDetails) => {
    destroyCharts();
    
    const ctxBar = document.getElementById('chartSalesPurchases')?.getContext('2d');
    const ctxPie = document.getElementById('chartCategorySales')?.getContext('2d');
    
    if (!ctxBar || !ctxPie) return;
    
    // Group sales and purchases by date
    const dateMap = {};
    
    salesDetails.forEach(d => {
      const dDate = d.sales_date.split('T')[0];
      if (!dateMap[dDate]) dateMap[dDate] = { sales: 0, purchases: 0 };
      dateMap[dDate].sales += parseFloat(d.item_amount || 0);
    });
    
    if (appMode !== 'restaurant') {
      purchaseDetails.forEach(d => {
        const dDate = d.purchase_date.split('T')[0];
        if (!dateMap[dDate]) dateMap[dDate] = { sales: 0, purchases: 0 };
        dateMap[dDate].purchases += parseFloat(d.item_amount || 0);
      });
    }
    
    // Sort dates ascending
    const sortedDates = Object.keys(dateMap).sort();
    // Cap to last 15 days of transactions to fit in graph area
    const datesToShow = sortedDates.slice(-15);
    
    const salesData = datesToShow.map(d => dateMap[d].sales);
    const purchaseData = datesToShow.map(d => dateMap[d].purchases);
    const dateLabels = datesToShow.map(d => {
      const parts = d.split('-');
      return `${parts[2]}/${parts[1]}`; // DD/MM format
    });
    
    // Theme accent color resolution
    const accent = document.body.getAttribute('data-accent') || 'blue';
    const accentColorMap = {
      blue: '#2563eb',
      green: '#10b981',
      purple: '#6366f1',
      red: '#ef4444',
      orange: '#f97316'
    };
    const primaryColor = accentColorMap[accent] || '#2563eb';
    
    chartSalesPurchasesObj = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: dateLabels.length > 0 ? dateLabels : ['No Data'],
        datasets: [
          {
            label: 'Sales Revenue',
            data: salesData.length > 0 ? salesData : [0],
            backgroundColor: primaryColor,
            borderRadius: 4
          },
          ...(appMode === 'restaurant' ? [] : [{
            label: 'Purchase Cost',
            data: purchaseData.length > 0 ? purchaseData : [0],
            backgroundColor: '#ef4444',
            borderRadius: 4
          }])
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#1e293b' } }
        },
        scales: {
          x: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } },
          y: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } }
        }
      }
    });
    
    // Pie Chart: Category Sales distribution
    const catMap = {};
    salesDetails.forEach(d => {
      const catName = d.category_name || 'Uncategorized';
      if (!catMap[catName]) catMap[catName] = 0;
      catMap[catName] += parseFloat(d.item_amount || 0);
    });
    
    const catLabels = Object.keys(catMap);
    const catValues = Object.values(catMap);
    
    const pieColors = [
      primaryColor,
      '#10b981', // Emerald
      '#6366f1', // Indigo
      '#ef4444', // Ruby
      '#f97316', // Orange
      '#06b6d4', // Cyan
      '#eab308', // Amber
      '#ec4899', // Pink
      '#14b8a6'  // Teal
    ];
    
    chartCategorySalesObj = new Chart(ctxPie, {
      type: 'pie',
      data: {
        labels: catLabels.length > 0 ? catLabels : ['No Sales'],
        datasets: [{
          data: catValues.length > 0 ? catValues : [0],
          backgroundColor: catValues.length > 0 ? pieColors.slice(0, catLabels.length) : ['#e2e8f0']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#1e293b' } }
        }
      }
    });
  };

  const drawDateGroupedCharts = (dates, totalData, countData, isSales) => {
    destroyCharts();
    const ctxBar = document.getElementById('chartSalesPurchases')?.getContext('2d');
    const ctxPie = document.getElementById('chartCategorySales')?.getContext('2d');
    if (!ctxBar || !ctxPie) return;

    if (reportChart1Title) reportChart1Title.textContent = isSales ? 'Daily Sales Revenue Trend (₹)' : 'Daily Purchase Cost Trend (₹)';
    if (reportChart2Title) reportChart2Title.textContent = isSales ? 'Invoices Issued Count' : 'Purchase Orders Count';

    const accent = document.body.getAttribute('data-accent') || 'blue';
    const accentColorMap = {
      blue: '#2563eb', green: '#10b981', purple: '#6366f1', red: '#ef4444', orange: '#f97316'
    };
    const primaryColor = accentColorMap[accent] || '#2563eb';
    const color = isSales ? primaryColor : '#ef4444';

    const dateLabels = dates.map(d => {
      const parts = d.split('-');
      return parts.length > 2 ? `${parts[2]}/${parts[1]}` : d;
    });

    chartSalesPurchasesObj = new Chart(ctxBar, {
      type: 'line',
      data: {
        labels: dateLabels.length > 0 ? dateLabels : ['No Data'],
        datasets: [{
          label: isSales ? 'Sales Revenue (₹)' : 'Purchase Cost (₹)',
          data: totalData.length > 0 ? totalData : [0],
          borderColor: color,
          backgroundColor: color + '22',
          borderWidth: 2,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: 'var(--text-main)' } } },
        scales: {
          x: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } },
          y: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } }
        }
      }
    });

    chartCategorySalesObj = new Chart(ctxPie, {
      type: 'bar',
      data: {
        labels: dateLabels.length > 0 ? dateLabels : ['No Data'],
        datasets: [{
          label: isSales ? 'Invoices Count' : 'Orders Count',
          data: countData.length > 0 ? countData : [0],
          backgroundColor: '#a855f7',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: 'var(--text-main)' } } },
        scales: {
          x: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } },
          y: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } }
        }
      }
    });
  };

  const drawCategoryWiseCharts = (groupedData) => {
    destroyCharts();
    const ctxBar = document.getElementById('chartSalesPurchases')?.getContext('2d');
    const ctxPie = document.getElementById('chartCategorySales')?.getContext('2d');
    if (!ctxBar || !ctxPie) return;

    if (reportChart1Title) reportChart1Title.textContent = 'Revenue Share by Category';
    if (reportChart2Title) reportChart2Title.textContent = 'Total Quantity Sold by Category';

    const accent = document.body.getAttribute('data-accent') || 'blue';
    const accentColorMap = {
      blue: '#2563eb', green: '#10b981', purple: '#6366f1', red: '#ef4444', orange: '#f97316'
    };
    const primaryColor = accentColorMap[accent] || '#2563eb';

    const labels = Object.keys(groupedData);
    const amounts = labels.map(k => groupedData[k].total_amount);
    const quantities = labels.map(k => groupedData[k].quantity);

    const pieColors = [
      primaryColor, '#10b981', '#6366f1', '#ef4444', '#f97316', '#06b6d4', '#eab308', '#ec4899', '#14b8a6'
    ];

    chartSalesPurchasesObj = new Chart(ctxBar, {
      type: 'pie',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [{
          data: amounts.length > 0 ? amounts : [0],
          backgroundColor: pieColors.slice(0, labels.length || 1),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: 'var(--text-main)' } }
        }
      }
    });

    chartCategorySalesObj = new Chart(ctxPie, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [{
          label: 'Quantity Sold',
          data: quantities.length > 0 ? quantities : [0],
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: 'var(--text-main)' } } },
        scales: {
          x: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } },
          y: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } }
        }
      }
    });
  };

  const drawItemWiseCharts = (groupedData) => {
    destroyCharts();
    const ctxBar = document.getElementById('chartSalesPurchases')?.getContext('2d');
    const ctxPie = document.getElementById('chartCategorySales')?.getContext('2d');
    if (!ctxBar || !ctxPie) return;

    if (reportChart1Title) reportChart1Title.textContent = 'Top 8 Items by Revenue (₹)';
    if (reportChart2Title) reportChart2Title.textContent = 'Top 8 Items by Quantity Sold';

    const accent = document.body.getAttribute('data-accent') || 'blue';
    const accentColorMap = {
      blue: '#2563eb', green: '#10b981', purple: '#6366f1', red: '#ef4444', orange: '#f97316'
    };
    const primaryColor = accentColorMap[accent] || '#2563eb';

    // Sort items by revenue
    const sortedByRevenue = Object.values(groupedData).sort((a, b) => b.total_amount - a.total_amount).slice(0, 8);
    const revLabels = sortedByRevenue.map(i => i.item_name);
    const revData = sortedByRevenue.map(i => i.total_amount);

    // Sort items by quantity
    const sortedByQty = Object.values(groupedData).sort((a, b) => b.quantity - a.quantity).slice(0, 8);
    const qtyLabels = sortedByQty.map(i => i.item_name);
    const qtyData = sortedByQty.map(i => i.quantity);

    chartSalesPurchasesObj = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: revLabels.length > 0 ? revLabels : ['No Data'],
        datasets: [{
          label: 'Revenue (₹)',
          data: revData.length > 0 ? revData : [0],
          backgroundColor: primaryColor,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: 'var(--text-main)' } } },
        scales: {
          x: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } },
          y: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } }
        }
      }
    });

    chartCategorySalesObj = new Chart(ctxPie, {
      type: 'bar',
      data: {
        labels: qtyLabels.length > 0 ? qtyLabels : ['No Data'],
        datasets: [{
          label: 'Quantity Sold',
          data: qtyData.length > 0 ? qtyData : [0],
          backgroundColor: '#10b981',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: 'var(--text-main)' } } },
        scales: {
          x: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } },
          y: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } }
        }
      }
    });
  };

  const drawCustomerCharts = (filteredCustomers, customerSales) => {
    destroyCharts();
    const ctxBar = document.getElementById('chartSalesPurchases')?.getContext('2d');
    const ctxPie = document.getElementById('chartCategorySales')?.getContext('2d');
    if (!ctxBar || !ctxPie) return;

    if (reportChart1Title) reportChart1Title.textContent = 'Top 8 Customers by Total Purchase (₹)';
    if (reportChart2Title) reportChart2Title.textContent = 'Top 8 Customers by Invoice Volume';

    const accent = document.body.getAttribute('data-accent') || 'blue';
    const accentColorMap = {
      blue: '#2563eb', green: '#10b981', purple: '#6366f1', red: '#ef4444', orange: '#f97316'
    };
    const primaryColor = accentColorMap[accent] || '#2563eb';

    // Map customers with sales info
    const customerStats = filteredCustomers.map(c => {
      const stats = customerSales[c.customer_id] || { count: 0, spent: 0 };
      return {
        name: `${c.first_name} ${c.last_name}`,
        spent: stats.spent,
        count: stats.count
      };
    });

    // Sort by spent descending
    const topBySpent = customerStats.filter(c => c.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 8);
    const spentLabels = topBySpent.map(c => c.name);
    const spentData = topBySpent.map(c => c.spent);

    // Sort by count descending
    const topByCount = customerStats.filter(c => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 8);
    const countLabels = topByCount.map(c => c.name);
    const countData = topByCount.map(c => c.count);

    chartSalesPurchasesObj = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: spentLabels.length > 0 ? spentLabels : ['No Data'],
        datasets: [{
          label: 'Total Spent (₹)',
          data: spentData.length > 0 ? spentData : [0],
          backgroundColor: primaryColor,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: 'var(--text-main)' } } },
        scales: {
          x: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } },
          y: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } }
        }
      }
    });

    chartCategorySalesObj = new Chart(ctxPie, {
      type: 'bar',
      data: {
        labels: countLabels.length > 0 ? countLabels : ['No Data'],
        datasets: [{
          label: 'Total Invoices',
          data: countData.length > 0 ? countData : [0],
          backgroundColor: '#f59e0b',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: 'var(--text-main)' } } },
        scales: {
          x: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } },
          y: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border-color)' } }
        }
      }
    });
  };

  const exportReportToCSV = () => {
    if (!reportsResultHeader || !reportsResultBody) return;
    
    let csvContent = '';
    
    // Get headers
    const headers = Array.from(reportsResultHeader.querySelectorAll('th')).map(th => {
      return '"' + th.textContent.replace(/"/g, '""').trim() + '"';
    });
    if (headers.length === 0) {
      showToast('Export Error', 'No report data available to export.', 'warning');
      return;
    }
    csvContent += headers.join(',') + '\r\n';
    
    // Get rows
    const rows = reportsResultBody.querySelectorAll('tr');
    if (rows.length === 0) {
      showToast('Export Error', 'No report data rows available to export.', 'warning');
      return;
    }
    rows.forEach(tr => {
      const cells = Array.from(tr.querySelectorAll('td')).map(td => {
        let val = td.textContent.trim();
        return '"' + val.replace(/"/g, '""') + '"';
      });
      csvContent += cells.join(',') + '\r\n';
    });
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const reportType = reportTypeSelect ? reportTypeSelect.value : 'report';
    const dateStr = new Date().toISOString().split('T')[0];
    
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Vanshee_POS_${reportType}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export Success', 'Report successfully exported to CSV!', 'success');
  };

  function renderReportFilters(reportType) {
    if (!reportsFiltersContainer) return;
    const today = new Date().toISOString().split('T')[0];
    
    let html = '';
    if (reportType === 'sales') {
      html = `
        <div class="form-field">
          <label for="filterStartDate">Start Date</label>
          <input type="date" id="filterStartDate" value="${today}">
        </div>
        <div class="form-field">
          <label for="filterEndDate">End Date</label>
          <input type="date" id="filterEndDate" value="${today}">
        </div>
        <div class="form-field">
          <label for="filterCategory">Category</label>
          <select id="filterCategory">
            <option value="">All Categories</option>
            ${reportsCategories.map(c => `<option value="${c.category_id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="filterItem">Item</label>
          <select id="filterItem">
            <option value="">All Items</option>
            ${reportsItems.map(i => `<option value="${i.item_id}">${i.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="filterCustomer">Customer</label>
          <select id="filterCustomer">
            <option value="">All Customers</option>
            ${reportsCustomers.map(c => `<option value="${c.customer_id}">${c.first_name} ${c.last_name}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="filterUser">User / Operator</label>
          <select id="filterUser">
            <option value="">All Users</option>
            ${reportsUsers.map(u => `<option value="${u.username}">${u.username}</option>`).join('')}
          </select>
        </div>
      `;
    } else if (reportType === 'purchase') {
      html = `
        <div class="form-field">
          <label for="filterStartDate">Start Date</label>
          <input type="date" id="filterStartDate" value="${today}">
        </div>
        <div class="form-field">
          <label for="filterEndDate">End Date</label>
          <input type="date" id="filterEndDate" value="${today}">
        </div>
        <div class="form-field">
          <label for="filterCategory">Category</label>
          <select id="filterCategory">
            <option value="">All Categories</option>
            ${reportsCategories.map(c => `<option value="${c.category_id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="filterItem">Item</label>
          <select id="filterItem">
            <option value="">All Items</option>
            ${reportsItems.map(i => `<option value="${i.item_id}">${i.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="filterVendor">Vendor</label>
          <select id="filterVendor">
            <option value="">All Vendors</option>
            ${reportsVendors.map(v => `<option value="${v.vendor_id}">${v.first_name} ${v.last_name} (${v.company || ''})</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="filterUser">User / Operator</label>
          <select id="filterUser">
            <option value="">All Users</option>
            ${reportsUsers.map(u => `<option value="${u.username}">${u.username}</option>`).join('')}
          </select>
        </div>
      `;
    } else if (reportType === 'item') {
      html = `
        <div class="form-field">
          <label for="filterCategory">Category</label>
          <select id="filterCategory">
            <option value="">All Categories</option>
            ${reportsCategories.map(c => `<option value="${c.category_id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label for="filterStatus">Status</label>
          <select id="filterStatus">
            <option value="">All Statuses</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </div>
      `;
    } else if (reportType === 'category') {
      html = `
        <div class="form-field">
          <label for="filterStatus">Status</label>
          <select id="filterStatus">
            <option value="">All Statuses</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </div>
      `;
    } else if (reportType === 'customer') {
      html = `
        <div class="form-field">
          <label for="filterCity">City</label>
          <input type="text" id="filterCity" placeholder="Enter city name">
        </div>
      `;
    } else if (reportType === 'user') {
      html = `
        <div class="form-field">
          <label for="filterRole">Role</label>
          <select id="filterRole">
            <option value="">All Roles</option>
            <option value="1">Admin</option>
            <option value="2">Manager</option>
            <option value="3">User</option>
            <option value="4">Viewer</option>
          </select>
        </div>
      `;
    } else if (['sales_by_date', 'purchase_by_date', 'category_wise', 'cash_flow'].includes(reportType)) {
      html = `
        <div class="form-field">
          <label for="filterStartDate">Start Date</label>
          <input type="date" id="filterStartDate" value="${today}">
        </div>
        <div class="form-field">
          <label for="filterEndDate">End Date</label>
          <input type="date" id="filterEndDate" value="${today}">
        </div>
      `;
    } else if (reportType === 'item_wise') {
      html = `
        <div class="form-field">
          <label for="filterStartDate">Start Date</label>
          <input type="date" id="filterStartDate" value="${today}">
        </div>
        <div class="form-field">
          <label for="filterEndDate">End Date</label>
          <input type="date" id="filterEndDate" value="${today}">
        </div>
        <div class="form-field">
          <label for="filterCategory">Category</label>
          <select id="filterCategory">
            <option value="">All Categories</option>
            ${reportsCategories.map(c => `<option value="${c.category_id}">${c.name}</option>`).join('')}
          </select>
        </div>
      `;
    }
    reportsFiltersContainer.innerHTML = html;
  };

  async function fetchReportsOverviewMetrics() {
    try {
      const [salesRes, purchaseRes, invRes, empRes] = await Promise.all([
        authFetch(getApiUrl('/api/sales')),
        authFetch(getApiUrl('/api/purchase')),
        authFetch(getApiUrl('/api/inventory')),
        authFetch(getApiUrl('/api/employees'))
      ]);

      const sales = salesRes.ok ? await salesRes.json() : [];
      const purchases = purchaseRes.ok ? await purchaseRes.json() : [];
      const inv = invRes.ok ? await invRes.json() : [];
      const emps = empRes.ok ? await empRes.json() : [];

      let totalSalesAmt = 0;
      sales.forEach(s => totalSalesAmt += parseFloat(s.total || 0));

      let totalPurchasesAmt = 0;
      purchases.forEach(p => totalPurchasesAmt += parseFloat(p.total || 0));

      const profitMargin = totalSalesAmt - totalPurchasesAmt;
      const lowStockItems = inv.filter(i => parseFloat(i.current_stock) <= parseFloat(i.min_stock)).length;

      if (reportValSales) reportValSales.textContent = `₹${totalSalesAmt.toFixed(2)}`;
      if (reportCountSales) reportCountSales.textContent = `${sales.length} invoices`;
      
      if (reportValPurchases) reportValPurchases.textContent = `₹${totalPurchasesAmt.toFixed(2)}`;
      if (reportCountPurchases) reportCountPurchases.textContent = `${purchases.length} invoices`;

      if (reportValMargin) {
        reportValMargin.textContent = `₹${profitMargin.toFixed(2)}`;
        reportValMargin.style.color = profitMargin >= 0 ? '#10b981' : '#ef4444';
      }

      const reportValStockAlert = document.getElementById('reportValStockAlert');
      const reportCountStaff = document.getElementById('reportCountStaff');

      if (reportValStockAlert) {
        reportValStockAlert.textContent = `${lowStockItems} Alert${lowStockItems === 1 ? '' : 's'}`;
        reportValStockAlert.style.color = lowStockItems > 0 ? '#ef4444' : 'inherit';
      }
      if (reportCountStaff) {
        reportCountStaff.textContent = `${emps.length} active employee${emps.length === 1 ? '' : 's'}`;
      }
    } catch (err) {
      console.error('Error fetching overview metrics:', err);
    }
  };

  const generateReport = async () => {
    if (!reportTypeSelect || !reportsResultHeader || !reportsResultBody) return;
    
    const reportType = reportTypeSelect.value;
    reportsResultBody.innerHTML = `<tr><td colspan="10" class="empty-state">Generating report table...</td></tr>`;
    destroyCharts();
    
    const cashflowSection = document.getElementById('cashflowReportSection');
    if (cashflowSection) cashflowSection.style.display = 'none';
    
    try {
      if (reportType === 'sales') {
        reportsChartsPanel.style.display = 'grid';
        reportsTableTitle.textContent = 'Sales Report Details';
        
        const startDate = document.getElementById('filterStartDate')?.value;
        const endDate = document.getElementById('filterEndDate')?.value;
        const catId = document.getElementById('filterCategory')?.value;
        const itemId = document.getElementById('filterItem')?.value;
        const custId = document.getElementById('filterCustomer')?.value;
        const username = document.getElementById('filterUser')?.value;
        
        const res = await authFetch(getApiUrl('/api/sales/details/all'));
        if (!res.ok) throw new Error('Failed to load sales detail records.');
        const details = await res.json();
        
        const filtered = details.filter(d => {
          if (startDate) {
            const dDate = d.sales_date.split('T')[0];
            if (dDate < startDate) return false;
          }
          if (endDate) {
            const dDate = d.sales_date.split('T')[0];
            if (dDate > endDate) return false;
          }
          if (catId && d.category_id != catId) return false;
          if (itemId && d.item_id != itemId) return false;
          if (custId && d.customer_id != custId) return false;
          if (username && d.created_by !== username) return false;
          return true;
        });
        
        reportsRowCount.textContent = `${filtered.length} records found`;
        
        reportsResultHeader.innerHTML = `
          <tr>
            <th>Date</th>
            <th>Bill No</th>
            <th>Customer</th>
            <th>Category</th>
            <th>Item Name</th>
            <th style="text-align: right;">Rate</th>
            <th style="text-align: right;">Qty</th>
            <th style="text-align: right;">Amount</th>
            <th>Operator</th>
          </tr>
        `;
        
        if (filtered.length === 0) {
          reportsResultBody.innerHTML = `<tr><td colspan="9" class="empty-state">No matching sales records found.</td></tr>`;
        } else {
          let totalQty = 0;
          let totalAmt = 0;
          
          reportsResultBody.innerHTML = filtered.map(d => {
            const dDate = new Date(d.sales_date);
            const dateStr = `${dDate.getDate()}/${dDate.getMonth()+1}/${dDate.getFullYear()}`;
            const amt = parseFloat(d.item_amount || 0);
            const qty = parseFloat(d.quantity || 0);
            totalAmt += amt;
            totalQty += qty;
            
            return `
              <tr>
                <td>${dateStr}</td>
                <td><strong>${d.sales_bill_no}</strong></td>
                <td>${d.customer_name || 'Walk-in Customer'}</td>
                <td>${d.category_name || 'N/A'}</td>
                <td>${d.item_name}</td>
                <td style="text-align: right;">₹${parseFloat(d.rate || 0).toFixed(2)}</td>
                <td style="text-align: right;">${qty.toFixed(2)}</td>
                <td style="text-align: right; font-weight: bold; color: var(--primary-color);">₹${amt.toFixed(2)}</td>
                <td>${d.created_by}</td>
              </tr>
            `;
          }).join('') + `
            <tr style="background-color: var(--input-bg); font-weight: bold;">
              <td colspan="6" style="text-align: right;">TOTAL:</td>
              <td style="text-align: right;">${totalQty.toFixed(2)}</td>
              <td style="text-align: right; color: var(--primary-color);">₹${totalAmt.toFixed(2)}</td>
              <td></td>
            </tr>
          `;
        }
        
        // Fetch purchase details in the same date range for chart comparison
        let pDetails = [];
        try {
          const pRes = await authFetch(getApiUrl('/api/purchase/details/all'));
          if (pRes.ok) {
            const allP = await pRes.json();
            pDetails = allP.filter(d => {
              if (startDate) {
                const dDate = d.purchase_date.split('T')[0];
                if (dDate < startDate) return false;
              }
              if (endDate) {
                const dDate = d.purchase_date.split('T')[0];
                if (dDate > endDate) return false;
              }
              return true;
            });
          }
        } catch (e) {
          console.error(e);
        }
        
        drawCharts(filtered, pDetails);
        
      } else if (reportType === 'purchase') {
        reportsChartsPanel.style.display = 'grid';
        reportsTableTitle.textContent = 'Purchase Report Details';
        
        const startDate = document.getElementById('filterStartDate')?.value;
        const endDate = document.getElementById('filterEndDate')?.value;
        const catId = document.getElementById('filterCategory')?.value;
        const itemId = document.getElementById('filterItem')?.value;
        const vendorId = document.getElementById('filterVendor')?.value;
        const username = document.getElementById('filterUser')?.value;
        
        const res = await authFetch(getApiUrl('/api/purchase/details/all'));
        if (!res.ok) throw new Error('Failed to load purchase detail records.');
        const details = await res.json();
        
        const filtered = details.filter(d => {
          if (startDate) {
            const dDate = d.purchase_date.split('T')[0];
            if (dDate < startDate) return false;
          }
          if (endDate) {
            const dDate = d.purchase_date.split('T')[0];
            if (dDate > endDate) return false;
          }
          if (catId && d.category_id != catId) return false;
          if (itemId && d.item_id != itemId) return false;
          if (vendorId && d.vendor_id != vendorId) return false;
          if (username && d.created_by !== username) return false;
          return true;
        });
        
        reportsRowCount.textContent = `${filtered.length} records found`;
        
        reportsResultHeader.innerHTML = `
          <tr>
            <th>Date</th>
            <th>Inward No</th>
            <th>Vendor</th>
            <th>Category</th>
            <th>Item Name</th>
            <th style="text-align: right;">Cost Rate</th>
            <th style="text-align: right;">Qty</th>
            <th style="text-align: right;">Amount</th>
            <th>Operator</th>
          </tr>
        `;
        
        if (filtered.length === 0) {
          reportsResultBody.innerHTML = `<tr><td colspan="9" class="empty-state">No matching purchase records found.</td></tr>`;
        } else {
          let totalQty = 0;
          let totalAmt = 0;
          
          reportsResultBody.innerHTML = filtered.map(d => {
            const dDate = new Date(d.purchase_date);
            const dateStr = `${dDate.getDate()}/${dDate.getMonth()+1}/${dDate.getFullYear()}`;
            const amt = parseFloat(d.item_amount || 0);
            const qty = parseFloat(d.quantity || 0);
            totalAmt += amt;
            totalQty += qty;
            
            return `
              <tr>
                <td>${dateStr}</td>
                <td><strong>${d.purchase_bill_no}</strong></td>
                <td>${d.vendor_name || 'N/A'}${d.vendor_company ? ` (${d.vendor_company})` : ''}</td>
                <td>${d.category_name || 'N/A'}</td>
                <td>${d.item_name}</td>
                <td style="text-align: right;">₹${parseFloat(d.rate || 0).toFixed(2)}</td>
                <td style="text-align: right;">${qty.toFixed(2)}</td>
                <td style="text-align: right; font-weight: bold; color: #0d9488;">₹${amt.toFixed(2)}</td>
                <td>${d.created_by}</td>
              </tr>
            `;
          }).join('') + `
            <tr style="background-color: var(--input-bg); font-weight: bold;">
              <td colspan="6" style="text-align: right;">TOTAL:</td>
              <td style="text-align: right;">${totalQty.toFixed(2)}</td>
              <td style="text-align: right; color: #0d9488;">₹${totalAmt.toFixed(2)}</td>
              <td></td>
            </tr>
          `;
        }
        
        // Fetch sales details in the same date range for chart comparison
        let sDetails = [];
        try {
          const sRes = await authFetch(getApiUrl('/api/sales/details/all'));
          if (sRes.ok) {
            const allS = await sRes.json();
            sDetails = allS.filter(d => {
              if (startDate) {
                const dDate = d.sales_date.split('T')[0];
                if (dDate < startDate) return false;
              }
              if (endDate) {
                const dDate = d.sales_date.split('T')[0];
                if (dDate > endDate) return false;
              }
              return true;
            });
          }
        } catch (e) {
          console.error(e);
        }
        
        drawCharts(sDetails, filtered);
        
      } else if (reportType === 'item') {
        reportsChartsPanel.style.display = 'none';
        reportsTableTitle.textContent = 'Registered Items Listing';
        
        const catId = document.getElementById('filterCategory')?.value;
        const status = document.getElementById('filterStatus')?.value;
        
        const res = await authFetch(getApiUrl('/api/items'));
        if (!res.ok) throw new Error('Failed to load items.');
        const items = await res.json();
        
        const filtered = items.filter(i => {
          if (catId && i.category_id != catId) return false;
          if (status !== '' && status !== undefined && i.status != status) return false;
          return true;
        });
        
        reportsRowCount.textContent = `${filtered.length} records found`;
        
        const isRestaurant = appMode === 'restaurant';
        reportsResultHeader.innerHTML = `
          <tr>
            <th>Item ID</th>
            <th>Code</th>
            <th>Item Name</th>
            <th>Category</th>
            <th>Base Unit</th>
            <th>Tax Rate</th>
            <th style="text-align: right;">Sales Price</th>
            ${isRestaurant ? '' : '<th style="text-align: right;">Purchase Price</th>'}
            <th>Status</th>
          </tr>
        `;
        
        if (filtered.length === 0) {
          reportsResultBody.innerHTML = `<tr><td colspan="${isRestaurant ? '8' : '9'}" class="empty-state">No matching items found.</td></tr>`;
        } else {
          reportsResultBody.innerHTML = filtered.map(i => `
            <tr>
              <td>${i.display_id || i.item_id}</td>
              <td>${i.code || '--'}</td>
              <td><strong>${i.name}</strong></td>
              <td>${i.category_name || '--'}</td>
              <td>${i.unit_name || '--'}</td>
              <td>${i.tax_name || '--'}</td>
              <td style="text-align: right;">₹${parseFloat(i.price || i.sales_price || 0).toFixed(2)}</td>
              ${isRestaurant ? '' : `<td style="text-align: right;">₹${parseFloat(i.purchase_price || 0).toFixed(2)}</td>`}
              <td>
                <span class="status-badge ${i.status == 1 || i.active == 1 ? 'status-active' : 'status-inactive'}">
                  ${(i.status == 1 || i.active == 1) ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          `).join('');
        }
        
      } else if (reportType === 'category') {
        reportsChartsPanel.style.display = 'none';
        reportsTableTitle.textContent = 'Registered Categories Listing';
        
        const status = document.getElementById('filterStatus')?.value;
        
        const res = await authFetch(getApiUrl('/api/categories'));
        if (!res.ok) throw new Error('Failed to load categories.');
        const categories = await res.json();
        
        const filtered = categories.filter(c => {
          if (status !== '' && status !== undefined && c.status != status) return false;
          return true;
        });
        
        reportsRowCount.textContent = `${filtered.length} records found`;
        
        reportsResultHeader.innerHTML = `
          <tr>
            <th>Cat ID</th>
            <th>Category Name</th>
            <th>Status</th>
            <th>Created Date</th>
          </tr>
        `;
        
        if (filtered.length === 0) {
          reportsResultBody.innerHTML = `<tr><td colspan="4" class="empty-state">No matching categories found.</td></tr>`;
        } else {
          reportsResultBody.innerHTML = filtered.map(c => {
            const cDate = new Date(c.created_at);
            const dateStr = `${cDate.getDate()}/${cDate.getMonth()+1}/${cDate.getFullYear()}`;
            return `
              <tr>
                <td>${c.display_id || c.category_id}</td>
                <td><strong>${c.name}</strong></td>
                <td>
                  <span class="status-badge ${c.status == 1 ? 'status-active' : 'status-inactive'}">
                    ${c.status == 1 ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>${dateStr}</td>
              </tr>
            `;
          }).join('');
        }
        
      } else if (reportType === 'customer') {
        reportsChartsPanel.style.display = 'grid';
        reportsTableTitle.textContent = 'Registered Customers Details & Sales Summary';
        
        const city = document.getElementById('filterCity')?.value?.toLowerCase()?.trim();
        
        const [custRes, salesRes] = await Promise.all([
          authFetch(getApiUrl('/api/customers')),
          authFetch(getApiUrl('/api/sales'))
        ]);
        
        if (!custRes.ok) throw new Error('Failed to load customers.');
        const customers = await custRes.json();
        const salesList = salesRes.ok ? await salesRes.json() : [];
        
        // Group sales by customer ID
        const customerSales = {};
        salesList.forEach(s => {
          if (!customerSales[s.customer_id]) {
            customerSales[s.customer_id] = { count: 0, spent: 0 };
          }
          customerSales[s.customer_id].count++;
          customerSales[s.customer_id].spent += parseFloat(s.total || 0);
        });
        
        const filtered = customers.filter(c => {
          if (city && c.city?.toLowerCase()?.indexOf(city) === -1) return false;
          return true;
        });
        
        reportsRowCount.textContent = `${filtered.length} records found`;
        
        reportsResultHeader.innerHTML = `
          <tr>
            <th>Cust ID</th>
            <th>Full Name</th>
            <th>Contact Details</th>
            <th>City & Country</th>
            <th style="text-align: right;">Total Bills</th>
            <th style="text-align: right;">Total Purchase Amt</th>
          </tr>
        `;
        
        if (filtered.length === 0) {
          reportsResultBody.innerHTML = `<tr><td colspan="6" class="empty-state">No matching customers found.</td></tr>`;
        } else {
          let grandSpent = 0;
          let grandBills = 0;
          
          reportsResultBody.innerHTML = filtered.map(c => {
            const name = [c.first_name, c.middle_name, c.last_name].filter(p => p && p.trim() !== '').join(' ');
            const loc = [c.city, c.country].filter(p => p && p.trim() !== '').join(', ') || 'N/A';
            const contacts = [c.phone_1, c.email_1].filter(p => p && p.trim() !== '').join(' | ') || 'N/A';
            
            const stats = customerSales[c.customer_id] || { count: 0, spent: 0 };
            grandSpent += stats.spent;
            grandBills += stats.count;
            
            return `
              <tr>
                <td>${c.display_id || c.customer_id}</td>
                <td><strong>${name}</strong></td>
                <td>${contacts}</td>
                <td>${loc}</td>
                <td style="text-align: right;">${stats.count}</td>
                <td style="text-align: right; font-weight: bold; color: var(--primary-color);">₹${stats.spent.toFixed(2)}</td>
              </tr>
            `;
          }).join('') + `
            <tr style="background-color: var(--input-bg); font-weight: bold;">
              <td colspan="4" style="text-align: right;">TOTAL:</td>
              <td style="text-align: right;">${grandBills}</td>
              <td style="text-align: right; color: var(--primary-color);">₹${grandSpent.toFixed(2)}</td>
            </tr>
          `;
        }
        drawCustomerCharts(filtered, customerSales);
        
      } else if (reportType === 'user') {
        reportsChartsPanel.style.display = 'none';
        reportsTableTitle.textContent = 'Registered Users Listing';
        
        const roleId = document.getElementById('filterRole')?.value;
        
        const res = await authFetch(getApiUrl('/api/users'));
        if (!res.ok) throw new Error('Failed to load users.');
        const users = await res.json();
        
        const filtered = users.filter(u => {
          if (roleId && u.role_id != roleId) return false;
          return true;
        });
        
        reportsRowCount.textContent = `${filtered.length} records found`;
        
        reportsResultHeader.innerHTML = `
          <tr>
            <th>User ID</th>
            <th>Username</th>
            <th>Full Name</th>
            <th>City & Country</th>
            <th>Contact Details</th>
            <th>Role</th>
          </tr>
        `;
        
        if (filtered.length === 0) {
          reportsResultBody.innerHTML = `<tr><td colspan="6" class="empty-state">No matching users found.</td></tr>`;
        } else {
          reportsResultBody.innerHTML = filtered.map(u => {
            const name = [u.first_name, u.middle_name, u.last_name].filter(p => p && p.trim() !== '').join(' ');
            const loc = [u.city, u.country].filter(p => p && p.trim() !== '').join(', ') || 'N/A';
            const contacts = [u.phone_1, u.email_1].filter(p => p && p.trim() !== '').join(' | ') || 'N/A';
            return `
              <tr>
                <td>${u.display_id || u.user_id}</td>
                <td>${u.username}</td>
                <td><strong>${name}</strong></td>
                <td>${loc}</td>
                <td>${contacts}</td>
                <td>
                  <span class="badge badge-light" style="background-color:#f1f5f9; color:#475569; padding: 4px 8px; border-radius: 4px; font-weight: 500;">
                    ${u.role_name || 'User'}
                  </span>
                </td>
              </tr>
            `;
          }).join('');
        }

      } else if (reportType === 'sales_by_date') {
        reportsChartsPanel.style.display = 'grid';
        reportsTableTitle.textContent = 'Sales by Date Summary';
        
        const startDate = document.getElementById('filterStartDate')?.value;
        const endDate = document.getElementById('filterEndDate')?.value;
        
        const res = await authFetch(getApiUrl('/api/sales'));
        if (!res.ok) throw new Error('Failed to load sales master records.');
        const sales = await res.json();
        
        const filtered = sales.filter(s => {
          const sDate = s.sales_date.split('T')[0];
          if (startDate && sDate < startDate) return false;
          if (endDate && sDate > endDate) return false;
          return true;
        });
        
        // Group by Date
        const grouped = {};
        filtered.forEach(s => {
          const sDate = s.sales_date.split('T')[0];
          if (!grouped[sDate]) {
            grouped[sDate] = { count: 0, gross: 0, tax: 0, total: 0 };
          }
          grouped[sDate].count++;
          grouped[sDate].gross += parseFloat(s.gross || 0);
          grouped[sDate].tax += parseFloat(s.tax || 0);
          grouped[sDate].total += parseFloat(s.total || 0);
        });
        
        const dates = Object.keys(grouped).sort();
        reportsRowCount.textContent = `${dates.length} days found`;
        
        reportsResultHeader.innerHTML = `
          <tr>
            <th>Sales Date</th>
            <th style="text-align: right;">Total Invoices</th>
            <th style="text-align: right;">Gross Total</th>
            <th style="text-align: right;">Tax Total</th>
            <th style="text-align: right;">Net Total Revenue</th>
          </tr>
        `;
        
        if (dates.length === 0) {
          reportsResultBody.innerHTML = `<tr><td colspan="5" class="empty-state">No matching sales records found in selected range.</td></tr>`;
        } else {
          let sumCount = 0;
          let sumGross = 0;
          let sumTax = 0;
          let sumTotal = 0;
          
          reportsResultBody.innerHTML = dates.map(d => {
            const dateObj = new Date(d);
            const dateStr = `${dateObj.getDate()}/${dateObj.getMonth()+1}/${dateObj.getFullYear()}`;
            const info = grouped[d];
            sumCount += info.count;
            sumGross += info.gross;
            sumTax += info.tax;
            sumTotal += info.total;
            
            return `
              <tr>
                <td><strong>${dateStr}</strong></td>
                <td style="text-align: right;">${info.count}</td>
                <td style="text-align: right;">₹${info.gross.toFixed(2)}</td>
                <td style="text-align: right;">₹${info.tax.toFixed(2)}</td>
                <td style="text-align: right; font-weight: bold; color: var(--primary-color);">₹${info.total.toFixed(2)}</td>
              </tr>
            `;
          }).join('') + `
            <tr style="background-color: var(--input-bg); font-weight: bold;">
              <td style="text-align: right;">TOTAL:</td>
              <td style="text-align: right;">${sumCount}</td>
              <td style="text-align: right;">₹${sumGross.toFixed(2)}</td>
              <td style="text-align: right;">₹${sumTax.toFixed(2)}</td>
              <td style="text-align: right; color: var(--primary-color);">₹${sumTotal.toFixed(2)}</td>
            </tr>
          `;
        }
        drawDateGroupedCharts(dates, dates.map(d => grouped[d].total), dates.map(d => grouped[d].count), true);
        
      } else if (reportType === 'purchase_by_date') {
        reportsChartsPanel.style.display = 'grid';
        reportsTableTitle.textContent = 'Purchase by Date Summary';
        
        const startDate = document.getElementById('filterStartDate')?.value;
        const endDate = document.getElementById('filterEndDate')?.value;
        
        const res = await authFetch(getApiUrl('/api/purchase'));
        if (!res.ok) throw new Error('Failed to load purchase master records.');
        const purchases = await res.json();
        
        const filtered = purchases.filter(p => {
          const pDate = p.purchase_date.split('T')[0];
          if (startDate && pDate < startDate) return false;
          if (endDate && pDate > endDate) return false;
          return true;
        });
        
        // Group by Date
        const grouped = {};
        filtered.forEach(p => {
          const pDate = p.purchase_date.split('T')[0];
          if (!grouped[pDate]) {
            grouped[pDate] = { count: 0, gross: 0, tax: 0, total: 0 };
          }
          grouped[pDate].count++;
          grouped[pDate].gross += parseFloat(p.gross || 0);
          grouped[pDate].tax += parseFloat(p.tax || 0);
          grouped[pDate].total += parseFloat(p.total || 0);
        });
        
        const dates = Object.keys(grouped).sort();
        reportsRowCount.textContent = `${dates.length} days found`;
        
        reportsResultHeader.innerHTML = `
          <tr>
            <th>Purchase Date</th>
            <th style="text-align: right;">Total Purchases</th>
            <th style="text-align: right;">Gross Total</th>
            <th style="text-align: right;">Tax Total</th>
            <th style="text-align: right;">Net Total Inward</th>
          </tr>
        `;
        
        if (dates.length === 0) {
          reportsResultBody.innerHTML = `<tr><td colspan="5" class="empty-state">No matching purchase records found in selected range.</td></tr>`;
        } else {
          let sumCount = 0;
          let sumGross = 0;
          let sumTax = 0;
          let sumTotal = 0;
          
          reportsResultBody.innerHTML = dates.map(d => {
            const dateObj = new Date(d);
            const dateStr = `${dateObj.getDate()}/${dateObj.getMonth()+1}/${dateObj.getFullYear()}`;
            const info = grouped[d];
            sumCount += info.count;
            sumGross += info.gross;
            sumTax += info.tax;
            sumTotal += info.total;
            
            return `
              <tr>
                <td><strong>${dateStr}</strong></td>
                <td style="text-align: right;">${info.count}</td>
                <td style="text-align: right;">₹${info.gross.toFixed(2)}</td>
                <td style="text-align: right;">₹${info.tax.toFixed(2)}</td>
                <td style="text-align: right; font-weight: bold; color: #0d9488;">₹${info.total.toFixed(2)}</td>
              </tr>
            `;
          }).join('') + `
            <tr style="background-color: var(--input-bg); font-weight: bold;">
              <td style="text-align: right;">TOTAL:</td>
              <td style="text-align: right;">${sumCount}</td>
              <td style="text-align: right;">₹${sumGross.toFixed(2)}</td>
              <td style="text-align: right;">₹${sumTax.toFixed(2)}</td>
              <td style="text-align: right; color: #0d9488;">₹${sumTotal.toFixed(2)}</td>
            </tr>
          `;
        }
        drawDateGroupedCharts(dates, dates.map(d => grouped[d].total), dates.map(d => grouped[d].count), false);
        
      } else if (reportType === 'category_wise') {
        reportsChartsPanel.style.display = 'grid';
        reportsTableTitle.textContent = 'Category-wise Sales Revenue';
        
        const startDate = document.getElementById('filterStartDate')?.value;
        const endDate = document.getElementById('filterEndDate')?.value;
        
        const res = await authFetch(getApiUrl('/api/sales/details/all'));
        if (!res.ok) throw new Error('Failed to load sales detail records.');
        const details = await res.json();
        
        const filtered = details.filter(d => {
          const sDate = d.sales_date.split('T')[0];
          if (startDate && sDate < startDate) return false;
          if (endDate && sDate > endDate) return false;
          return true;
        });
        
        // Group by category name
        const grouped = {};
        filtered.forEach(d => {
          const catName = d.category_name || 'Uncategorized';
          if (!grouped[catName]) {
            grouped[catName] = { qty: 0, total: 0 };
          }
          grouped[catName].qty += parseFloat(d.quantity || 0);
          grouped[catName].total += parseFloat(d.item_amount || 0);
        });
        
        const cats = Object.keys(grouped).sort();
        reportsRowCount.textContent = `${cats.length} categories sold`;
        
        reportsResultHeader.innerHTML = `
          <tr>
            <th>Category Name</th>
            <th style="text-align: right;">Total Quantity Sold</th>
            <th style="text-align: right;">Total Revenue Amount</th>
          </tr>
        `;
        
        if (cats.length === 0) {
          reportsResultBody.innerHTML = `<tr><td colspan="3" class="empty-state">No category sales found in selected range.</td></tr>`;
        } else {
          let sumQty = 0;
          let sumTotal = 0;
          
          reportsResultBody.innerHTML = cats.map(c => {
            const info = grouped[c];
            sumQty += info.qty;
            sumTotal += info.total;
            
            return `
              <tr>
                <td><strong>${c}</strong></td>
                <td style="text-align: right;">${info.qty.toFixed(2)}</td>
                <td style="text-align: right; font-weight: bold; color: var(--primary-color);">₹${info.total.toFixed(2)}</td>
              </tr>
            `;
          }).join('') + `
            <tr style="background-color: var(--input-bg); font-weight: bold;">
              <td style="text-align: right;">TOTAL:</td>
              <td style="text-align: right;">${sumQty.toFixed(2)}</td>
              <td style="text-align: right; color: var(--primary-color);">₹${sumTotal.toFixed(2)}</td>
            </tr>
          `;
        }
        drawCategoryWiseCharts(grouped);
        
      } else if (reportType === 'item_wise') {
        reportsChartsPanel.style.display = 'grid';
        reportsTableTitle.textContent = 'Item-wise Sales Breakdown';
        
        const startDate = document.getElementById('filterStartDate')?.value;
        const endDate = document.getElementById('filterEndDate')?.value;
        const catId = document.getElementById('filterCategory')?.value;
        
        const res = await authFetch(getApiUrl('/api/sales/details/all'));
        if (!res.ok) throw new Error('Failed to load sales detail records.');
        const details = await res.json();
        
        const filtered = details.filter(d => {
          const sDate = d.sales_date.split('T')[0];
          if (startDate && sDate < startDate) return false;
          if (endDate && sDate > endDate) return false;
          if (catId && d.category_id != catId) return false;
          return true;
        });
        
        // Group by item name
        const grouped = {};
        filtered.forEach(d => {
          const itemKey = d.item_name;
          if (!grouped[itemKey]) {
            grouped[itemKey] = { category: d.category_name || 'N/A', rateSum: 0, rateCount: 0, qty: 0, total: 0 };
          }
          grouped[itemKey].rateSum += parseFloat(d.rate || 0);
          grouped[itemKey].rateCount++;
          grouped[itemKey].qty += parseFloat(d.quantity || 0);
          grouped[itemKey].total += parseFloat(d.item_amount || 0);
        });
        
        const items = Object.keys(grouped).sort();
        reportsRowCount.textContent = `${items.length} items sold`;
        
        reportsResultHeader.innerHTML = `
          <tr>
            <th>Item Name</th>
            <th>Category</th>
            <th style="text-align: right;">Avg Rate</th>
            <th style="text-align: right;">Quantity Sold</th>
            <th style="text-align: right;">Total Sales Amount</th>
          </tr>
        `;
        
        if (items.length === 0) {
          reportsResultBody.innerHTML = `<tr><td colspan="5" class="empty-state">No item sales found in selected range.</td></tr>`;
        } else {
          let sumQty = 0;
          let sumTotal = 0;
          
          reportsResultBody.innerHTML = items.map(name => {
            const info = grouped[name];
            sumQty += info.qty;
            sumTotal += info.total;
            const avgRate = info.rateSum / info.rateCount;
            
            return `
              <tr>
                <td><strong>${name}</strong></td>
                <td>${info.category}</td>
                <td style="text-align: right;">₹${avgRate.toFixed(2)}</td>
                <td style="text-align: right;">${info.qty.toFixed(2)}</td>
                <td style="text-align: right; font-weight: bold; color: var(--primary-color);">₹${info.total.toFixed(2)}</td>
              </tr>
            `;
          }).join('') + `
            <tr style="background-color: var(--input-bg); font-weight: bold;">
              <td colspan="3" style="text-align: right;">TOTAL:</td>
              <td style="text-align: right;">${sumQty.toFixed(2)}</td>
              <td style="text-align: right; color: var(--primary-color);">₹${sumTotal.toFixed(2)}</td>
            </tr>
          `;
        }
        drawItemWiseCharts(grouped);
        
      } else if (reportType === 'cash_flow') {
        reportsChartsPanel.style.display = 'none';
        if (cashflowSection) cashflowSection.style.display = 'block';
        reportsTableTitle.textContent = 'Cash Flow Analysis Ledger';
        
        const startDate = document.getElementById('filterStartDate')?.value;
        const endDate = document.getElementById('filterEndDate')?.value;
        
        const [salesRes, purchaseRes] = await Promise.all([
          authFetch(getApiUrl('/api/sales')),
          authFetch(getApiUrl('/api/purchase'))
        ]);
        
        const sales = salesRes.ok ? await salesRes.json() : [];
        const purchases = purchaseRes.ok ? await purchaseRes.json() : [];
        
        // Filter transactions in date range
        const fSales = sales.filter(s => {
          const sDate = s.sales_date.split('T')[0];
          if (startDate && sDate < startDate) return false;
          if (endDate && sDate > endDate) return false;
          return true;
        });
        const fPurchases = purchases.filter(p => {
          const pDate = p.purchase_date.split('T')[0];
          if (startDate && pDate < startDate) return false;
          if (endDate && pDate > endDate) return false;
          return true;
        });
        
        const salesTotal = fSales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);
        const purchasesTotal = fPurchases.reduce((sum, p) => sum + parseFloat(p.total || 0), 0);
        
        // Mock Cash Inflow/Outflow from investments
        const openingBalance = 2500000.00;
        const investmentInflow = 1000000.00;
        const investmentOutflow = 500000.00;
        
        const totalInflow = salesTotal + investmentInflow;
        const totalOutflow = purchasesTotal + investmentOutflow;
        const netCashFlow = totalInflow - totalOutflow;
        const closingBalance = openingBalance + netCashFlow;
        
        // Populate Summary metrics
        document.getElementById('cfTotalInflow').textContent = `₹${totalInflow.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('cfTotalOutflow').textContent = `₹${totalOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('cfNetCashFlow').textContent = `${netCashFlow >= 0 ? '+' : ''}₹${netCashFlow.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('cfOpeningBalance').textContent = `₹${openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('cfClosingBalance').textContent = `₹${closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        const netColor = netCashFlow >= 0 ? '#10b981' : '#ef4444';
        document.getElementById('cfNetCashFlow').style.color = netColor;
        
        reportsRowCount.textContent = `5 Cash Flow segments active`;
        
        // Draw Waterfall Floating Bar chart
        const ctxWaterfall = document.getElementById('chartCashflowWaterfall')?.getContext('2d');
        if (ctxWaterfall) {
          chartCFWaterfallObj = new Chart(ctxWaterfall, {
            type: 'bar',
            data: {
              labels: ['Opening', 'Sales (Ops)', 'Investment In', 'Purchases (Ops)', 'Investment Out', 'Closing'],
              datasets: [{
                label: 'Cash Position',
                data: [
                  [0, openingBalance],
                  [openingBalance, openingBalance + salesTotal],
                  [openingBalance + salesTotal, openingBalance + salesTotal + investmentInflow],
                  [openingBalance + salesTotal + investmentInflow - purchasesTotal, openingBalance + salesTotal + investmentInflow],
                  [closingBalance, openingBalance + salesTotal + investmentInflow - purchasesTotal],
                  [0, closingBalance]
                ],
                backgroundColor: [
                  '#6366f1', // Indigo
                  '#10b981', // Emerald green
                  '#34d399', // Light emerald green
                  '#f87171', // Light red
                  '#ef4444', // Red
                  '#4f46e5'  // Dark Indigo
                ],
                borderWidth: 1,
                borderRadius: 4
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              },
              scales: {
                x: { grid: { display: false } },
                y: { ticks: { callback: value => '₹' + value.toLocaleString('en-IN') } }
              }
            }
          });
        }
        
        // Draw Pie Chart for Breakdown
        const ctxPie = document.getElementById('chartCashflowPie')?.getContext('2d');
        if (ctxPie) {
          chartCFPieObj = new Chart(ctxPie, {
            type: 'pie',
            data: {
              labels: ['Sales (Ops)', 'Investment In', 'Purchases (Ops)', 'Investment Out'],
              datasets: [{
                data: [salesTotal, investmentInflow, purchasesTotal, investmentOutflow],
                backgroundColor: ['#10b981', '#34d399', '#f87171', '#ef4444']
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'right' }
              }
            }
          });
        }
        
        // Draw Bar Chart comparing Inflows vs Outflows
        const ctxBar = document.getElementById('chartCashflowBar')?.getContext('2d');
        if (ctxBar) {
          chartCFBarObj = new Chart(ctxBar, {
            type: 'bar',
            data: {
              labels: ['Inflows', 'Outflows'],
              datasets: [{
                label: 'Inflows vs Outflows',
                data: [totalInflow, totalOutflow],
                backgroundColor: ['#10b981', '#ef4444'],
                borderRadius: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: { ticks: { callback: value => '₹' + value.toLocaleString('en-IN') } }
              }
            }
          });
        }
        
        // Populate Result Table
        reportsResultHeader.innerHTML = `
          <tr>
            <th>Cash Flow Activity Segment</th>
            <th>Type</th>
            <th style="text-align: right;">Inflow Amount</th>
            <th style="text-align: right;">Outflow Amount</th>
            <th style="text-align: right;">Net Movement</th>
          </tr>
        `;
        
        reportsResultBody.innerHTML = `
          <tr>
            <td><strong>Cash Inflow from Operations (Sales Total)</strong></td>
            <td><span class="status-badge status-active" style="background:#dcfce7; color:#15803d; border-radius:20px; padding:3px 10px;">Operations In</span></td>
            <td style="text-align: right; color:#10b981; font-weight:600;">₹${salesTotal.toFixed(2)}</td>
            <td style="text-align: right; color:var(--text-secondary);">₹0.00</td>
            <td style="text-align: right; color:#10b981; font-weight:600;">+₹${salesTotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td><strong>Cash Inflow from Capital Investments</strong></td>
            <td><span class="status-badge status-active" style="background:#dbeafe; color:#1d4ed8; border-radius:20px; padding:3px 10px;">Investment In</span></td>
            <td style="text-align: right; color:#10b981; font-weight:600;">₹${investmentInflow.toFixed(2)}</td>
            <td style="text-align: right; color:var(--text-secondary);">₹0.00</td>
            <td style="text-align: right; color:#10b981; font-weight:600;">+₹${investmentInflow.toFixed(2)}</td>
          </tr>
          <tr>
            <td><strong>Cash Outflow for Operations (Purchases Total)</strong></td>
            <td><span class="status-badge status-inactive" style="background:#fee2e2; color:#b91c1c; border-radius:20px; padding:3px 10px;">Operations Out</span></td>
            <td style="text-align: right; color:var(--text-secondary);">₹0.00</td>
            <td style="text-align: right; color:#ef4444; font-weight:600;">₹${purchasesTotal.toFixed(2)}</td>
            <td style="text-align: right; color:#ef4444; font-weight:600;">-₹${purchasesTotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td><strong>Cash Outflow for Capital Purchases</strong></td>
            <td><span class="status-badge status-inactive" style="background:#fef3c7; color:#b45309; border-radius:20px; padding:3px 10px;">Investment Out</span></td>
            <td style="text-align: right; color:var(--text-secondary);">₹0.00</td>
            <td style="text-align: right; color:#ef4444; font-weight:600;">₹${investmentOutflow.toFixed(2)}</td>
            <td style="text-align: right; color:#ef4444; font-weight:600;">-₹${investmentOutflow.toFixed(2)}</td>
          </tr>
          <tr style="background-color: var(--input-bg); font-weight: bold; border-top: 2px solid var(--border-color);">
            <td>NET SUMMARY POSITION:</td>
            <td></td>
            <td style="text-align: right; color:#10b981;">₹${totalInflow.toFixed(2)}</td>
            <td style="text-align: right; color:#ef4444;">₹${totalOutflow.toFixed(2)}</td>
            <td style="text-align: right; color:${netColor}; font-size:1.05rem;">${netCashFlow >= 0 ? '+' : ''}₹${netCashFlow.toFixed(2)}</td>
          </tr>
        `;
      }
    } catch (err) {
      console.error(err);
      reportsResultBody.innerHTML = `<tr><td colspan="10" class="empty-state" style="color: #ef4444;">Error generating report: ${err.message}</td></tr>`;
    }
  };

  const loadReportsMetadata = async () => {
    try {
      const [catsRes, itemsRes, custsRes, vendsRes, usersRes] = await Promise.all([
        authFetch(getApiUrl('/api/categories')),
        authFetch(getApiUrl('/api/items')),
        authFetch(getApiUrl('/api/customers')),
        authFetch(getApiUrl('/api/vendors')),
        authFetch(getApiUrl('/api/users'))
      ]);
      
      reportsCategories = catsRes.ok ? await catsRes.json() : [];
      reportsItems = itemsRes.ok ? await itemsRes.json() : [];
      reportsCustomers = custsRes.ok ? await custsRes.json() : [];
      reportsVendors = vendsRes.ok ? await vendsRes.json() : [];
      reportsUsers = usersRes.ok ? await usersRes.json() : [];
      
      if (reportTypeSelect) {
        renderReportFilters(reportTypeSelect.value);
      }
    } catch (err) {
      console.error('Error loading reports metadata:', err);
    }
  };

  if (reportTypeSelect) {
    reportTypeSelect.addEventListener('change', (e) => {
      renderReportFilters(e.target.value);
    });
  }

  if (btnGenerateReport) {
    btnGenerateReport.addEventListener('click', generateReport);
  }

  if (btnPrintReport) {
    btnPrintReport.addEventListener('click', () => {
      const metaDate = document.getElementById('printReportMetaDate');
      if (metaDate) {
        const start = document.getElementById('filterStartDate')?.value || 'Start';
        const end = document.getElementById('filterEndDate')?.value || 'End';
        const typeName = reportTypeSelect ? reportTypeSelect.options[reportTypeSelect.selectedIndex].text : 'Report';
        metaDate.innerHTML = `Report: <strong>${typeName}</strong><br>Period: ${start} to ${end}<br>Printed: ${new Date().toLocaleString()}`;
      }
      document.body.classList.add('print-report-active');
      window.print();
      document.body.classList.remove('print-report-active');
    });
  }

  const exportReportToPDF = () => {
    if (!reportsResultHeader || !reportsResultBody) return;
    const rows = reportsResultBody.querySelectorAll('tr');
    if (rows.length === 0 || reportsResultBody.querySelector('.empty-state')) {
      showToast('Export Error', 'No report data available to export to PDF.', 'warning');
      return;
    }

    const typeName = reportTypeSelect ? reportTypeSelect.options[reportTypeSelect.selectedIndex].text : 'Report';
    const start = document.getElementById('filterStartDate')?.value || 'Start';
    const end = document.getElementById('filterEndDate')?.value || 'End';
    const dateStr = new Date().toISOString().split('T')[0];

    const pdfContainer = document.createElement('div');
    pdfContainer.style.padding = '20px';
    pdfContainer.style.background = '#ffffff';
    pdfContainer.style.color = '#0f172a';
    pdfContainer.style.fontFamily = 'Helvetica, Arial, sans-serif';

    pdfContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: bold;">Vanshee POS System</h2>
          <p style="margin: 4px 0 0 0; color: #64748b; font-size: 11px;">Official Business Report</p>
        </div>
        <div style="text-align: right;">
          <h3 style="margin: 0; color: #2563eb; font-size: 16px; text-transform: uppercase;">${typeName}</h3>
          <p style="margin: 4px 0 0 0; color: #64748b; font-size: 11px;">Period: ${start} to ${end} | Generated: ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f1f5f9; color: #0f172a; text-align: left;">
            ${reportsResultHeader.innerHTML}
          </tr>
        </thead>
        <tbody>
          ${reportsResultBody.innerHTML}
        </tbody>
      </table>
      <div style="margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 10px; color: #94a3b8; text-align: center;">
        Generated automatically by Vanshee POS Management System
      </div>
    `;

    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin:       0.4,
        filename:     `Vanshee_POS_${reportTypeSelect?.value || 'report'}_${dateStr}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
      };
      showToast('Exporting PDF', 'Generating styled PDF document...', 'info');
      html2pdf().set(opt).from(pdfContainer).save().then(() => {
        showToast('Export Success', 'PDF document exported successfully!', 'success');
      });
    } else {
      const metaDate = document.getElementById('printReportMetaDate');
      if (metaDate) {
        metaDate.innerHTML = `Report: <strong>${typeName}</strong><br>Period: ${start} to ${end}<br>Exported: ${new Date().toLocaleString()}`;
      }
      document.body.classList.add('print-report-active');
      window.print();
      document.body.classList.remove('print-report-active');
    }
  };

  const btnExportPDF = document.getElementById('btnExportPDF');
  if (btnExportPDF) {
    btnExportPDF.addEventListener('click', exportReportToPDF);
  }

  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', exportReportToCSV);
  }

  // --- Global Command Palette / Quick Search (Ctrl+K) Implementation ---
  const cmdModal = document.getElementById('cmdPaletteModal');
  const cmdInput = document.getElementById('cmdSearchInput');
  const cmdResults = document.getElementById('cmdResultsList');
  const btnQuickSearch = document.getElementById('btnQuickSearch');
  let cmdActiveFilter = 'all';
  let cmdSelectedIndex = 0;
  let cmdCurrentMatches = [];

  function openCommandPalette() {
    if (!cmdModal) return;
    cmdModal.style.display = 'flex';
    if (cmdInput) {
      cmdInput.value = '';
      cmdInput.focus();
    }
    renderCommandResults();
  };

  const closeCommandPalette = () => {
    if (cmdModal) {
      cmdModal.style.display = 'none';
    }
  };

  if (btnQuickSearch) {
    btnQuickSearch.addEventListener('click', openCommandPalette);
  }

  // Keyboard shortcut Ctrl+K or Cmd+K
  window.addEventListener('keydown', (e) => {
    const isK = e.key === 'k' || e.key === 'K' || e.code === 'KeyK';
    if ((e.ctrlKey || e.metaKey) && isK) {
      e.preventDefault();
      if (cmdModal && cmdModal.style.display === 'flex') {
        closeCommandPalette();
      } else {
        openCommandPalette();
      }
    }
    if (e.key === 'Escape' && cmdModal && cmdModal.style.display === 'flex') {
      closeCommandPalette();
    }
  });

  if (cmdModal) {
    cmdModal.addEventListener('click', (e) => {
      if (e.target === cmdModal) closeCommandPalette();
    });
  }

  // Mobile Bottom Navigation Bar Click Handlers
  const mobileNavItems = document.querySelectorAll('#mobileBottomNav .mobile-nav-item');
  mobileNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      if (target === 'drawer') {
        const drawer = document.getElementById('drawer');
        if (drawer) drawer.classList.toggle('open');
      } else if (target) {
        switchScreen(target);
      }
    });
  });

  // Filter Chip Tabs Click Listeners
  const filterChips = document.querySelectorAll('.cmd-filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => {
        c.classList.remove('active');
        c.style.background = 'var(--card-bg)';
        c.style.borderColor = 'var(--border-color)';
        c.style.color = 'var(--text-secondary)';
      });
      chip.classList.add('active');
      chip.style.background = 'var(--primary-color)';
      chip.style.borderColor = 'var(--primary-color)';
      chip.style.color = 'white';

      cmdActiveFilter = chip.getAttribute('data-filter');
      renderCommandResults();
    });
  });

  function renderCommandResults() {
    if (!cmdResults) return;
    const query = cmdInput ? cmdInput.value.trim().toLowerCase() : '';
    let matches = [];

    // 1. Modules / Navigation Screens
    if (cmdActiveFilter === 'all' || cmdActiveFilter === 'screen') {
      Object.keys(screens).forEach(key => {
        const s = screens[key];
        const title = s.title || key;
        if (!query || title.toLowerCase().includes(query)) {
          matches.push({
            type: 'screen',
            icon: s.menu?.querySelector('.material-icons')?.textContent || 'apps',
            title: title,
            subtitle: 'Module / Navigation Screen',
            action: () => switchScreen(key)
          });
        }
      });
    }

    // 2. Items
    if (cmdActiveFilter === 'all' || cmdActiveFilter === 'item') {
      if (Array.isArray(allItems)) {
        allItems.forEach(item => {
          const name = item.name || '';
          const code = item.code || '';
          const catName = item.category_name || '';
          if (!query || name.toLowerCase().includes(query) || code.toLowerCase().includes(query) || catName.toLowerCase().includes(query)) {
            matches.push({
              type: 'item',
              icon: 'inventory_2',
              title: `${name} ${code ? `(${code})` : ''}`,
              subtitle: `Stock Item • ₹${parseFloat(item.sales_price || 0).toFixed(2)} • ${catName || 'General'}`,
              action: () => {
                switchScreen('item');
                editItem(item.item_id);
              }
            });
          }
        });
      }
    }

    // 3. Customers
    if (cmdActiveFilter === 'all' || cmdActiveFilter === 'customer') {
      if (Array.isArray(allCustomers)) {
        allCustomers.forEach(cust => {
          const fullName = `${cust.first_name || ''} ${cust.last_name || ''}`.trim();
          const phone = cust.phone_1 || '';
          const email = cust.email || '';
          if (!query || fullName.toLowerCase().includes(query) || phone.includes(query) || email.toLowerCase().includes(query)) {
            matches.push({
              type: 'customer',
              icon: 'contact_mail',
              title: fullName,
              subtitle: `Customer • ${phone || 'No phone'} • ${cust.city || ''}`,
              action: () => {
                switchScreen('customer_listing');
                editCustomer(cust.customer_id);
              }
            });
          }
        });
      }
    }

    // 4. Users
    if (cmdActiveFilter === 'all' || cmdActiveFilter === 'user') {
      if (Array.isArray(allUsersList)) {
        allUsersList.forEach(u => {
          const username = u.username || '';
          const roleName = u.role_name || 'User';
          const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
          if (!query || username.toLowerCase().includes(query) || name.toLowerCase().includes(query) || roleName.toLowerCase().includes(query)) {
            matches.push({
              type: 'user',
              icon: 'person',
              title: `${username} (${name})`,
              subtitle: `System User • Role: ${roleName}`,
              action: () => {
                switchScreen('user_listing');
                editUser(u.user_id);
              }
            });
          }
        });
      }
    }

    cmdCurrentMatches = matches.slice(0, 30);
    if (cmdSelectedIndex >= cmdCurrentMatches.length) cmdSelectedIndex = 0;

    if (cmdCurrentMatches.length === 0) {
      cmdResults.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--text-secondary);">
          <span class="material-icons" style="font-size: 2.5rem; color: var(--border-color); margin-bottom: 0.5rem;">search_off</span>
          <div>No results found for "${query}"</div>
        </div>
      `;
      return;
    }

    cmdResults.innerHTML = cmdCurrentMatches.map((m, idx) => `
      <div class="cmd-item-row ${idx === cmdSelectedIndex ? 'selected' : ''}" data-index="${idx}" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.25rem; cursor: pointer; transition: background 0.15s ease; border-left: 3px solid ${idx === cmdSelectedIndex ? 'var(--primary-color)' : 'transparent'}; background: ${idx === cmdSelectedIndex ? 'var(--input-bg)' : 'transparent'};">
        <div style="display: flex; align-items: center; gap: 0.85rem;">
          <div style="width: 34px; height: 34px; border-radius: 8px; background: var(--input-bg); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; color: var(--primary-color);">
            <span class="material-icons" style="font-size: 1.1rem;">${m.icon}</span>
          </div>
          <div>
            <div style="font-weight: 600; color: var(--text-main); font-size: 0.92rem;">${m.title}</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">${m.subtitle}</div>
          </div>
        </div>
        <span class="material-icons" style="font-size: 1.1rem; color: var(--text-secondary); opacity: ${idx === cmdSelectedIndex ? '1' : '0'}; transition: opacity 0.15s ease;">subdirectory_arrow_left</span>
      </div>
    `).join('');

    const rows = cmdResults.querySelectorAll('.cmd-item-row');
    rows.forEach(r => {
      r.addEventListener('click', () => {
        const idx = parseInt(r.getAttribute('data-index'));
        if (cmdCurrentMatches[idx] && cmdCurrentMatches[idx].action) {
          cmdCurrentMatches[idx].action();
          closeCommandPalette();
        }
      });
    });
  };

  if (cmdInput) {
    cmdInput.addEventListener('input', () => {
      cmdSelectedIndex = 0;
      renderCommandResults();
    });

    cmdInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (cmdCurrentMatches.length > 0) {
          cmdSelectedIndex = (cmdSelectedIndex + 1) % cmdCurrentMatches.length;
          renderCommandResults();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (cmdCurrentMatches.length > 0) {
          cmdSelectedIndex = (cmdSelectedIndex - 1 + cmdCurrentMatches.length) % cmdCurrentMatches.length;
          renderCommandResults();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (cmdCurrentMatches[cmdSelectedIndex] && cmdCurrentMatches[cmdSelectedIndex].action) {
          cmdCurrentMatches[cmdSelectedIndex].action();
          closeCommandPalette();
        }
      }
    });
  }

  // --- App Mode / Restaurant POS Mode State and Listeners ---
  const settingAppMode = document.getElementById('settingAppMode');
  let appMode = localStorage.getItem('appMode') || 'retail';

  const updateReportTypeSelect = () => {
    if (!reportTypeSelect) return;
    const currentVal = reportTypeSelect.value;
    const isRestaurant = appMode === 'restaurant';
    
    let html = `
      <option value="customer">Customer Report</option>
      <option value="sales">Sales Ledger (Detail)</option>
      ${isRestaurant ? '' : '<option value="purchase">Purchase Ledger (Detail)</option>'}
      <option value="sales_by_date">Sales by Date Report</option>
      ${isRestaurant ? '' : '<option value="purchase_by_date">Purchase by Date Report</option>'}
      <option value="category_wise">Category-wise Report</option>
      <option value="item_wise">Item-wise Report</option>
      ${isRestaurant ? '' : '<option value="cash_flow">Cash Flow Analysis</option>'}
      <option value="item">Item Master List</option>
      <option value="category">Category Master List</option>
      <option value="user">User Master List</option>
    `;
    reportTypeSelect.innerHTML = html;
    
    if (currentVal && (currentVal !== 'purchase' || !isRestaurant)) {
      reportTypeSelect.value = currentVal;
    } else {
      reportTypeSelect.value = 'customer';
    }
  };

  const applyAppModeSettings = () => {
    const isRestaurant = appMode === 'restaurant';
    
    // Hide/show Purchase navigation menu item
    const menuPurchase = document.getElementById('menuPurchase');
    if (menuPurchase) {
      menuPurchase.style.display = isRestaurant ? 'none' : '';
    }

    // Hide/show Purchase-related stats on Reports screen
    const cardValMargin = document.getElementById('reportValMargin')?.closest('.stat-card');
    const cardValPurchases = document.getElementById('reportValPurchases')?.closest('.stat-card');
    if (cardValMargin) cardValMargin.style.display = isRestaurant ? 'none' : '';
    if (cardValPurchases) cardValPurchases.style.display = isRestaurant ? 'none' : '';

    // Toggle Purchase Price field visibility in New Item Modal
    const purchasePriceContainer = document.getElementById('purchase_price_container');
    if (purchasePriceContainer) {
      purchasePriceContainer.style.display = isRestaurant ? 'none' : '';
      const input = document.getElementById('item_purchase_price');
      if (input) {
        if (isRestaurant) {
          input.removeAttribute('required');
        } else {
          input.setAttribute('required', 'required');
        }
      }
    }

    // Update Report Module select options
    updateReportTypeSelect();
  };

  if (settingAppMode) {
    settingAppMode.value = appMode;
    settingAppMode.addEventListener('change', () => {
      appMode = settingAppMode.value;
      localStorage.setItem('appMode', appMode);
      applyAppModeSettings();
      alert(`Application mode switched to ${appMode === 'restaurant' ? 'Restaurant POS (Purchase features hidden)' : 'Retail POS'}.`);
    });
  }

  // Initial load execution of App Mode configuration
  applyAppModeSettings();

  screens['reports'].onTransition = async () => {
    updateReportTypeSelect();
    await loadReportsMetadata();
    await fetchReportsOverviewMetrics();
    await generateReport();
  };

  // --- LICENSE & AMC MANAGEMENT SECTION ---
  async function fetchLicenseDetails() {
    try {
      const response = await authFetch(getApiUrl('/api/license'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to load license details.');
        }
      const data = await response.json();
      
      // Update UI elements
      document.getElementById('licValKey').textContent = data.license_key;
      
      const valFrom = new Date(data.valid_from);
      const valTo = new Date(data.valid_to);
      const amcStart = new Date(data.amc_start_date);
      const amcEnd = new Date(data.amc_end_date);
      
      document.getElementById('licValFrom').textContent = `${valFrom.getDate()}/${valFrom.getMonth()+1}/${valFrom.getFullYear()}`;
      document.getElementById('licValTo').textContent = `${valTo.getDate()}/${valTo.getMonth()+1}/${valTo.getFullYear()}`;
      document.getElementById('licAmcValidity').textContent = `${amcStart.getDate()}/${amcStart.getMonth()+1}/${amcStart.getFullYear()} to ${amcEnd.getDate()}/${amcEnd.getMonth()+1}/${amcEnd.getFullYear()}`;
      
      const remainingDaysText = document.getElementById('licValDays');
      remainingDaysText.textContent = `${data.remaining_days} days`;
      
      const badge = document.getElementById('licenseStatusBadge');
      badge.textContent = data.status;
      badge.className = 'license-status-badge'; // reset
      
      const alertBanner = document.getElementById('licenseAlertBanner');
      const alertText = document.getElementById('licenseAlertText');
      
      if (data.status === 'Expired') {
        badge.classList.add('expired');
        alertBanner.style.display = 'flex';
        alertBanner.style.background = '#fee2e2';
        alertBanner.style.color = '#991b1b';
        alertBanner.style.borderLeft = '5px solid #ef4444';
        alertText.textContent = `Your software license and AMC support expired on ${valTo.getDate()}/${valTo.getMonth()+1}/${valTo.getFullYear()}. Please renew online instantly to restore all operations.`;
      } else if (data.status === 'Renewal Due') {
        badge.classList.add('due');
        alertBanner.style.display = 'flex';
        alertBanner.style.background = '#fef3c7';
        alertBanner.style.color = '#92400e';
        alertBanner.style.borderLeft = '5px solid #d97706';
        alertText.textContent = `Your Annual Maintenance Contract is expiring in ${data.remaining_days} days. Please renew online instantly to prevent system disruption.`;
      } else {
        badge.classList.add('active');
        alertBanner.style.display = 'none';
      }
    } catch (err) {
      console.error('License fetch failed:', err);
    }
  };

  // Bind License Renewal portal elements
  const licenseRenewalForm = document.getElementById('licenseRenewalForm');
  const licensePaymentModal = document.getElementById('licensePaymentModal');
  const licensePaymentClose = document.getElementById('licensePaymentClose');
  const btnCancelPayment = document.getElementById('btnCancelPayment');
  const btnConfirmPayment = document.getElementById('btnConfirmPayment');
  const spinnerPayment = document.getElementById('spinnerPayment');
  const payOptionUPI = document.getElementById('payOptionUPI');
  const payOptionCard = document.getElementById('payOptionCard');
  const paymentUPIView = document.getElementById('paymentUPIView');
  const paymentCardView = document.getElementById('paymentCardView');
  const upiMockQrImage = document.getElementById('upiMockQrImage');
  const renewPlanSelect = document.getElementById('renewPlanSelect');

  if (licenseRenewalForm) {
    licenseRenewalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      upiMockQrImage.src = 'scanner.png';
      licensePaymentModal.style.display = 'flex';
    });
  }

  const closeLicensePaymentModal = () => {
    licensePaymentModal.style.display = 'none';
    spinnerPayment.style.display = 'none';
  };

  if (licensePaymentClose) licensePaymentClose.addEventListener('click', closeLicensePaymentModal);
  if (btnCancelPayment) btnCancelPayment.addEventListener('click', closeLicensePaymentModal);

  if (payOptionUPI) {
    payOptionUPI.addEventListener('click', () => {
      payOptionUPI.classList.add('active');
      payOptionCard.classList.remove('active');
      payOptionUPI.style.borderColor = 'var(--primary-color)';
      payOptionCard.style.borderColor = 'var(--border-color)';
      paymentUPIView.style.display = 'block';
      paymentCardView.style.display = 'none';
    });
  }

  if (payOptionCard) {
    payOptionCard.addEventListener('click', () => {
      payOptionCard.classList.add('active');
      payOptionUPI.classList.remove('active');
      payOptionCard.style.borderColor = 'var(--primary-color)';
      payOptionUPI.style.borderColor = 'var(--border-color)';
      paymentCardView.style.display = 'block';
      paymentUPIView.style.display = 'none';
    });
  }

  if (btnConfirmPayment) {
    btnConfirmPayment.addEventListener('click', async () => {
      try {
        spinnerPayment.style.display = 'inline-block';
        btnConfirmPayment.disabled = true;
        
        const response = await authFetch(getApiUrl('/api/license/renew'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to complete online renewal.');
        }
        
        alert('Renewal payment processed successfully! Your software license validity and AMC support contract have been extended by 1 year.');
        closeLicensePaymentModal();
        await fetchLicenseDetails();
      } catch (err) {
        alert(`Renewal Error: ${err.message}`);
      } finally {
        btnConfirmPayment.disabled = false;
        spinnerPayment.style.display = 'none';
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🍴 RESTAURANT MODULE CLIENT LOGIC
  // ─────────────────────────────────────────────────────────────────────────
  // allTables hoisted to top
  
  
  
  let currentOrderItems = [];

  // --- TABLES MASTER ---
  async function fetchRestTables() {
    try {
      const response = await authFetch(getApiUrl('/api/restaurant/tables'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch restaurant tables');
        }
      allTables = await response.json();
      renderRestTables();
    } catch (err) {
      console.error(err);
    }
  };

  function renderRestTables() {
    const container = document.getElementById('tableGridContainer');
    if (!container) return;
    
    if (allTables.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1;" class="empty-state">No tables registered yet. Create one above!</div>`;
      return;
    }

    container.innerHTML = allTables.map(t => {
      let statusColor = '#10B981'; // Available - Green
      if (t.status === 'occupied') statusColor = '#EF4444'; // Occupied - Red
      else if (t.status === 'reserved') statusColor = '#3B82F6'; // Reserved - Blue

      return `
        <div class="card table-card" style="padding: 1.5rem; text-align: center; border-radius: 12px; border: 1.5px solid ${statusColor}; position: relative; background: var(--card-bg);">
          <span class="material-icons" style="font-size: 3rem; color: ${statusColor}; margin-bottom: 0.5rem;">table_restaurant</span>
          <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--text-main);">${t.table_no}</h3>
          <p style="margin: 4px 0; font-size: 0.85rem; color: var(--text-muted);">${t.section} • Capacity: ${t.capacity}</p>
          <div style="margin-top: 0.75rem; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; color: ${statusColor};">${t.status}</div>
          
          <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: center;">
            <button class="btn btn-secondary btn-table-edit" data-id="${t.table_id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; display: inline-flex; align-items: center; justify-content: center;"><span class="material-icons" style="font-size: 1rem;">edit</span></button>
            <button class="btn btn-danger btn-table-delete" data-id="${t.table_id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; display: inline-flex; align-items: center; justify-content: center;"><span class="material-icons" style="font-size: 1rem;">delete</span></button>
          </div>
        </div>
      `;
    }).join('');

    // Bind edit/delete actions
    container.querySelectorAll('.btn-table-edit').forEach(btn => {
      btn.addEventListener('click', () => openTableModal(btn.getAttribute('data-id')));
    });
    container.querySelectorAll('.btn-table-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteTable(btn.getAttribute('data-id')));
    });
  };

  const tableModal = document.getElementById('tableModal');
  const btnNewTable = document.getElementById('btnNewTable');
  const tableForm = document.getElementById('tableForm');

    function openTableModal(id = null) {
    const modal = document.getElementById('tableModal');
    if (!modal) return;
    if (modal.parentNode !== document.body) {
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';

    const tableForm = document.getElementById('tableForm');
    if (tableForm) tableForm.reset();
    const idInput = document.getElementById('table_id');
    if (idInput) idInput.value = id || '';
    if (id && Array.isArray(allTables)) {
      const table = allTables.find(t => t.table_id == id);
      if (table) {
        if (document.getElementById('table_no')) document.getElementById('table_no').value = table.table_no || '';
        if (document.getElementById('table_section')) document.getElementById('table_section').value = table.section || 'Main Hall';
        if (document.getElementById('table_capacity')) document.getElementById('table_capacity').value = table.capacity || 4;
      }
    }
  }

  if (btnNewTable) btnNewTable.addEventListener('click', () => openTableModal());
  if (document.getElementById('tableModalClose')) {
    document.getElementById('tableModalClose').addEventListener('click', () => { tableModal.style.display = 'none'; });
  }
  if (document.getElementById('btnTableCancel')) {
    document.getElementById('btnTableCancel').addEventListener('click', () => { tableModal.style.display = 'none'; });
  }

  if (tableForm) {
    tableForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('table_id').value;
      const data = {
        table_no: document.getElementById('table_no').value.trim(),
        section: document.getElementById('table_section').value,
        capacity: parseInt(document.getElementById('table_capacity').value) || 4
      };

      try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/restaurant/tables/${id}` : '/api/restaurant/tables';
        const response = await authFetch(getApiUrl(url), {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to save table');
        }
        tableModal.style.display = 'none';
        showToast('Table Saved', 'Restaurant dining table configuration updated successfully!', 'success');
        fetchRestTables();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  async function deleteTable(id) {
    if (!confirm('Are you sure you want to delete this table?')) return;
    try {
      const response = await authFetch(getApiUrl(`/api/restaurant/tables/${id}`), { method: 'DELETE' });
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to delete table');
        }
      showToast('Table Deleted', 'Table de-registered successfully', 'success');
      fetchRestTables();
    } catch (err) {
      alert(err.message);
    }
  };


  // --- RESTAURANT MENU TABS & LISTINGS ---
  let activeMenuTab = 'categories';
  const sectionMenuCategories = document.getElementById('sectionMenuCategories');
  const sectionMenuItems = document.getElementById('sectionMenuItems');
  const btnTabMenuCategories = document.getElementById('btnTabMenuCategories');
  const btnTabMenuItems = document.getElementById('btnTabMenuItems');

  const loadRestMenuTab = () => {
    if (activeMenuTab === 'categories') {
      if (btnTabMenuCategories) btnTabMenuCategories.className = 'btn btn-primary';
      if (btnTabMenuItems) btnTabMenuItems.className = 'btn btn-secondary';
      if (sectionMenuCategories) sectionMenuCategories.style.display = 'block';
      if (sectionMenuItems) sectionMenuItems.style.display = 'none';
      fetchMenuCategories();
    } else {
      if (btnTabMenuCategories) btnTabMenuCategories.className = 'btn btn-secondary';
      if (btnTabMenuItems) btnTabMenuItems.className = 'btn btn-primary';
      if (sectionMenuCategories) sectionMenuCategories.style.display = 'none';
      if (sectionMenuItems) sectionMenuItems.style.display = 'block';
      fetchMenuItems();
    }
  };

  if (btnTabMenuCategories) btnTabMenuCategories.addEventListener('click', () => { activeMenuTab = 'categories'; loadRestMenuTab(); });
  if (btnTabMenuItems) btnTabMenuItems.addEventListener('click', () => { activeMenuTab = 'items'; loadRestMenuTab(); });

  async function fetchMenuCategories() {
    try {
      const response = await authFetch(getApiUrl('/api/restaurant/menu/categories'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch categories');
        }
      allMenuCategories = await response.json();
      renderMenuCategories();
    } catch (err) {
      console.error(err);
    }
  };

  function renderMenuCategories() {
    const tbody = document.getElementById('menuCategoryTableBody');
    if (!tbody) return;
    if (allMenuCategories.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No categories registered yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = allMenuCategories.map((c, idx) => `
      <tr>
        <td><strong>#${idx + 1}</strong></td>
        <td><strong>${c.name}</strong></td>
        <td>${c.image_url || 'None'}</td>
        <td style="text-align: center;">
          <div class="table-actions" style="justify-content: center;">
            <button class="btn btn-secondary btn-category-edit" data-id="${c.category_id}" style="padding: 0.25rem 0.5rem; display: inline-flex; align-items: center; justify-content: center;"><span class="material-icons" style="font-size: 1rem;">edit</span></button>
            <button class="btn btn-danger btn-category-delete" data-id="${c.category_id}" style="padding: 0.25rem 0.5rem; display: inline-flex; align-items: center; justify-content: center;"><span class="material-icons" style="font-size: 1rem;">delete</span></button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-category-edit').forEach(btn => {
      btn.addEventListener('click', () => openCategoryModal(btn.getAttribute('data-id')));
    });
    tbody.querySelectorAll('.btn-category-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteMenuCategory(btn.getAttribute('data-id')));
    });
  };

  const menuCategoryModal = document.getElementById('menuCategoryModal');
  const btnNewMenuCategory = document.getElementById('btnNewMenuCategory');
  const menuCategoryForm = document.getElementById('menuCategoryForm');

    function openCategoryModal(id = null) {
    const modal = document.getElementById('menuCategoryModal');
    if (!modal) return;
    if (modal.parentNode !== document.body) {
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';

    const menuCategoryForm = document.getElementById('menuCategoryForm');
    if (menuCategoryForm) menuCategoryForm.reset();
    const catIdInput = document.getElementById('menu_category_id');
    if (catIdInput) catIdInput.value = id || '';
    if (id && Array.isArray(allMenuCategories)) {
      const cat = allMenuCategories.find(c => c.category_id == id);
      if (cat) {
        if (document.getElementById('menu_category_name')) document.getElementById('menu_category_name').value = cat.name || '';
        if (document.getElementById('menu_category_image')) document.getElementById('menu_category_image').value = cat.image_url || '';
      }
    }
  };

  if (btnNewMenuCategory) btnNewMenuCategory.addEventListener('click', () => openCategoryModal());
  if (document.getElementById('menuCategoryModalClose')) {
    document.getElementById('menuCategoryModalClose').addEventListener('click', () => { menuCategoryModal.style.display = 'none'; });
  }
  if (document.getElementById('btnMenuCategoryCancel')) {
    document.getElementById('btnMenuCategoryCancel').addEventListener('click', () => { menuCategoryModal.style.display = 'none'; });
  }

  if (menuCategoryForm) {
    menuCategoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('menu_category_id').value;
      const data = {
        name: document.getElementById('menu_category_name').value.trim(),
        image_url: document.getElementById('menu_category_image').value.trim() || null
      };

      try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/restaurant/menu/categories/${id}` : '/api/restaurant/menu/categories';
        const response = await authFetch(getApiUrl(url), {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to save category');
        }
        menuCategoryModal.style.display = 'none';
        showToast('Category Saved', 'Menu category created successfully!', 'success');
        fetchMenuCategories();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  const deleteMenuCategory = async (id) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      const response = await authFetch(getApiUrl(`/api/restaurant/menu/categories/${id}`), { method: 'DELETE' });
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to delete category');
        }
      showToast('Category Deleted', 'Category removed successfully', 'success');
      fetchMenuCategories();
    } catch (err) {
      alert(err.message);
    }
  };

  // --- MENU ITEMS ---
  async function fetchMenuItems() {
    try {
      const response = await authFetch(getApiUrl('/api/restaurant/menu/items'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch items');
        }
      allMenuItems = await response.json();
      renderMenuItems();
    } catch (err) {
      console.error(err);
    }
  };

  function renderMenuItems() {
    const tbody = document.getElementById('menuItemTableBody');
    if (!tbody) return;
    if (allMenuItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No menu items registered yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = allMenuItems.map(i => `
      <tr>
        <td><strong>${i.name}</strong><br><small style="color: var(--text-muted);">${i.description || 'No description'}</small></td>
        <td>${i.category_name || 'Unassigned'}</td>
        <td>₹${parseFloat(i.price).toFixed(2)}</td>
        <td><span class="status-badge" style="background: ${i.is_veg ? '#d1fae5; color: #065f46;' : '#fee2e2; color: #991b1b;'}">${i.is_veg ? 'VEG' : 'NON-VEG'}</span></td>
        <td>${i.preparation_time} mins</td>
        <td>${i.kitchen_dept}</td>
        <td>${parseFloat(i.gst_percent).toFixed(1)}%</td>
        <td style="text-align: center;">
          <div class="table-actions" style="justify-content: center;">
            <button class="btn btn-secondary btn-item-edit" data-id="${i.menu_item_id}" style="padding: 0.25rem 0.5rem; display: inline-flex; align-items: center; justify-content: center;"><span class="material-icons" style="font-size: 1rem;">edit</span></button>
            <button class="btn btn-danger btn-item-delete" data-id="${i.menu_item_id}" style="padding: 0.25rem 0.5rem; display: inline-flex; align-items: center; justify-content: center;"><span class="material-icons" style="font-size: 1rem;">delete</span></button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-item-edit').forEach(btn => {
      btn.addEventListener('click', () => openMenuItemModal(btn.getAttribute('data-id')));
    });
    tbody.querySelectorAll('.btn-item-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteMenuItem(btn.getAttribute('data-id')));
    });
  };

  const menuItemModal = document.getElementById('menuItemModal');
  const btnNewMenuItem = document.getElementById('btnNewMenuItem');
  const menuItemForm = document.getElementById('menuItemForm');

    function openMenuItemModal(id = null) {
    const modal = document.getElementById('menuItemModal');
    if (!modal) return;
    if (modal.parentNode !== document.body) {
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';

    const menuItemForm = document.getElementById('menuItemForm');
    if (menuItemForm) menuItemForm.reset();
    const itemIdInp = document.getElementById('menu_item_id');
    if (itemIdInp) itemIdInp.value = id || '';

    // Populate category dropdown
    const catSelect = document.getElementById('menu_item_category_id');
    if (catSelect && Array.isArray(allMenuCategories)) {
      catSelect.innerHTML = '<option value="">-- Select Category --</option>' +
        allMenuCategories.map(c => `<option value="${c.category_id}">${c.name}</option>`).join('');
    }

    if (id && Array.isArray(allMenuItems)) {
      const item = allMenuItems.find(i => i.item_id == id);
      if (item) {
        if (document.getElementById('menu_item_name')) document.getElementById('menu_item_name').value = item.name || '';
        if (document.getElementById('menu_item_category_id')) document.getElementById('menu_item_category_id').value = item.category_id || '';
        if (document.getElementById('menu_item_price')) document.getElementById('menu_item_price').value = item.price || '';
        if (document.getElementById('menu_item_description')) document.getElementById('menu_item_description').value = item.description || '';
        if (document.getElementById('menu_item_image')) document.getElementById('menu_item_image').value = item.image_url || '';
        if (document.getElementById('menu_item_veg')) document.getElementById('menu_item_veg').value = item.is_veg ? '1' : '0';
      }
    }
  };

  if (btnNewMenuItem) btnNewMenuItem.addEventListener('click', async () => {
    await fetchMenuCategories();
    openMenuItemModal();
  });
  if (document.getElementById('menuItemModalClose')) {
    document.getElementById('menuItemModalClose').addEventListener('click', () => { menuItemModal.style.display = 'none'; });
  }
  if (document.getElementById('btnMenuItemCancel')) {
    document.getElementById('btnMenuItemCancel').addEventListener('click', () => { menuItemModal.style.display = 'none'; });
  }

  if (menuItemForm) {
    menuItemForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('menu_item_id').value;
      const data = {
        name: document.getElementById('menu_item_name').value.trim(),
        category_id: parseInt(document.getElementById('menu_item_category').value) || null,
        price: parseFloat(document.getElementById('menu_item_price').value) || 0,
        gst_percent: parseFloat(document.getElementById('menu_item_gst').value) || 5.00,
        preparation_time: parseInt(document.getElementById('menu_item_prep').value) || 10,
        kitchen_dept: document.getElementById('menu_item_dept').value,
        description: document.getElementById('menu_item_desc').value.trim() || '',
        image_url: document.getElementById('menu_item_image').value.trim() || null,
        is_veg: document.getElementById('menu_item_veg').checked ? 1 : 0,
        available: document.getElementById('menu_item_available').checked ? 1 : 0
      };

      try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/restaurant/menu/items/${id}` : '/api/restaurant/menu/items';
        const response = await authFetch(getApiUrl(url), {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to save menu item');
        }
        menuItemModal.style.display = 'none';
        showToast('Item Saved', 'Menu dish item updated successfully!', 'success');
        fetchMenuItems();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  const deleteMenuItem = async (id) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    try {
      const response = await authFetch(getApiUrl(`/api/restaurant/menu/items/${id}`), { method: 'DELETE' });
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to delete item');
        }
      showToast('Item Deleted', 'Menu item removed successfully', 'success');
      fetchMenuItems();
    } catch (err) {
      alert(err.message);
    }
  };


  // --- RESTAURANT ORDERS & BILLING ---
  async function fetchRestOrders() {
    try {
      const response = await authFetch(getApiUrl('/api/restaurant/orders'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch restaurant orders');
        }
      allRestOrders = await response.json();
      renderRestOrders();
    } catch (err) {
      console.error(err);
    }
  };

  function renderRestOrders() {
    const tbody = document.getElementById('restOrdersTableBody');
    if (!tbody) return;
    if (allRestOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No active orders placed yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = allRestOrders.map(o => {
      const dateVal = new Date(o.created_date);
      const dateStr = `${dateVal.getHours().toString().padStart(2,'0')}:${dateVal.getMinutes().toString().padStart(2,'0')}`;
      
      let statusColor = '#F59E0B'; // Pending/accepted - Amber
      if (o.status === 'ready' || o.status === 'served') statusColor = '#10B981'; // Green
      else if (o.status === 'billed') statusColor = '#6366F1'; // Blue
      else if (o.status === 'cancelled') statusColor = '#EF4444'; // Red

      const getOrderAction = () => {
        if (o.status === 'pending' || o.status === 'accepted' || o.status === 'preparing') {
          return `<button class="btn btn-secondary btn-order-kot" data-id="${o.order_id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Add KOT</button>`;
        }
        if (o.status === 'ready' || o.status === 'served') {
          return `<button class="btn btn-primary btn-order-bill" data-id="${o.order_id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Generate Bill</button>`;
        }
        return `<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Settled</span>`;
      };

      return `
        <tr>
          <td><strong>#OR-${o.order_id}</strong></td>
          <td style="text-transform: uppercase;"><strong>${o.order_type}</strong></td>
          <td>${o.table_no ? `<strong>Table ${o.table_no}</strong> (${o.section})` : 'Parcel/Del.'}</td>
          <td>${o.customer_name || 'Walk-in Guest'}</td>
          <td><strong>₹${parseFloat(o.total).toFixed(2)}</strong></td>
          <td><span class="status-badge" style="background: ${statusColor}22; color: ${statusColor}; font-weight: bold; text-transform: uppercase;">${o.status}</span></td>
          <td>${dateStr}</td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center;">
              ${getOrderAction()}
              ${o.status !== 'cancelled' && o.status !== 'billed' ? `<button class="btn btn-danger btn-order-cancel" data-id="${o.order_id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; display: inline-flex; align-items: center; justify-content: center;"><span class="material-icons" style="font-size: 1rem;">cancel</span></button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-order-kot').forEach(btn => {
      btn.addEventListener('click', () => openRestOrderModal(btn.getAttribute('data-id')));
    });
    tbody.querySelectorAll('.btn-order-bill').forEach(btn => {
      btn.addEventListener('click', () => checkoutOrder(btn.getAttribute('data-id')));
    });
    tbody.querySelectorAll('.btn-order-cancel').forEach(btn => {
      btn.addEventListener('click', () => updateOrderStatus(btn.getAttribute('data-id'), 'cancelled'));
    });
  };

  const updateOrderStatus = async (id, status) => {
    if (status === 'cancelled' && !confirm('Are you sure you want to cancel this order?')) return;
    try {
      const response = await authFetch(getApiUrl(`/api/restaurant/orders/${id}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to update status');
        }
      showToast('Order Updated', `Order status updated to ${status}`, 'success');
      fetchRestOrders();
    } catch (err) {
      alert(err.message);
    }
  };

  const checkoutOrder = async (id) => {
    const order = allRestOrders.find(o => o.order_id == id);
    if (!order) return;

    if (!confirm(`Generate final bill checkout for Order #OR-${id} of ₹${parseFloat(order.total).toFixed(2)}?`)) return;

    const salesInvoiceData = {
      customer_id: order.customer_id,
      gross: order.total,
      tax: parseFloat(order.total) * 0.05,
      total: parseFloat(order.total) * 1.05,
      payment_method: 'Cash',
      items: order.items.map(i => ({
        item_id: null,
        item_name: i.item_name,
        quantity: i.quantity,
        item_amount: i.price,
        tax_amount: parseFloat(i.price) * 0.05
      }))
    };

    try {
      const response = await authFetch(getApiUrl('/api/sales'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salesInvoiceData)
      });
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to create sales invoice checkout.');
        }
      const result = await response.json();

      await authFetch(getApiUrl(`/api/restaurant/orders/${id}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'billed' })
      });

      showToast('Checkout Complete', 'Sales Invoice created & table released.', 'success');
      fetchRestOrders();
      openPrintReceipt(result.sales_id);
    } catch (err) {
      alert(err.message);
    }
  };

  const restOrderModal = document.getElementById('restOrderModal');
  const btnNewRestOrder = document.getElementById('btnNewRestOrder');
  const restOrderForm = document.getElementById('restOrderForm');
  const orderAddItemSelect = document.getElementById('orderAddItemSelect');
  const orderAddItemQty = document.getElementById('orderAddItemQty');
  const btnOrderAddItem = document.getElementById('btnOrderAddItem');
  const orderSelectedItemsBody = document.getElementById('orderSelectedItemsBody');
  const orderGrandTotal = document.getElementById('orderGrandTotal');

  async function openRestOrderModal(id = null) {
    if (!restOrderModal) return;
    restOrderForm.reset();
    currentOrderItems = [];
    document.getElementById('rest_order_id').value = id || '';

    try {
      const responseTab = await authFetch(getApiUrl('/api/restaurant/tables'));
      const listTab = await responseTab.json();
      const tabSelect = document.getElementById('order_table_id');
      if (tabSelect) {
        tabSelect.innerHTML = '<option value="">Select Table</option>' +
          listTab.map(t => `<option value="${t.table_id}">${t.table_no} (${t.section} Seating)</option>`).join('');
      }

      const responseCust = await authFetch(getApiUrl('/api/customers'));
      const listCust = await responseCust.json();
      const custSelect = document.getElementById('order_customer_id');
      if (custSelect) {
        custSelect.innerHTML = '<option value="">Walk-in Customer</option>' +
          listCust.map(c => `<option value="${c.customer_id}">${c.name} (${c.phone})</option>`).join('');
      }

      const responseWait = await authFetch(getApiUrl('/api/users'));
      const listWait = await responseWait.json();
      const waitSelect = document.getElementById('order_waiter_id');
      if (waitSelect) {
        waitSelect.innerHTML = '<option value="">Assign Waiter</option>' +
          listWait.map(u => `<option value="${u.user_id}">${u.username}</option>`).join('');
      }

      const responseMenu = await authFetch(getApiUrl('/api/restaurant/menu/items'));
      allMenuItems = await responseMenu.json();
      if (orderAddItemSelect) {
        orderAddItemSelect.innerHTML = '<option value="">Select Dish / Beverage</option>' +
          allMenuItems.map(i => `<option value="${i.menu_item_id}">${i.name} (₹${parseFloat(i.price).toFixed(2)})</option>`).join('');
      }

    } catch (err) {
      console.error(err);
    }

    if (id) {
      const order = allRestOrders.find(o => o.order_id == id);
      if (order) {
        document.getElementById('order_type').value = order.order_type;
        document.getElementById('order_table_id').value = order.table_id || '';
        document.getElementById('order_waiter_id').value = order.waiter_id || '';
        document.getElementById('order_customer_id').value = order.customer_id || '';
        document.getElementById('order_notes').value = order.notes || '';
      }
    }

    updateRestOrderItemsList();
    restOrderModal.style.display = 'flex';
  };

  const updateRestOrderItemsList = () => {
    if (!orderSelectedItemsBody) return;
    if (currentOrderItems.length === 0) {
      orderSelectedItemsBody.innerHTML = `<tr><td colspan="5" style="text-align: center;" class="empty-state">No items added to KOT ticket yet.</td></tr>`;
      orderGrandTotal.textContent = '₹0.00';
      return;
    }

    let total = 0;
    orderSelectedItemsBody.innerHTML = currentOrderItems.map((item, idx) => {
      const cost = item.price * item.quantity;
      total += cost;
      return `
        <tr>
          <td><strong>${item.name}</strong></td>
          <td style="text-align: right;">₹${parseFloat(item.price).toFixed(2)}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right; font-weight: bold; color: var(--primary-color);">₹${parseFloat(cost).toFixed(2)}</td>
          <td style="text-align: center;">
            <button type="button" class="btn btn-danger" onclick="removeKOTDraftItem(${idx})" style="padding: 0.15rem 0.4rem; font-size: 0.75rem; display: inline-flex; align-items: center; justify-content: center;"><span class="material-icons" style="font-size: 0.95rem;">delete</span></button>
          </td>
        </tr>
      `;
    }).join('');

    orderGrandTotal.textContent = `₹${parseFloat(total).toFixed(2)}`;
  };

  window.removeKOTDraftItem = (idx) => {
    currentOrderItems.splice(idx, 1);
    updateRestOrderItemsList();
  };

  if (btnOrderAddItem) {
    btnOrderAddItem.addEventListener('click', () => {
      const itemId = orderAddItemSelect.value;
      const qty = parseInt(orderAddItemQty.value) || 1;
      if (!itemId) return alert('Select a dish item first');

      const item = allMenuItems.find(i => i.menu_item_id == itemId);
      if (item) {
        const exist = currentOrderItems.find(i => i.menu_item_id == itemId);
        if (exist) {
          exist.quantity += qty;
        } else {
          currentOrderItems.push({
            menu_item_id: item.menu_item_id,
            name: item.name,
            price: parseFloat(item.price),
            quantity: qty
          });
        }
        updateRestOrderItemsList();
      }
    });
  }

  if (btnNewRestOrder) btnNewRestOrder.addEventListener('click', () => openRestOrderModal());
  if (document.getElementById('restOrderModalClose')) {
    document.getElementById('restOrderModalClose').addEventListener('click', () => { restOrderModal.style.display = 'none'; });
  }
  if (document.getElementById('btnRestOrderCancel')) {
    document.getElementById('btnRestOrderCancel').addEventListener('click', () => { restOrderModal.style.display = 'none'; });
  }

  if (restOrderForm) {
    restOrderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('rest_order_id').value;

      if (currentOrderItems.length === 0) return alert('Please add at least 1 menu item to place an order.');

      const data = {
        table_id: parseInt(document.getElementById('order_table_id').value) || null,
        customer_id: parseInt(document.getElementById('order_customer_id').value) || null,
        waiter_id: parseInt(document.getElementById('order_waiter_id').value) || null,
        order_type: document.getElementById('order_type').value,
        notes: document.getElementById('order_notes').value.trim(),
        items: currentOrderItems
      };

      try {
        const url = id ? `/api/restaurant/orders/${id}/items` : '/api/restaurant/orders';
        const response = await authFetch(getApiUrl(url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to submit order');
        }
        restOrderModal.style.display = 'none';
        showToast('KOT Submitted', 'KOT ticket routed to kitchen display system successfully!', 'success');
        fetchRestOrders();
      } catch (err) {
        alert(err.message);
      }
    });
  }


  // --- KITCHEN DISPLAY SYSTEM (KDS) Queue ---
  let kdsQueue = [];

  async function fetchKdsQueue() {
    try {
      const response = await authFetch(getApiUrl('/api/restaurant/kitchen/queue'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch KDS queue');
        }
      kdsQueue = await response.json();
      renderKdsQueue();
    } catch (err) {
      console.error(err);
    }
  };

  function renderKdsQueue() {
    const container = document.getElementById('kdsGridContainer');
    if (!container) return;

    const filterElem = document.getElementById('kdsDeptFilter');
    const filterVal = filterElem ? filterElem.value : 'ALL';
    const filteredQueue = kdsQueue.filter(item => filterVal === 'ALL' || item.kitchen_dept === filterVal);

    if (filteredQueue.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1;" class="empty-state">Kitchen Queue is clear! No active preparations.</div>`;
      return;
    }

    const orderGroups = {};
    filteredQueue.forEach(item => {
      if (!orderGroups[item.order_id]) {
        orderGroups[item.order_id] = {
          order_id: item.order_id,
          table_no: item.table_no,
          order_type: item.order_type,
          order_time: new Date(item.order_time),
          items: []
        };
      }
      orderGroups[item.order_id].items.push(item);
    });

    container.innerHTML = Object.values(orderGroups).map(group => {
      const elapsedMins = Math.round((Date.now() - group.order_time) / 60000);
      const isUrgent = elapsedMins > 15 ? 'color: #EF4444; font-weight: 800;' : '';

      const itemsHtml = group.items.map(item => {
        let statusBtn = `<button class="btn btn-secondary btn-kds-step" data-id="${item.id}" data-status="preparing" style="padding: 0.15rem 0.5rem; font-size: 0.75rem;">Prep</button>`;
        if (item.status === 'preparing') {
          statusBtn = `<button class="btn btn-primary btn-kds-step" data-id="${item.id}" data-status="ready" style="padding: 0.15rem 0.5rem; font-size: 0.75rem; background: #10B981; border: none;">Ready</button>`;
        }

        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px dashed var(--border-color);">
            <div>
              <span style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${parseInt(item.quantity)}x</span>
              <span style="color: var(--text-main); font-size: 0.9rem;">${item.item_name}</span>
              ${item.notes ? `<div style="font-size: 0.75rem; color: #EF4444; font-style: italic;">* ${item.notes}</div>` : ''}
              <div style="font-size: 0.7rem; color: var(--text-muted);">${item.kitchen_dept}</div>
            </div>
            <div>
              ${statusBtn}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="card kds-ticket" style="padding: 1.25rem; border-radius: 12px; border: 1.5px solid var(--border-color); background: var(--card-bg);">
          <div style="display: flex; justify-content: space-between; border-bottom: 1.5px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
            <div>
              <span style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">#OR-${group.order_id}</span>
              <span style="font-size: 0.8rem; text-transform: uppercase; margin-left: 0.5rem; padding: 2px 6px; border-radius: 12px; background: #E2E8F0; color: #475569; font-weight: 700;">${group.order_type}</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.95rem; font-weight: 700; color: var(--primary-color);">${group.table_no ? `Table ${group.table_no}` : 'Parcel'}</span>
              <div style="font-size: 0.75rem; ${isUrgent}">${elapsedMins} mins ago</div>
            </div>
          </div>
          <div class="kds-ticket-items">
            ${itemsHtml}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-kds-step').forEach(btn => {
      btn.addEventListener('click', () => {
        updateKdsItemStatus(btn.getAttribute('data-id'), btn.getAttribute('data-status'));
      });
    });
  };

  const updateKdsItemStatus = async (itemId, status) => {
    try {
      const response = await authFetch(getApiUrl(`/api/restaurant/orders/items/${itemId}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to update KDS item state');
        }
      fetchKdsQueue();
    } catch (err) {
      alert(err.message);
    }
  };

  if (document.getElementById('kdsDeptFilter')) {
    document.getElementById('kdsDeptFilter').addEventListener('change', renderKdsQueue);
  }

  // --- SSE REAL-TIME SYNCHRONIZATION ---
  const initRestaurantSSE = () => {
    if (!activeUser) return;
    const token = localStorage.getItem('pos_auth_token') || '';
    if (!token) return;
    console.log('Initializing Real-Time SSE Listener Stream...');
    const sse = new EventSource(getApiUrl(`/api/realtime-events?token=${encodeURIComponent(token)}`));

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.client_id && data.client_id !== activeUser.client_id) return;

        console.log('Real-Time Event Received:', data.type);
        
        if (activeScreen === 'rest_kds') {
          fetchKdsQueue();
        } else if (activeScreen === 'rest_orders') {
          fetchRestOrders();
        } else if (activeScreen === 'rest_tables') {
          fetchRestTables();
        }
      } catch (err) {
        console.error(err);
      }
    };

    sse.onerror = (err) => {
      // Close SSE stream on error to prevent infinite 401 reconnect loops
      try { sse.close(); } catch (e) {}
    };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 🏨 HOTEL MODULE CLIENT LOGIC [NEW]
  // ─────────────────────────────────────────────────────────────────────────
  
  
  
  

  // --- ROOMS MANAGEMENT ---
  async function fetchHotelRooms() {
    try {
      const response = await authFetch(getApiUrl('/api/hotel/rooms'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch rooms');
        }
      allRooms = await response.json();
      renderHotelRooms();
    } catch (err) {
      console.error(err);
    }
  };

  // --- Barcode & Label Printing Studio Logic ---
  async function initBarcodeStudio() {
    try {
      if (allItems.length === 0) {
        await fetchItems();
      }
      const select = document.getElementById('barcodeItemSelect');
      if (select) {
        select.innerHTML = '<option value="">-- Choose Item --</option>' +
          allItems.map(i => `<option value="${i.item_id}">${i.name} ${i.code ? `(${i.code})` : ''}</option>`).join('');
      }

      updateBarcodePreview();
    } catch (err) {
      console.error('Error initializing barcode studio:', err);
    }
  };

  const updateBarcodePreview = () => {
    const itemId = document.getElementById('barcodeItemSelect')?.value;
    const item = allItems.find(i => i.item_id == itemId) || (allItems.length > 0 ? allItems[0] : null);

    const storeNameEl = document.getElementById('prevStoreName');
    const itemNameEl = document.getElementById('prevItemName');
    const itemPriceEl = document.getElementById('prevItemPrice');
    const chkPrice = document.getElementById('chkShowPrice')?.checked;
    const chkStore = document.getElementById('chkShowStoreName')?.checked;
    const barcodeType = document.getElementById('barcodeType')?.value || 'CODE128';

    const storeTitle = localStorage.getItem('pos_receipt_title') || 'Vanshee POS';
    if (storeNameEl) {
      storeNameEl.textContent = storeTitle;
      storeNameEl.style.display = chkStore ? 'block' : 'none';
    }
    if (itemPriceEl) itemPriceEl.style.display = chkPrice ? 'block' : 'none';

    if (item) {
      if (itemNameEl) itemNameEl.textContent = item.name;
      if (itemPriceEl) itemPriceEl.textContent = `₹${parseFloat(item.sales_price || 0).toFixed(2)}`;
      
      const codeValue = item.code || `ITEM-${item.item_id}`;
      try {
        if (window.JsBarcode) {
          JsBarcode('#barcodeSvg', codeValue, {
            format: barcodeType === 'EAN13' ? 'EAN13' : 'CODE128',
            width: 1.5,
            height: 45,
            displayValue: true,
            fontSize: 12
          });
        }
      } catch (e) {
        console.warn('JsBarcode render error:', e);
      }
    } else {
      if (itemNameEl) itemNameEl.textContent = 'Select an item';
      if (itemPriceEl) itemPriceEl.textContent = '₹0.00';
    }
  };

  const printBarcodeLabelsSheet = () => {
    const qty = parseInt(document.getElementById('barcodePrintQty')?.value || '12');
    const previewHtml = document.getElementById('barcodeStickerPreview')?.outerHTML;
    if (!previewHtml) return;

    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <html>
        <head>
          <title>Print Barcode Label Sheet</title>
          <style>
            body { font-family: sans-serif; padding: 20px; margin: 0; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 15px; }
            @media print {
              body { padding: 0; }
              .grid { gap: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="grid">
            ${Array(qty).fill(previewHtml).join('')}
          </div>
          <script>
            setTimeout(() => { window.print(); window.close(); }, 500);
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  document.getElementById('barcodeItemSelect')?.addEventListener('change', updateBarcodePreview);
  document.getElementById('barcodeType')?.addEventListener('change', updateBarcodePreview);
  document.getElementById('chkShowPrice')?.addEventListener('change', updateBarcodePreview);
  document.getElementById('chkShowStoreName')?.addEventListener('change', updateBarcodePreview);
  document.getElementById('btnPrintBarcodeLabels')?.addEventListener('click', printBarcodeLabelsSheet);

  function renderHotelRooms() {
    const container = document.getElementById('roomGridContainer');
    if (!container) return;

    if (allRooms.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1;" class="empty-state">No rooms registered yet. Create one above!</div>`;
      return;
    }

    container.innerHTML = allRooms.map((r, idx) => {
      let statusColor = '#10B981'; // Available - Green
      if (r.status === 'occupied') statusColor = '#EF4444'; // Occupied - Red
      else if (r.status === 'dirty') statusColor = '#F59E0B'; // Dirty - Amber
      else if (r.status === 'maintenance') statusColor = '#64748B'; // Maintenance - Grey

      return `
        <div class="card room-card" style="padding: 1.5rem; text-align: center; border-radius: 12px; border: 1.5px solid ${statusColor}; background: var(--card-bg);">
          <span class="material-icons" style="font-size: 3rem; color: ${statusColor}; margin-bottom: 0.5rem;">bed</span>
          <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--text-main);">Room ${r.room_no}</h3>
          <p style="margin: 4px 0; font-size: 0.85rem; color: var(--text-muted);">${r.room_type} • ₹${parseFloat(r.price_per_night || 0).toFixed(2)}/night</p>
          <div style="margin-top: 0.75rem; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; color: ${statusColor};">${r.status}</div>
          
          <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: center;">
            <button class="btn btn-secondary btn-room-edit" data-id="${r.room_id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; display: inline-flex; align-items: center; justify-content: center;"><span class="material-icons" style="font-size: 1rem;">edit</span></button>
            <button class="btn btn-danger btn-room-delete" data-id="${r.room_id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; display: inline-flex; align-items: center; justify-content: center;"><span class="material-icons" style="font-size: 1rem;">delete</span></button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-room-edit').forEach(btn => {
      btn.addEventListener('click', () => openRoomModal(btn.getAttribute('data-id')));
    });
    container.querySelectorAll('.btn-room-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteRoom(btn.getAttribute('data-id')));
    });
  };

  const roomModal = document.getElementById('roomModal');
  const btnNewRoom = document.getElementById('btnNewRoom');
  const roomForm = document.getElementById('roomForm');

    function openRoomModal(id = null) {
    const modal = document.getElementById('roomModal');
    if (!modal) return;
    if (modal.parentNode !== document.body) {
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';

    const roomForm = document.getElementById('roomForm');
    if (roomForm) roomForm.reset();
    const roomIdInp = document.getElementById('room_id');
    if (roomIdInp) roomIdInp.value = id || '';

    if (id && Array.isArray(allRooms)) {
      const room = allRooms.find(r => r.room_id == id);
      if (room) {
        if (document.getElementById('room_no')) document.getElementById('room_no').value = room.room_no || '';
        if (document.getElementById('room_type')) document.getElementById('room_type').value = room.room_type || 'Standard';
        if (document.getElementById('room_rate')) document.getElementById('room_rate').value = room.rate_per_night || '';
        if (document.getElementById('room_status')) document.getElementById('room_status').value = room.status || 'available';
      }
    }
  };

  if (btnNewRoom) btnNewRoom.addEventListener('click', () => openRoomModal());
  if (document.getElementById('roomModalClose')) {
    document.getElementById('roomModalClose').addEventListener('click', () => { roomModal.style.display = 'none'; });
  }
  if (document.getElementById('btnRoomCancel')) {
    document.getElementById('btnRoomCancel').addEventListener('click', () => { roomModal.style.display = 'none'; });
  }

  if (roomForm) {
    roomForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('room_id').value;
      const data = {
        room_no: document.getElementById('room_no').value.trim(),
        room_type: document.getElementById('room_type').value,
        price_per_night: parseFloat(document.getElementById('room_price').value) || 0
      };

      try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/hotel/rooms/${id}` : '/api/hotel/rooms';
        const response = await authFetch(getApiUrl(url), {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to save room');
        }
        roomModal.style.display = 'none';
        showToast('Room Saved', 'Hotel room registered successfully!', 'success');
        fetchHotelRooms();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  const deleteRoom = async (id) => {
    if (!confirm('Are you sure you want to delete this room?')) return;
    try {
      const response = await authFetch(getApiUrl(`/api/hotel/rooms/${id}`), { method: 'DELETE' });
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to delete room');
        }
      showToast('Room Deleted', 'Room de-registered successfully', 'success');
      fetchHotelRooms();
    } catch (err) {
      alert(err.message);
    }
  };


  // --- GUESTS REGISTRY ---
  async function fetchHotelGuests() {
    try {
      const response = await authFetch(getApiUrl('/api/hotel/guests'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch guests');
        }
      allGuests = await response.json();
      renderHotelGuests();
    } catch (err) {
      console.error(err);
    }
  };

  function renderHotelGuests() {
    const tbody = document.getElementById('hotelGuestsTableBody');
    if (!tbody) return;

    if (allGuests.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No guests registered in system yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = allGuests.map((g, idx) => {
      const dateVal = new Date(g.created_date || Date.now());
      const dateStr = `${dateVal.getDate()}/${dateVal.getMonth()+1}/${dateVal.getFullYear()}`;
      return `
        <tr>
          <td><strong>#G-${g.display_id || g.guest_id}</strong></td>
          <td><strong>${g.name}</strong></td>
          <td>${g.phone}</td>
          <td>${g.email || 'N/A'}</td>
          <td>${g.id_proof_type || 'Aadhaar'}: ${g.id_proof_no || 'N/A'}</td>
          <td>${dateStr}</td>
          <td style="text-align: center;">
            <div class="table-actions" style="justify-content: center;">
              <button class="btn btn-secondary btn-guest-edit" data-id="${g.guest_id}" style="padding: 0.25rem 0.5rem; display: inline-flex; align-items: center; justify-content: center;"><span class="material-icons" style="font-size: 1rem;">edit</span></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-guest-edit').forEach(btn => {
      btn.addEventListener('click', () => openGuestModal(btn.getAttribute('data-id')));
    });
  };

  const guestModal = document.getElementById('guestModal');
  const btnNewGuest = document.getElementById('btnNewGuest');
  const guestForm = document.getElementById('guestForm');

    function openGuestModal(id = null) {
    const modal = document.getElementById('guestModal');
    if (!modal) return;
    if (modal.parentNode !== document.body) {
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';

    const guestForm = document.getElementById('guestForm');
    if (guestForm) guestForm.reset();
    const guestIdInp = document.getElementById('guest_id');
    if (guestIdInp) guestIdInp.value = id || '';

    if (id && Array.isArray(allGuests)) {
      const guest = allGuests.find(g => g.guest_id == id);
      if (guest) {
        if (document.getElementById('guest_name')) document.getElementById('guest_name').value = guest.full_name || '';
        if (document.getElementById('guest_phone')) document.getElementById('guest_phone').value = guest.phone || '';
        if (document.getElementById('guest_email')) document.getElementById('guest_email').value = guest.email || '';
        if (document.getElementById('guest_id_proof')) document.getElementById('guest_id_proof').value = guest.id_proof_type || 'Aadhaar';
        if (document.getElementById('guest_id_number')) document.getElementById('guest_id_number').value = guest.id_proof_number || '';
        if (document.getElementById('guest_address')) document.getElementById('guest_address').value = guest.address || '';
      }
    }
  };

  if (btnNewGuest) btnNewGuest.addEventListener('click', () => openGuestModal());
  if (document.getElementById('guestModalClose')) {
    document.getElementById('guestModalClose').addEventListener('click', () => { guestModal.style.display = 'none'; });
  }
  if (document.getElementById('btnGuestCancel')) {
    document.getElementById('btnGuestCancel').addEventListener('click', () => { guestModal.style.display = 'none'; });
  }

  if (guestForm) {
    guestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('guest_id').value;
      const data = {
        name: document.getElementById('guest_name').value.trim(),
        phone: document.getElementById('guest_phone').value.trim(),
        email: document.getElementById('guest_email').value.trim() || null,
        id_proof_type: document.getElementById('guest_id_type').value,
        id_proof_no: document.getElementById('guest_id_no').value.trim() || null
      };

      try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/hotel/guests/${id}` : '/api/hotel/guests';
        const response = await authFetch(getApiUrl(url), {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to save guest details');
        }
        guestModal.style.display = 'none';
        showToast('Guest Saved', 'Hotel guest details updated successfully!', 'success');
        fetchHotelGuests();
      } catch (err) {
        alert(err.message);
      }
    });
  }


  // --- HOTEL STAY BOOKINGS ---
  async function fetchHotelBookings() {
    try {
      const response = await authFetch(getApiUrl('/api/hotel/bookings'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch bookings');
        }
      allBookings = await response.json();
      renderHotelBookings();
    } catch (err) {
      console.error(err);
    }
  };

  function renderHotelBookings() {
    const tbody = document.getElementById('hotelBookingsTableBody');
    if (!tbody) return;

    if (allBookings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No stay folios checked-in yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = allBookings.map((b, idx) => {
      const inDate = new Date(b.check_in_date);
      const inStr = `${inDate.getDate()}/${inDate.getMonth()+1} ${inDate.getHours().toString().padStart(2,'0')}:${inDate.getMinutes().toString().padStart(2,'0')}`;
      
      let outStr = 'Ongoing';
      if (b.check_out_date && b.status === 'checked-out') {
        const outDate = new Date(b.check_out_date);
        outStr = `${outDate.getDate()}/${outDate.getMonth()+1} ${outDate.getHours().toString().padStart(2,'0')}:${outDate.getMinutes().toString().padStart(2,'0')}`;
      }

      let statusColor = '#F59E0B'; // Checked-in (Amber)
      if (b.status === 'checked-out') statusColor = '#10B981'; // Green
      else if (b.status === 'cancelled') statusColor = '#EF4444'; // Red

      const getActions = () => {
        if (b.status === 'checked-in') {
          return `
            <button class="btn btn-secondary btn-booking-service" data-id="${b.booking_id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Room Service</button>
            <button class="btn btn-primary btn-booking-checkout" data-id="${b.booking_id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Checkout Bill</button>
          `;
        }
        return `<span style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">Settled Folio</span>`;
      };

      return `
        <tr>
          <td><strong>#BK-${b.booking_id}</strong></td>
          <td><strong>Room ${b.room_no}</strong><br><small>${b.room_type}</small></td>
          <td><strong>${b.guest_name}</strong></td>
          <td>${b.guest_phone}</td>
          <td>${inStr}</td>
          <td>${outStr}</td>
          <td><span class="status-badge" style="background: ${statusColor}22; color: ${statusColor}; font-weight: bold; text-transform: uppercase;">${b.status}</span></td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center;">
              ${getActions()}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-booking-service').forEach(btn => {
      btn.addEventListener('click', () => openRoomServiceModal(btn.getAttribute('data-id')));
    });
    tbody.querySelectorAll('.btn-booking-checkout').forEach(btn => {
      btn.addEventListener('click', () => checkoutHotelBooking(btn.getAttribute('data-id')));
    });
  };

  const bookingModal = document.getElementById('bookingModal');
  const btnNewBooking = document.getElementById('btnNewBooking');
  const bookingForm = document.getElementById('bookingForm');

    async function openBookingModal() {
    const modal = document.getElementById('bookingModal');
    if (!modal) return;
    if (modal.parentNode !== document.body) {
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    bookingForm.reset();

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const checkInElem = document.getElementById('booking_check_in');
    if (checkInElem) checkInElem.value = now.toISOString().slice(0, 16);

    try {
      const responseG = await authFetch(getApiUrl('/api/hotel/guests'));
      const listG = responseG.ok ? await responseG.json() : [];
      if (Array.isArray(listG)) {
        allGuests = listG;
        const selectG = document.getElementById('booking_guest_id');
        if (selectG) {
          selectG.innerHTML = '<option value="">Select Stay Guest</option>' +
            listG.map(g => `<option value="${g.guest_id}">${g.name} (${g.phone})</option>`).join('');
        }
      }

      const responseR = await authFetch(getApiUrl('/api/hotel/rooms'));
      const listR = responseR.ok ? await responseR.json() : [];
      if (Array.isArray(listR)) {
        allRooms = listR;
        const availRooms = listR.filter(r => r.status === 'available');
        const selectR = document.getElementById('booking_room_id');
        if (selectR) {
          selectR.innerHTML = '<option value="">Select Available Room</option>' +
            availRooms.map(r => `<option value="${r.room_id}">Room ${r.room_no} (${r.room_type} - ₹${parseFloat(r.price_per_night || 0).toFixed(2)}/n)</option>`).join('');
        }
      }
    } catch (err) {
      console.error('Booking modal fetch error:', err);
    }
  };

  if (btnNewBooking) btnNewBooking.addEventListener('click', openBookingModal);
  if (document.getElementById('bookingModalClose')) {
    document.getElementById('bookingModalClose').addEventListener('click', () => { bookingModal.style.display = 'none'; });
  }
  if (document.getElementById('btnBookingCancel')) {
    document.getElementById('btnBookingCancel').addEventListener('click', () => { bookingModal.style.display = 'none'; });
  }

  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        guest_id: parseInt(document.getElementById('booking_guest_id').value),
        room_id: parseInt(document.getElementById('booking_room_id').value),
        check_in_date: document.getElementById('booking_check_in').value,
        check_out_date: document.getElementById('booking_check_out').value || null,
        notes: document.getElementById('booking_notes').value.trim()
      };

      try {
        const response = await authFetch(getApiUrl('/api/hotel/bookings'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to create check-in folio');
        }
        bookingModal.style.display = 'none';
        showToast('Guest Checked In', 'Stay folio created and room marked occupied.', 'success');
        fetchHotelBookings();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // --- ROOM SERVICE BILLING FOLIO ---
  const roomServiceModal = document.getElementById('roomServiceModal');
  const roomServiceForm = document.getElementById('roomServiceForm');
  const roomServiceItemsBody = document.getElementById('roomServiceItemsBody');

  async function openRoomServiceModal(bookingId) {
    if (!roomServiceModal) return;
    roomServiceForm.reset();
    document.getElementById('service_booking_id').value = bookingId;

    const booking = allBookings.find(b => b.booking_id == bookingId);
    if (booking) {
      document.getElementById('serviceRoomDetails').innerHTML = `
        <strong>Guest Name:</strong> ${booking.guest_name} &nbsp;&nbsp;|&nbsp;&nbsp; 
        <strong>Room Allocated:</strong> Room ${booking.room_no} (${booking.room_type})
      `;
    }

    await fetchRoomServices(bookingId);
    roomServiceModal.style.display = 'flex';
  };

  async function fetchRoomServices(bookingId) {
    try {
      const response = await authFetch(getApiUrl(`/api/hotel/bookings/${bookingId}/services`));
      activeBookingServices = await response.json();
      renderRoomServices();
    } catch (err) {
      console.error(err);
    }
  };

  function renderRoomServices() {
    if (!roomServiceItemsBody) return;
    if (activeBookingServices.length === 0) {
      roomServiceItemsBody.innerHTML = `<tr><td colspan="4" style="text-align: center;" class="empty-state">No room services ordered for this stay yet.</td></tr>`;
      return;
    }

    roomServiceItemsBody.innerHTML = activeBookingServices.map(s => {
      const cost = s.price * s.quantity;
      return `
        <tr>
          <td><strong>${s.item_name}</strong><br><small style="color: var(--text-muted); text-transform: uppercase;">${s.status}</small></td>
          <td style="text-align: right;">₹${parseFloat(s.price).toFixed(2)}</td>
          <td style="text-align: center;">${parseInt(s.quantity)}</td>
          <td style="text-align: right; font-weight: bold; color: var(--primary-color);">₹${parseFloat(cost).toFixed(2)}</td>
        </tr>
      `;
    }).join('');
  };

  if (document.getElementById('roomServiceModalClose')) {
    document.getElementById('roomServiceModalClose').addEventListener('click', () => { roomServiceModal.style.display = 'none'; });
  }

  if (roomServiceForm) {
    roomServiceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bookingId = document.getElementById('service_booking_id').value;
      const data = {
        item_name: document.getElementById('serviceItemName').value.trim(),
        quantity: parseInt(document.getElementById('serviceQty').value) || 1,
        price: parseFloat(document.getElementById('servicePrice').value) || 0
      };

      try {
        const response = await authFetch(getApiUrl(`/api/hotel/bookings/${bookingId}/services`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to order service');
        }
        showToast('Service Added', 'Room service charge appended to guest folio.', 'success');
        roomServiceForm.reset();
        fetchRoomServices(bookingId);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // --- CHECKOUT & BILL GENERATION ---
  const checkoutHotelBooking = async (bookingId) => {
    const booking = allBookings.find(b => b.booking_id == bookingId);
    if (!booking) return;

    const inDate = new Date(booking.check_in_date);
    const timeDiff = Math.abs(new Date() - inDate);
    const nights = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) || 1;
    const roomCost = nights * parseFloat(booking.price_per_night);

    let servicesTotal = 0;
    try {
      const response = await authFetch(getApiUrl(`/api/hotel/bookings/${bookingId}/services`));
      const services = await response.json();
      servicesTotal = services.reduce((sum, s) => sum + (parseFloat(s.price) * parseFloat(s.quantity)), 0);
    } catch (err) {
      console.error('Error fetching stay services:', err);
    }

    const subTotal = roomCost + servicesTotal;
    const tax = subTotal * 0.12; 
    const grandTotal = subTotal + tax;

    const confirmMsg = `
      Check-out summary for Room ${booking.room_no} (${booking.guest_name}):
      -----------------------------------------------
      Stay Duration: ${nights} night(s)
      Room Charges: ₹${roomCost.toFixed(2)} (₹${parseFloat(booking.price_per_night).toFixed(2)}/n)
      Room Service Charges: ₹${servicesTotal.toFixed(2)}
      Tax (12% Hotel Tax): ₹${tax.toFixed(2)}
      
      Total check-out amount: ₹${grandTotal.toFixed(2)}
      
      Generate checkout invoice & release room?
    `;

    if (!confirm(confirmMsg)) return;

    const salesInvoiceData = {
      customer_id: null,
      customer_name: booking.guest_name,
      gross: subTotal,
      tax: tax,
      total: grandTotal,
      payment_method: 'Cash',
      items: [
        {
          item_id: null,
          item_name: `Room Accommodation Charges (Room ${booking.room_no} - ${nights} Nights)`,
          quantity: nights,
          item_amount: parseFloat(booking.price_per_night),
          tax_amount: parseFloat(booking.price_per_night) * nights * 0.12
        }
      ]
    };

    try {
      const responseServ = await authFetch(getApiUrl(`/api/hotel/bookings/${bookingId}/services`));
      const servicesList = await responseServ.json();
      servicesList.forEach(s => {
        salesInvoiceData.items.push({
          item_id: null,
          item_name: `Room Service: ${s.item_name}`,
          quantity: parseFloat(s.quantity),
          item_amount: parseFloat(s.price),
          tax_amount: parseFloat(s.price) * parseFloat(s.quantity) * 0.12
        });
      });
    } catch (err) {
      console.error(err);
    }

    try {
      const response = await authFetch(getApiUrl('/api/sales'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salesInvoiceData)
      });
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to checkout guest invoice.');
        }
      const result = await response.json();

      await authFetch(getApiUrl(`/api/hotel/bookings/${bookingId}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'checked-out', total_amount: grandTotal })
      });

      showToast('Checkout Complete', 'Sales stay invoice generated and room released.', 'success');
      fetchHotelBookings();
      openPrintReceipt(result.sales_id);
    } catch (err) {
      alert(err.message);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 📦 INVENTORY & PURCHASE ORDER CLIENT LOGIC [NEW]
  // ─────────────────────────────────────────────────────────────────────────
  
  
  

  // --- INVENTORY MANAGEMENT ---
  async function fetchInventory() {
    try {
      const response = await authFetch(getApiUrl('/api/inventory'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch stock inventory');
        }
      allInventory = await response.json();
      renderInventory();
    } catch (err) {
      console.error(err);
    }
  };

  function renderInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    if (allInventory.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-state">No items registered in stock inventory yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = allInventory.map((i, idx) => {
      const current = parseFloat(i.current_stock || 0);
      const minStock = parseFloat(i.min_stock || 0);
      const isLow = current <= minStock;
      const expDate = i.expiry_date ? new Date(i.expiry_date).toLocaleDateString() : 'N/A';

      return `
        <tr style="${isLow ? 'background: rgba(239, 68, 68, 0.08);' : ''}">
          <td><strong>#INV-${i.display_id || i.inventory_id}</strong></td>
          <td><strong>${i.item_name}</strong></td>
          <td>${i.sku || 'N/A'}</td>
          <td>${i.barcode || 'N/A'}</td>
          <td style="text-align: right; font-weight: bold; color: ${isLow ? 'red' : 'inherit'};">${current.toFixed(2)} ${i.unit || 'pcs'}</td>
          <td style="text-align: right; color: var(--text-muted);">${minStock.toFixed(2)}</td>
          <td>${i.batch_no || 'N/A'}</td>
          <td>${expDate}</td>
          <td style="text-align: center;">
            <div class="table-actions" style="justify-content: center;">
              <button class="btn btn-secondary btn-inv-edit" data-id="${i.inventory_id}" style="padding: 0.25rem 0.5rem;"><span class="material-icons" style="font-size: 1rem;">edit</span></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-inv-edit').forEach(btn => {
      btn.addEventListener('click', () => openInvItemModal(btn.getAttribute('data-id')));
    });
  };

  const invItemModal = document.getElementById('invItemModal');
  const btnNewInvItem = document.getElementById('btnNewInvItem');
  const invItemForm = document.getElementById('invItemForm');

    function openInvItemModal(id = null) {
    const modal = document.getElementById('invItemModal');
    if (!modal) return;
    if (modal.parentNode !== document.body) {
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';

    const invItemForm = document.getElementById('invItemForm');
    if (invItemForm) invItemForm.reset();
    const invIdInp = document.getElementById('inv_item_id');
    if (invIdInp) invIdInp.value = id || '';

    if (id && Array.isArray(allInventory)) {
      const item = allInventory.find(i => i.item_id == id);
      if (item) {
        if (document.getElementById('inv_item_name')) document.getElementById('inv_item_name').value = item.item_name || '';
        if (document.getElementById('inv_sku')) document.getElementById('inv_sku').value = item.sku || '';
        if (document.getElementById('inv_category')) document.getElementById('inv_category').value = item.category || '';
        if (document.getElementById('inv_unit')) document.getElementById('inv_unit').value = item.unit || 'pcs';
        if (document.getElementById('inv_min_stock')) document.getElementById('inv_min_stock').value = item.min_stock_alert || 5;
        if (document.getElementById('inv_unit_cost')) document.getElementById('inv_unit_cost').value = item.unit_cost || 0;
      }
    }
  };

  if (btnNewInvItem) btnNewInvItem.addEventListener('click', () => openInvItemModal());
  if (document.getElementById('invItemModalClose')) {
    document.getElementById('invItemModalClose').addEventListener('click', () => { invItemModal.style.display = 'none'; });
  }
  if (document.getElementById('btnInvItemCancel')) {
    document.getElementById('btnInvItemCancel').addEventListener('click', () => { invItemModal.style.display = 'none'; });
  }

  if (invItemForm) {
    invItemForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('inventory_id').value;
      const data = {
        item_name: document.getElementById('inv_item_name').value.trim(),
        sku: document.getElementById('inv_sku').value.trim() || null,
        barcode: document.getElementById('inv_barcode').value.trim() || null,
        unit: document.getElementById('inv_unit').value.trim(),
        min_stock: parseFloat(document.getElementById('inv_min_stock').value) || 0,
        batch_no: document.getElementById('inv_batch').value.trim() || null,
        expiry_date: document.getElementById('inv_expiry').value || null
      };

      try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/inventory/${id}` : '/api/inventory';
        const response = await authFetch(getApiUrl(url), {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to save inventory item');
        }
        invItemModal.style.display = 'none';
        showToast('Inventory Updated', 'Stock ledger item saved successfully!', 'success');
        fetchInventory();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // --- MANUAL STOCK MOVEMENTS ADJUSTMENT ---
  const stockMovementModal = document.getElementById('stockMovementModal');
  const btnStockAdjust = document.getElementById('btnStockAdjust');
  const stockMovementForm = document.getElementById('stockMovementForm');

  function openStockMovementModal() {
    if (!stockMovementModal) return;
    stockMovementModal.style.display = 'flex';
    if (stockMovementForm) stockMovementForm.reset();
    
    const moveSelect = document.getElementById('move_inv_id');
    if (moveSelect && Array.isArray(allInventory)) {
      moveSelect.innerHTML = allInventory.map(i => {
        const curr = parseFloat(i.current_stock || i.base_quantity || 0).toFixed(2);
        return `<option value="${i.inventory_id}">${i.item_name || 'Item'} (Current: ${curr} ${i.unit || 'pcs'})</option>`;
      }).join('');
    }
  };

  if (btnStockAdjust) btnStockAdjust.addEventListener('click', openStockMovementModal);
  if (document.getElementById('stockMovementModalClose')) {
    document.getElementById('stockMovementModalClose').addEventListener('click', () => { stockMovementModal.style.display = 'none'; });
  }
  if (document.getElementById('btnMoveCancel')) {
    document.getElementById('btnMoveCancel').addEventListener('click', () => { stockMovementModal.style.display = 'none'; });
  }

  if (stockMovementForm) {
    stockMovementForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        inventory_id: parseInt(document.getElementById('move_inv_id').value),
        type: document.getElementById('move_type').value,
        quantity: parseFloat(document.getElementById('move_qty').value) || 0,
        reference: document.getElementById('move_ref').value.trim() || null,
        notes: document.getElementById('move_notes').value.trim() || null,
        created_by: activeUser?.first_name || 'System'
      };

      try {
        const response = await authFetch(getApiUrl('/api/inventory/movement'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to post stock transaction');
        }
        stockMovementModal.style.display = 'none';
        showToast('Stock Posted', 'Ledger balances updated successfully!', 'success');
        fetchInventory();
      } catch (err) {
        alert(err.message);
      }
    });
  }


  // --- PURCHASE ORDERS (PO) MANAGEMENT ---
  async function fetchPurchaseOrders() {
    try {
      const response = await authFetch(getApiUrl('/api/purchase-orders'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch purchase orders');
        }
      allPOs = await response.json();
      renderPurchaseOrders();
    } catch (err) {
      console.error(err);
    }
  };

  function renderPurchaseOrders() {
    const tbody = document.getElementById('poTableBody');
    if (!tbody) return;

    if (allPOs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No Purchase Orders created yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = allPOs.map((po, idx) => {
      const dateVal = new Date(po.created_date);
      const dateStr = `${dateVal.getDate()}/${dateVal.getMonth()+1}/${dateVal.getFullYear()}`;
      
      let statusColor = '#64748B'; 
      if (po.status === 'ordered') statusColor = '#F59E0B'; 
      else if (po.status === 'received') statusColor = '#10B981'; 

      const getActions = () => {
        if (po.status === 'draft') {
          return `
            <button class="btn btn-primary btn-po-send" data-id="${po.po_id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Send to Vendor</button>
          `;
        } else if (po.status === 'ordered') {
          return `
            <button class="btn btn-secondary btn-po-receive" data-id="${po.po_id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Receive GRN</button>
          `;
        }
        return `<span style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">Received & Filed</span>`;
      };

      return `
        <tr>
          <td><strong>#PO-${idx + 1}</strong></td>
          <td><strong>${po.vendor_company || 'N/A'}</strong><br><small>${po.vendor_name}</small></td>
          <td>${po.created_by || 'System'}</td>
          <td><strong>₹${parseFloat(po.total).toFixed(2)}</strong></td>
          <td><span class="status-badge" style="background: ${statusColor}22; color: ${statusColor}; font-weight: bold; text-transform: uppercase;">${po.status}</span></td>
          <td>${dateStr}</td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center;">
              ${getActions()}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-po-send').forEach(btn => {
      btn.addEventListener('click', () => updatePoStatus(btn.getAttribute('data-id'), 'ordered'));
    });
    tbody.querySelectorAll('.btn-po-receive').forEach(btn => {
      btn.addEventListener('click', () => openGrnModal(btn.getAttribute('data-id')));
    });
  };

  const updatePoStatus = async (poId, status) => {
    try {
      const response = await authFetch(getApiUrl(`/api/purchase-orders/${poId}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to update PO status');
        }
      showToast('PO Updated', `Purchase order marked as ${status}!`, 'success');
      fetchPurchaseOrders();
    } catch (err) {
      alert(err.message);
    }
  };

  // --- CREATE PO FORM & CART ---
  const purchaseOrderModal = document.getElementById('purchaseOrderModal');
  const btnNewPO = document.getElementById('btnNewPO');
  const poForm = document.getElementById('poForm');
  const poItemsCartBody = document.getElementById('poItemsCartBody');

    async function openPoModal() {
    const modal = document.getElementById('purchaseOrderModal');
    if (!modal) return;
    if (modal.parentNode !== document.body) {
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    if (poForm) poForm.reset();
    poCartItems = [];
    renderPoCart();

    try {
      const responseV = await authFetch(getApiUrl('/api/vendors'));
      const listV = responseV.ok ? await responseV.json() : [];
      if (Array.isArray(listV)) {
        const selectV = document.getElementById('po_vendor_id');
        if (selectV) {
          selectV.innerHTML = '<option value="">Select Supply Vendor</option>' +
            listV.map(v => `<option value="${v.vendor_id}">${v.company || v.company_name || 'Vendor'} (${v.first_name || ''} ${v.last_name || ''})</option>`).join('');
        }
      }
    } catch (err) {
      console.error('PO modal vendor fetch error:', err);
    }
  };

  if (btnNewPO) btnNewPO.addEventListener('click', openPoModal);
  if (document.getElementById('poModalClose')) {
    document.getElementById('poModalClose').addEventListener('click', () => { purchaseOrderModal.style.display = 'none'; });
  }
  if (document.getElementById('btnPoCancel')) {
    document.getElementById('btnPoCancel').addEventListener('click', () => { purchaseOrderModal.style.display = 'none'; });
  }

  function renderPoCart() {
    if (!poItemsCartBody) return;
    if (poCartItems.length === 0) {
      poItemsCartBody.innerHTML = `<tr><td colspan="5" style="text-align: center;" class="empty-state">No line items in supply draft yet.</td></tr>`;
      document.getElementById('poGrandTotalText').innerText = '₹0.00';
      return;
    }

    let grand = 0;
    poItemsCartBody.innerHTML = poCartItems.map((item, idx) => {
      const total = item.quantity * item.price;
      grand += total;
      return `
        <tr>
          <td><strong>${item.item_name}</strong></td>
          <td style="text-align: right;">₹${parseFloat(item.price).toFixed(2)}</td>
          <td style="text-align: center;">${parseInt(item.quantity)}</td>
          <td style="text-align: right; font-weight: bold; color: var(--primary-color);">₹${total.toFixed(2)}</td>
          <td style="text-align: center;">
            <button type="button" class="btn btn-danger btn-po-cart-del" data-idx="${idx}" style="padding: 0.15rem 0.35rem;"><span class="material-icons" style="font-size: 0.95rem;">delete</span></button>
          </td>
        </tr>
      `;
    }).join('');

    document.getElementById('poGrandTotalText').innerText = `₹${grand.toFixed(2)}`;

    poItemsCartBody.querySelectorAll('.btn-po-cart-del').forEach(btn => {
      btn.addEventListener('click', () => {
        poCartItems.splice(parseInt(btn.getAttribute('data-idx')), 1);
        renderPoCart();
      });
    });
  };

  if (document.getElementById('btnAddPoItem')) {
    document.getElementById('btnAddPoItem').addEventListener('click', () => {
      const name = document.getElementById('poItemName').value.trim();
      const qty = parseInt(document.getElementById('poItemQty').value) || 1;
      const price = parseFloat(document.getElementById('poItemPrice').value) || 0;

      if (!name || price <= 0) return;
      poCartItems.push({ item_name: name, quantity: qty, price: price });
      
      document.getElementById('poItemName').value = '';
      document.getElementById('poItemQty').value = '1';
      document.getElementById('poItemPrice').value = '';
      renderPoCart();
    });
  }

  if (poForm) {
    poForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (poCartItems.length === 0) {
        alert('Please add at least one line item to this purchase order cart first!');
        return;
      }

      let total = poCartItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const data = {
        vendor_id: parseInt(document.getElementById('po_vendor_id').value),
        items: poCartItems,
        total: total,
        created_by: activeUser?.first_name || 'System'
      };

      try {
        const response = await authFetch(getApiUrl('/api/purchase-orders'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to create purchase order');
        }
        purchaseOrderModal.style.display = 'none';
        showToast('PO Draft Created', 'Vendor purchase order saved to ledger.', 'success');
        fetchPurchaseOrders();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // --- GOODS RECEIVED NOTE (GRN) DIALOG ---
  const grnModal = document.getElementById('grnModal');
  const grnForm = document.getElementById('grnForm');
  const grnItemsTableBody = document.getElementById('grnItemsTableBody');
  let activePoDetails = null;

  async function openGrnModal(poId) {
    if (!grnModal) return;
    grnForm.reset();
    document.getElementById('grn_po_id').value = poId;

    try {
      const response = await authFetch(getApiUrl(`/api/purchase-orders/${poId}`));
      activePoDetails = await response.json();

      document.getElementById('grnPoSummaryText').innerHTML = `
        <strong>PO Reference:</strong> #PO-${activePoDetails.po_id} &nbsp;&nbsp;|&nbsp;&nbsp; 
        <strong>Vendor:</strong> ${activePoDetails.vendor_company || ""} (${activePoDetails.vendor_name})
      `;

      if (grnItemsTableBody) {
        grnItemsTableBody.innerHTML = activePoDetails.items.map((item, idx) => {
          return `
            <tr>
              <td><strong>${item.item_name}</strong></td>
              <td style="text-align: center;">${parseInt(item.quantity)}</td>
              <td style="text-align: center;">
                <input type="number" class="grn-recv-qty-input" data-idx="${idx}" value="${parseInt(item.quantity)}" min="0" max="${parseInt(item.quantity) * 2}" style="width: 80px; padding: 0.35rem; border: 1px solid var(--border-color); border-radius: 4px; text-align: center;">
              </td>
            </tr>
          `;
        }).join('');
      }

      grnModal.style.display = 'flex';
    } catch (err) {
      console.error(err);
    }
  };

  if (document.getElementById('grnModalClose')) {
    document.getElementById('grnModalClose').addEventListener('click', () => { grnModal.style.display = 'none'; });
  }
  if (document.getElementById('btnGrnCancel')) {
    document.getElementById('btnGrnCancel').addEventListener('click', () => { grnModal.style.display = 'none'; });
  }

  if (grnForm) {
    grnForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const poId = document.getElementById('grn_po_id').value;
      const grnItems = [];

      const inputs = grnItemsTableBody.querySelectorAll('.grn-recv-qty-input');
      inputs.forEach(inp => {
        const idx = parseInt(inp.getAttribute('data-idx'));
        const originalItem = activePoDetails.items[idx];
        grnItems.push({
          item_name: originalItem.item_name,
          quantity_ordered: parseFloat(originalItem.quantity),
          quantity_received: parseFloat(inp.value) || 0
        });
      });

      const data = {
        received_by: activeUser?.user_id || null,
        notes: document.getElementById('grn_notes').value.trim() || '',
        items: grnItems
      };

      try {
        const response = await authFetch(getApiUrl(`/api/purchase-orders/${poId}/grn`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to submit GRN inventory receipt');
        }
        grnModal.style.display = 'none';
        showToast('GRN Completed', 'Goods Received and stock ledger updated successfully!', 'success');
        fetchPurchaseOrders();
        fetchInventory();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 👥 EMPLOYEE & STAFF ATTENDANCE CLIENT LOGIC [NEW]
  // ─────────────────────────────────────────────────────────────────────────
  
  

  // --- EMPLOYEE MANAGEMENT ---
  async function fetchEmployees() {
    try {
      const response = await authFetch(getApiUrl('/api/employees'));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to fetch employees list');
        }
      allEmployees = await response.json();
      renderEmployees();
    } catch (err) {
      console.error(err);
    }
  };

  function renderEmployees() {
    const tbody = document.getElementById('employeesTableBody');
    if (!tbody) return;

    if (allEmployees.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-state">No staff employees registered yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = allEmployees.map((e, idx) => {
      const salaryVal = parseFloat(e.salary || 0);
      const joinStr = e.join_date ? new Date(e.join_date).toLocaleDateString() : 'N/A';

      return `
        <tr>
          <td><strong>#EMP-${idx + 1}</strong></td>
          <td><strong>${e.first_name} ${e.last_name}</strong></td>
          <td>${e.designation || 'N/A'}</td>
          <td>${e.department || 'N/A'}</td>
          <td>${e.phone || 'N/A'}</td>
          <td style="text-align: right; font-weight: bold;">₹${salaryVal.toFixed(2)}</td>
          <td>${joinStr}</td>
          <td><span class="status-badge" style="background: var(--primary-bg); color: var(--primary-color); font-weight: bold;">${e.role_name || 'No Access'}</span></td>
          <td style="text-align: center;">
            <div class="table-actions" style="justify-content: center;">
              <button class="btn btn-secondary btn-emp-edit" data-id="${e.employee_id}" style="padding: 0.25rem 0.5rem;"><span class="material-icons" style="font-size: 1rem;">edit</span></button>
              <button class="btn btn-danger btn-emp-del" data-id="${e.employee_id}" style="padding: 0.25rem 0.5rem;"><span class="material-icons" style="font-size: 1rem;">delete</span></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-emp-edit').forEach(btn => {
      btn.addEventListener('click', () => openEmployeeModal(btn.getAttribute('data-id')));
    });
    tbody.querySelectorAll('.btn-emp-del').forEach(btn => {
      btn.addEventListener('click', () => deactivateEmployee(btn.getAttribute('data-id')));
    });
  };

  const employeeModal = document.getElementById('employeeModal');
  const btnNewEmployee = document.getElementById('btnNewEmployee');
  const employeeForm = document.getElementById('employeeForm');

  async function openEmployeeModal(id = null) {
    const modal = document.getElementById('employeeModal');
    if (!modal) return;
    if (modal.parentNode !== document.body) {
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.style.zIndex = '999999';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    const form = document.getElementById('employeeForm');
    if (form) form.reset();
    const empIdInp = document.getElementById('employee_id');
    if (empIdInp) empIdInp.value = id || '';
    
    try {
      const responseR = await authFetch(getApiUrl('/api/roles'));
      const listR = responseR.ok ? await responseR.json() : [];
      if (Array.isArray(listR)) {
        const empRoleSelect = document.getElementById('emp_role_id');
        if (empRoleSelect) {
          empRoleSelect.innerHTML = '<option value="">No System Access (Staff)</option>' +
            listR.map(r => `<option value="${r.role_id}">${r.role_name}</option>`).join('');
        }
      }
    } catch (err) {
      console.error('Roles fetch error in employee modal:', err);
    }

    if (id && Array.isArray(allEmployees)) {
      const emp = allEmployees.find(e => e.employee_id == id);
      if (emp) {
        if (document.getElementById('emp_first_name')) document.getElementById('emp_first_name').value = emp.first_name || '';
        if (document.getElementById('emp_last_name')) document.getElementById('emp_last_name').value = emp.last_name || '';
        if (document.getElementById('emp_phone')) document.getElementById('emp_phone').value = emp.phone || '';
        if (document.getElementById('emp_email')) document.getElementById('emp_email').value = emp.email || '';
        if (document.getElementById('emp_designation')) document.getElementById('emp_designation').value = emp.designation || '';
        if (document.getElementById('emp_department')) document.getElementById('emp_department').value = emp.department || '';
        if (document.getElementById('emp_salary')) document.getElementById('emp_salary').value = emp.salary || '';
        if (document.getElementById('emp_join_date')) document.getElementById('emp_join_date').value = emp.join_date ? emp.join_date.slice(0, 10) : '';
        if (document.getElementById('emp_role_id')) document.getElementById('emp_role_id').value = emp.role_id || '';
      }
    }
  }

  window.openEmployeeModal = openEmployeeModal;
  window.deactivateEmployee = deactivateEmployee;

  if (btnNewEmployee) btnNewEmployee.addEventListener('click', () => openEmployeeModal());
  if (document.getElementById('employeeModalClose')) {
    document.getElementById('employeeModalClose').addEventListener('click', () => { 
      const modal = document.getElementById('employeeModal');
      if (modal) modal.style.display = 'none'; 
    });
  }
  if (document.getElementById('btnEmpCancel')) {
    document.getElementById('btnEmpCancel').addEventListener('click', () => { 
      const modal = document.getElementById('employeeModal');
      if (modal) modal.style.display = 'none'; 
    });
  }

  if (employeeForm) {
    employeeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('employee_id').value;
      const data = {
        first_name: document.getElementById('emp_first_name').value.trim(),
        last_name: document.getElementById('emp_last_name').value.trim(),
        phone: document.getElementById('emp_phone').value.trim(),
        email: document.getElementById('emp_email').value.trim() || null,
        designation: document.getElementById('emp_designation').value.trim() || null,
        department: document.getElementById('emp_department').value.trim() || null,
        salary: parseFloat(document.getElementById('emp_salary').value) || 0.0,
        join_date: document.getElementById('emp_join_date').value || null,
        role_id: parseInt(document.getElementById('emp_role_id').value) || null,
        password: document.getElementById('emp_password').value.trim() || null
      };

      try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/employees/${id}` : '/api/employees';
        const response = await authFetch(getApiUrl(url), {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to save employee profile');
        }
        employeeModal.style.display = 'none';
        showToast('Profile Saved', 'Employee staff directory updated successfully!', 'success');
        fetchEmployees();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  async function deactivateEmployee(id) {
    if (!confirm('Are you sure you want to deactivate this employee?')) return;
    try {
      const response = await authFetch(getApiUrl(`/api/employees/${id}`), { method: 'DELETE' });
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to deactivate employee');
        }
      showToast('Employee Deactivated', 'Staff user marked inactive.', 'success');
      fetchEmployees();
    } catch (err) {
      alert(err.message);
    }
  };

  // --- STAFF ATTENDANCE ---
  const attendanceDatePicker = document.getElementById('attendanceDatePicker');
  if (attendanceDatePicker) {
    attendanceDatePicker.value = new Date().toISOString().substring(0, 10);
    attendanceDatePicker.addEventListener('change', () => fetchAttendance());
  }

  async function fetchAttendance() {
    const date = attendanceDatePicker ? attendanceDatePicker.value : new Date().toISOString().substring(0, 10);
    try {
      const response = await authFetch(getApiUrl(`/api/employees/attendance?date=${date}`));
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to load attendance sheet');
        }
      allAttendance = await response.json();
      renderAttendance();
    } catch (err) {
      console.error(err);
    }
  };

  function renderAttendance() {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;

    if (allAttendance.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No active employees to track attendance for.</td></tr>`;
      return;
    }

    tbody.innerHTML = allAttendance.map(att => {
      const checkInStr = att.check_in || '--:--';
      const checkOutStr = att.check_out || '--:--';

      let selectClass = '';
      if (att.status === 'present') selectClass = 'style="color: var(--accent); font-weight: bold;"';
      else if (att.status === 'absent') selectClass = 'style="color: #ef4444; font-weight: bold;"';
      else if (att.status === 'leave') selectClass = 'style="color: #f59e0b; font-weight: bold;"';

      return `
        <tr>
          <td><strong>${att.first_name} ${att.last_name}</strong></td>
          <td>${att.designation || 'Staff'} <br><small class="text-muted">${att.department || 'General'}</small></td>
          <td><strong style="color: var(--primary-color);">${checkInStr}</strong></td>
          <td><strong style="color: var(--text-muted);">${checkOutStr}</strong></td>
          <td>
            <select class="attendance-status-select" data-id="${att.employee_id}" ${selectClass} style="padding: 0.35rem; border-radius: 6px; border: 1.5px solid var(--border-color); background: var(--input-bg); color: var(--text-main);">
              <option value="present" ${att.status === 'present' ? 'selected' : ''}>Present</option>
              <option value="absent" ${att.status === 'absent' ? 'selected' : ''}>Absent</option>
              <option value="leave" ${att.status === 'leave' ? 'selected' : ''}>On Leave</option>
            </select>
          </td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 0.5rem; justify-content: center;">
              <button class="btn btn-primary btn-checkin" data-id="${att.employee_id}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;"><span class="material-icons" style="font-size: 0.95rem; vertical-align: middle;">login</span> Check-in</button>
              <button class="btn btn-secondary btn-checkout" data-id="${att.employee_id}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;"><span class="material-icons" style="font-size: 0.95rem; vertical-align: middle;">logout</span> Check-out</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.attendance-status-select').forEach(sel => {
      sel.addEventListener('change', () => {
        updateAttendanceStatus(sel.getAttribute('data-id'), sel.value);
      });
    });

    tbody.querySelectorAll('.btn-checkin').forEach(btn => {
      btn.addEventListener('click', () => logCheckInOut(btn.getAttribute('data-id'), 'check-in'));
    });

    tbody.querySelectorAll('.btn-checkout').forEach(btn => {
      btn.addEventListener('click', () => logCheckInOut(btn.getAttribute('data-id'), 'check-out'));
    });
  };

  const updateAttendanceStatus = async (empId, status) => {
    const date = attendanceDatePicker ? attendanceDatePicker.value : new Date().toISOString().substring(0, 10);
    try {
      const response = await authFetch(getApiUrl('/api/employees/attendance/status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: parseInt(empId), date, status })
      });
      if (!response.ok) {
          const errRes = await response.json().catch(() => ({}));
          throw new Error(errRes.error || errRes.message || 'Failed to update status');
        }
      showToast('Attendance Logged', 'Staff status updated successfully!', 'success');
      fetchAttendance();
    } catch (err) {
      alert(err.message);
    }
  };

  const logCheckInOut = async (empId, type) => {
    const date = attendanceDatePicker ? attendanceDatePicker.value : new Date().toISOString().substring(0, 10);
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    
    try {
      const response = await authFetch(getApiUrl(`/api/employees/attendance/${type}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: parseInt(empId), date, time: timeStr })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed log transaction');
      }
      showToast(type === 'check-in' ? 'Check-in Recorded' : 'Check-out Recorded', `Logged successfully at ${timeStr}!`, 'success');
      fetchAttendance();
    } catch (err) {
      alert(err.message);
    }
  };

  window.fetchLicenseDetails = fetchLicenseDetails;

  // Session Check initialization
  checkAuthSession();
});
