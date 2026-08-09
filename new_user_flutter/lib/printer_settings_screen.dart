import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'api_client.dart';
import 'config.dart';

class PrinterSettingsScreen extends StatefulWidget {
  const PrinterSettingsScreen({super.key});

  @override
  State<PrinterSettingsScreen> createState() => _PrinterSettingsScreenState();
}

class _PrinterSettingsScreenState extends State<PrinterSettingsScreen> {
  final _formKey = GlobalKey<FormState>();

  bool isLoading = true;

  final nameCtrl = TextEditingController(text: 'Thermal POS Printer');
  final ipCtrl = TextEditingController(text: '192.168.1.100');
  final portCtrl = TextEditingController(text: '9100');
  final copiesCtrl = TextEditingController(text: '1');

  // Receipt Customization Controllers
  final storeNameCtrl = TextEditingController(text: 'Vanshee Enterprise Store');
  final addressCtrl = TextEditingController(text: '101 Commercial Hub, Station Road, Ahmedabad');
  final phoneCtrl = TextEditingController(text: '+91 98765 43210');
  final gstinCtrl = TextEditingController(text: '24AAAAA0000A1Z5');
  final upiIdCtrl = TextEditingController(text: 'vanshee@upi');
  final footerNoteCtrl = TextEditingController(text: 'Thank you for shopping with us! Returns accepted within 7 days.');

  String printerType = 'thermal';
  String paperSize = '80mm'; // 58mm, 80mm, A4, A5
  String connectionType = 'usb'; // usb, bluetooth, network
  bool autoPrint = true;
  bool showUpiQr = true;
  bool showGstin = true;

  @override
  void initState() {
    super.initState();
    fetchSettings();
  }

  @override
  void dispose() {
    nameCtrl.dispose();
    ipCtrl.dispose();
    portCtrl.dispose();
    copiesCtrl.dispose();
    storeNameCtrl.dispose();
    addressCtrl.dispose();
    phoneCtrl.dispose();
    gstinCtrl.dispose();
    upiIdCtrl.dispose();
    footerNoteCtrl.dispose();
    super.dispose();
  }

  Future<void> fetchSettings() async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/settings/printer'));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        setState(() {
          nameCtrl.text = data['printer_name'] ?? 'Thermal POS Printer';
          printerType = data['printer_type'] ?? 'thermal';
          paperSize = data['paper_size'] ?? '80mm';
          connectionType = data['connection'] ?? 'usb';
          ipCtrl.text = data['ip_address'] ?? '192.168.1.100';
          portCtrl.text = (data['port'] ?? 9100).toString();
          autoPrint = data['auto_print'] == 1 || data['auto_print'] == true;
          copiesCtrl.text = (data['copies'] ?? 1).toString();
          
