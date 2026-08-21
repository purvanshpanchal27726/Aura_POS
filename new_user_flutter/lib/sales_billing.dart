import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'config.dart';
import 'api_client.dart';
import 'models/cart_item_model.dart';
import 'services/pdf_receipt_service.dart';
import 'services/bonrix_display_service.dart';

class SalesBillingScreen extends StatefulWidget {
  const SalesBillingScreen({super.key});

  @override
  State<SalesBillingScreen> createState() => _SalesBillingScreenState();
}

class _SalesBillingScreenState extends State<SalesBillingScreen> {
  bool isLoading = false;
  
  List<dynamic> customers = [];
  List<dynamic> items = [];
  List<dynamic> taxes = [];
  List<dynamic> categories = [];
  
  int? selectedCustomerId;
  DateTime invoiceDate = DateTime.now();
  int billNo = 1;
  String selectedPaymentMethod = 'Cash';
  
  // Cart lines state list
  List<Map<String, dynamic>> cartLines = [];
  
  // Filtering state
  String searchQuery = '';
  int? selectedCategoryIdFilter; // null means 'All'

  @override
  void initState() {
    super.initState();
    fetchSetupData();
  }

  Future<void> fetchSetupData() async {
    try {
      setState(() => isLoading = true);
      
      final responses = await Future.wait([
        ApiClient.get(Uri.parse(AppConfig.customersApiUrl)),
        ApiClient.get(Uri.parse(AppConfig.itemsApiUrl)),
        ApiClient.get(Uri.parse(AppConfig.taxesApiUrl)),
        ApiClient.get(Uri.parse(AppConfig.salesApiUrl)),
        ApiClient.get(Uri.parse(AppConfig.categoriesApiUrl)),
      ]);

      if (responses.every((res) => res.statusCode == 200)) {
        final custData = json.decode(responses[0].body);
        final itemData = json.decode(responses[1].body);
        final taxData = json.decode(responses[2].body);
        final salesData = json.decode(responses[3].body);
        final catData = json.decode(responses[4].body);
        
        setState(() {
          customers = custData;
          items = itemData.where((i) => i['active'] == 1 || i['active'] == true).toList();
          taxes = taxData;
          categories = catData.where((c) => c['active'] == 1 || c['active'] == true).toList();
          billNo = salesData.length + 1;
          isLoading = false;
        });
      } else {
        throw Exception('Failed to fetch transaction resources');
      }
    } catch (e) {
      debugPrint('Error loading billing setup: $e');
      setState(() => isLoading = false);
    }
  }

  void _addItemToCart(dynamic item) {
    SystemSound.play(SystemSoundType.click);
    final itemId = item['item_id'];
    final defaultPrice = double.tryParse(item['sales_price']?.toString() ?? '0.0') ?? 0.0;
    final taxId = item['tax_id'];
    
    double percent = 0.0;
    if (taxId != null) {
      final tax = taxes.firstWhere((t) => t['tax_id'] == taxId, orElse: () => null);
      if (tax != null) {
        final label = tax['name'] ?? '';
        final match = RegExp(r'\d+').firstMatch(label);
        if (match != null) {
          percent = (double.tryParse(match.group(0)!) ?? 0.0) / 100.0;
        }
      }
    }

    final existingIdx = cartLines.indexWhere((line) => line['item_id'] == itemId);
    setState(() {
      if (existingIdx != -1) {
        final newQty = cartLines[existingIdx]['quantity'] + 1.0;
        final rate = cartLines[existingIdx]['rate'];
        final newGross = rate * newQty;
        final newTaxAmt = newGross * percent;
        final newNet = newGross + newTaxAmt;
        
        cartLines[existingIdx]['quantity'] = newQty;
        cartLines[existingIdx]['gross'] = newGross;
        cartLines[existingIdx]['tax_amount'] = newTaxAmt;
        cartLines[existingIdx]['item_amount'] = newNet;
      } else {
        final gross = defaultPrice * 1.0;
        final taxAmt = gross * percent;
        final net = gross + taxAmt;
        cartLines.add({
          'item_id': itemId,
          'name': item['name'] ?? 'N/A',
          'rate': defaultPrice,
          'quantity': 1.0,
          'taxPercent': percent,
          'gross': gross,
          'tax_amount': taxAmt,
          'item_amount': net,
          'editable_price': item['editable_price'] == 1 || item['editable_price'] == true,
        });
      }
    });
  }

