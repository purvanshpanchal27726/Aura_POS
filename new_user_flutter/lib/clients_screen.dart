import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'api_client.dart';
import 'config.dart';

class ClientsScreen extends StatefulWidget {
  final bool canModify;
  const ClientsScreen({super.key, this.canModify = false});

  @override
  State<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends State<ClientsScreen> {
  final _formKey = GlobalKey<FormState>();

  List<dynamic> clients = [];
  bool isLoading = true;

  int? editingClientId;
  final nameCtrl = TextEditingController();
  final phoneCtrl = TextEditingController();
  final emailCtrl = TextEditingController();
  final addressCtrl = TextEditingController();
  final gstCtrl = TextEditingController();
  final logoCtrl = TextEditingController();
  bool isActive = true;

  // Module selections
  bool subKirana = true;
  bool subRestaurant = false;
  bool subHotel = false;

  @override
  void initState() {
    super.initState();
    fetchClients();
  }

  @override
  void dispose() {
    nameCtrl.dispose();
    phoneCtrl.dispose();
    emailCtrl.dispose();
    addressCtrl.dispose();
    gstCtrl.dispose();
    logoCtrl.dispose();
    super.dispose();
  }

  Future<void> fetchClients() async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/clients'));
      if (response.statusCode == 200) {
        setState(() {
          clients = json.decode(response.body);
          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching clients: $e');
      setState(() => isLoading = false);
    }
  }

  Future<void> fetchClientModules(int clientId) async {
    try {
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/clients/$clientId/modules'));
      if (response.statusCode == 200) {
        final List<dynamic> modules = json.decode(response.body);
        final activeIds = modules.map((m) => int.tryParse(m['group_id']?.toString() ?? '')).toList();
        setState(() {
          subKirana = activeIds.contains(1);
          subRestaurant = activeIds.contains(2);
          subHotel = activeIds.contains(3);
        });
      }
    } catch (e) {
      debugPrint('Error fetching client modules: $e');
    }
  }

  Future<bool> saveClient() async {
    if (!_formKey.currentState!.validate()) return false;

    final clientData = {
      'name': nameCtrl.text.trim(),
      'email': emailCtrl.text.trim().isNotEmpty ? emailCtrl.text.trim() : null,
      'phone': phoneCtrl.text.trim().isNotEmpty ? phoneCtrl.text.trim() : null,
      'address': addressCtrl.text.trim().isNotEmpty ? addressCtrl.text.trim() : null,
      'gst_no': gstCtrl.text.trim().isNotEmpty ? gstCtrl.text.trim() : null,
      'logo_url': logoCtrl.text.trim().isNotEmpty ? logoCtrl.text.trim() : null,
      'active': isActive ? 1 : 0
    };

    try {
      setState(() => isLoading = true);
      dynamic response;

      if (editingClientId == null) {
        response = await ApiClient.post(
          Uri.parse('${AppConfig.baseUrl}/api/clients'),
          body: json.encode(clientData),
        );
      } else {
        response = await ApiClient.put(
          Uri.parse('${AppConfig.baseUrl}/api/clients/$editingClientId'),
          body: json.encode(clientData),
        );
      }

      if (response.statusCode == 200 || response.statusCode == 201) {
        final resData = json.decode(response.body);
        final targetClientId = editingClientId ?? resData['client_id'];

        // Save module subscription assignments
        final List<int> groupIds = [];
        if (subKirana) groupIds.add(1);
        if (subRestaurant) groupIds.add(2);
        if (subHotel) groupIds.add(3);

        final modulesResponse = await ApiClient.put(
          Uri.parse('${AppConfig.baseUrl}/api/clients/$targetClientId/modules'),
          body: json.encode({'groupIds': groupIds}),
        );

        if (modulesResponse.statusCode != 200) {
          throw Exception('Modules subscription save failed');
        }

        return true;
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
          ),
        );
      }
      setState(() => isLoading = false);
      return false;
    }
  }