          if (data['store_name'] != null) storeNameCtrl.text = data['store_name'];
          if (data['address'] != null) addressCtrl.text = data['address'];
          if (data['phone'] != null) phoneCtrl.text = data['phone'];
          if (data['gstin'] != null) gstinCtrl.text = data['gstin'];
          if (data['upi_id'] != null) upiIdCtrl.text = data['upi_id'];
          if (data['footer_note'] != null) footerNoteCtrl.text = data['footer_note'];

          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching printer settings: $e');
      setState(() => isLoading = false);
    }
  }

  Future<void> saveSettings() async {
    if (!_formKey.currentState!.validate()) return;

    final data = {
      'printer_name': nameCtrl.text.trim(),
      'printer_type': printerType,
      'paper_size': paperSize,
      'connection': connectionType,
      'ip_address': ipCtrl.text.trim().isNotEmpty ? ipCtrl.text.trim() : null,
      'port': int.tryParse(portCtrl.text.trim()) ?? 9100,
      'auto_print': autoPrint ? 1 : 0,
      'copies': int.tryParse(copiesCtrl.text.trim()) ?? 1,
      'store_name': storeNameCtrl.text.trim(),
      'address': addressCtrl.text.trim(),
      'phone': phoneCtrl.text.trim(),
      'gstin': gstinCtrl.text.trim(),
      'upi_id': upiIdCtrl.text.trim(),
      'footer_note': footerNoteCtrl.text.trim(),
      'show_upi_qr': showUpiQr ? 1 : 0,
      'show_gstin': showGstin ? 1 : 0,
    };

    try {
      setState(() => isLoading = true);
      final response = await ApiClient.put(
        Uri.parse('${AppConfig.baseUrl}/api/settings/printer'),
        body: json.encode(data),
      );

      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Printer & Thermal Receipt Customization saved successfully!', style: GoogleFonts.inter()),
              backgroundColor: const Color(0xFF10B981),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (e) {
      debugPrint('Error saving printer settings: $e');
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;
    final isDesktop = MediaQuery.of(context).size.width > 900;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0B0F19) : const Color(0xFFF8FAFC),
      body: isLoading
          ? Center(child: CircularProgressIndicator(color: primaryColor))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Form Left Column
                  Expanded(
                    flex: isDesktop ? 2 : 1,
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Thermal Printer & Receipt Customizer',
                            style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                          ),
                          Text(
                            'Configure thermal printer hardware, paper sizes, GST details, UPI QR codes, and receipt layouts.',
                            style: GoogleFonts.inter(fontSize: 13, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                          ),
                          const SizedBox(height: 24),

                          // Hardware & Paper Size Config
                          _buildCardSection(
                            isDark: isDark,
                            title: 'Printer Hardware & Paper Template',
                            icon: Icons.print_rounded,
                            primaryColor: primaryColor,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: DropdownButtonFormField<String>(
                                      value: paperSize,
                                      decoration: _inputDeco(isDark, 'Paper Template / Size', Icons.aspect_ratio_rounded, primaryColor),
                                      dropdownColor: isDark ? const Color(0xFF151D30) : Colors.white,
                                      items: const [
                                        DropdownMenuItem(value: '58mm', child: Text('58mm Thermal (2 Inch)')),
                                        DropdownMenuItem(value: '80mm', child: Text('80mm Thermal (3 Inch - Standard)')),
                                        DropdownMenuItem(value: 'A4', child: Text('A4 Full Page Tax Invoice')),
                                        DropdownMenuItem(value: 'A5', child: Text('A5 Half Page Tax Invoice')),
                                      ],
                                      onChanged: (v) => setState(() => paperSize = v!),
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: DropdownButtonFormField<String>(
                                      value: connectionType,
                                      decoration: _inputDeco(isDark, 'Connection Mode', Icons.cable_rounded, primaryColor),
                                      dropdownColor: isDark ? const Color(0xFF151D30) : Colors.white,
                                      items: const [
                                        DropdownMenuItem(value: 'usb', child: Text('USB Direct Cable')),
                                        DropdownMenuItem(value: 'bluetooth', child: Text('Bluetooth Wireless')),
                                        DropdownMenuItem(value: 'network', child: Text('LAN / Network IP')),
                                      ],
                                      onChanged: (v) => setState(() => connectionType = v!),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  Expanded(
                                    child: TextFormField(
                                      controller: nameCtrl,
                                      decoration: _inputDeco(isDark, 'Printer Device Name', Icons.devices_other_rounded, primaryColor),
                                      validator: (v) => v!.isEmpty ? 'Name required' : null,
                                    ),
                                  ),
                                  if (connectionType == 'network') ...[
                                    const SizedBox(width: 16),
                                    Expanded(
                                      child: TextFormField(
                                        controller: ipCtrl,
                                        decoration: _inputDeco(isDark, 'Printer IP Address', Icons.lan_rounded, primaryColor),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  SwitchListTile(
                                    value: autoPrint,
                                    activeColor: primaryColor,
                                    title: Text('Auto-Print on Bill Checkout', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                                    onChanged: (v) => setState(() => autoPrint = v),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),

                          // Receipt Store Branding & Header Customizer
                          _buildCardSection(
                            isDark: isDark,
                            title: 'Store Branding & Tax Information',
                            icon: Icons.storefront_rounded,
                            primaryColor: primaryColor,
                            children: [
                              TextFormField(
                                controller: storeNameCtrl,
                                decoration: _inputDeco(isDark, 'Header Store Name', Icons.business_rounded, primaryColor),
                              ),
                              const SizedBox(height: 14),
                              TextFormField(
                                controller: addressCtrl,
                                decoration: _inputDeco(isDark, 'Store Address', Icons.location_on_rounded, primaryColor),
                              ),
                              const SizedBox(height: 14),
                              Row(
                                children: [
                                  Expanded(
                                    child: TextFormField(
                                      controller: phoneCtrl,
                                      decoration: _inputDeco(isDark, 'Phone Number', Icons.phone_rounded, primaryColor),
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: TextFormField(
                                      controller: gstinCtrl,
                                      decoration: _inputDeco(isDark, 'GSTIN / Tax No', Icons.receipt_rounded, primaryColor),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 14),
                              Row(
                                children: [
                                  Expanded(
                                    child: TextFormField(
                                      controller: upiIdCtrl,
                                      decoration: _inputDeco(isDark, 'Store UPI ID for Instant Payment QR', Icons.qr_code_2_rounded, primaryColor),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 14),
                              TextFormField(
                                controller: footerNoteCtrl,
                                maxLines: 2,
                                decoration: _inputDeco(isDark, 'Footer Terms & Thank You Message', Icons.edit_note_rounded, primaryColor),
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),

                          // Save Button
                          SizedBox(
                            width: double.infinity,
                            height: 48,
                            child: ElevatedButton.icon(
                              onPressed: saveSettings,
                              icon: const Icon(Icons.save_rounded, color: Colors.white),
                              label: Text('Save Printer & Receipt Settings', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: primaryColor,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Receipt Live Preview Card (Right Column on Desktop)
                  if (isDesktop) ...[
                    const SizedBox(width: 24),
                    Expanded(
                      flex: 1,
                      child: _buildReceiptPreviewCard(isDark, primaryColor),
                    ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildCardSection({required bool isDark, required String title, required IconData icon, required Color primaryColor, required List<Widget> children}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: primaryColor),
              const SizedBox(width: 10),
              Text(title, style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A))),
            ],
          ),
          const Divider(height: 24),
          ...children,
        ],
      ),
    );
  }

  InputDecoration _inputDeco(bool isDark, String label, IconData icon, Color primaryColor) {
    return InputDecoration(
      labelText: label,
      labelStyle: GoogleFonts.inter(fontSize: 12.5, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
      prefixIcon: Icon(icon, size: 18, color: primaryColor),
      filled: true,
      fillColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: primaryColor, width: 1.5)),
    );
  }

  Widget _buildReceiptPreviewCard(bool isDark, Color primaryColor) {
    final double width = paperSize == '58mm' ? 220 : 290;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.remove_red_eye_rounded, size: 18, color: primaryColor),
              const SizedBox(width: 8),
              Text('Live Receipt Preview ($paperSize)', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A))),
            ],
          ),
          const SizedBox(height: 16),

          // Simulated Paper Sheet
          Container(
            width: width,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 10, offset: Offset(0, 4))],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(storeNameCtrl.text, style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.black), textAlign: TextAlign.center),
                Text(addressCtrl.text, style: GoogleFonts.inter(fontSize: 10, color: Colors.black87), textAlign: TextAlign.center),
                Text('Phone: ${phoneCtrl.text}', style: GoogleFonts.inter(fontSize: 10, color: Colors.black87)),
                if (gstinCtrl.text.isNotEmpty) Text('GSTIN: ${gstinCtrl.text}', style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.black87)),
                const Text('------------------------------------', style: TextStyle(color: Colors.black54, fontSize: 10)),

                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Bill: #INV-1024', style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.black)),
                    Text('24/05/2025', style: GoogleFonts.inter(fontSize: 10, color: Colors.black87)),
                  ],
                ),
                const Text('------------------------------------', style: TextStyle(color: Colors.black54, fontSize: 10)),

                _previewItemRow('Amul Taaza 500ml', '2 x ₹30', '₹60.00'),
                _previewItemRow('Pepsi 500ml', '1 x ₹40', '₹40.00'),
                _previewItemRow('Parle-G Biscuit', '4 x ₹10', '₹40.00'),
                const Text('------------------------------------', style: TextStyle(color: Colors.black54, fontSize: 10)),

                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('CGST (9%)', style: GoogleFonts.inter(fontSize: 10, color: Colors.black87)),
                    Text('₹ 6.30', style: GoogleFonts.inter(fontSize: 10, color: Colors.black87)),
                  ],
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('SGST (9%)', style: GoogleFonts.inter(fontSize: 10, color: Colors.black87)),
                    Text('₹ 6.30', style: GoogleFonts.inter(fontSize: 10, color: Colors.black87)),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('NET TOTAL:', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.black)),
                    Text('₹ 152.60', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.black)),
                  ],
                ),
                const Text('------------------------------------', style: TextStyle(color: Colors.black54, fontSize: 10)),

                // UPI QR Box
                if (upiIdCtrl.text.isNotEmpty) ...[
                  const Icon(Icons.qr_code_2_rounded, size: 70, color: Colors.black),
                  Text('Scan to Pay via UPI', style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.black)),
                  Text(upiIdCtrl.text, style: GoogleFonts.inter(fontSize: 8, color: Colors.black54)),
                  const SizedBox(height: 6),
                ],

                Text(footerNoteCtrl.text, style: GoogleFonts.inter(fontSize: 9, fontStyle: FontStyle.italic, color: Colors.black87), textAlign: TextAlign.center),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _previewItemRow(String name, String qty, String price) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(child: Text(name, style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.black), maxLines: 1, overflow: TextOverflow.ellipsis)),
          Text(qty, style: GoogleFonts.inter(fontSize: 9, color: Colors.black87)),
          const SizedBox(width: 8),
          Text(price, style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.black)),
        ],
      ),
    );
  }
}