  void _updateLineQuantity(int idx, double newQty) {
    if (newQty <= 0) {
      setState(() {
        cartLines.removeAt(idx);
      });
      return;
    }
    setState(() {
      final line = cartLines[idx];
      final rate = line['rate'];
      final percent = line['taxPercent'];
      final newGross = rate * newQty;
      final newTaxAmt = newGross * percent;
      final newNet = newGross + newTaxAmt;
      
      line['quantity'] = newQty;
      line['gross'] = newGross;
      line['tax_amount'] = newTaxAmt;
      line['item_amount'] = newNet;
    });
  }

  void _updateLineRate(int idx, double newRate) {
    setState(() {
      final line = cartLines[idx];
      final qty = line['quantity'];
      final percent = line['taxPercent'];
      final newGross = newRate * qty;
      final newTaxAmt = newGross * percent;
      final newNet = newGross + newTaxAmt;
      
      line['rate'] = newRate;
      line['gross'] = newGross;
      line['tax_amount'] = newTaxAmt;
      line['item_amount'] = newNet;
    });
  }

  void _removeCartLine(int index) {
    setState(() {
      cartLines.removeAt(index);
    });
  }

  void _resetInvoice() {\n    BonrixDisplayService.showWelcome();
    setState(() {
      selectedCustomerId = null;
      invoiceDate = DateTime.now();
      cartLines.clear();
      searchQuery = '';
      selectedCategoryIdFilter = null;
      selectedPaymentMethod = 'Cash';
    });
    fetchSetupData();
  }

  double get grossTotal => cartLines.fold(0.0, (sum, line) => sum + (line['gross'] ?? 0.0));
  double get taxTotal => cartLines.fold(0.0, (sum, line) => sum + (line['tax_amount'] ?? 0.0));
  double get netTotal => cartLines.fold(0.0, (sum, line) => sum + (line['item_amount'] ?? 0.0));

