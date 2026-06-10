document.addEventListener('DOMContentLoaded', () => {
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
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let iconName = 'info';
    if (type === 'success') iconName = 'check_circle';
    if (type === 'warning') iconName = 'warning';
    if (type === 'danger') iconName = 'error';
    
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
      const sseUrl = getApiUrl('/api/realtime-events');
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
        // SSE auto-reconnects natively, just catch error logs if server restarts
      };
    } catch (e) {
      console.warn('Real-time updates not supported or blocked:', e);
    }
  };

  // Launch live-sync client listener
  initRealtimeSSE();


  const money = (value) => `Rs.${(parseFloat(value || 0)).toFixed(2)}`;

  const getItemImageSrc = (item, preferred = 'thumb') => {
    if (!item) return '';
    const variants = item.image_variants || {};
    const variant =
      variants[preferred] ||
      variants.web ||
      variants.mobile ||
      variants.thumb ||
      variants.original;

    if (variant && variant.url) return variant.url;
    if (typeof item.image_url === 'string' && item.image_url) return item.image_url;
    if (typeof item.image === 'string' && item.image) return item.image;
    return '';
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
    e.target.value = e.target.value.replace(/\D/g, '');
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

  let allUsers = [];

  const fetchUsers = async () => {
    try {
      const response = await fetch(getApiUrl('/api/users'));
      if (!response.ok) throw new Error('Failed to fetch users');
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
      onTransition: () => fetchPermissionMatrix()
    },
    'role_listing': {
      menu: document.getElementById('menuRoleListing'),
      view: document.getElementById('screenRoleListing'),
      title: 'Role Master',
      onTransition: () => fetchRoles()
    }
  };

  // RBAC Global State variables
  let activeUser = null;
  let allUsersList = [];
  let permissionsData = [];

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
    const roleName = (activeUser?.role_name || activeUser?.role || '').toString().toLowerCase();
    return activeUser?.role_id == 1 || roleName === 'admin';
  };

  const hasModulePermission = (moduleId) => {
    if (!moduleId) return true;
    if (!activeUser) return false;
    if (!permissionsData.length) return false;

    const roleId = activeUser.role_id;
    const perm = permissionsData.find(p => p.role_id == roleId && p.module_id == moduleId);
    return perm ? perm.allowed == 1 : false;
  };

  const checkScreenPermission = (screenName) => hasModulePermission(moduleForScreen(screenName));

  const applyNavigationPermissions = () => {
    if (!activeUser || !permissionsData.length) return;
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

    const masterGroup = document.getElementById('groupMasters');
    if (masterGroup) {
      const visibleChild = Array.from(masterGroup.querySelectorAll('.drawer-submenu .drawer-item'))
        .some(item => item.style.display !== 'none');
      masterGroup.style.display = visibleChild ? 'block' : 'none';
    }

    if (!checkScreenPermission(Object.keys(screens).find(key => screens[key].view?.style.display === 'block'))) {
      switchScreen('dashboard');
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

  const fetchPermissionsAndUsers = async () => {
    try {
      const permRes = await fetch(getApiUrl('/api/permissions'));
      if (permRes.ok) {
        const data = await permRes.json();
        permissionsData = data.permissions;
        
        // Populate user role options in form dropdown dynamically
        const selectRole = document.getElementById('user_role_id');
        if (selectRole && data.roles) {
          selectRole.innerHTML = '<option value="">Select Role</option>' + 
            data.roles.map(r => `<option value="${r.role_id}">${r.name}</option>`).join('');
        }

        // Apply navigation permissions since permissionsData is loaded
        applyNavigationPermissions();
      }
      const usersRes = await fetch(getApiUrl('/api/users'));
      if (usersRes.ok) {
        allUsersList = await usersRes.json();
        populateUserSelector();
      }
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
        if (screen.view) screen.view.style.display = 'block';
        if (screen.menu) screen.menu.classList.add('active');
        if (appBarTitle) appBarTitle.textContent = screen.title;
        if (screen.onTransition) screen.onTransition();
      } else {
        if (screen.view) screen.view.style.display = 'none';
        if (screen.menu) screen.menu.classList.remove('active');
      }
    });

    // Automatically retract the drawer overlay upon tab click
    if (sideDrawer) {
      sideDrawer.style.display = 'none';
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch(getApiUrl('/api/dashboard/stats'));
      if (!response.ok) throw new Error('Failed to fetch dashboard statistics');
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
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    }
  };

  // Bind dashboard card click events to switch screens
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

  const renderUsers = (users) => {
    if (users.length === 0) {
      userTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">No users registered yet.</td>
        </tr>
      `;
      return;
    }

    userTableBody.innerHTML = users.map(user => {
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
          <td>${user.user_id}</td>
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

    const selectRole = document.getElementById('user_role_id');
    if (selectRole) {
      selectRole.value = user.role_id || '';
    }

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
      const response = await fetch(getApiUrl(`/api/users/${id}`), {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete user');

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

    const selectRole = document.getElementById('user_role_id');
    if (selectRole) {
      selectRole.value = '';
    }

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
    if (email1Input && !emailReg.test(email1Input.value)) {
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

  let allCustomers = [];

  const fetchCustomers = async () => {
    try {
      const response = await fetch(getApiUrl('/api/customers'));
      if (!response.ok) throw new Error('Failed to fetch customers');
      allCustomers = await response.json();
      renderCustomers(allCustomers);
    } catch (err) {
      console.error(err);
    }
  };

  const renderCustomers = (list) => {
    if (list.length === 0) {
      customerTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">No customers registered yet.</td>
        </tr>
      `;
      return;
    }

    customerTableBody.innerHTML = list.map(c => {
      const fullName = `${c.first_name} ${c.last_name}`;
      const address = c.address_2 ? `${c.address_1}, ${c.address_2}` : c.address_1;
      const location = `${c.city}, ${c.country}`;
      const contact = `${c.phone_1} | ${c.email}`;

      return `
        <tr>
          <td>${c.customer_id}</td>
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
      const response = await fetch(getApiUrl(`/api/customers/${id}`), {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete customer');

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

      if (custPhone1Input && custPhone1Input.value.length !== 10) {
        custPhone1Input.setCustomValidity('Enter a valid phone number');
        isValid = false;
      }

      const emailReg = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      if (custEmailInput && !emailReg.test(custEmailInput.value)) {
        custEmailInput.setCustomValidity('Enter a valid email address');
        isValid = false;
      }

      if (!isValid) {
        customerForm.reportValidity();
        return;
      }

      const formData = new FormData(customerForm);
      const data = Object.fromEntries(formData.entries());
      const id = custIdInput.value;

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

  let allUnits = [];

  const fetchUnits = async () => {
    try {
      const response = await fetch(getApiUrl('/api/units'));
      if (!response.ok) throw new Error('Failed to fetch units');
      allUnits = await response.json();
      renderUnits(allUnits);
    } catch (err) {
      console.error(err);
    }
  };

  const renderUnits = (list) => {
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
          <td>${u.unit_id}</td>
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
      const response = await fetch(getApiUrl(`/api/units/${id}`), {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete unit');

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

  let allTaxes = [];

  const fetchTaxes = async () => {
    try {
      const response = await fetch(getApiUrl('/api/taxes'));
      if (!response.ok) throw new Error('Failed to fetch taxes');
      allTaxes = await response.json();
      renderTaxes(allTaxes);
    } catch (err) {
      console.error(err);
    }
  };

  const renderTaxes = (list) => {
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
          <td>${t.tax_id}</td>
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
      const response = await fetch(getApiUrl(`/api/taxes/${id}`), {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete tax');

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

  let allCategories = [];

  const fetchCategories = async () => {
    try {
      const response = await fetch(getApiUrl('/api/categories'));
      if (!response.ok) throw new Error('Failed to fetch categories');
      allCategories = await response.json();
      renderCategories(allCategories);
    } catch (err) {
      console.error(err);
    }
  };

  const renderCategories = (list) => {
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
          <td>${c.category_id}</td>
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
      const response = await fetch(getApiUrl(`/api/categories/${id}`), {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete category');

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

  let allItems = [];
  let selectedItemImagePayload = null;

  const populateDropdowns = async () => {
    try {
      const [catsRes, unitsRes, taxesRes] = await Promise.all([
        fetch(getApiUrl('/api/categories')),
        fetch(getApiUrl('/api/units')),
        fetch(getApiUrl('/api/taxes'))
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

  const fetchItems = async () => {
    try {
      await populateDropdowns();
      const response = await fetch(getApiUrl('/api/items'));
      if (!response.ok) throw new Error('Failed to fetch items');
      allItems = await response.json();
      renderItems(allItems);
    } catch (err) {
      console.error(err);
    }
  };

  const renderItems = (list) => {
    if (list.length === 0) {
      itemTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="empty-state">No items registered yet.</td>
        </tr>
      `;
      return;
    }

    itemTableBody.innerHTML = list.map(item => {
      const itemCode = item.code || 'N/A';
      const imageSrc = getItemImageSrc(item, 'thumb');
      const imageTag = imageSrc ? `<img src="${imageSrc}" class="item-table-image" alt="${item.name || 'Item image'}">` : '';
      const description = item.description || 'No description';

      return `
        <tr>
          <td><strong>${itemCode}</strong></td>
          <td>${imageTag}${item.name}</td>
          <td>${description}</td>
          <td>
            <div class="table-actions">
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

    // Bind action buttons
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

  const editItem = async (id) => {
    try {
      const response = await fetch(getApiUrl(`/api/items/${id}`));
      if (!response.ok) throw new Error('Failed to fetch item details');
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
      const response = await fetch(getApiUrl(`/api/items/${id}`), {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete item');

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
    itemForm.reset();
  };

  if (btnNewItem) {
    btnNewItem.addEventListener('click', () => {
      itemForm.reset();
      if (itemModal) {
        itemModal.style.display = 'flex';
      }
    });
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
      const sales_price = parseFloat(document.getElementById('item_sales_price').value);
      const purchase_price = parseFloat(document.getElementById('item_purchase_price').value);

      if (sales_price < purchase_price) {
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

        alert(`Item ${id ? 'updated' : 'registered'} successfully!`);
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

  let allVendors = [];

  const fetchVendors = async () => {
    try {
      const response = await fetch(getApiUrl('/api/vendors'));
      if (!response.ok) throw new Error('Failed to fetch vendors');
      allVendors = await response.json();
      renderVendors(allVendors);
    } catch (err) {
      console.error(err);
    }
  };

  const renderVendors = (list) => {
    if (list.length === 0) {
      vendorTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No vendors registered yet.</td></tr>`;
      return;
    }
    vendorTableBody.innerHTML = list.map(v => {
      const fullName = `${v.first_name} ${v.last_name}`;
      const address = v.address_2 ? `${v.address_1}, ${v.address_2}` : v.address_1;
      const location = `${v.city}, ${v.country}`;
      const contact = `${v.phone_1} | ${v.email}`;
      return `
        <tr>
          <td>${v.vendor_id}</td>
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
      const response = await fetch(getApiUrl(`/api/vendors/${id}`), { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete vendor');
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
  if (vendorForm) {
    vendorForm.addEventListener('reset', () => {
      resetVendorFormState();
    });

    vendorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = vendorIdInput.value;
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
        if (!response.ok) throw new Error('Failed to save vendor details.');
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

  const fetchInvoiceSetup = async () => {
    if (!invoiceDate || !invoiceCustomer || !adderItem || !invoiceBillNo) return;
    try {
      invoiceDate.value = new Date().toISOString().split('T')[0];
      
      const custRes = await fetch(getApiUrl('/api/customers'));
      availableCustomers = custRes.ok ? await custRes.json() : [];
      invoiceCustomer.innerHTML = '<option value="">Choose Customer</option>' + 
        availableCustomers.map(c => `<option value="${c.customer_id}">${c.first_name} ${c.last_name}</option>`).join('');

      const itemsRes = await fetch(getApiUrl('/api/items'));
      availableItems = itemsRes.ok ? (await itemsRes.json()).filter(item => item.visible == 1 && item.active == 1) : [];
      adderItem.innerHTML = '<option value="">Select Item</option>' + 
        availableItems.map(i => `<option value="${i.item_id}">${i.name}</option>`).join('');
      renderSalesCategories();
      renderSalesCatalog();

      const taxesRes = await fetch(getApiUrl('/api/taxes'));
      availableTaxes = taxesRes.ok ? await taxesRes.json() : [];

      const salesRes = await fetch(getApiUrl('/api/sales'));
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

    const tax = availableTaxes.find(t => t.tax_id == item.tax_id);
    let taxPercent = tax ? parseFloat(tax.percentage || 0) / 100 : 0;

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

    adderItem.value = '';
    adderRate.value = '';
    adderRate.readOnly = true;
    adderQty.value = '1.00';
    adderTaxName.value = '';
    renderInvoiceLines();
  };

  if (btnAdderAdd) {
    btnAdderAdd.addEventListener('click', () => {
      const item = availableItems.find(i => i.item_id == adderItem.value);
      addSalesItemLine(item, adderQty.value, adderRate.value);
    });
  }

  const renderSalesCategories = () => {
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

  const renderSalesCatalog = () => {
    if (!salesProductGrid) return;
    const filtered = getFilteredSalesItems();
    if (!filtered.length) {
      salesProductGrid.innerHTML = '<div class="empty-state pos-grid-empty">No matching items found.</div>';
      return;
    }

    salesProductGrid.innerHTML = filtered.map(item => {
      const imageSrc = getItemImageSrc(item, 'web');
      const image = imageSrc
        ? `<img src="${imageSrc}" alt="${item.name || 'Item image'}">`
        : '<span class="material-icons">inventory_2</span>';
      return `
        <button type="button" class="pos-product-card" data-id="${item.item_id}">
          <div class="pos-product-image">${image}</div>
          <strong>${item.name || 'Unnamed Item'}</strong>
          <span>${money(item.sales_price)} @ ${item.base_quantity || 1} ${item.unit_name || ''}</span>
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

  const renderInvoiceLines = () => {
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
          <td>${line.name}</td>
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

    summaryGross.textContent = money(tGross);
    summaryTax.textContent = money(tTax);
    summaryNet.textContent = money(tNet);
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
      const gross = parseFloat(summaryGross.textContent.replace('Rs.', ''));
      const tax = parseFloat(summaryTax.textContent.replace('Rs.', ''));
      const total = parseFloat(summaryNet.textContent.replace('Rs.', ''));
      const created_by = activeUser ? activeUser.username : 'System';

      const data = { customer_id, sales_date, sales_bill_no, gross, tax, total, created_by, items: invoiceLines };

      try {
        const response = await fetch(getApiUrl('/api/sales'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to save sales invoice.');
        const result = await response.json();
        openPrintReceipt(result.sales_id);
        fetchInvoiceSetup();
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });

    document.getElementById('btnInvoiceClear').addEventListener('click', fetchInvoiceSetup);
  }

  // Receipt modal loader and printer
  const receiptModal = document.getElementById('receiptModal');
  const printReceiptContent = document.getElementById('printReceiptContent');
  const receiptModalClose = document.getElementById('receiptModalClose');
  const btnReceiptClose = document.getElementById('btnReceiptClose');
  const btnReceiptPrint = document.getElementById('btnReceiptPrint');

  const openPrintReceipt = async (salesId) => {
    try {
      const response = await fetch(getApiUrl(`/api/sales/${salesId}`));
      if (!response.ok) throw new Error('Failed to fetch invoice details.');
      const invoice = await response.json();

      document.getElementById('rCustName').textContent = invoice.customer_name || 'Walk-in Customer';
      const dateVal = new Date(invoice.sales_date);
      const dateStr = `${dateVal.getDate()}/${dateVal.getMonth()+1}/${dateVal.getFullYear()}`;
      document.getElementById('rDate').textContent = dateStr;
      document.getElementById('rBillNo').textContent = invoice.sales_bill_no;
      
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

      if (receiptModal) receiptModal.style.display = 'flex';
    } catch (err) {
      alert(`Error loading receipt: ${err.message}`);
    }
  };

  if (receiptModalClose) receiptModalClose.addEventListener('click', () => receiptModal.style.display = 'none');
  if (btnReceiptClose) btnReceiptClose.addEventListener('click', () => receiptModal.style.display = 'none');
  if (btnReceiptPrint) btnReceiptPrint.addEventListener('click', () => window.print());

  // Receipt listing page
  const receiptTableBody = document.getElementById('receiptTableBody');
  const btnRefreshReceipts = document.getElementById('btnRefreshReceipts');

  const fetchReceipts = async () => {
    try {
      const response = await fetch(getApiUrl('/api/sales'));
      if (!response.ok) throw new Error('Failed to load receipts.');
      const list = await response.json();
      renderReceipts(list);
    } catch (err) {
      console.error(err);
    }
  };

  const renderReceipts = (list) => {
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

  const fetchPermissionMatrix = async () => {
    if (!permissionsTableBody) return;
    try {
      const response = await fetch(getApiUrl('/api/permissions'));
      if (!response.ok) throw new Error('Failed to load permissions config.');
      const data = await response.json();
      matrixRoles = data.roles;
      matrixModules = data.modules;
      matrixPermissions = data.permissions;
      renderPermissionMatrix();
    } catch (err) {
      console.error(err);
    }
  };

  const renderPermissionMatrix = () => {
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
        const response = await fetch(getApiUrl('/api/permissions'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });
        if (!response.ok) throw new Error('Failed to update permissions matrix.');
        alert('Role permissions updated successfully!');
        await fetchPermissionsAndUsers();
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

  let allRoles = [];

  const fetchRoles = async () => {
    try {
      const response = await fetch(getApiUrl('/api/roles'));
      if (!response.ok) throw new Error('Failed to fetch roles');
      allRoles = await response.json();
      renderRoles(allRoles);
    } catch (err) {
      console.error(err);
    }
  };

  const renderRoles = (list) => {
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
      const response = await fetch(getApiUrl(`/api/roles/${id}`), {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete role');

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
    if (storedUser) {
      activeUser = JSON.parse(storedUser);
      if (loginOverlay) loginOverlay.style.display = 'none';
      if (loggedInUsername) loggedInUsername.textContent = activeUser.username;
      
      // Load app stats and data
      fetchPermissionsAndUsers();
      fetchDashboardStats();
      fetchUsers();
      switchScreen('dashboard');
    } else {
      activeUser = null;
      if (loginOverlay) loginOverlay.style.display = 'flex';
      if (loggedInUsername) loggedInUsername.textContent = 'Guest';
    }
  };

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value;
      const password = document.getElementById('loginPassword').value;

      try {
        const response = await fetch(getApiUrl('/api/users/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Invalid credentials');
        }
        const data = await response.json();
        localStorage.setItem('pos_active_user', JSON.stringify(data.user));
        showToast('Login Successful', `Welcome back, ${username}!`, 'success');
        AudioSynth.playSuccess();
        checkAuthSession();
      } catch (err) {
        showToast('Login Failed', err.message, 'danger');
        AudioSynth.playError();
      }
    });
  }



  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('pos_active_user');
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

  const fetchPurchaseSetup = async () => {
    if (!purchaseDate || !purchaseVendor || !purchaseAdderItem || !purchaseBillNo) return;
    try {
      purchaseDate.value = new Date().toISOString().split('T')[0];
      
      const vendorRes = await fetch(getApiUrl('/api/vendors'));
      availableVendors = vendorRes.ok ? await vendorRes.json() : [];
      purchaseVendor.innerHTML = '<option value="">Choose Supplier</option>' + 
        availableVendors.map(v => `<option value="${v.vendor_id}">${v.first_name} ${v.last_name} (${v.company || 'Individual'})</option>`).join('');

      const itemsRes = await fetch(getApiUrl('/api/items'));
      availableItems = itemsRes.ok ? (await itemsRes.json()).filter(item => item.visible == 1 && item.active == 1) : [];
      purchaseAdderItem.innerHTML = '<option value="">Select Item</option>' + 
        availableItems.map(i => `<option value="${i.item_id}">${i.name}</option>`).join('');
      renderPurchaseCategories();
      renderPurchaseCatalog();

      const taxesRes = await fetch(getApiUrl('/api/taxes'));
      availableTaxes = taxesRes.ok ? await taxesRes.json() : [];

      const purchaseRes = await fetch(getApiUrl('/api/purchase'));
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

    const tax = availableTaxes.find(t => t.tax_id == item.tax_id);
    let taxPercent = tax ? parseFloat(tax.percentage || 0) / 100 : 0;

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

    purchaseAdderItem.value = '';
    purchaseAdderRate.value = '';
    purchaseAdderQty.value = '1.00';
    purchaseAdderTaxName.value = '';
    renderPurchaseLines();
  };

  if (btnPurchaseAdderAdd) {
    btnPurchaseAdderAdd.addEventListener('click', () => {
      const item = availableItems.find(i => i.item_id == purchaseAdderItem.value);
      addPurchaseItemLine(item, purchaseAdderQty.value, purchaseAdderRate.value);
    });
  }

  const renderPurchaseCategories = () => {
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

  const renderPurchaseCatalog = () => {
    if (!purchaseProductGrid) return;
    const filtered = getFilteredPurchaseItems();
    if (!filtered.length) {
      purchaseProductGrid.innerHTML = '<div class="empty-state pos-grid-empty">No matching items found.</div>';
      return;
    }

    purchaseProductGrid.innerHTML = filtered.map(item => {
      const imageSrc = getItemImageSrc(item, 'web');
      const image = imageSrc
        ? `<img src="${imageSrc}" alt="${item.name || 'Item image'}">`
        : '<span class="material-icons">inventory_2</span>';
      return `
        <button type="button" class="pos-product-card" data-id="${item.item_id}">
          <div class="pos-product-image">${image}</div>
          <strong>${item.name || 'Unnamed Item'}</strong>
          <span>${money(item.purchase_price)} @ ${item.base_quantity || 1} ${item.unit_name || ''}</span>
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

  const renderPurchaseLines = () => {
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
          <td>${line.name}</td>
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
        const response = await fetch(getApiUrl('/api/purchase'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to save purchase inward.');
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
  const reportsFiltersContainer = document.getElementById('reportFiltersContainer');
  const reportsResultHeader = document.getElementById('reportResultHeader');
  const reportsResultBody = document.getElementById('reportResultBody');
  const reportsRowCount = document.getElementById('reportRowCount');
  const reportsTableTitle = document.getElementById('reportTableTitle');
  const reportsChartsPanel = document.getElementById('reportChartsPanel');

  let reportsCategories = [];
  let reportsItems = [];
  let reportsCustomers = [];
  let reportsVendors = [];
  let reportsUsers = [];

  let chartSalesPurchasesObj = null;
  let chartCategorySalesObj = null;

  const destroyCharts = () => {
    if (chartSalesPurchasesObj) {
      chartSalesPurchasesObj.destroy();
      chartSalesPurchasesObj = null;
    }
    if (chartCategorySalesObj) {
      chartCategorySalesObj.destroy();
      chartCategorySalesObj = null;
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

  const renderReportFilters = (reportType) => {
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
    }
    reportsFiltersContainer.innerHTML = html;
  };

  const fetchReportsOverviewMetrics = async () => {
    try {
      const [salesRes, purchaseRes] = await Promise.all([
        fetch(getApiUrl('/api/sales')),
        fetch(getApiUrl('/api/purchase'))
      ]);

      const sales = salesRes.ok ? await salesRes.json() : [];
      const purchases = purchaseRes.ok ? await purchaseRes.json() : [];

      let totalSalesAmt = 0;
      sales.forEach(s => totalSalesAmt += parseFloat(s.total || 0));

      let totalPurchasesAmt = 0;
      purchases.forEach(p => totalPurchasesAmt += parseFloat(p.total || 0));

      const profitMargin = totalSalesAmt - totalPurchasesAmt;

      if (reportValSales) reportValSales.textContent = `₹${totalSalesAmt.toFixed(2)}`;
      if (reportCountSales) reportCountSales.textContent = `${sales.length} invoices`;
      
      if (reportValPurchases) reportValPurchases.textContent = `₹${totalPurchasesAmt.toFixed(2)}`;
      if (reportCountPurchases) reportCountPurchases.textContent = `${purchases.length} invoices`;

      if (reportValMargin) {
        reportValMargin.textContent = `₹${profitMargin.toFixed(2)}`;
        reportValMargin.style.color = profitMargin >= 0 ? '#10b981' : '#ef4444';
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
        
        const res = await fetch(getApiUrl('/api/sales/details/all'));
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
          const pRes = await fetch(getApiUrl('/api/purchase/details/all'));
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
        
        const res = await fetch(getApiUrl('/api/purchase/details/all'));
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
          const sRes = await fetch(getApiUrl('/api/sales/details/all'));
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
        
        const res = await fetch(getApiUrl('/api/items'));
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
              <td>${i.item_id}</td>
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
        
        const res = await fetch(getApiUrl('/api/categories'));
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
                <td>${c.category_id}</td>
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
        reportsChartsPanel.style.display = 'none';
        reportsTableTitle.textContent = 'Registered Customers Listing';
        
        const city = document.getElementById('filterCity')?.value?.toLowerCase()?.trim();
        
        const res = await fetch(getApiUrl('/api/customers'));
        if (!res.ok) throw new Error('Failed to load customers.');
        const customers = await res.json();
        
        const filtered = customers.filter(c => {
          if (city && c.city?.toLowerCase()?.indexOf(city) === -1) return false;
          return true;
        });
        
        reportsRowCount.textContent = `${filtered.length} records found`;
        
        reportsResultHeader.innerHTML = `
          <tr>
            <th>Cust ID</th>
            <th>Full Name</th>
            <th>Address Details</th>
            <th>City & Country</th>
            <th>Contact Details</th>
          </tr>
        `;
        
        if (filtered.length === 0) {
          reportsResultBody.innerHTML = `<tr><td colspan="5" class="empty-state">No matching customers found.</td></tr>`;
        } else {
          reportsResultBody.innerHTML = filtered.map(c => {
            const name = [c.first_name, c.middle_name, c.last_name].filter(p => p && p.trim() !== '').join(' ');
            const address = [c.address_1, c.address_2, c.address_3].filter(p => p && p.trim() !== '').join(', ') || 'N/A';
            const loc = [c.city, c.country].filter(p => p && p.trim() !== '').join(', ') || 'N/A';
            const contacts = [c.phone_1, c.email_1].filter(p => p && p.trim() !== '').join(' | ') || 'N/A';
            return `
              <tr>
                <td>${c.customer_id}</td>
                <td><strong>${name}</strong></td>
                <td>${address}</td>
                <td>${loc}</td>
                <td>${contacts}</td>
              </tr>
            `;
          }).join('');
        }
        
      } else if (reportType === 'user') {
        reportsChartsPanel.style.display = 'none';
        reportsTableTitle.textContent = 'Registered Users Listing';
        
        const roleId = document.getElementById('filterRole')?.value;
        
        const res = await fetch(getApiUrl('/api/users'));
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
                <td>${u.user_id}</td>
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
      }
    } catch (err) {
      console.error(err);
      reportsResultBody.innerHTML = `<tr><td colspan="10" class="empty-state" style="color: #ef4444;">Error generating report: ${err.message}</td></tr>`;
    }
  };

  const loadReportsMetadata = async () => {
    try {
      const [catsRes, itemsRes, custsRes, vendsRes, usersRes] = await Promise.all([
        fetch(getApiUrl('/api/categories')),
        fetch(getApiUrl('/api/items')),
        fetch(getApiUrl('/api/customers')),
        fetch(getApiUrl('/api/vendors')),
        fetch(getApiUrl('/api/users'))
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
      document.body.classList.add('print-report-active');
      window.print();
      document.body.classList.remove('print-report-active');
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
      <option value="sales">Sales Report</option>
      ${isRestaurant ? '' : '<option value="purchase">Purchase Report</option>'}
      <option value="item">Item Report</option>
      <option value="category">Item Category Report</option>
      <option value="customer">Customer Report</option>
      <option value="user">User Report</option>
    `;
    reportTypeSelect.innerHTML = html;
    
    if (currentVal && (currentVal !== 'purchase' || !isRestaurant)) {
      reportTypeSelect.value = currentVal;
    } else {
      reportTypeSelect.value = 'sales';
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

  // Session Check initialization
  checkAuthSession();
});
