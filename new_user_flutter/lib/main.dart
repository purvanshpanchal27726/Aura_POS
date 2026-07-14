import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'config.dart';
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
        return Color(0xFF10B981);
      case 'purple':
        return Color(0xFF6366F1);
      case 'red':
        return Color(0xFFEF4444);
      case 'orange':
        return Color(0xFFF97316);
      case 'blue':
      default:
        return Color(0xFF2563EB);
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
      title: 'POS System Management',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF8FAFC), // Slate-50 clean background
        primaryColor: primaryColor,
        colorScheme: ColorScheme.light(
          primary: primaryColor,
          secondary: primaryColor.withValues(alpha: 0.7),
          surface: Colors.white,
        ),
        textTheme: GoogleFonts.interTextTheme(const TextTheme(
          bodyLarge: TextStyle(color: Color(0xFF0F172A), fontSize: 14), // Slate-900 primary text
          bodyMedium: TextStyle(color: Color(0xFF475569), fontSize: 13), // Slate-600 secondary text
        )),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF0F172A),
          elevation: 0,
          shadowColor: Colors.black12,
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
        scaffoldBackgroundColor: const Color(0xFF0B0F19), // Deep rich dark background
        primaryColor: primaryColor,
        colorScheme: ColorScheme.dark(
          primary: primaryColor,
          secondary: primaryColor.withValues(alpha: 0.7),
          surface: const Color(0xFF151D30), // Rich dark-blue card
        ),
        textTheme: GoogleFonts.interTextTheme(const TextTheme(
          bodyLarge: TextStyle(color: Color(0xFFF8FAFC), fontSize: 14), // Slate-50 primary text
          bodyMedium: TextStyle(color: Color(0xFF94A3B8), fontSize: 13), // Slate-400 secondary text
        )),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF111827),
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
  bool _isWakingUp = false; // true when Render cold-start is detected

  List<dynamic> allUsers = [];
  Map<String, dynamic>? activeUser;
  List<dynamic> permissionsData = [];

  /// Keep-alive timer — pings Render every 13 min so it never sleeps.
  Timer? _keepAliveTimer;

  @override
  void initState() {
    super.initState();
    if (widget.initialUser != null) {
      try {
        activeUser = json.decode(widget.initialUser!);
        if (activeUser != null && activeUser!['client_id'] != null) {
          AppConfig.setActiveUserClientId(activeUser!['client_id'].toString());
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
      AppConfig.setActiveUserClientId(null);
    } catch (e) {
      debugPrint('Error clearing user session: $e');
    }
  }

  @override
  void dispose() {
    _keepAliveTimer?.cancel();
    super.dispose();
  }

  /// Silently pings the backend every 13 minutes to prevent Render cold starts.
  void _startKeepAlive() {
    _keepAliveTimer?.cancel();
    _keepAliveTimer = Timer.periodic(const Duration(minutes: 13), (_) async {
      try {
        await http
            .get(Uri.parse(AppConfig.usersApiUrl), headers: AppConfig.extraHeaders)
            .timeout(const Duration(seconds: 10));
        debugPrint('[KeepAlive] Render pinged successfully.');
      } catch (e) {
        debugPrint('[KeepAlive] Ping failed (will retry next cycle): $e');
      }
    });
  }

  /// Fetches users and permissions from the backend.
  /// Automatically handles Render.com cold starts with a 3-attempt retry:
  ///   Attempt 1 — 8s  (fast check)
  ///   Attempt 2 — 25s (Render may be waking up)
  ///   Attempt 3 — 50s (full cold-start wait)
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
      // On 2nd+ attempt, show the waking-up message
      if (i == 1 && mounted) {
        setState(() => _isWakingUp = true);
      }

      try {
        final responses = await Future.wait([
          http.get(Uri.parse(AppConfig.usersApiUrl), headers: AppConfig.extraHeaders),
          http.get(Uri.parse(AppConfig.permissionsApiUrl), headers: AppConfig.extraHeaders),
        ]).timeout(attempts[i]);

        if (responses[0].statusCode == 200 && responses[1].statusCode == 200) {
          final List<dynamic> users = json.decode(responses[0].body);
          final Map<String, dynamic> permData = json.decode(responses[1].body);

          if (mounted) {
            setState(() {
              allUsers = users;
              permissionsData = permData['permissions'] ?? [];
              isLoading = false;
              isConnectionFailed = false;
              _isWakingUp = false;
            });
          }
          return; // success — stop retrying
        }
        // Non-200 response — don't retry, show error immediately
        if (mounted) {
          setState(() {
            isLoading = false;
            isConnectionFailed = true;
            _isWakingUp = false;
          });
        }
        return;
      } catch (e) {
        debugPrint('[Attempt ${i + 1}/${attempts.length}] Connection error: $e');
        if (i == attempts.length - 1) {
          // All attempts exhausted
          if (mounted) {
            setState(() {
              isLoading = false;
              isConnectionFailed = true;
              _isWakingUp = false;
            });
          }
        }
        // else: loop continues to next attempt
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
    if (modules == null) return true; // Legacy support
    if (modules is List) {
      if (modules.contains('ALL')) return true;
      return modules.any((m) => m.toString().toLowerCase() == groupName.toLowerCase());
    }
    return true;
  }

  List<Widget> get _screens => [
    DashboardScreen(
      onNavigate: (index) {
        setState(() => _currentIndex = index);
      },
      activeUser: activeUser,
      permissionsData: permissionsData,
    ),
    CategoryListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(3)), // 1
    ItemListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(3)), // 2
    CustomerListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(2)), // 3
    VendorListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(3)), // 4
    UnitListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(3)), // 5
    UserListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(1)), // 6
    TaxListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(3)), // 7
    RolewisePermissionsScreen(onSaved: fetchUsersAndPermissions), // 8
    const SalesBillingScreen(), // 9
    const PurchaseBillingScreen(), // 10
    const ReceiptListingScreen(), // 11
    const ReportsScreen(), // 12
    RoleListingScreen(roleId: activeUser?['role_id'], canModify: _hasPermission(1)), // 13
    const SupportScreen(), // 14
    const LicenseScreen(), // 15
    ClientsScreen(canModify: activeUser?['client_id'] == null), // 16
    const PrinterSettingsScreen(), // 17
    const RestaurantTablesScreen(), // 18
    const RestaurantMenuScreen(), // 19
    const RestaurantOrdersScreen(), // 20
    const RestaurantKdsScreen(), // 21
  ];

  String _getAppBarTitle() {
    switch (_currentIndex) {
      case 0:
        return 'Dashboard';
      case 1:
        return 'Category Master';
      case 2:
        return 'Item Master';
      case 3:
        return 'Customer Master';
      case 4:
        return 'Vendor Master';
      case 5:
        return 'Unit Master';
      case 6:
        return 'User Master';
      case 7:
        return 'Tax Master';
      case 8:
        return 'Settings';
      case 9:
        return 'Sales Billing';
      case 10:
        return 'Purchase Management';
      case 11:
        return 'Receipts';
      case 12:
        return 'Reports';
      case 13:
        return 'Role Master';
      case 14:
        return 'Support & Contact Us';
      case 15:
        return 'AMC & License Management';
      case 16:
        return 'Clients Company Management';
      case 17:
        return 'Thermal Printer Settings';
      case 18:
        return 'Restaurant Tables';
      case 19:
        return 'Restaurant Menu';
      case 20:
        return 'Restaurant Orders';
      case 21:
        return 'Kitchen Display (KDS)';
      default:
        return 'POS System';
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading && activeUser == null) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      return Scaffold(
        backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Animated spinner
              SizedBox(
                width: 52,
                height: 52,
                child: CircularProgressIndicator(
                  strokeWidth: 3.5,
                  color: Theme.of(context).primaryColor,
                ),
              ),
              const SizedBox(height: 28),
              Text(
                _isWakingUp ? '☁️  Waking up server...' : 'Connecting to server...',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white : const Color(0xFF1E293B),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _isWakingUp
                    ? 'The cloud server was idle.\nThis may take up to 60 seconds on first launch.'
                    : 'Please wait while we load your data.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (isConnectionFailed && activeUser == null) {
      return ConnectionSetupScreen(
        onRetry: fetchUsersAndPermissions,
      );
    }

    if (activeUser == null) {
      return LoginScreen(
        onLoginSuccess: (user) {
          setState(() {
            activeUser = user;
            if (user['client_id'] != null) {
              AppConfig.setActiveUserClientId(user['client_id'].toString());
            } else {
              AppConfig.setActiveUserClientId(null);
            }
            _currentIndex = 0; // Go to dashboard
          });
          _saveUser(user);
        },
      );
    }

    return Scaffold(
      appBar: AppBar(
        leading: _currentIndex == 0
            ? null
            : IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  setState(() => _currentIndex = 0);
                },
              ),
        title: Text(
          _getAppBarTitle(),
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          if (MediaQuery.of(context).size.width > 800) ...[
            Icon(Icons.account_circle, color: Theme.of(context).primaryColor, size: 18),
            const SizedBox(width: 6),
            Text(
              '${activeUser!['username']} (${activeUser!['role_name'] ?? 'User'})',
              style: TextStyle(
                color: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF1E293B),
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
            ),
            const SizedBox(width: 16),
          ]
        ],
        bottom: isConnectionFailed
            ? PreferredSize(
                preferredSize: const Size.fromHeight(40),
                child: Container(
                  color: const Color(0xFFFEF2F2),
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.signal_wifi_off_rounded, color: Color(0xFFDC2626), size: 16),
                      const SizedBox(width: 8),
                      Text(
                        'Offline: Cannot connect to server.',
                        style: GoogleFonts.inter(
                          color: const Color(0xFF991B1B),
                          fontSize: 12.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(width: 12),
                      InkWell(
                        onTap: fetchUsersAndPermissions,
                        child: Text(
                          'Retry Connection',
                          style: GoogleFonts.inter(
                            color: Theme.of(context).primaryColor,
                            fontSize: 12.5,
                            fontWeight: FontWeight.bold,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              )
            : null,
      ),
      drawer: Drawer(
        backgroundColor: Theme.of(context).cardColor,
        child: Column(
          children: [
            UserAccountsDrawerHeader(
              decoration: BoxDecoration(color: Theme.of(context).primaryColor),
              currentAccountPicture: CircleAvatar(
                backgroundColor: Colors.white,
                child: Icon(Icons.person, color: Theme.of(context).primaryColor, size: 36),
              ),
              accountName: Text(
                activeUser!['username'],
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
              ),
              accountEmail: Text(
                'Role: ${activeUser!['role_name'] ?? 'User'}',
                style: TextStyle(fontSize: 13, color: Colors.white70),
              ),
              margin: EdgeInsets.zero,
            ),

            Flexible(
              child: Scrollbar(
                thumbVisibility: true,
                thickness: 4,
                radius: const Radius.circular(99),
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    ListTile(
                      leading: Icon(Icons.dashboard, color: Color(0xFF64748B)),
                      title: Text('Home'),
                      selected: _currentIndex == 0,
                      onTap: () {
                        setState(() => _currentIndex = 0);
                        Navigator.pop(context);
                      },
                    ),
                    
                    if ((_hasPermission(1) || _hasPermission(2) || _hasPermission(3)) && (_hasModuleGroup('Kirana') || _hasModuleGroup('POS')))
                      ExpansionTile(
                        leading: Icon(Icons.layers, color: Color(0xFF64748B)),
                        title: Text('Masters', style: TextStyle(fontWeight: FontWeight.bold)),
                        childrenPadding: EdgeInsets.only(left: 16.0),
                        children: [
                          if (_hasPermission(3))
                            ListTile(
                              leading: Icon(Icons.category_outlined, color: Color(0xFF64748B)),
                              title: Text('Category'),
                              selected: _currentIndex == 1,
                              onTap: () {
                                setState(() => _currentIndex = 1);
                                Navigator.pop(context);
                              },
                            ),
                          if (_hasPermission(3))
                            ListTile(
                              leading: Icon(Icons.inventory_2_outlined, color: Color(0xFF64748B)),
                              title: Text('Item'),
                              selected: _currentIndex == 2,
                              onTap: () {
                                setState(() => _currentIndex = 2);
                                Navigator.pop(context);
                              },
                            ),
                          if (_hasPermission(2))
                            ListTile(
                              leading: Icon(Icons.contact_mail, color: Color(0xFF64748B)),
                              title: Text('Customer'),
                              selected: _currentIndex == 3,
                              onTap: () {
                                setState(() => _currentIndex = 3);
                                Navigator.pop(context);
                              },
                            ),
                          if (_hasPermission(3))
                            ListTile(
                              leading: Icon(Icons.local_shipping_outlined, color: Color(0xFF64748B)),
                              title: Text('Vendor'),
                              selected: _currentIndex == 4,
                              onTap: () {
                                setState(() => _currentIndex = 4);
                                Navigator.pop(context);
                              },
                            ),
                          if (_hasPermission(3))
                            ListTile(
                              leading: Icon(Icons.straighten_outlined, color: Color(0xFF64748B)),
                              title: Text('Unit'),
                              selected: _currentIndex == 5,
                              onTap: () {
                                setState(() => _currentIndex = 5);
                                Navigator.pop(context);
                              },
                            ),
                          if (_hasPermission(1))
                            ListTile(
                              leading: Icon(Icons.people, color: Color(0xFF64748B)),
                              title: Text('Users'),
                              selected: _currentIndex == 6,
                              onTap: () {
                                setState(() => _currentIndex = 6);
                                Navigator.pop(context);
                              },
                            ),
                          if (_hasPermission(3))
                            ListTile(
                              leading: Icon(Icons.percent_outlined, color: Color(0xFF64748B)),
                              title: Text('Tax'),
                              selected: _currentIndex == 7,
                              onTap: () {
                                setState(() => _currentIndex = 7);
                                Navigator.pop(context);
                              },
                            ),
                          if (_hasPermission(1))
                            ListTile(
                              leading: Icon(Icons.security, color: Color(0xFF64748B)),
                              title: Text('Roles'),
                              selected: _currentIndex == 13,
                              onTap: () {
                                setState(() => _currentIndex = 13);
                                Navigator.pop(context);
                              },
                            ),
                        ],
                      ),

                    if (_hasPermission(1))
                      ExpansionTile(
                        leading: const Icon(Icons.settings_outlined, color: Color(0xFF64748B)),
                        title: const Text('Settings', style: TextStyle(fontWeight: FontWeight.bold)),
                        childrenPadding: const EdgeInsets.only(left: 16.0),
                        children: [
                          if (_hasModuleGroup('Kirana') || _hasModuleGroup('POS'))
                            ListTile(
                              leading: const Icon(Icons.security_outlined, color: Color(0xFF64748B)),
                              title: const Text('Role Permissions'),
                              selected: _currentIndex == 8,
                              onTap: () {
                                setState(() => _currentIndex = 8);
                                Navigator.pop(context);
                              },
                            ),
                          ListTile(
                            leading: const Icon(Icons.print_outlined, color: Color(0xFF64748B)),
                            title: const Text('Printer Settings'),
                            selected: _currentIndex == 17,
                            onTap: () {
                              setState(() => _currentIndex = 17);
                              Navigator.pop(context);
                            },
                          ),
                        ],
                      ),

                    if (_hasModuleGroup('Restaurant'))
                      ExpansionTile(
                        leading: const Icon(Icons.restaurant_outlined, color: Color(0xFF64748B)),
                        title: const Text('Restaurant POS', style: TextStyle(fontWeight: FontWeight.bold)),
                        childrenPadding: const EdgeInsets.only(left: 16.0),
                        children: [
                          ListTile(
                            leading: const Icon(Icons.table_restaurant_outlined, color: Color(0xFF64748B)),
                            title: const Text('Tables Grid'),
                            selected: _currentIndex == 18,
                            onTap: () {
                              setState(() => _currentIndex = 18);
                              Navigator.pop(context);
                            },
                          ),
                          ListTile(
                            leading: const Icon(Icons.restaurant_menu_outlined, color: Color(0xFF64748B)),
                            title: const Text('Menu Catalog'),
                            selected: _currentIndex == 19,
                            onTap: () {
                              setState(() => _currentIndex = 19);
                              Navigator.pop(context);
                            },
                          ),
                          ListTile(
                            leading: const Icon(Icons.ramen_dining_outlined, color: Color(0xFF64748B)),
                            title: const Text('Orders & KOT'),
                            selected: _currentIndex == 20,
                            onTap: () {
                              setState(() => _currentIndex = 20);
                              Navigator.pop(context);
                            },
                          ),
                          ListTile(
                            leading: const Icon(Icons.kitchen_outlined, color: Color(0xFF64748B)),
                            title: const Text('Kitchen Display (KDS)'),
                            selected: _currentIndex == 21,
                            onTap: () {
                              setState(() => _currentIndex = 21);
                              Navigator.pop(context);
                            },
                          ),
                        ],
                      ),

                    if (_hasPermission(4) && (_hasModuleGroup('Kirana') || _hasModuleGroup('POS')))
                      ListTile(
                        leading: Icon(Icons.shopping_cart_outlined, color: Color(0xFF64748B)),
                        title: Text('Sell'),
                        selected: _currentIndex == 9,
                        onTap: () {
                          setState(() => _currentIndex = 9);
                          Navigator.pop(context);
                        },
                      ),
                    
                    if (_hasPermission(5) && !AppConfig.isRestaurantMode && (_hasModuleGroup('Kirana') || _hasModuleGroup('POS')))
                      ListTile(
                        leading: Icon(Icons.receipt_long_outlined, color: Color(0xFF64748B)),
                        title: Text('Purchase'),
                        selected: _currentIndex == 10,
                        onTap: () {
                          setState(() => _currentIndex = 10);
                          Navigator.pop(context);
                        },
                      ),

                    if (_hasPermission(4) && (_hasModuleGroup('Kirana') || _hasModuleGroup('POS')))
                      ListTile(
                        leading: Icon(Icons.receipt, color: Color(0xFF64748B)),
                        title: Text('Receipt'),
                        selected: _currentIndex == 11,
                        onTap: () {
                          setState(() => _currentIndex = 11);
                          Navigator.pop(context);
                        },
                      ),
                    
                    if (_hasPermission(6) && (_hasModuleGroup('Kirana') || _hasModuleGroup('POS')))
                      ListTile(
                        leading: Icon(Icons.assessment_outlined, color: Color(0xFF64748B)),
                        title: Text('Reports'),
                        selected: _currentIndex == 12,
                        onTap: () {
                          setState(() => _currentIndex = 12);
                          Navigator.pop(context);
                        },
                      ),

                    if (activeUser?['client_id'] == null && _hasModuleGroup('ALL'))
                      ListTile(
                        leading: const Icon(Icons.business, color: Color(0xFF64748B)),
                        title: const Text('Clients'),
                        selected: _currentIndex == 16,
                        onTap: () {
                          setState(() => _currentIndex = 16);
                          Navigator.pop(context);
                        },
                      ),

                    ListTile(
                      leading: Icon(Icons.contact_support_outlined, color: Color(0xFF64748B)),
                      title: Text('Support & Contact'),
                      selected: _currentIndex == 14,
                      onTap: () {
                        setState(() => _currentIndex = 14);
                        Navigator.pop(context);
                      },
                    ),

                    ListTile(
                      leading: Icon(Icons.badge_outlined, color: Color(0xFF64748B)),
                      title: Text('License & AMC'),
                      selected: _currentIndex == 15,
                      onTap: () {
                        setState(() => _currentIndex = 15);
                        Navigator.pop(context);
                      },
                    ),

                  ],
                ),
              ),
            ),
            Divider(height: 1),
            Container(
              padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
              color: Theme.of(context).brightness == Brightness.dark
                  ? Color(0xFF1E293B)
                  : Color(0xFFF8FAFC),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Theme.of(context).brightness == Brightness.dark
                                ? Icons.dark_mode_outlined
                                : Icons.light_mode_outlined,
                            size: 18,
                            color: Color(0xFF64748B),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Theme Mode',
                            style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      DropdownButtonHideUnderline(
                        child: DropdownButton<ThemeMode>(
                          value: widget.currentThemeMode,
                          dropdownColor: Theme.of(context).cardColor,
                          onChanged: (ThemeMode? mode) {
                            if (mode != null) {
                              widget.onThemeChanged(mode, widget.currentAccent);
                            }
                          },
                          items: [
                            DropdownMenuItem(
                              value: ThemeMode.light,
                              child: Text('Light', style: TextStyle(fontSize: 12.5)),
                            ),
                            DropdownMenuItem(
                              value: ThemeMode.dark,
                              child: Text('Dark', style: TextStyle(fontSize: 12.5)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.palette_outlined, size: 18, color: Color(0xFF64748B)),
                          SizedBox(width: 8),
                          Text(
                            'Accent Color',
                            style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: widget.currentAccent,
                          dropdownColor: Theme.of(context).cardColor,
                          onChanged: (String? accent) {
                            if (accent != null) {
                              widget.onThemeChanged(widget.currentThemeMode, accent);
                            }
                          },
                          items: [
                            DropdownMenuItem(value: 'blue', child: Text('Blue', style: TextStyle(fontSize: 12.5))),
                            DropdownMenuItem(value: 'green', child: Text('Green', style: TextStyle(fontSize: 12.5))),
                            DropdownMenuItem(value: 'purple', child: Text('Purple', style: TextStyle(fontSize: 12.5))),
                            DropdownMenuItem(value: 'red', child: Text('Red', style: TextStyle(fontSize: 12.5))),
                            DropdownMenuItem(value: 'orange', child: Text('Orange', style: TextStyle(fontSize: 12.5))),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            backgroundColor: Theme.of(context).cardColor,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            title: Text('Confirm Logout', style: TextStyle(fontWeight: FontWeight.bold)),
                            content: Text('Are you sure you want to log out of this session?'),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(ctx),
                                child: Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
                              ),
                              ElevatedButton(
                                  onPressed: () {
                                    Navigator.pop(ctx);
                                    setState(() {
                                      activeUser = null;
                                      _currentIndex = 0;
                                    });
                                    _clearUser();
                                  },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Color(0xFFEF4444),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                ),
                                child: Text('Logout'),
                              ),
                            ],
                          ),
                        );
                      },
                      icon: Icon(Icons.logout, size: 14),
                      label: Text('Logout Session', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Color(0xFFEF4444),
                        side: BorderSide(color: Color(0xFFFCA5A5)),
                        padding: EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: _screens[_currentIndex],
    );
  }
}

class PlaceholderScreen extends StatelessWidget {
  final String title;
  final IconData icon;
  final String description;

  const PlaceholderScreen({
    super.key,
    required this.title,
    required this.icon,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        'No details',
        style: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w500,
          color: Color(0xFF64748B),
        ),
      ),
    );
  }
}