import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Centralized configuration class for the Flutter application.
/// It dynamically resolves the API Base URL based on the current operating system/platform.
class AppConfig {
  static String? _customHost;

  // ─────────────────────────────────────────────────────────────────────────
  // 🌐 PRODUCTION: Render.com backend URL
  // Update this if your Render service name changes.
  // Find it in: Render Dashboard → your Web Service → URL at the top
  // ─────────────────────────────────────────────────────────────────────────
  static const String _renderProductionUrl = 'https://possys-w2ip.onrender.com';

  /// Initializes config values from SharedPreferences.
  static Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _customHost = prefs.getString('backend_host');
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
  /// Priority: Custom host (from settings) > Render production URL
  static String get baseUrl {
    // If user has manually set a custom host (e.g. local dev or ngrok)
    if (_customHost != null && _customHost!.isNotEmpty) {
      if (_customHost!.contains('ngrok-free.dev') ||
          _customHost!.contains('trycloudflare.com') ||
          _customHost!.contains('onrender.com') ||
          _customHost!.contains('https://')) {
        return 'https://$_customHost';
      }
      return 'http://$_customHost';
    }

    // Default: always use Render production URL for all platforms
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
  /// For Ngrok tunnels, adds the bypass header to skip the interstitial page.
  static Map<String, String> get extraHeaders {
    if (_customHost != null &&
        (_customHost!.contains('ngrok-free.dev') ||
         _customHost!.contains('ngrok.io') ||
         _customHost!.contains('trycloudflare.com'))) {
      return {'ngrok-skip-browser-warning': 'true'};
    }
    return {};
  }
}
