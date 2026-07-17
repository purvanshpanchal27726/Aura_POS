import 'dart:convert';
import 'package:http/http.dart' as http;
import 'config.dart';

/// Custom API client that automatically appends the active user's client ID header
/// ('x-client-id') for SaaS tenant isolation in PostgreSQL queries.
class ApiClient {
  static Map<String, String> _getHeaders(Map<String, String>? customHeaders) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    
    // Add extra headers from AppConfig (e.g. ngrok bypass headers if applicable)
    headers.addAll(AppConfig.extraHeaders);

    if (customHeaders != null) {
      headers.addAll(customHeaders);
    }
    
    // Inject active user's client ID if logged in
    if (AppConfig.activeUserClientId != null) {
      headers['x-client-id'] = AppConfig.activeUserClientId!;
    }

    // Inject active user's JWT authorization token if logged in
    if (AppConfig.authToken != null) {
      headers['Authorization'] = 'Bearer ${AppConfig.authToken!}';
    }
    
    return headers;
  }

  static Future<http.Response> get(Uri url, {Map<String, String>? headers}) {
    return http.get(url, headers: _getHeaders(headers));
  }

  static Future<http.Response> post(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) {
    return http.post(url, headers: _getHeaders(headers), body: body, encoding: encoding);
  }

  static Future<http.Response> put(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) {
    return http.put(url, headers: _getHeaders(headers), body: body, encoding: encoding);
  }

  static Future<http.Response> delete(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) {
    return http.delete(url, headers: _getHeaders(headers), body: body, encoding: encoding);
  }
}