  Future<void> _saveInvoice() async {
    if (selectedCustomerId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Please select a customer', style: GoogleFonts.inter()),
          backgroundColor: const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    
    if (cartLines.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Please add at least one item to checkout', style: GoogleFonts.inter()),
          backgroundColor: const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    
    final String dateStr = "${invoiceDate.year}-${invoiceDate.month.toString().padLeft(2, '0')}-${invoiceDate.day.toString().padLeft(2, '0')}";
    
    final payload = {
      'customer_id': selectedCustomerId,
      'sales_date': dateStr,
      'sales_bill_no': billNo.toString(),
      'gross': grossTotal,
      'tax': taxTotal,
      'total': netTotal,
      'created_by': 'System',
      'payment_method': selectedPaymentMethod,
      'items': cartLines.map((line) => {
        'item_id': line['item_id'],
        'rate': line['rate'],
        'quantity': line['quantity'],
        'item_amount': line['item_amount'],
      }).toList(),
    };

    try {
      setState(() => isLoading = true);
      final response = await ApiClient.post(
        Uri.parse(AppConfig.salesApiUrl),
        body: json.encode(payload),
      );

      if (!mounted) return;

      if (response.statusCode == 201) {
        SystemSound.play(SystemSoundType.click);
        HapticFeedback.heavyImpact();
        final res = json.decode(response.body);
        final salesId = res['sales_id'];
        
        BonrixDisplayService.showSuccess(netTotal.toStringAsFixed(2));
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Invoice saved successfully!', style: GoogleFonts.inter()), 
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
          ),
        );
        
        _openReceiptDialog(salesId);
        _resetInvoice();
      } else {
        final err = json.decode(response.body);
        throw Exception(err['error'] ?? 'Failed to save billing invoice');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${e.toString()}', style: GoogleFonts.inter()), 
          backgroundColor: const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _openReceiptDialog(int salesId) async {
    try {
      final response = await ApiClient.get(Uri.parse('${AppConfig.salesApiUrl}/$salesId'));
      if (response.statusCode != 200) throw Exception('Failed to load invoice receipt details.');
      
      final invoice = json.decode(response.body);
      if (!mounted) return;
      
      showDialog(
        context: context,
        builder: (ctx) {
          final isDark = Theme.of(context).brightness == Brightness.dark;
          return AlertDialog(
            backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Row(
              children: [
                const Icon(Icons.receipt_rounded, color: Color(0xFF6366F1)),
                const SizedBox(width: 8),
                Text('Print Receipt', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
              ],
            ),
            content: Container(
              width: 380,
              padding: const EdgeInsets.all(12.0),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF0B0F19) : const Color(0xFFF8FAFC),
                border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      (invoice['client_name'] ?? 'AURA POS ENTERPRISE').toString().toUpperCase(),
                      style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1.0, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      invoice['address_1'] ?? '123 Commercial Hub, SG Highway, Ahmedabad',
                      style: GoogleFonts.inter(fontSize: 11, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                      textAlign: TextAlign.center,
                    ),
                    Text(
                      'GSTIN: ${invoice['gstin'] ?? '24AAACV1234F1Z9'}',
                      style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: isDark ? const Color(0xFF38BDF8) : const Color(0xFF0284C7)),
                    ),
                    const SizedBox(height: 10),

                    // Visual Invoice Barcode Box
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1)),
                      ),
                      child: Column(
                        children: [
                          Text(
                            '||| | || |||| | ||| |||| | |||',
                            style: GoogleFonts.robotoMono(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 3, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '*${invoice['sales_bill_no'] ?? 'INV-1001'}*',
                            style: GoogleFonts.inter(fontSize: 10.5, fontWeight: FontWeight.w600, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 20, thickness: 1),
                    
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Bill No: ${invoice['sales_bill_no'] ?? 'N/A'}', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF1E293B))),
                        Text('Date: ${invoice['sales_date'] ?? 'N/A'}', style: GoogleFonts.inter(fontSize: 12, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B))),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Customer: ${invoice['customer_name'] ?? 'Walk-in'}', style: GoogleFonts.inter(fontSize: 12, color: isDark ? Colors.white70 : const Color(0xFF334155))),
                        Text('Pay Mode: ${invoice['payment_method'] ?? 'Cash'}', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: const Color(0xFF6366F1))),
                      ],
                    ),
                    const Divider(height: 24, thickness: 1),
                    
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(child: Text('Item Name', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: isDark ? Colors.white70 : const Color(0xFF475569)))),
                        SizedBox(width: 50, child: Text('Qty', textAlign: TextAlign.right, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: isDark ? Colors.white70 : const Color(0xFF475569)))),
                        SizedBox(width: 80, child: Text('Amount', textAlign: TextAlign.right, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: isDark ? Colors.white70 : const Color(0xFF475569)))),
                      ],
                    ),
                    const SizedBox(height: 8),
                    
