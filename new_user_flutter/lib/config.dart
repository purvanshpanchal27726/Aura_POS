import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Centralized configuration class for the Flutter application.
/// It dynamically resolves the API Base URL based on the current operating system/platform.
class AppConfig {
  static String? _customHost;

  // ─────────────────────────────────────────────────────────────────────────
  // 🌐 PRODUCTION: Render.com backend URL  (24/7 hosted — default)
  // This is the permanent backend URL deployed on Render.
  // No ngrok or local server needed — the app works out of the box.
  // Update this only if your Render service URL changes.
  // Find it in: Render Dashboard → your Web Service → URL at the top
  // ─────────────────────────────────────────────────────────────────────────
  static const String _renderProductionUrl = 'https://possys-w2ip.onrender.com';

  static bool _isRestaurantMode = false;
  static bool get isRestaurantMode => _isRestaurantMode;

  static Future<void> setRestaurantMode(bool val) async {
    _isRestaurantMode = val;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('is_restaurant_mode', val);
    } catch (e) {
      debugPrint('Error saving restaurant mode: $e');
    }
  }

  /// Initializes config values from SharedPreferences.
  static Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _customHost = prefs.getString('backend_host');
      _isRestaurantMode = prefs.getBool('is_restaurant_mode') ?? false;
    } catch (e) {
      debugPrint('Error loading custom backend host: $e');
    }
  }

  /// Sets a new custom backend host and persists it.
  static Future<void> setCustomHost(String host) async {
    String cleaned = host.trim();
    cleaned = cleaned.replaceAll('http://', '').replaceAll('https://', '');
    if (cleaned.endsWith('/')) {
      cleaned = cleaned.substring(0, cleaned.length - 1);
    }
    _customHost = cleaned;
    
    try {
      final prefs = await SharedPreferences.getInstance();
      if (_customHost!.isEmpty) {
        await prefs.remove('backend_host');
        _customHost = null;
      } else {
        await prefs.setString('backend_host', _customHost!);
      }
    } catch (e) {
      debugPrint('Error saving custom backend host: $e');
    }
  }

  /// Gets the currently configured host (IP:port).
  static String get currentHost => _customHost ?? '';

  /// Resolves the base URL for the backend API.
  /// Priority: Custom host (from settings) > Render production URL (default)
  static String get baseUrl {
    // If user has manually set a custom host (e.g. local dev fallback)
    if (_customHost != null && _customHost!.isNotEmpty) {
      // HTTPS hosts: Render, Cloudflare tunnels, or already prefixed with https://
      if (_customHost!.contains('onrender.com') ||
          _customHost!.contains('trycloudflare.com') ||
          _customHost!.contains('ngrok-free.dev') ||
          _customHost!.contains('ngrok.io') ||
          _customHost!.contains('https://')) {
        // Strip any accidental double-prefix before adding https://
        final clean = _customHost!.replaceFirst(RegExp(r'^https?://'), '');
        return 'https://$clean';
      }
      return 'http://$_customHost';
    }

    // Default: Render.com production URL — always-on, 24/7
    return _renderProductionUrl;
  }

  /// URL endpoint for user-related API operations
  static String get usersApiUrl => '$baseUrl/api/users';

  /// URL endpoint for customer-related API operations
  static String get customersApiUrl => '$baseUrl/api/customers';

  /// URL endpoint for unit-related API operations
  static String get unitsApiUrl => '$baseUrl/api/units';

  /// URL endpoint for tax-related API operations
  static String get taxesApiUrl => '$baseUrl/api/taxes';

  /// URL endpoint for category-related API operations
  static String get categoriesApiUrl => '$baseUrl/api/categories';

  /// URL endpoint for item-related API operations
  static String get itemsApiUrl => '$baseUrl/api/items';

  /// URL endpoint for dashboard statistics
  static String get dashboardStatsUrl => '$baseUrl/api/dashboard/stats';

  /// URL endpoint for vendor-related API operations
  static String get vendorsApiUrl => '$baseUrl/api/vendors';

  /// URL endpoint for sales billing API operations
  static String get salesApiUrl => '$baseUrl/api/sales';

  /// URL endpoint for permission-related API operations
  static String get permissionsApiUrl => '$baseUrl/api/permissions';

  /// URL endpoint for role-related API operations
  static String get rolesApiUrl => '$baseUrl/api/roles';

  /// URL endpoint for purchase-related API operations
  static String get purchasesApiUrl => '$baseUrl/api/purchase';

  /// Returns extra HTTP headers required based on the current host.
  /// Render.com does not need any special headers.
  /// Ngrok tunnels require a bypass header to skip the interstitial warning page.
  static Map<String, String> get extraHeaders {
    // No custom host → using Render production → no extra headers needed
    if (_customHost == null || _customHost!.isEmpty) return {};

    // Ngrok interstitial bypass (only needed for local dev tunnels)
    if (_customHost!.contains('ngrok-free.dev') ||
        _customHost!.contains('ngrok.io')) {
      return {'ngrok-skip-browser-warning': 'true'};
    }
    return {};
  }
}
