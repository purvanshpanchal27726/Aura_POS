import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../api_client.dart';
import '../config.dart';

class POSSetupData {
  final List<dynamic> customers;
  final List<dynamic> items;
  final List<dynamic> taxes;
  final List<dynamic> categories;
  final int nextBillNo;

  POSSetupData({
    required this.customers,
    required this.items,
    required this.taxes,
    required this.categories,
    required this.nextBillNo,
  });
}

class POSService {
  static Future<POSSetupData> fetchPOSSetupData() async {
    final responses = await Future.wait([
      ApiClient.get(Uri.parse(AppConfig.customersApiUrl)),
      ApiClient.get(Uri.parse(AppConfig.itemsApiUrl)),
      ApiClient.get(Uri.parse(AppConfig.taxesApiUrl)),
      ApiClient.get(Uri.parse(AppConfig.salesApiUrl)),
      ApiClient.get(Uri.parse(AppConfig.categoriesApiUrl)),
    ]);

    if (responses.every((res) => res.statusCode == 200)) {
      final custData = json.decode(responses[0].body) as List;
      final itemData = json.decode(responses[1].body) as List;
      final taxData = json.decode(responses[2].body) as List;
      final salesData = json.decode(responses[3].body) as List;
      final catData = json.decode(responses[4].body) as List;

      final activeItems = itemData.where((i) => i['active'] == 1 || i['active'] == true).toList();
      final activeCategories = catData.where((c) => c['active'] == 1 || c['active'] == true).toList();

      return POSSetupData(
        customers: custData,
        items: activeItems,
        taxes: taxData,
        categories: activeCategories,
        nextBillNo: salesData.length + 1,
      );
    } else {
      throw Exception('Failed to load transaction resources from server');
    }
  }

  static Future<bool> submitSalesInvoice(Map<String, dynamic> invoicePayload) async {
    final response = await ApiClient.post(
      Uri.parse(AppConfig.salesApiUrl),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(invoicePayload),
    );
    return response.statusCode == 201 || response.statusCode == 200;
  }
}
