import 'dart:async';
import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'config.dart';
import 'api_client.dart';
import 'dashboard.dart';
import 'user_listing.dart';
import 'customer_listing.dart';
import 'unit_listing.dart';
import 'tax_listing.dart';
import 'category_listing.dart';
import 'item_listing.dart';
import 'vendor_listing.dart';
import 'receipt_listing.dart';
import 'login_screen.dart';
import 'license_lockout_screen.dart';
import 'role_listing.dart';
import 'role_permissions.dart';
import 'sales_billing.dart';
import 'purchase_billing.dart';
import 'reports_screen.dart';
import 'connection_setup_screen.dart';
import 'support_screen.dart';
import 'license_screen.dart';
import 'clients_screen.dart';
import 'printer_settings_screen.dart';
import 'restaurant_tables_screen.dart';
import 'restaurant_menu_screen.dart';
import 'restaurant_orders_screen.dart';
import 'restaurant_kds_screen.dart';
import 'hotel_rooms_screen.dart';
import 'hotel_guests_screen.dart';
import 'hotel_bookings_screen.dart';
import 'inventory_screen.dart';
import 'purchase_orders_screen.dart';
import 'employee_screen.dart';

import 'package:shared_preferences/shared_preferences.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppConfig.init();
  
  String themeMode = 'light';
  String accentColor = 'blue';
  String? savedUser;
  try {
    final prefs = await SharedPreferences.getInstance();
    themeMode = prefs.getString('theme_mode') ?? 'light';
    accentColor = prefs.getString('accent_color') ?? 'blue';
    savedUser = prefs.getString('active_user');
  } catch (e) {
    debugPrint('Error loading initial theme settings: $e');
  }

  runApp(MyApp(
    initialThemeMode: themeMode, 
    initialAccentColor: accentColor,
    initialUser: savedUser,
  ));
}

class MyApp extends StatefulWidget {
  final String initialThemeMode;
  final String initialAccentColor;
  final String? initialUser;

  const MyApp({
    super.key,
    required this.initialThemeMode,
    required this.initialAccentColor,
    this.initialUser,
  });

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late ThemeMode _themeMode;
  late String _accentColor;

  @override
  void initState() {
    super.initState();
    _accentColor = widget.initialAccentColor;
    if (widget.initialThemeMode == 'dark') {
      _themeMode = ThemeMode.dark;
    } else if (widget.initialThemeMode == 'system') {
      _themeMode = ThemeMode.system;
    } else {
      _themeMode = ThemeMode.light;
    }
  }

  Color _getPrimaryColor() {
    switch (_accentColor) {
      case 'green':
        return const Color(0xFF10B981);
      case 'purple':
        return const Color(0xFF6366F1);
      case 'red':
        return const Color(0xFFEF4444);
      case 'orange':
        return const Color(0xFFF97316);
      case 'blue':
      default:
        return const Color(0xFF2563EB);
    }
  }

