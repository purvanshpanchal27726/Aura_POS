import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';

class PdfReceiptService {
  static pw.Widget _buildReceipt(pw.Context context, Map<String, dynamic> invoice) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.stretch,
      children: [
        pw.Center(
          child: pw.Text('AURA POS', style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold)),
        ),
        pw.SizedBox(height: 10),
        pw.Text('Bill No: ${invoice['sales_bill_no'] ?? ''}'),
        pw.Text('Date: ${invoice['sales_date'] ?? ''}'),
        pw.Text('Customer: ${invoice['customer_name'] ?? 'Walk-in'}'),
        pw.Divider(),
        ...((invoice['items'] as List<dynamic>? ?? []).map((item) {
          return pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Expanded(child: pw.Text('${item['item_name'] ?? item['name'] ?? ''} x${item['quantity']}')),
              pw.Text('Rs. ${item['item_amount'] ?? item['amount'] ?? '0.00'}'),
            ],
          );
        }).toList()),
        pw.Divider(),
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text('Gross:', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
            pw.Text('Rs. ${invoice['gross'] ?? '0.00'}', style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
          ],
        ),
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text('Tax:'),
            pw.Text('Rs. ${invoice['tax'] ?? '0.00'}'),
          ],
        ),
        pw.Divider(),
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text('NET TOTAL:', style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
            pw.Text('Rs. ${invoice['total'] ?? '0.00'}', style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
          ],
        ),
        pw.SizedBox(height: 20),
        pw.Center(
          child: pw.Text('Thank you for shopping with us!', textAlign: pw.TextAlign.center),
        ),
      ],
    );
  }

  static Future<void> printReceipt(Map<String, dynamic> invoice) async {
    try {
      if (kIsWeb && (defaultTargetPlatform == TargetPlatform.iOS || defaultTargetPlatform == TargetPlatform.android)) {
        final doc = pw.Document();
        doc.addPage(
          pw.Page(
            pageFormat: PdfPageFormat.a4,
            build: (context) => _buildReceipt(context, invoice),
          ),
        );
        await Printing.sharePdf(
          bytes: await doc.save(),
          filename: 'Receipt_${invoice['sales_bill_no']}.pdf',
        );
      } else {
        await Printing.layoutPdf(
          name: 'Receipt_${invoice['sales_bill_no']}',
          onLayout: (PdfPageFormat format) async {
            final doc = pw.Document();
            doc.addPage(
              pw.Page(
                pageFormat: format,
                build: (context) => _buildReceipt(context, invoice),
              ),
            );
            return doc.save();
          },
        );
      }
    } catch (e) {
      debugPrint('Printing error: $e');
    }
  }
}
