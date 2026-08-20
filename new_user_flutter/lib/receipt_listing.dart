import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'config.dart';
import 'api_client.dart';
import 'package:intl/intl.dart';
import 'services/pdf_receipt_service.dart';

class ReceiptListingScreen extends StatefulWidget {
  const ReceiptListingScreen({super.key});

  @override
  State<ReceiptListingScreen> createState() => _ReceiptListingScreenState();
}

class _ReceiptListingScreenState extends State<ReceiptListingScreen> {
  List<dynamic> receipts = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    fetchReceipts();
  }

  Future<void> fetchReceipts() async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse(AppConfig.salesApiUrl));
      if (response.statusCode == 200) {
        setState(() {
          receipts = json.decode(response.body);
          isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching receipts: $e');
      setState(() => isLoading = false);
    }
  }

  Future<void> _viewReceipt(int salesId) async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse('${AppConfig.salesApiUrl}/$salesId'));
      setState(() => isLoading = false);
      
      if (response.statusCode != 200) throw Exception('Invoice not found');
      
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
                Text('Invoice Receipt Details', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
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
                    Text('POS SYSTEM RECEIPT', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1.0, color: isDark ? Colors.white : const Color(0xFF0F172A))),
                    Text('123 Enterprise St, POS City', style: GoogleFonts.inter(fontSize: 11, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B))),
                    const Divider(height: 24, thickness: 1),
                    
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Bill No: ${invoice['sales_bill_no'] ?? 'N/A'}', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF1E293B))),
                        Text('Date: ${invoice['sales_date'] ?? 'N/A'}', style: GoogleFonts.inter(fontSize: 12, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B))),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Text('Customer: ${invoice['customer_name'] ?? 'Walk-in'}', style: GoogleFonts.inter(fontSize: 12, color: isDark ? Colors.white70 : const Color(0xFF334155))),
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

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;
    final isMobile = MediaQuery.of(context).size.width < 750;

    return Scaffold(
      body: isLoading
          ? Center(child: CircularProgressIndicator(color: primaryColor))
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title / Actions Header Bar
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF151D30) : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
                      boxShadow: const [
                        BoxShadow(color: Colors.black12, blurRadius: 6, offset: Offset(0, 2)),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Invoices & Receipts',
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : const Color(0xFF0F172A),
                          ),
                        ),
                        IconButton(
                          icon: Icon(Icons.refresh_rounded, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569)),
                          tooltip: 'Refresh Receipts',
                          onPressed: fetchReceipts,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Responsive Table or Card Grid
                  Expanded(
                    child: receipts.isEmpty
                        ? Center(
                            child: Text(
                              'No receipts found.',
                              style: GoogleFonts.inter(fontSize: 15, color: const Color(0xFF94A3B8)),
                            ),
                          )
                        : isMobile
                            ? _buildMobileCardList(isDark)
                            : _buildDesktopDataTable(isDark),
                  ),
                ],
              ),
            ),
    );
  }

  // Mobile layout: ListView of Cards
  Widget _buildMobileCardList(bool isDark) {
    return ListView.builder(
      itemCount: receipts.length,
      itemBuilder: (ctx, idx) {
        final r = receipts[idx];
        final gross = double.tryParse(r['gross']?.toString() ?? '0.0') ?? 0.0;
        final tax = double.tryParse(r['tax']?.toString() ?? '0.0') ?? 0.0;
        final net = double.tryParse(r['total']?.toString() ?? '0.0') ?? 0.0;

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Bill No: ${r['sales_bill_no'] ?? 'N/A'}',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: isDark ? Colors.white : const Color(0xFF0F172A),
                      ),
                    ),
                    Text(
                      r['sales_date'] ?? '',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  'Customer: ${r['customer_name'] ?? 'N/A'}',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w500,
                    fontSize: 13,
                    color: isDark ? Colors.white70 : const Color(0xFF334155),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Gross: ₹${gross.toStringAsFixed(2)}  |  Tax: ₹${tax.toStringAsFixed(2)}',
                          style: GoogleFonts.inter(fontSize: 11.5, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Total: ₹${net.toStringAsFixed(2)}',
                          style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: const Color(0xFF6366F1)),
                        ),
                      ],
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF6366F1).withValues(alpha: 0.12),
                        foregroundColor: const Color(0xFF6366F1),
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      ),
                      onPressed: () => _viewReceipt(r['sales_id']),
                      child: Text('View', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ],
                )
              ],
            ),
          ),
        );
      },
    );
  }

  // Desktop layout: Styled DataTable
  Widget _buildDesktopDataTable(bool isDark) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: SingleChildScrollView(
          child: DataTable(
            headingRowColor: WidgetStateProperty.all(
              isDark ? const Color(0xFF1F2937) : const Color(0xFFF8FAFC),
            ),
            headingTextStyle: GoogleFonts.inter(
              fontWeight: FontWeight.bold,
              color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569),
              fontSize: 13,
            ),
            dataTextStyle: GoogleFonts.inter(
              color: isDark ? Colors.white : const Color(0xFF1E293B),
              fontSize: 13.5,
            ),
            dividerThickness: 1,
            columns: [
              DataColumn(label: Text('Bill No', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
              DataColumn(label: Text('Customer', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
              DataColumn(label: Text('Sales Date', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
              DataColumn(label: Text('Gross', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
              DataColumn(label: Text('Tax', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
              DataColumn(label: Text('Net Total', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
              DataColumn(label: Text('Actions', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
            ],
            rows: receipts.map<DataRow>((r) {
              final gross = double.tryParse(r['gross']?.toString() ?? '0.0') ?? 0.0;
              final tax = double.tryParse(r['tax']?.toString() ?? '0.0') ?? 0.0;
              final net = double.tryParse(r['total']?.toString() ?? '0.0') ?? 0.0;

              return DataRow(cells: [
                DataCell(
                  Text(
                    r['sales_bill_no'] ?? 'N/A',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                DataCell(Text(r['customer_name'] ?? 'N/A')),
                DataCell(Text(r['sales_date'] ?? 'N/A')),
                DataCell(Text('₹${gross.toStringAsFixed(2)}')),
                DataCell(Text('₹${tax.toStringAsFixed(2)}')),
                DataCell(Text('₹${net.toStringAsFixed(2)}', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: const Color(0xFF6366F1)))),
                DataCell(
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6366F1).withValues(alpha: 0.12),
                      foregroundColor: const Color(0xFF6366F1),
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () => _viewReceipt(r['sales_id']),
                    child: Text('View Bill', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ),
              ]);
            }).toList(),
          ),
        ),
      ),
    );
  }
}