  void _showFormModal({int? clientId}) async {
    if (clientId != null) {
      final c = clients.firstWhere((item) => item['client_id'] == clientId);
      editingClientId = clientId;
      nameCtrl.text = c['name'] ?? '';
      phoneCtrl.text = c['phone'] ?? '';
      emailCtrl.text = c['email'] ?? '';
      addressCtrl.text = c['address'] ?? '';
      gstCtrl.text = c['gst_no'] ?? '';
      logoCtrl.text = c['logo_url'] ?? '';
      isActive = c['active'] == 1 || c['active'] == true;
      await fetchClientModules(clientId);
    } else {
      editingClientId = null;
      nameCtrl.clear();
      phoneCtrl.clear();
      emailCtrl.clear();
      addressCtrl.clear();
      gstCtrl.clear();
      logoCtrl.clear();
      isActive = true;
      subKirana = true;
      subRestaurant = false;
      subHotel = false;
    }

    if (!mounted) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            return AlertDialog(
              title: Text(
                clientId == null ? 'Register New Client' : 'Edit Client Company',
                style: GoogleFonts.inter(fontWeight: FontWeight.bold),
              ),
              content: SingleChildScrollView(
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TextFormField(
                        controller: nameCtrl,
                        decoration: const InputDecoration(labelText: 'Company Name *'),
                        validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: gstCtrl,
                        decoration: const InputDecoration(labelText: 'GST Number'),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: phoneCtrl,
                        decoration: const InputDecoration(labelText: 'Phone Number'),
                        keyboardType: TextInputType.phone,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: emailCtrl,
                        decoration: const InputDecoration(labelText: 'Email Address'),
                        keyboardType: TextInputType.emailAddress,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: logoCtrl,
                        decoration: const InputDecoration(labelText: 'Logo URL'),
                        keyboardType: TextInputType.url,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: addressCtrl,
                        decoration: const InputDecoration(labelText: 'Office Address'),
                        maxLines: 2,
                      ),
                      const SizedBox(height: 16),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Module Subscriptions',
                          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                      ),
                      const SizedBox(height: 8),
                      CheckboxListTile(
                        title: const Text('Kirana (POS)'),
                        value: subKirana,
                        onChanged: (val) {
                          setDialogState(() => subKirana = val ?? false);
                          setState(() => subKirana = val ?? false);
                        },
                        controlAffinity: ListTileControlAffinity.leading,
                        dense: true,
                      ),
                      CheckboxListTile(
                        title: const Text('Restaurant'),
                        value: subRestaurant,
                        onChanged: (val) {
                          setDialogState(() => subRestaurant = val ?? false);
                          setState(() => subRestaurant = val ?? false);
                        },
                        controlAffinity: ListTileControlAffinity.leading,
                        dense: true,
                      ),
                      CheckboxListTile(
                        title: const Text('Hotel'),
                        value: subHotel,
                        onChanged: (val) {
                          setDialogState(() => subHotel = val ?? false);
                          setState(() => subHotel = val ?? false);
                        },
                        controlAffinity: ListTileControlAffinity.leading,
                        dense: true,
                      ),
                      const SizedBox(height: 12),
                      SwitchListTile(
                        title: const Text('Active Status'),
                        value: isActive,
                        onChanged: (val) {
                          setDialogState(() => isActive = val);
                          setState(() => isActive = val);
                        },
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogCtx),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final NavigatorState nav = Navigator.of(dialogCtx);
                    final ok = await saveClient();
                    if (ok) {
                      nav.pop();
                      fetchClients();
                    }
                  },
                  child: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;

    return Scaffold(
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: fetchClients,
              child: clients.isEmpty
                  ? Center(
                      child: Text(
                        'No clients registered yet.',
                        style: GoogleFonts.inter(color: Colors.grey),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: clients.length,
                      itemBuilder: (context, index) {
                        final c = clients[index];
                        final active = c['active'] == 1 || c['active'] == true;

                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          elevation: 1,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(color: isDark ? Colors.transparent : const Color(0xFFE2E8F0)),
                          ),
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: primaryColor.withValues(alpha: 0.1),
                              child: Text(
                                (c['name'] ?? 'C')[0].toUpperCase(),
                                style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold),
                              ),
                            ),
                            title: Text(
                              c['name'] ?? '',
                              style: GoogleFonts.inter(fontWeight: FontWeight.bold),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 4),
                                if (c['gst_no'] != null && c['gst_no'].toString().isNotEmpty)
                                  Text('GSTIN: ${c['gst_no']}', style: const TextStyle(fontSize: 12)),
                                Text('Phone: ${c['phone'] ?? 'N/A'} | Email: ${c['email'] ?? 'N/A'}', style: const TextStyle(fontSize: 12)),
                              ],
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: active ? Colors.green.withValues(alpha: 0.1) : Colors.red.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    active ? 'Active' : 'Inactive',
                                    style: TextStyle(color: active ? Colors.green : Colors.red, fontSize: 10, fontWeight: FontWeight.bold),
                                  ),
                                ),
                                if (widget.canModify) ...[
                                  const SizedBox(width: 8),
                                  IconButton(
                                    icon: const Icon(Icons.edit, color: Colors.blue, size: 20),
                                    onPressed: () => _showFormModal(clientId: c['client_id']),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
      floatingActionButton: widget.canModify
          ? FloatingActionButton(
              onPressed: () => _showFormModal(),
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}
