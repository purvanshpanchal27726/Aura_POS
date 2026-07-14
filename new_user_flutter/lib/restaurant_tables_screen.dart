import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'api_client.dart';
import 'config.dart';

class RestaurantTablesScreen extends StatefulWidget {
  const RestaurantTablesScreen({super.key});

  @override
  State<RestaurantTablesScreen> createState() => _RestaurantTablesScreenState();
}

class _RestaurantTablesScreenState extends State<RestaurantTablesScreen> {
  List<dynamic> tables = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    fetchTables();
  }

  Future<void> fetchTables() async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/restaurant/tables'));
      if (response.statusCode == 200) {
        setState(() {
          tables = json.decode(response.body);
          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching tables: $e');
      setState(() => isLoading = false);
    }
  }

  Future<void> saveTable(int? id, String tableNo, String section, int capacity) async {
    final data = {
      'table_no': tableNo.trim(),
      'section': section,
      'capacity': capacity
    };

    try {
      setState(() => isLoading = true);
      final url = id != null
          ? '${AppConfig.baseUrl}/api/restaurant/tables/$id'
          : '${AppConfig.baseUrl}/api/restaurant/tables';
      
      final response = id != null
          ? await ApiClient.put(Uri.parse(url), body: json.encode(data))
          : await ApiClient.post(Uri.parse(url), body: json.encode(data));

      if (response.statusCode == 200 || response.statusCode == 201) {
        fetchTables();
      } else {
        final err = json.decode(response.body);
        throw Exception(err['error'] ?? 'Server error occurred');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
      setState(() => isLoading = false);
    }
  }

  Future<void> deleteTable(int id) async {
    if (!await showConfirmationDialog()) return;

    try {
      setState(() => isLoading = true);
      final response = await ApiClient.delete(Uri.parse('${AppConfig.baseUrl}/api/restaurant/tables/$id'));
      if (response.statusCode == 200) {
        fetchTables();
      } else {
        throw Exception('Failed to delete table');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
      setState(() => isLoading = false);
    }
  }

  Future<bool> showConfirmationDialog() async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Delete Table'),
            content: const Text('Are you sure you want to de-register this table?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                style: TextButton.styleFrom(foregroundColor: Colors.red),
                child: const Text('Delete'),
              ),
            ],
          ),
        ) ??
        false;
  }

  void openTableFormDialog([dynamic table]) {
    final formKey = GlobalKey<FormState>();
    final noCtrl = TextEditingController(text: table != null ? table['table_no'] : '');
    final capCtrl = TextEditingController(text: table != null ? table['capacity'].toString() : '4');
    String section = table != null ? table['section'] : 'Indoor';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(table != null ? 'Edit Table details' : 'Register New Table', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: noCtrl,
                    decoration: const InputDecoration(labelText: 'Table Number *', hintText: 'e.g. Table 1'),
                    validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: section,
                    decoration: const InputDecoration(labelText: 'Section Area'),
                    items: const [
                      DropdownMenuItem(value: 'Indoor', child: Text('Indoor Dining')),
                      DropdownMenuItem(value: 'Outdoor', child: Text('Outdoor Garden')),
                      DropdownMenuItem(value: 'Terrace', child: Text('Terrace Rooftop')),
                      DropdownMenuItem(value: 'Bar', child: Text('Bar Lounge')),
                    ],
                    onChanged: (val) => setDialogState(() => section = val!),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: capCtrl,
                    decoration: const InputDecoration(labelText: 'Capacity (Seats)'),
                    keyboardType: TextInputType.number,
                    validator: (v) => int.tryParse(v ?? '') == null ? 'Enter valid number' : null,
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () {
                if (formKey.currentState!.validate()) {
                  Navigator.pop(ctx);
                  saveTable(
                    table != null ? table['table_id'] : null,
                    noCtrl.text,
                    section,
                    int.parse(capCtrl.text),
                  );
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final primaryColor = Theme.of(context).primaryColor;

    return Scaffold(
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : tables.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.table_bar_outlined, size: 64, color: Colors.grey.shade400),
                      const SizedBox(height: 16),
                      Text('No tables created yet.', style: GoogleFonts.inter(fontSize: 16, color: Colors.grey)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () => openTableFormDialog(),
                        child: const Text('Add First Table'),
                      )
                    ],
                  ),
                )
              : Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: GridView.builder(
                    gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                      maxCrossAxisExtent: 220,
                      mainAxisSpacing: 16,
                      crossAxisSpacing: 16,
                      childAspectRatio: 0.85,
                    ),
                    itemCount: tables.length,
                    itemBuilder: (ctx, idx) {
                      final t = tables[idx];
                      Color statusColor = const Color(0xFF10B981); // Available
                      if (t['status'] == 'occupied') statusColor = const Color(0xFFEF4444);
                      if (t['status'] == 'reserved') statusColor = const Color(0xFF3B82F6);

                      return Card(
                        elevation: 1,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(color: statusColor.withValues(alpha: 0.8), width: 1.5),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(12.0),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.table_restaurant, size: 40, color: statusColor),
                              const SizedBox(height: 8),
                              Text(
                                t['table_no'],
                                style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold),
                              ),
                              Text(
                                '${t['section']} • Max ${t['capacity']}',
                                style: GoogleFonts.inter(fontSize: 12, color: Colors.grey),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: statusColor.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  t['status'].toString().toUpperCase(),
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: statusColor,
                                  ),
                                ),
                              ),
                              const Spacer(),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.edit_outlined, size: 20),
                                    onPressed: () => openTableFormDialog(t),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline, size: 20, color: Colors.red),
                                    onPressed: () => deleteTable(t['table_id']),
                                  ),
                                ],
                              )
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
      floatingActionButton: tables.isNotEmpty
          ? FloatingActionButton(
              onPressed: () => openTableFormDialog(),
              backgroundColor: primaryColor,
              foregroundColor: Colors.white,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}
