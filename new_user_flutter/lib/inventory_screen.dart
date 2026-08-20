import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'api_client.dart';
import 'config.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  List<dynamic> inventoryList = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    fetchInventory();
  }

  Future<void> fetchInventory() async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/inventory'));
      if (response.statusCode == 200) {
        setState(() {
          inventoryList = json.decode(response.body);
          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching inventory: $e');
      setState(() => isLoading = false);
    }
  }

  Future<void> saveInventoryItem({
    int? id,
    required String itemName,
    String? sku,
    String? barcode,
    required String unit,
    required double minStock,
    String? batchNo,
    String? expiry,
  }) async {
    try {
      final data = {
        'item_name': itemName,
        'sku': sku,
        'barcode': barcode,
        'unit': unit,
        'min_stock': minStock,
        'batch_no': batchNo,
        'expiry_date': expiry,
      };

      final response = id == null
          ? await ApiClient.post(Uri.parse('${AppConfig.baseUrl}/api/inventory'), body: json.encode(data))
          : await ApiClient.put(Uri.parse('${AppConfig.baseUrl}/api/inventory/$id'), body: json.encode(data));

      if (response.statusCode == 200 || response.statusCode == 201) {
        fetchInventory();
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Inventory item saved!')));
      }
    } catch (e) {
      debugPrint('Error saving inventory item: $e');
    }
  }

  Future<void> postStockMovement(int invId, String type, double qty, String ref, String notes) async {
    try {
      final data = {
        'inventory_id': invId,
        'type': type,
        'quantity': qty,
        'reference': ref,
        'notes': notes,
      };

      final response = await ApiClient.post(Uri.parse('${AppConfig.baseUrl}/api/inventory/movement'), body: json.encode(data));
      if (response.statusCode == 200) {
        fetchInventory();
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Stock movement transaction posted!')));
      }
    } catch (e) {
      debugPrint('Error posting stock: $e');
    }
  }

  void showItemForm({dynamic item}) {
    final nameController = TextEditingController(text: item?['item_name'] ?? '');
    final skuController = TextEditingController(text: item?['sku'] ?? '');
    final barcodeController = TextEditingController(text: item?['barcode'] ?? '');
    final unitController = TextEditingController(text: item?['unit'] ?? 'pcs');
    final minStockController = TextEditingController(text: item != null ? item['min_stock'].toString() : '5');
    final batchController = TextEditingController(text: item?['batch_no'] ?? '');
    final expiryController = TextEditingController(text: item?['expiry_date'] != null ? item['expiry_date'].toString().substring(0, 10) : '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(item == null ? 'Register Inventory Item' : 'Edit Inventory Details', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Item Name *'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: skuController,
                decoration: const InputDecoration(labelText: 'SKU Code'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: barcodeController,
                decoration: const InputDecoration(labelText: 'Barcode'),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: unitController,
                      decoration: const InputDecoration(labelText: 'Unit (e.g. kg, pcs)'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: minStockController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Min Stock Level'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: batchController,
                decoration: const InputDecoration(labelText: 'Batch Number'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: expiryController,
                decoration: const InputDecoration(labelText: 'Expiry Date (YYYY-MM-DD)', hintText: 'e.g. 2026-12-31'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              if (nameController.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              saveInventoryItem(
                id: item?['inventory_id'],
                itemName: nameController.text.trim(),
                sku: skuController.text.trim().isNotEmpty ? skuController.text.trim() : null,
                barcode: barcodeController.text.trim().isNotEmpty ? barcodeController.text.trim() : null,
                unit: unitController.text.trim(),
                minStock: double.tryParse(minStockController.text) ?? 5.0,
                batchNo: batchController.text.trim().isNotEmpty ? batchController.text.trim() : null,
                expiry: expiryController.text.trim().isNotEmpty ? expiryController.text.trim() : null,
              );
            },
            child: const Text('Save'),
          )
        ],
      ),
    );
  }

  void showMovementForm() {
    if (inventoryList.isEmpty) return;
    int selectedInvId = inventoryList[0]['inventory_id'];
    String movementType = 'IN';
    final qtyController = TextEditingController();
    final refController = TextEditingController();
    final notesController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setStateDialog) => AlertDialog(
          title: Text('Post Stock Movement', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<int>(
                  value: selectedInvId,
                  decoration: const InputDecoration(labelText: 'Select Stock Item *'),
                  items: inventoryList.map<DropdownMenuItem<int>>((i) {
                    return DropdownMenuItem<int>(
                      value: i['inventory_id'],
                      child: Text('${i['item_name']} (${(double.tryParse(i['current_stock']?.toString() ?? '0') ?? 0.0).toStringAsFixed(1)})'),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setStateDialog(() => selectedInvId = val);
                    }
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: movementType,
                  decoration: const InputDecoration(labelText: 'Movement Type *'),
                  items: const [
                    DropdownMenuItem(value: 'IN', child: Text('Stock IN (+)')),
                    DropdownMenuItem(value: 'OUT', child: Text('Stock OUT (-)')),
                    DropdownMenuItem(value: 'ADJUST', child: Text('Manual Reconcile / Adjust')),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setStateDialog(() => movementType = val);
                    }
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: qtyController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Quantity / Balance *'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: refController,
                  decoration: const InputDecoration(labelText: 'Reference Code', hintText: 'e.g. ADJ-001'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: notesController,
                  decoration: const InputDecoration(labelText: 'Adjustment Reason'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () {
                if (qtyController.text.trim().isEmpty) return;
                Navigator.pop(ctx);
                postStockMovement(
                  selectedInvId,
                  movementType,
                  double.tryParse(qtyController.text) ?? 0.0,
                  refController.text.trim(),
                  notesController.text.trim(),
                );
              },
              child: const Text('Post'),
            )
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            ElevatedButton.icon(
              icon: const Icon(Icons.add_box, size: 16),
              label: const Text('New Item'),
              onPressed: () => showItemForm(),
            ),
            ElevatedButton.icon(
              icon: const Icon(Icons.published_with_changes, size: 16),
              label: const Text('Post Movement'),
              onPressed: showMovementForm,
            ),
          ],
        ),
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : inventoryList.isEmpty
              ? Center(child: Text('No stock recorded yet', style: GoogleFonts.inter(color: Colors.grey)))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: inventoryList.length,
                  itemBuilder: (ctx, idx) {
                    final i = inventoryList[idx];
                    final current = double.tryParse(i['current_stock']?.toString() ?? '0') ?? 0.0;
                    final minS = double.tryParse(i['min_stock']?.toString() ?? '0') ?? 0.0;
                    final isLow = current <= minS;

                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: BorderSide(
                          color: isLow ? Colors.red.shade300 : Colors.grey.shade200,
                          width: isLow ? 1.5 : 1,
                        ),
                      ),
                      color: isLow ? Colors.red.shade50.withValues(alpha: 0.2) : null,
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: isLow ? Colors.red.shade50 : Colors.indigo.shade50,
                          child: Icon(Icons.inventory_2, color: isLow ? Colors.red : Colors.indigo.shade400, size: 20),
                        ),
                        title: Text(
                          i['item_name'],
                          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        subtitle: Text(
                          'SKU: ${i['sku'] ?? "N/A"} • Batch: ${i['batch_no'] ?? "N/A"}\nExpiry: ${i['expiry_date'] != null ? i['expiry_date'].toString().substring(0, 10) : "N/A"}',
                          style: GoogleFonts.inter(fontSize: 11),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '${current.toStringAsFixed(1)} ${i['unit']}',
                                  style: GoogleFonts.inter(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: isLow ? Colors.red : Colors.black87,
                                  ),
                                ),
                                Text(
                                  'Min: ${minS.toStringAsFixed(0)}',
                                  style: GoogleFonts.inter(fontSize: 10, color: Colors.grey),
                                )
                              ],
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              icon: const Icon(Icons.edit, color: Colors.blue, size: 18),
                              onPressed: () => showItemForm(item: i),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