                    ...((invoice['items'] as List<dynamic>? ?? []).map((i) {
                      final qty = double.tryParse(i['quantity']?.toString() ?? '0.0') ?? 0.0;
                      final amt = double.tryParse(i['item_amount']?.toString() ?? '0.0') ?? 0.0;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(child: Text(i['item_name'] ?? 'N/A', style: GoogleFonts.inter(fontSize: 11.5, color: isDark ? Colors.white70 : const Color(0xFF334155)))),
                            SizedBox(width: 50, child: Text(qty.toStringAsFixed(1), textAlign: TextAlign.right, style: GoogleFonts.inter(fontSize: 11.5, color: isDark ? Colors.white70 : const Color(0xFF334155)))),
                            SizedBox(width: 80, child: Text('₹${amt.toStringAsFixed(2)}', textAlign: TextAlign.right, style: GoogleFonts.inter(fontSize: 11.5, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF1E293B)))),
                          ],
                        ),
                      );
                    })),
                    
                    const Divider(height: 24, thickness: 1),
                    
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Gross Total:', style: GoogleFonts.inter(fontSize: 12, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B))),
                        Text('₹${(double.tryParse(invoice['gross']?.toString() ?? '0.0') ?? 0.0).toStringAsFixed(2)}', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: isDark ? Colors.white70 : const Color(0xFF334155))),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Tax Total:', style: GoogleFonts.inter(fontSize: 12, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B))),
                        Text('₹${(double.tryParse(invoice['tax']?.toString() ?? '0.0') ?? 0.0).toStringAsFixed(2)}', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: isDark ? Colors.white70 : const Color(0xFF334155))),
                      ],
                    ),
                    const Divider(height: 18),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Net Payable:', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A))),
                        Text('₹${(double.tryParse(invoice['total']?.toString() ?? '0.0') ?? 0.0).toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: const Color(0xFF6366F1))),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text('Thank you for shopping with us!', style: GoogleFonts.inter(fontSize: 10.5, fontStyle: FontStyle.italic, color: const Color(0xFF64748B))),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: Text('Close', style: GoogleFonts.inter(color: const Color(0xFF64748B), fontWeight: FontWeight.bold)),
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF25D366),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(Icons.chat_rounded, size: 16),
                label: Text('WhatsApp', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                onPressed: () {
                  Navigator.pop(ctx);
                  _sendWhatsAppReceipt(invoice);
                },
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6366F1),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(Icons.print_rounded, size: 16),
                label: Text('Print Receipt', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                onPressed: () {
                  PdfReceiptService.printReceipt(invoice);
                  Navigator.pop(ctx);
                },
              ),
            ],
          );
        },
      );
    } catch (e) {
      debugPrint('Error viewing receipt: $e');
    }
  }

  void _sendWhatsAppReceipt(Map<String, dynamic> invoice) {
    final phoneController = TextEditingController(text: invoice['customer_phone']?.toString() ?? '9876543210');
    showDialog(
      context: context,
      builder: (dlgCtx) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return AlertDialog(
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              const Icon(Icons.chat_rounded, color: Color(0xFF25D366)),
              const SizedBox(width: 8),
              Text('Send WhatsApp Receipt', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Enter Customer WhatsApp 10-Digit Mobile Number:', style: GoogleFonts.inter(fontSize: 12, color: isDark ? Colors.white70 : const Color(0xFF475569))),
              const SizedBox(height: 12),
              TextField(
                controller: phoneController,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  prefixText: '+91 ',
                  labelText: 'Mobile Number',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dlgCtx),
              child: Text('Cancel', style: GoogleFonts.inter(color: Colors.grey)),
            ),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF25D366),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.send_rounded, size: 16),
              label: Text('Send Invoice', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
              onPressed: () async {
                final rawPhone = phoneController.text.trim().replaceAll(RegExp(r'\D'), '');
                final phone = rawPhone.length >= 10 ? rawPhone.substring(rawPhone.length - 10) : rawPhone;
                final billNo = invoice['sales_bill_no'] ?? 'INV-1001';
                final total = invoice['total'] ?? '0.00';
                final pdfUrl = '${AppConfig.salesApiUrl}/pdf/$billNo';
                final msg = 'Hello! Thank you for shopping with us. Your POS Invoice $billNo for total ₹$total is ready. View/Download Official Invoice: $pdfUrl';
                final url = Uri.parse('https://wa.me/91$phone?text=${Uri.encodeComponent(msg)}');
                
                Navigator.pop(dlgCtx);
                try {
                  if (await canLaunchUrl(url)) {
                    await launchUrl(url, mode: LaunchMode.externalApplication);
                  } else {
                    await launchUrl(url);
                  }
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('WhatsApp Delivery Link: $url'), backgroundColor: const Color(0xFF25D366)),
                  );
                }
              },
            ),
          ],
        );
      },
    );
  }

  Widget _getItemImage(dynamic imageUrlOrBase64, {String? itemName, double size = 48}) {
    Widget buildAvatarFallback() {
      final name = (itemName ?? 'POS Item').trim();
      final parts = name.split(' ').where((p) => p.isNotEmpty).toList();
      final initials = parts.length >= 2 
        ? '${parts[0][0]}${parts[1][0]}'.toUpperCase() 
        : (name.length >= 2 ? name.substring(0, 2).toUpperCase() : name.toUpperCase());

      final colorIndex = (name.codeUnits.fold<int>(0, (a, b) => a + b)) % 5;
      final gradients = [
        [const Color(0xFF2563EB), const Color(0xFF3B82F6)],
        [const Color(0xFF0284C7), const Color(0xFF38BDF8)],
        [const Color(0xFFD97706), const Color(0xFFF59E0B)],
        [const Color(0xFF059669), const Color(0xFF10B981)],
        [const Color(0xFF7C3AED), const Color(0xFFA855F7)],
      ];
      final selectedGradient = gradients[colorIndex];

      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: selectedGradient,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Center(
          child: Text(
            initials,
            style: GoogleFonts.outfit(
              fontSize: size * 0.38,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ),
      );
    }

    if (imageUrlOrBase64 == null || imageUrlOrBase64.toString().isEmpty || imageUrlOrBase64.toString() == 'null') {
      return buildAvatarFallback();
    }
    final imgStr = imageUrlOrBase64.toString();
    if (imgStr.startsWith('http://') || imgStr.startsWith('https://')) {
      return Image.network(
        imgStr,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (ctx, err, st) => buildAvatarFallback(),
      );
    } else if (imgStr.startsWith('/uploads/') || imgStr.startsWith('/Images/')) {
      final fullUrl = '${AppConfig.baseUrl}$imgStr';
      return Image.network(
        fullUrl,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (ctx, err, st) => buildAvatarFallback(),
      );
    } else if (imgStr.contains('base64,')) {
      try {
        final base64Data = imgStr.split('base64,').last;
        return Image.memory(
          base64Decode(base64Data),
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (ctx, err, st) => buildAvatarFallback(),
        );
      } catch (e) {
        return buildAvatarFallback();
      }
    } else {
      try {
        return Image.memory(
          base64Decode(imgStr),
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (ctx, err, st) => buildAvatarFallback(),
        );
      } catch (e) {
        return buildAvatarFallback();
      }
    }
  }

  Widget _buildCatalogHeader() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2)),
        ]
      ),
      child: Column(
        children: [
          // Text search input
          TextField(
            onChanged: (val) => setState(() => searchQuery = val),
            style: GoogleFonts.inter(color: isDark ? Colors.white : const Color(0xFF0F172A)),
            decoration: InputDecoration(
              labelText: 'Search Products...',
              labelStyle: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
              prefixIcon: Icon(Icons.search_rounded, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Theme.of(context).primaryColor, width: 2),
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
              filled: true,
              fillColor: isDark ? const Color(0xFF0B0F19) : const Color(0xFFF8FAFC),
            ),
          ),
          const SizedBox(height: 12),
          
          // Horizontal scrollable category list
          SizedBox(
            height: 38,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: categories.length + 1,
              itemBuilder: (ctx, idx) {
                final isAll = idx == 0;
                final dynamic cat = isAll ? null : categories[idx - 1];
                final catId = isAll ? null : cat['category_id'];
                final catName = isAll ? 'All Products' : cat['name'];
                final isSelected = selectedCategoryIdFilter == catId;

                return Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  child: ChoiceChip(
                    label: Text(
                      catName,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        color: isSelected ? Colors.white : (isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569)),
                      ),
                    ),
                    selected: isSelected,
                    selectedColor: const Color(0xFF6366F1),
                    backgroundColor: isDark ? const Color(0xFF0B0F19) : const Color(0xFFF1F5F9),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    showCheckmark: false,
                    onSelected: (_) {
                      setState(() => selectedCategoryIdFilter = catId);
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCatalogGrid(List<dynamic> filteredItems) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    if (filteredItems.isEmpty) {
      return Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF151D30) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.inventory_2_outlined, size: 48, color: isDark ? const Color(0xFF334155) : const Color(0xFF94A3B8)),
              const SizedBox(height: 12),
              Text(
                'No items found matching filter.',
                style: GoogleFonts.inter(fontSize: 14, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
              ),
            ],
          ),
        ),
      );
    }

    return LayoutBuilder(
      builder: (ctx, constraints) {
        int columns = 3;
        if (constraints.maxWidth > 900) {
          columns = 4;
        } else if (constraints.maxWidth < 600) {
          columns = 2;
        }
        return GridView.builder(
          itemCount: filteredItems.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            crossAxisSpacing: 14,
            mainAxisSpacing: 14,
            childAspectRatio: 0.76,
          ),
          itemBuilder: (ctx, idx) {
            final item = filteredItems[idx];
            final price = double.tryParse(item['sales_price']?.toString() ?? '0.0') ?? 0.0;
            return Card(
              margin: EdgeInsets.zero,
              color: isDark ? const Color(0xFF151D30) : Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
              ),
              child: InkWell(
                onTap: () => _addItemToCart(item),
                borderRadius: BorderRadius.circular(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                        child: _getItemImage(item['image'], itemName: item['name']),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 10.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item['name'] ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13.5, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            item['category_name'] ?? 'No Category',
                            style: GoogleFonts.inter(fontSize: 11, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '₹${price.toStringAsFixed(2)}',
                                style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 14, color: const Color(0xFF6366F1)),
                              ),
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF6366F1).withValues(alpha: 0.1),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.add_rounded, size: 16, color: Color(0xFF6366F1)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildCartPanel() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(color: Colors.black12, blurRadius: 6, offset: Offset(0, 2)),
        ],
      ),
      child: ListView(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Current Invoice',
                style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF6366F1).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'Bill No: $billNo',
                  style: GoogleFonts.inter(fontSize: 12.5, fontWeight: FontWeight.bold, color: const Color(0xFF6366F1)),
                ),
              ),
            ],
          ),
          const Divider(height: 24),
          
          // Customer selection & Bill Date
          DropdownButtonFormField<int>(
            key: ValueKey(selectedCustomerId),
            initialValue: selectedCustomerId,
            style: GoogleFonts.inter(color: isDark ? Colors.white : const Color(0xFF0F172A), fontSize: 13.5),
            decoration: InputDecoration(
              labelText: 'Select Customer *',
              labelStyle: TextStyle(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              filled: true,
              fillColor: isDark ? const Color(0xFF0B0F19) : const Color(0xFFF8FAFC),
            ),
            items: customers.map<DropdownMenuItem<int>>((c) {
              return DropdownMenuItem<int>(
                value: c['customer_id'],
                child: Text('${c['first_name'] ?? ''} ${c['last_name'] ?? ''}'),
              );
            }).toList(),
            onChanged: (val) {
              setState(() => selectedCustomerId = val);
            },
          ),
          const SizedBox(height: 12),
          TextFormField(
            readOnly: true,
            style: GoogleFonts.inter(color: isDark ? Colors.white : const Color(0xFF0F172A), fontSize: 13.5),
            decoration: InputDecoration(
              labelText: 'Sales Date',
              labelStyle: TextStyle(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
              suffixIcon: const Icon(Icons.calendar_month_rounded, color: Color(0xFF6366F1), size: 20),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              filled: true,
              fillColor: isDark ? const Color(0xFF0B0F19) : const Color(0xFFF8FAFC),
            ),
            controller: TextEditingController(
              text: "${invoiceDate.day.toString().padLeft(2, '0')}/${invoiceDate.month.toString().padLeft(2, '0')}/${invoiceDate.year}",
            ),
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: invoiceDate,
                firstDate: DateTime(2020),
                lastDate: DateTime(2030),
              );
              if (picked != null) {
                setState(() => invoiceDate = picked);
              }
            },
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: selectedPaymentMethod,
            style: GoogleFonts.inter(color: isDark ? Colors.white : const Color(0xFF0F172A), fontSize: 13.5),
            decoration: InputDecoration(
              labelText: 'Payment Method',
              labelStyle: TextStyle(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              filled: true,
              fillColor: isDark ? const Color(0xFF0B0F19) : const Color(0xFFF8FAFC),
            ),
            items: const [
              DropdownMenuItem(value: 'Cash', child: Text('Cash')),
              DropdownMenuItem(value: 'UPI', child: Text('UPI')),
              DropdownMenuItem(value: 'Half Cash + Half UPI', child: Text('Half Cash + Half UPI (Split)')),
            ],
            onChanged: (val) {
              if (val != null) {
                setState(() => selectedPaymentMethod = val);
                if (val == 'UPI') {
                   BonrixDisplayService.showQR(netTotal.toStringAsFixed(2), 'store@upi', 'upi://pay?pa=store@upi&pn=Store&am=${netTotal.toStringAsFixed(2)}');
                } else {
                   BonrixDisplayService.showWelcome();
                }
              }
            },
          ),
          const Divider(height: 24),
          
          // Cart line items list
          cartLines.isEmpty
              ? Container(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.shopping_cart_outlined, size: 36, color: isDark ? const Color(0xFF334155) : const Color(0xFF94A3B8)),
                      const SizedBox(height: 10),
                      Text(
                        'Checkout cart is empty.',
                        style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                )
              : ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: cartLines.length,
                  separatorBuilder: (ctx, idx) => Divider(height: 12, color: isDark ? const Color(0xFF1F2937) : const Color(0xFFF1F5F9)),
                  itemBuilder: (ctx, idx) {
                    final line = cartLines[idx];
                      final qty = line['quantity'] as double;
                      final rate = line['rate'] as double;
                      final isEditable = line['editable_price'] == true;
                      
                      return Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  line['name'] ?? '',
                                  style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                isEditable
                                    ? SizedBox(
                                        width: 100,
                                        height: 32,
                                        child: TextFormField(
                                          initialValue: rate.toStringAsFixed(2),
                                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                          style: GoogleFonts.inter(fontSize: 12, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                                          decoration: const InputDecoration(
                                            prefixText: '₹',
                                            contentPadding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                            border: OutlineInputBorder(),
                                          ),
                                          onChanged: (val) {
                                            final newRate = double.tryParse(val) ?? 0.0;
                                            _updateLineRate(idx, newRate);
                                          },
                                        ),
                                      )
                                    : Text(
                                        '₹${rate.toStringAsFixed(2)}',
                                        style: GoogleFonts.inter(fontSize: 12, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                                      ),
                              ],
                            ),
                          ),
                          
                          // Inline Quantity controls (- Qty +)
                          Row(
                            children: [
                              IconButton(
                                onPressed: () => _updateLineQuantity(idx, qty - 1.0),
                                icon: const Icon(Icons.remove_rounded, size: 14),
                                style: IconButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: const Size(26, 26),
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  backgroundColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 10.0),
                                child: Text(
                                  qty.toStringAsFixed(0),
                                  style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13.5),
                                ),
                              ),
                              IconButton(
                                onPressed: () => _updateLineQuantity(idx, qty + 1.0),
                                icon: const Icon(Icons.add_rounded, size: 14),
                                style: IconButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: const Size(26, 26),
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  backgroundColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 14),
                          
                          // Amount & Delete button
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '₹${(line['item_amount'] as double).toStringAsFixed(2)}',
                                style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                              ),
                              const SizedBox(height: 3),
                              InkWell(
                                onTap: () => _removeCartLine(idx),
                                child: Text('Remove', style: GoogleFonts.inter(color: const Color(0xFFEF4444), fontSize: 11, fontWeight: FontWeight.w600)),
                              ),
                            ],
                          ),
                        ],
                      );
                    },
                  ),
          const Divider(height: 24),
          
          // Invoice Calculations
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Gross Total', style: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B), fontSize: 12.5)),
              Text('₹${grossTotal.toStringAsFixed(2)}', style: GoogleFonts.inter(fontSize: 13.5, fontWeight: FontWeight.w600, color: isDark ? Colors.white70 : const Color(0xFF334155))),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Tax Total', style: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B), fontSize: 12.5)),
              Text('₹${taxTotal.toStringAsFixed(2)}', style: GoogleFonts.inter(fontSize: 13.5, fontWeight: FontWeight.w600, color: isDark ? Colors.white70 : const Color(0xFF334155))),
            ],
          ),
          const Divider(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Net Total', style: GoogleFonts.inter(fontSize: 14.5, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A))),
              Text('₹${netTotal.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: const Color(0xFF6366F1))),
            ],
          ),
          const SizedBox(height: 16),
          
          // Action buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _resetInvoice,
                  child: Text('Reset', style: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B), fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6366F1),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: _saveInvoice,
                  child: Text('Save & Print', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Filter items based on selected category and search input
    final filteredItems = items.where((item) {
      final matchesSearch = item['name']?.toString().toLowerCase().contains(searchQuery.toLowerCase()) ?? true;
      final matchesCategory = selectedCategoryIdFilter == null || item['category_id'] == selectedCategoryIdFilter;
      return matchesSearch && matchesCategory;
    }).toList();

    final bool isMobile = MediaQuery.of(context).size.width < 850;

    if (isMobile) {
      return DefaultTabController(
        length: 2,
        child: Scaffold(
          appBar: PreferredSize(
            preferredSize: const Size.fromHeight(50),
            child: Container(
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF111827) : Colors.white,
                border: Border(bottom: BorderSide(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFCBD5E1))),
              ),
              child: TabBar(
                indicatorColor: const Color(0xFF6366F1),
                labelColor: const Color(0xFF6366F1),
                unselectedLabelColor: const Color(0xFF64748B),
                labelStyle: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
                tabs: [
                  const Tab(text: 'Catalog', icon: Icon(Icons.grid_view_rounded, size: 18)),
                  Tab(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.shopping_cart_rounded, size: 18),
                        const SizedBox(width: 6),
                        const Text('Cart'),
                        if (cartLines.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Color(0xFFEF4444),
                              shape: BoxShape.circle,
                            ),
                            constraints: const BoxConstraints(
                              minWidth: 16,
                              minHeight: 16,
                            ),
                            child: Text(
                              '${cartLines.length}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ]
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          body: isLoading
              ? Center(child: CircularProgressIndicator(color: Theme.of(context).primaryColor))
              : TabBarView(
                  children: [
                    // Tab 1: Catalog
                    Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        children: [
                          _buildCatalogHeader(),
                          const SizedBox(height: 12),
                          Expanded(child: _buildCatalogGrid(filteredItems)),
                        ],
                      ),
                    ),
                    // Tab 2: Cart & Checkout
                    Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: _buildCartPanel(),
                    ),
                  ],
                ),
        ),
      );
    }

    return Scaffold(
      body: isLoading
          ? Center(child: CircularProgressIndicator(color: Theme.of(context).primaryColor))
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Left catalog panel (flex 3)
                  Expanded(
                    flex: 3,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildCatalogHeader(),
                        const SizedBox(height: 16),
                        Expanded(child: _buildCatalogGrid(filteredItems)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  
                  // Right cart panel (width 380)
                  SizedBox(
                    width: 380,
                    child: _buildCartPanel(),
                  ),
                ],
              ),
            ),
    );
  }
}