  void _changeTheme(ThemeMode mode, String accent) async {
    setState(() {
      _themeMode = mode;
      _accentColor = accent;
    });
    try {
      final prefs = await SharedPreferences.getInstance();
      String modeStr = 'light';
      if (mode == ThemeMode.dark) modeStr = 'dark';
      if (mode == ThemeMode.system) modeStr = 'system';
      await prefs.setString('theme_mode', modeStr);
      await prefs.setString('accent_color', accent);
    } catch (e) {
      debugPrint('Error saving theme settings: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final primaryColor = _getPrimaryColor();
    
    return MaterialApp(
      title: 'Aura POS Business Suite',
      debugShowCheckedModeBanner: false,
      scrollBehavior: const MaterialScrollBehavior().copyWith(
        dragDevices: {
          PointerDeviceKind.mouse,
          PointerDeviceKind.touch,
          PointerDeviceKind.stylus,
          PointerDeviceKind.unknown,
        },
      ),
      theme: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        primaryColor: primaryColor,
        colorScheme: ColorScheme.light(
          primary: primaryColor,
          secondary: primaryColor.withValues(alpha: 0.7),
          surface: Colors.white,
        ),
        textTheme: GoogleFonts.interTextTheme(const TextTheme(
          bodyLarge: TextStyle(color: Color(0xFF0F172A), fontSize: 14),
          bodyMedium: TextStyle(color: Color(0xFF475569), fontSize: 13),
        )),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF0F172A),
          elevation: 0,
          shape: Border(bottom: BorderSide(color: Color(0xFFF1F5F9), width: 1.5)),
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFFE2E8F0), width: 1),
          ),
        ),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0B0F19),
        primaryColor: primaryColor,
        colorScheme: ColorScheme.dark(
          primary: primaryColor,
          secondary: primaryColor.withValues(alpha: 0.7),
          surface: const Color(0xFF151D30),
        ),
        textTheme: GoogleFonts.interTextTheme(const TextTheme(
          bodyLarge: TextStyle(color: Color(0xFFF8FAFC), fontSize: 14),
          bodyMedium: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
        )),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0F172A),
          foregroundColor: Color(0xFFF8FAFC),
          elevation: 0,
          shape: Border(bottom: BorderSide(color: Color(0xFF1F2937), width: 1.5)),
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF151D30),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF1F2937), width: 1),
          ),
        ),
        useMaterial3: true,
      ),
      themeMode: _themeMode,
      home: MainLayout(
        currentThemeMode: _themeMode,
        currentAccent: _accentColor,
        onThemeChanged: _changeTheme,
        initialUser: widget.initialUser,
      ),
    );
  }
}

class MainLayout extends StatefulWidget {
  final ThemeMode currentThemeMode;
  final String currentAccent;
  final Function(ThemeMode, String) onThemeChanged;
  final String? initialUser;

  const MainLayout({
    super.key,
    required this.currentThemeMode,
    required this.currentAccent,
    required this.onThemeChanged,
    this.initialUser,
  });

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  int _currentIndex = 0;
  bool isLoading = true;
  bool isConnectionFailed = false;
  bool _isWakingUp = false;

  List<dynamic> allUsers = [];
  List<dynamic> allClients = [];
  Map<String, dynamic>? activeUser;
  List<dynamic> permissionsData = [];
  Timer? _keepAliveTimer;

  String activeStoreId = '1';

  @override
  void initState() {
    super.initState();
    if (widget.initialUser != null) {
      try {
        activeUser = json.decode(widget.initialUser!);
        if (activeUser != null) {
          if (activeUser!['client_id'] != null) {
            activeStoreId = activeUser!['client_id'].toString();
            AppConfig.setActiveUserClientId(activeStoreId);
          }
          if (activeUser!['token'] != null) {
            AppConfig.setAuthToken(activeUser!['token'].toString());
          }
        }
      } catch (e) {
        debugPrint('Error parsing initial user: $e');
      }
    }
    fetchUsersAndPermissions();
    _startKeepAlive();
  }

