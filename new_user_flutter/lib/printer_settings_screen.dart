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

  final nameCtrl = TextEditingController();
  final ipCtrl = TextEditingController();
  final portCtrl = TextEditingController();
  final copiesCtrl = TextEditingController();

  String printerType = 'thermal';
  String paperSize = 'medium';
  String connectionType = 'usb';
  bool autoPrint = false;

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
    super.dispose();
  }

  Future<void> fetchSettings() async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/settings/printer'));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        setState(() {
          nameCtrl.text = data['printer_name'] ?? 'Default Printer';
          printerType = data['printer_type'] ?? 'thermal';
          paperSize = data['paper_size'] ?? 'medium';
          connectionType = data['connection'] ?? 'usb';
          ipCtrl.text = data['ip_address'] ?? '';
          portCtrl.text = (data['port'] ?? 9100).toString();
          autoPrint = data['auto_print'] == 1 || data['auto_print'] == true;
          copiesCtrl.text = (data['copies'] ?? 1).toString();
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
      'copies': int.tryParse(copiesCtrl.text.trim()) ?? 1
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
              content: Text('Printer settings saved successfully!', style: GoogleFonts.inter()),
              backgroundColor: const Color(0xFF10B981),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        // Save paper size locally in AppConfig for offline fast-checks
        AppConfig.setActiveUserClientId(AppConfig.activeUserClientId); // Refresh
        fetchSettings();
      } else {
        final err = json.decode(response.body);
        throw Exception(err['error'] ?? 'Server error occurred');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}', style: GoogleFonts.inter()),
            backgroundColor: const Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;

    return Scaffold(
      appBar: AppBar(
        title: Text('Thermal Printer Settings', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'POS Hardware Configuration',
                      style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold, color: primaryColor),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Configure paper size details, auto-printing, and interface connections.',
                      style: GoogleFonts.inter(fontSize: 13, color: Colors.grey),
                    ),
                    const SizedBox(height: 24),
                    Card(
                      elevation: 1,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: isDark ? Colors.transparent : const Color(0xFFE2E8F0)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          children: [
                            TextFormField(
                              controller: nameCtrl,
                              decoration: const InputDecoration(
                                labelText: 'Printer Name / Local Alias',
                                hintText: 'e.g. XP-80, Default Printer',
                                prefixIcon: Icon(Icons.print_outlined),
                              ),
                              validator: (v) => v == null || v.trim().isEmpty ? 'Printer name is required' : null,
                            ),
                            const SizedBox(height: 16),
                            DropdownButtonFormField<String>(
                              value: printerType,
                              decoration: const InputDecoration(
                                labelText: 'Printer Hardware Type',
                                prefixIcon: Icon(Icons.settings_input_hdmi_outlined),
                              ),
                              items: const [
                                DropdownMenuItem(value: 'thermal', child: Text('POS Thermal Receipt Printer')),
                                DropdownMenuItem(value: 'laser', child: Text('Laser / Inkjet Office Printer')),
                              ],
                              onChanged: (val) => setState(() => printerType = val!),
                            ),
                            const SizedBox(height: 16),
                            DropdownButtonFormField<String>(
                              value: paperSize,
                              decoration: const InputDecoration(
                                labelText: 'Paper Size / Dimensions',
                                prefixIcon: Icon(Icons.settings_overscan_outlined),
                              ),
                              items: const [
                                DropdownMenuItem(value: 'small', child: Text('Small (58mm Thermal Roll)')),
                                DropdownMenuItem(value: 'medium', child: Text('Medium (80mm Thermal Roll)')),
                                DropdownMenuItem(value: 'large', child: Text('Large (A4 Invoice Document)')),
                              ],
                              onChanged: (val) => setState(() => paperSize = val!),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Connection Interface',
                      style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 12),
                    Card(
                      elevation: 1,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: isDark ? Colors.transparent : const Color(0xFFE2E8F0)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          children: [
                            DropdownButtonFormField<String>(
                              value: connectionType,
                              decoration: const InputDecoration(
                                labelText: 'Connection Port',
                                prefixIcon: Icon(Icons.cable_outlined),
                              ),
                              items: const [
                                DropdownMenuItem(value: 'usb', child: Text('USB Interface (Local)')),
                                DropdownMenuItem(value: 'network', child: Text('LAN / Wi-Fi Network Interface')),
                                DropdownMenuItem(value: 'bluetooth', child: Text('Bluetooth Wireless Interface')),
                              ],
                              onChanged: (val) => setState(() => connectionType = val!),
                            ),
                            if (connectionType == 'network') ...[
                              const SizedBox(height: 16),
                              TextFormField(
                                controller: ipCtrl,
                                decoration: const InputDecoration(
                                  labelText: 'IP Address',
                                  hintText: 'e.g. 192.168.1.100',
                                  prefixIcon: Icon(Icons.lan_outlined),
                                ),
                                validator: (v) => connectionType == 'network' && (v == null || v.trim().isEmpty) ? 'Required for LAN' : null,
                              ),
                              const SizedBox(height: 16),
                              TextFormField(
                                controller: portCtrl,
                                decoration: const InputDecoration(
                                  labelText: 'Port',
                                  hintText: '9100',
                                  prefixIcon: Icon(Icons.numbers_outlined),
                                ),
                                keyboardType: TextInputType.number,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Preferences',
                      style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 12),
                    Card(
                      elevation: 1,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: isDark ? Colors.transparent : const Color(0xFFE2E8F0)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(8.0),
                        child: Column(
                          children: [
                            SwitchListTile(
                              title: const Text('Auto-Print on Bill Save'),
                              subtitle: const Text('Directly trigger print output without preview'),
                              value: autoPrint,
                              onChanged: (val) => setState(() => autoPrint = val),
                            ),
                            const Divider(),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                              child: TextFormField(
                                controller: copiesCtrl,
                                decoration: const InputDecoration(
                                  labelText: 'Number of copies',
                                  prefixIcon: Icon(Icons.copy_all_outlined),
                                ),
                                keyboardType: TextInputType.number,
                                validator: (v) {
                                  if (v == null || v.isEmpty) return 'Required';
                                  final num = int.tryParse(v);
                                  if (num == null || num < 1 || num > 5) return 'Enter a number between 1 and 5';
                                  return null;
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryColor,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: saveSettings,
                        child: Text(
                          'Save Settings',
                          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
