import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'api_client.dart';
import 'config.dart';

class PurchaseOrdersScreen extends StatefulWidget {
  const PurchaseOrdersScreen({super.key});

  @override
  State<PurchaseOrdersScreen> createState() => _PurchaseOrdersScreenState();
}

class _PurchaseOrdersScreenState extends State<PurchaseOrdersScreen> {
  List<dynamic> purchaseOrders = [];
  List<dynamic> vendors = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    fetchPurchaseOrders();
  }

  Future<void> fetchPurchaseOrders() async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/purchase-orders'));
      if (response.statusCode == 200) {
        setState(() {
          purchaseOrders = json.decode(response.body);
          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching POs: $e');
      setState(() => isLoading = false);
    }
  }

  Future<void> updatePoStatus(int poId, String status) async {
    try {
      final response = await ApiClient.put(
        Uri.parse('${AppConfig.baseUrl}/api/purchase-orders/$poId/status'),
        body: json.encode({'status': status}),
      );
      if (response.statusCode == 200) {
        fetchPurchaseOrders();
      }
    } catch (e) {
      debugPrint('Error updating PO: $e');
    }
  }

  Future<void> createPO({required int vendorId, required List<dynamic> items, required double total}) async {
    try {
      final data = {
        'vendor_id': vendorId,
        'items': items,
        'total': total,
      };

      final response = await ApiClient.post(Uri.parse('${AppConfig.baseUrl}/api/purchase-orders'), body: json.encode(data));
      if (response.statusCode == 201 || response.statusCode == 200) {
        fetchPurchaseOrders();
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Purchase Order created!')));
      }
    } catch (e) {
      debugPrint('Error creating PO: $e');
    }
  }

  Future<void> showPoForm() async {
    try {
      final res = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/vendors'));
      if (res.statusCode == 200) {
        setState(() {
          vendors = json.decode(res.body);
        });
      }
    } catch (e) {
      debugPrint('Error loading vendors: $e');
    }

    if (vendors.isEmpty) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please register a vendor first!')));
      return;
    }

    int? selectedVendor = vendors[0]['vendor_id'];
    List<dynamic> poItemsCart = [];
    final itemNameController = TextEditingController();
    final qtyController = TextEditingController(text: '1');
    final priceController = TextEditingController();

    if (mounted) {
      showDialog(
        context: context,
        builder: (ctx) => StatefulBuilder(
          builder: (context, setStateDialog) {
            double grand = poItemsCart.fold(0.0, (sum, item) => sum + (item['quantity'] * item['price']));

            return AlertDialog(
              title: Text('Create Purchase Order', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16)),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<int>(
                      value: selectedVendor,
                      decoration: const InputDecoration(labelText: 'Select Vendor *'),
                      items: vendors.map<DropdownMenuItem<int>>((v) {
                        return DropdownMenuItem<int>(
                          value: v['vendor_id'],
                          child: Text(v['company'] ?? '${v['first_name']} ${v['last_name']}'),
                        );
                      }).toList(),
                      onChanged: (val) => setStateDialog(() => selectedVendor = val),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: itemNameController,
                            decoration: const InputDecoration(labelText: 'Item Desc *', hintText: 'e.g. Flour bag'),
                          ),
                        ),
                        const SizedBox(width: 6),
                        SizedBox(
                          width: 45,
                          child: TextField(
                            controller: qtyController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Qty'),
                          ),
                        ),
                        const SizedBox(width: 6),
                        SizedBox(
                          width: 65,
                          child: TextField(
                            controller: priceController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Price (₹)'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerRight,
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.add, size: 14),
                        label: const Text('Add Item'),
                        onPressed: () {
                          if (itemNameController.text.trim().isEmpty || priceController.text.trim().isEmpty) return;
                          setStateDialog(() {
                            poItemsCart.add({
                              'item_name': itemNameController.text.trim(),
                              'quantity': double.tryParse(qtyController.text) ?? 1.0,
                              'price': double.tryParse(priceController.text) ?? 0.0,
                            });
                            itemNameController.clear();
                            priceController.clear();
                            qtyController.text = '1';
                          });
                        },
                      ),
                    ),
                    const Divider(height: 16),
                    Expanded(
                      child: poItemsCart.isEmpty
                          ? const Center(child: Text('No draft items added.'))
                          : ListView.builder(
                              itemCount: poItemsCart.length,
                              itemBuilder: (c, idx) {
                                final item = poItemsCart[idx];
                                return ListTile(
                                  dense: true,
                                  title: Text(item['item_name']),
                                  subtitle: Text('${item['quantity'].toString().replaceAll('.00', '')}x @ ₹${item['price']}'),
                                  trailing: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text('₹${(item['quantity'] * item['price']).toStringAsFixed(2)}'),
                                      IconButton(
                                        icon: const Icon(Icons.delete, color: Colors.red, size: 16),
                                        onPressed: () => setStateDialog(() => poItemsCart.removeAt(idx)),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                    ),
                    const Divider(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Estimated Total:', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                        Text('₹${grand.toStringAsFixed(2)}', style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Theme.of(context).primaryColor)),
                      ],
                    )
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                ElevatedButton(
                  onPressed: () {
                    if (selectedVendor == null || poItemsCart.isEmpty) return;
                    Navigator.pop(ctx);
                    createPO(vendorId: selectedVendor!, items: poItemsCart, total: grand);
                  },
                  child: const Text('Save PO Draft'),
                )
              ],
            );
          },
        ),
      );
    }
  }

  Future<void> openGrnDialog(int poId) async {
    List<dynamic> poItems = [];
    List<TextEditingController> controllers = [];
    final grnNotesController = TextEditingController();

    try {
      final res = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/purchase-orders/$poId'));
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        poItems = data['items'];
        controllers = List.generate(poItems.length, (idx) {
          return TextEditingController(text: double.parse(poItems[idx]['quantity'].toString()).toStringAsFixed(0));
        });
      }
    } catch (e) {
      debugPrint('Error getting PO details: $e');
    }

    if (poItems.isEmpty) return;

    if (mounted) {
      showDialog(
        context: context,
        builder: (ctx) => StatefulBuilder(
          builder: (context, setStateDialog) => AlertDialog(
            title: Text('Receive Goods (GRN) for PO #$poId', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 15)),
            content: SizedBox(
              width: double.maxFinite,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: grnNotesController,
                    decoration: const InputDecoration(labelText: 'Receiving Remarks / Storage Notes'),
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: ListView.builder(
                      itemCount: poItems.length,
                      itemBuilder: (c, idx) {
                        final item = poItems[idx];
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4.0),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  item['item_name'],
                                  style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
                                ),
                              ),
                              Text('Ordered: ${double.parse(item['quantity'].toString()).toStringAsFixed(0)}'),
                              const SizedBox(width: 10),
                              SizedBox(
                                width: 60,
                                child: TextField(
                                  controller: controllers[idx],
                                  keyboardType: TextInputType.number,
                                  textAlign: TextAlign.center,
                                  decoration: const InputDecoration(
                                    contentPadding: EdgeInsets.symmetric(vertical: 4),
                                    labelText: 'Recv',
                                  ),
                                ),
                              )
                            ],
                          ),
                        );
                      },
                    ),
                  )
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              ElevatedButton(
                onPressed: () async {
                  Navigator.pop(ctx);
                  await submitGrn(poId, poItems, controllers, grnNotesController.text.trim());
                },
                child: const Text('Complete GRN'),
              )
            ],
          ),
        ),
      );
    }
  }

  Future<void> submitGrn(int poId, List<dynamic> poItems, List<TextEditingController> controllers, String notes) async {
    try {
      final List<dynamic> grnLines = [];
      for (var i = 0; i < poItems.length; i++) {
        grnLines.add({
          'item_name': poItems[i]['item_name'],
          'quantity_ordered': double.parse(poItems[i]['quantity'].toString()),
          'quantity_received': double.tryParse(controllers[i].text) ?? 0.0,
        });
      }

      final data = {
        'notes': notes,
        'items': grnLines,
      };

      final response = await ApiClient.post(Uri.parse('${AppConfig.baseUrl}/api/purchase-orders/$poId/grn'), body: json.encode(data));
      if (response.statusCode == 201 || response.statusCode == 200) {
        fetchPurchaseOrders();
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('GRN processed and stock updated successfully!')));
      }
    } catch (e) {
      debugPrint('Error GRN: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: showPoForm,
        child: const Icon(Icons.add),
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : purchaseOrders.isEmpty
              ? Center(child: Text('No Purchase Orders created yet', style: GoogleFonts.inter(color: Colors.grey)))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: purchaseOrders.length,
                  itemBuilder: (ctx, idx) {
                    final po = purchaseOrders[idx];
                    final dateVal = DateTime.parse(po['created_date']).toLocal();
                    final dateStr = '${dateVal.day}/${dateVal.month}/${dateVal.year}';

                    Color statusColor = Colors.grey;
                    if (po['status'] == 'ordered') statusColor = Colors.orange;
                    else if (po['status'] == 'received') statusColor = Colors.green;

                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      child: Padding(
                        padding: const EdgeInsets.all(12.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'PO #PO-${po['po_id']}',
                                  style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: statusColor.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    po['status'].toString().toUpperCase(),
                                    style: TextStyle(fontSize: 9, color: statusColor, fontWeight: FontWeight.bold),
                                  ),
                                )
                              ],
                            ),
                            const Divider(height: 16),
                            Text(
                              po['vendor_company'] ?? 'Walk-in Vendor',
                              style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14),
                            ),
                            Text(
                              'Buyer: ${po['created_by']} • Date: $dateStr',
                              style: GoogleFonts.inter(fontSize: 11, color: Colors.grey),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Total: ₹${double.parse(po['total'].toString()).toStringAsFixed(2)}',
                                  style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14, color: Theme.of(context).primaryColor),
                                ),
                                if (po['status'] == 'draft')
                                  ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                                      minimumSize: const Size(80, 28),
                                    ),
                                    onPressed: () => updatePoStatus(po['po_id'], 'ordered'),
                                    child: const Text('Send to Vendor', style: TextStyle(fontSize: 10)),
                                  ),
                                if (po['status'] == 'ordered')
                                  ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.green,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                                      minimumSize: const Size(80, 28),
                                    ),
                                    onPressed: () => openGrnDialog(po['po_id']),
                                    child: const Text('Receive GRN', style: TextStyle(fontSize: 10)),
                                  ),
                              ],
                            )
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