  Future<void> _saveUser(Map<String, dynamic> user) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('active_user', json.encode(user));
    } catch (e) {
      debugPrint('Error saving user session: $e');
    }
  }

  Future<void> _clearUser() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('active_user');
      await prefs.remove('auth_token');
      AppConfig.setActiveUserClientId(null);
      AppConfig.setAuthToken(null);
    } catch (e) {
      debugPrint('Error clearing user session: $e');
    }
  }

  @override
  void dispose() {
    _keepAliveTimer?.cancel();
    super.dispose();
  }

  void _startKeepAlive() {
    _keepAliveTimer?.cancel();
    _keepAliveTimer = Timer.periodic(const Duration(minutes: 13), (_) async {
      try {
        await http
            .get(Uri.parse(AppConfig.usersApiUrl), headers: AppConfig.extraHeaders)
            .timeout(const Duration(seconds: 10));
      } catch (e) {}
    });
  }

  Future<void> fetchUsersAndPermissions() async {
    setState(() {
      isLoading = true;
      isConnectionFailed = false;
      _isWakingUp = false;
    });

    const attempts = [
      Duration(seconds: 8),
      Duration(seconds: 25),
      Duration(seconds: 50),
    ];

    for (int i = 0; i < attempts.length; i++) {
      if (i == 1 && mounted) {
        setState(() => _isWakingUp = true);
      }

      try {
        final responses = await Future.wait([
          ApiClient.get(Uri.parse(AppConfig.usersApiUrl)),
          ApiClient.get(Uri.parse(AppConfig.permissionsApiUrl)),
          ApiClient.get(Uri.parse(AppConfig.clientsApiUrl)),
        ]).timeout(attempts[i]);

        if (responses[0].statusCode == 200 && responses[1].statusCode == 200) {
          final List<dynamic> users = json.decode(responses[0].body);
          final Map<String, dynamic> permData = json.decode(responses[1].body);
          final List<dynamic> clients = responses[2].statusCode == 200 ? json.decode(responses[2].body) : [];

          if (mounted) {
            setState(() {
              allUsers = users;
              permissionsData = permData['permissions'] ?? [];
              allClients = clients;
              isLoading = false;
              isConnectionFailed = false;
              _isWakingUp = false;
            });
          }
          return;
        }
        if (mounted) {
          setState(() {
            isLoading = false;
            isConnectionFailed = true;
            _isWakingUp = false;
          });
        }
        return;
      } catch (e) {
        if (i == attempts.length - 1 && mounted) {
          setState(() {
            isLoading = false;
            isConnectionFailed = true;
            _isWakingUp = false;
          });
        }
      }
    }
  }

  bool _hasPermission(int moduleId) {
    if (activeUser == null) return false;
    final int? roleId = int.tryParse(activeUser!['role_id']?.toString() ?? '');
    if (permissionsData.isEmpty) return false;
    final perm = permissionsData.firstWhere(
      (p) {
        final pRoleId = int.tryParse(p['role_id']?.toString() ?? '');
        final pModuleId = int.tryParse(p['module_id']?.toString() ?? '');
        return pRoleId == roleId && pModuleId == moduleId;
      },
      orElse: () => null,
    );
    if (perm == null) return false;
    return perm['allowed'] == 1 || perm['allowed'] == true;
  }

  bool _hasModuleGroup(String groupName) {
    if (activeUser == null) return false;
    final modules = activeUser!['clientModules'];
    if (modules == null) return true;
    if (modules is List) {
      if (modules.contains('ALL')) return true;
      return modules.any((m) => m.toString().toLowerCase() == groupName.toLowerCase());
    }
    return true;
  }

  List<Widget> get _screens => [
    DashboardScreen(
      onNavigate: (index) => setState(() => _currentIndex = index),
      activeUser: activeUser,
      permissionsData: permissionsData,
    ),
    CategoryListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(3)),
    ItemListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(3)),
    CustomerListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(2)),
    VendorListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(3)),
    UnitListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(3)),
    UserListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(1)),
    TaxListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(3)),
    RolewisePermissionsScreen(onSaved: fetchUsersAndPermissions),
    const SalesBillingScreen(),
    const PurchaseBillingScreen(),
    const ReceiptListingScreen(),
    const ReportsScreen(),
    RoleListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(1)),
    const SupportScreen(),
    const LicenseScreen(),
    ClientsScreen(canModify: true),
    const PrinterSettingsScreen(),
    const RestaurantTablesScreen(),
    const RestaurantMenuScreen(),
    const RestaurantOrdersScreen(),
    const RestaurantKdsScreen(),
    const HotelRoomsScreen(),
    const HotelGuestsScreen(),
    const HotelBookingsScreen(),
    const InventoryScreen(),
    const PurchaseOrdersScreen(),
    const EmployeeScreen(),
  ];

  String _getAppBarTitle() {
    switch (_currentIndex) {
      case 0: return 'Dashboard';
      case 1: return 'Category Master';
      case 2: return 'Item Master';
      case 3: return 'Customer Master';
      case 4: return 'Vendor Master';
      case 5: return 'Unit Master';
      case 6: return 'User Master';
      case 7: return 'Tax Master';
      case 8: return 'Settings';
      case 9: return 'Sales Billing';
      case 10: return 'Purchase Management';
      case 11: return 'Receipts';
      case 12: return 'Reports';
      case 13: return 'Role Master';
      case 14: return 'Support & Contact Us';
      case 15: return 'AMC & License Management';
      case 16: return 'Clients Company Management';
      case 17: return 'Thermal Printer Settings';
      case 18: return 'Restaurant Tables';
      case 19: return 'Restaurant Menu';
      case 20: return 'Restaurant Orders';
      case 21: return 'Kitchen Display (KDS)';
      case 22: return 'Hotel Rooms';
      case 23: return 'Hotel Guest Registry';
      case 24: return 'Hotel Stay Bookings';
      case 25: return 'Stock Inventory';
      case 26: return 'Purchase Orders';
      case 27: return 'Employees & Attendance';
      default: return 'AURA POS Business Suite';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;
    final screenWidth = MediaQuery.of(context).size.width;
    final isDesktop = screenWidth > 900;

    if (isLoading && activeUser == null) {
      return Scaffold(
        backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 52,
                height: 52,
                child: CircularProgressIndicator(strokeWidth: 3.5, color: primaryColor),
              ),
              const SizedBox(height: 28),
              Text(
                _isWakingUp ? '☁️  Waking up server...' : 'Connecting to server...',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF1E293B)),
              ),
              const SizedBox(height: 8),
              Text(
                'Please wait while we load your data.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
              ),
            ],
          ),
        ),
      );
    }

    if (isConnectionFailed && activeUser == null) {
      return ConnectionSetupScreen(onRetry: fetchUsersAndPermissions);
    }

    if (activeUser == null) {
      return LoginScreen(
        onLoginSuccess: (user) {
          setState(() {
            activeUser = user;
            if (user['client_id'] != null) {
              activeStoreId = user['client_id'].toString();
              AppConfig.setActiveUserClientId(activeStoreId);
            } else {
              activeStoreId = 'ALL';
              AppConfig.setActiveUserClientId('ALL');
            }
            if (user['token'] != null) {
              AppConfig.setAuthToken(user['token'].toString());
              SharedPreferences.getInstance().then((prefs) {
                prefs.setString('auth_token', user['token'].toString());
              });
            }
            _currentIndex = 0;
          });
          _saveUser(user);
        },
      );
    }

    // Main App Body with persistent sidebar drawer on desktop
    return Scaffold(
      body: Row(
        children: [
          if (isDesktop)
            Container(
              width: 250,
              decoration: const BoxDecoration(
                color: Color(0xFF0B1120),
                border: Border(right: BorderSide(color: Color(0xFF1E293B), width: 1)),
              ),
              child: _buildSidebarContent(isDark, primaryColor, isDesktop: true),
            ),
          Expanded(
            child: Scaffold(
              appBar: _buildTopAppBar(isDark, primaryColor, isDesktop),
              drawer: isDesktop ? null : Drawer(child: _buildSidebarContent(isDark, primaryColor, isDesktop: false)),
              body: _screens[_currentIndex],
            ),
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildTopAppBar(bool isDark, Color primaryColor, bool isDesktop) {
    final userName = activeUser?['first_name'] ?? activeUser?['username'] ?? 'User';
    final roleName = activeUser?['role_name'] ?? 'Staff';
    final isSuperAdmin = activeUser?['role_id'] == 1 || activeUser?['is_superadmin'] == 1 || activeUser?['client_id'] == null;

    return AppBar(
      elevation: 0,
      backgroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
      title: Row(
        children: [
          Text(_getAppBarTitle(), style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 18)),
          const SizedBox(width: 16),
          // Command Palette Search Trigger
          if (isDesktop)
            Container(
              width: 220,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF151D30) : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  Icon(Icons.search_rounded, size: 16, color: primaryColor),
                  const SizedBox(width: 8),
                  Text('Search anything...', style: GoogleFonts.inter(fontSize: 12, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B))),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: isDark ? const Color(0xFF1E293B) : Colors.white, borderRadius: BorderRadius.circular(4)),
                    child: Text('Ctrl K', style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: const Color(0xFF64748B))),
                  )
                ],
              ),
            ),
        ],
      ),
      actions: [
        // Store Selector Dropdown for Super Admin & Multi-Store Management
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
          decoration: BoxDecoration(
            color: primaryColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: primaryColor.withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              Icon(Icons.storefront_rounded, size: 16, color: primaryColor),
              const SizedBox(width: 6),
              DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: activeStoreId,
                  dropdownColor: isDark ? const Color(0xFF151D30) : Colors.white,
                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: primaryColor),
                  items: [
                    if (isSuperAdmin) const DropdownMenuItem(value: 'ALL', child: Text('All Stores (Global View)')),
                    if (allClients.isNotEmpty)
                      ...allClients.map((c) => DropdownMenuItem(
                        value: c['client_id']?.toString() ?? '1',
                        child: Text(c['name'] ?? 'Store ${c['client_id']}'),
                      ))
                    else
                      const DropdownMenuItem(value: '1', child: Text('Aura POS Enterprise')),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setState(() {
                        activeStoreId = val;
                        AppConfig.setActiveUserClientId(val == 'ALL' ? null : val);
                      });
                      fetchUsersAndPermissions();
                    }
                  },
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),

        // User profile badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF151D30) : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Row(
            children: [
              CircleAvatar(radius: 12, backgroundColor: primaryColor, child: Text(userName[0].toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold))),
              const SizedBox(width: 8),
              Text('$userName ($roleName)', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF0F172A))),
            ],
          ),
        ),
        const SizedBox(width: 12),

        // Theme Toggle
        IconButton(
          icon: Icon(isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined, size: 20),
          onPressed: () {
            widget.onThemeChanged(isDark ? ThemeMode.light : ThemeMode.dark, widget.currentAccent);
          },
          tooltip: 'Toggle Dark/Light Mode',
        ),

        // Logout Pill
        Padding(
          padding: const EdgeInsets.only(right: 16.0),
          child: InkWell(
            onTap: () async {
              await _clearUser();
              setState(() => activeUser = null);
            },
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFFCA5A5)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.logout_rounded, size: 14, color: Color(0xFFEF4444)),
                  const SizedBox(width: 4),
                  Text('Logout', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: const Color(0xFFEF4444))),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSidebarContent(bool isDark, Color primaryColor, {required bool isDesktop}) {
    return Column(
      children: [
        // Sidebar Branding Header
        Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: Color(0xFF0B1120),
            border: Border(bottom: BorderSide(color: Color(0xFF1E293B), width: 1)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)]),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.storefront_rounded, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('AURA POS', style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 16, color: Colors.white)),
                  Text('Business Suite', style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8))),
                ],
              ),
            ],
          ),
        ),

        // Sidebar Category Menu List
        Expanded(
          child: ListView(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
            children: [
              _buildSectionHeader('OPERATIONS'),
              _buildNavItem(0, 'Home', Icons.home_rounded, isDesktop),
              if (_hasPermission(4)) _buildNavItem(9, 'Sell', Icons.shopping_cart_outlined, isDesktop),
              if (_hasPermission(5)) _buildNavItem(10, 'Purchase', Icons.receipt_long_outlined, isDesktop),
              if (_hasPermission(4)) _buildNavItem(11, 'Receipt', Icons.receipt_outlined, isDesktop),

              _buildSectionHeader('MASTERS'),
              if (_hasPermission(3)) _buildNavItem(2, 'Item Master', Icons.inventory_2_outlined, isDesktop),
              if (_hasPermission(3)) _buildNavItem(1, 'Category Master', Icons.category_outlined, isDesktop),
              if (_hasPermission(3)) _buildNavItem(5, 'Unit Master', Icons.straighten_outlined, isDesktop),
              if (_hasPermission(3)) _buildNavItem(7, 'Tax Master', Icons.percent_outlined, isDesktop),

              _buildSectionHeader('INVENTORY'),
              _buildNavItem(25, 'Stock Inventory', Icons.shelves, isDesktop),
              _buildNavItem(26, 'Purchase Orders', Icons.local_shipping_outlined, isDesktop),

              _buildSectionHeader('PEOPLE'),
              if (_hasPermission(1)) _buildNavItem(6, 'Users Directory', Icons.people_outline, isDesktop),
              if (_hasPermission(2)) _buildNavItem(3, 'Customers', Icons.contact_mail_outlined, isDesktop),
              if (_hasPermission(3)) _buildNavItem(4, 'Vendors', Icons.local_shipping_outlined, isDesktop),
              _buildNavItem(27, 'Staff Attendance', Icons.badge_outlined, isDesktop),
              _buildNavItem(16, 'Clients Stores', Icons.business_outlined, isDesktop),

              if (_hasModuleGroup('Restaurant')) ...[
                _buildSectionHeader('RESTAURANT'),
                _buildNavItem(18, 'Dine-in Tables', Icons.table_restaurant_outlined, isDesktop),
                _buildNavItem(19, 'Restaurant Menu', Icons.restaurant_menu_outlined, isDesktop),
                _buildNavItem(20, 'Rest. Orders & KOT', Icons.ramen_dining_outlined, isDesktop),
                _buildNavItem(21, 'Kitchen Queue (KDS)', Icons.kitchen_outlined, isDesktop),
              ],

              if (_hasModuleGroup('Hotel')) ...[
                _buildSectionHeader('HOTEL'),
                _buildNavItem(22, 'Hotel Rooms', Icons.bed_outlined, isDesktop),
                _buildNavItem(23, 'Hotel Guests', Icons.person_pin_outlined, isDesktop),
                _buildNavItem(24, 'Room Bookings', Icons.bedroom_parent_outlined, isDesktop),
              ],

              _buildSectionHeader('ANALYTICS'),
              if (_hasPermission(6)) _buildNavItem(12, 'Reports & Analytics', Icons.assessment_outlined, isDesktop),

              _buildSectionHeader('SUPPORT'),
              _buildNavItem(14, 'Support & Contact', Icons.contact_support_outlined, isDesktop),
              _buildNavItem(15, 'License & AMC', Icons.workspace_premium_outlined, isDesktop),

              _buildSectionHeader('SETTINGS'),
              if (_hasPermission(1)) _buildNavItem(8, 'Role Permissions', Icons.security_outlined, isDesktop),
              _buildNavItem(17, 'Printer Settings', Icons.print_outlined, isDesktop),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 12, top: 16, bottom: 6),
      child: Text(
        title,
        style: GoogleFonts.inter(
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          color: const Color(0xFF64748B),
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, String label, IconData icon, bool isDesktop) {
    final isSelected = _currentIndex == index;
    return Container(
      margin: const EdgeInsets.only(bottom: 3),
      child: ListTile(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        tileColor: isSelected ? const Color(0xFF2563EB) : Colors.transparent,
        dense: true,
        leading: Icon(icon, size: 18, color: isSelected ? Colors.white : const Color(0xFF94A3B8)),
        title: Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 13,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? Colors.white : const Color(0xFFCBD5E1),
          ),
        ),
        onTap: () {
          setState(() => _currentIndex = index);
          if (!isDesktop) Navigator.pop(context);
        },
      ),
    );
  }
}