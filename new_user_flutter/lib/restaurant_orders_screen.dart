import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'api_client.dart';
import 'config.dart';

class RestaurantOrdersScreen extends StatefulWidget {
  const RestaurantOrdersScreen({super.key});

  @override
  State<RestaurantOrdersScreen> createState() => _RestaurantOrdersScreenState();
}

class _RestaurantOrdersScreenState extends State<RestaurantOrdersScreen> {
  List<dynamic> orders = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    fetchOrders();
  }

  Future<void> fetchOrders() async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/restaurant/orders'));
      if (response.statusCode == 200) {
        setState(() {
          orders = json.decode(response.body);
          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching orders: $e');
      setState(() => isLoading = false);
    }
  }

  Future<void> updateOrderStatus(int id, String status) async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.put(
        Uri.parse('${AppConfig.baseUrl}/api/restaurant/orders/$id/status'),
        body: json.encode({'status': status}),
      );

      if (response.statusCode == 200) {
        fetchOrders();
      } else {
        throw Exception('Status change failed');
      }
    } catch (e) {
      setState(() => isLoading = false);
    }
  }

  Future<void> checkoutOrder(dynamic order) async {
    final double grandTotal = double.tryParse(order['total'].toString()) ?? 0;
    final String paymentMethod = 'Cash';

    // Build the checkout request payload
    final data = {
      'customer_id': order['customer_id'],
      'gross': grandTotal,
      'tax': grandTotal * 0.05,
      'total': grandTotal * 1.05,
      'payment_method': paymentMethod,
      'items': (order['items'] as List).map((i) => {
        'item_id': null,
        'item_name': i['item_name'],
        'quantity': double.tryParse(i['quantity'].toString()) ?? 1,
        'item_amount': double.tryParse(i['price'].toString()) ?? 0,
        'tax_amount': (double.tryParse(i['price'].toString()) ?? 0) * 0.05
      }).toList()
    };

    try {
      setState(() => isLoading = true);
      
      // Post sales transaction
      final response = await ApiClient.post(
        Uri.parse('${AppConfig.baseUrl}/api/sales'),
        body: json.encode(data),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        // Set restaurant order status to billed (releases table)
        await ApiClient.put(
          Uri.parse('${AppConfig.baseUrl}/api/restaurant/orders/${order['order_id']}/status'),
          body: json.encode({'status': 'billed'}),
        );
        fetchOrders();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Order checked out successfully! Released table.')),
          );
        }
      } else {
        throw Exception('Checkout failed');
      }
    } catch (e) {
      setState(() => isLoading = false);
    }
  }

  void openNewOrderModal() async {
    // 1. Fetch tables, users/waiters, customers, and menu items to populate dialog selection lists
    List<dynamic> tables = [];
    List<dynamic> waiters = [];
    List<dynamic> customers = [];
    List<dynamic> menuItems = [];

    try {
      setState(() => isLoading = true);
      final resTab = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/restaurant/tables'));
      final resCust = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/customers'));
      final resWait = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/users'));
      final resMenu = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/restaurant/menu/items'));

      if (resTab.statusCode == 200) tables = json.decode(resTab.body);
      if (resCust.statusCode == 200) customers = json.decode(resCust.body);
      if (resWait.statusCode == 200) waiters = json.decode(resWait.body);
      if (resMenu.statusCode == 200) menuItems = json.decode(resMenu.body);
    } catch (e) {
      debugPrint('Error preparing order form lists: $e');
    } finally {
      setState(() => isLoading = false);
    }

    if (mounted) {
      showDialog(
        context: context,
        builder: (ctx) => RestaurantOrderBuilderDialog(
          tables: tables,
          waiters: waiters,
          customers: customers,
          menuItems: menuItems,
          onPlaced: fetchOrders,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final primaryColor = Theme.of(context).primaryColor;

    return Scaffold(
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : orders.isEmpty
              ? Center(child: Text('No orders placed yet', style: GoogleFonts.inter(color: Colors.grey)))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: orders.length,
                  itemBuilder: (ctx, idx) {
                    final o = orders[idx];


                    Color statusColor = const Color(0xFFF59E0B); // amber
                    if (o['status'] == 'ready' || o['status'] == 'served') {
                      statusColor = const Color(0xFF10B981);
                    } else if (o['status'] == 'billed') {
                      statusColor = const Color(0xFF6366F1);
                    } else if (o['status'] == 'cancelled') {
                      statusColor = const Color(0xFFEF4444);
                    }

                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 1,
                      child: Padding(
                        padding: const EdgeInsets.all(12.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Order #OR-${o['order_id']} (${o['order_type'].toString().toUpperCase()})',
                                  style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 15),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: statusColor.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    o['status'].toString().toUpperCase(),
                                    style: GoogleFonts.inter(fontSize: 10, color: statusColor, fontWeight: FontWeight.bold),
                                  ),
                                )
                              ],
                            ),
                            const Divider(height: 16),
                            Text(
                              o['table_no'] != null
                                  ? 'Table: ${o['table_no']} (${o['section']})'
                                  : 'Type: Takeaway / Parcel',
                              style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Guest: ${o['customer_name'] ?? "Walk-in Guest"} • Waiter: ${o['waiter_name'] ?? "None"}',
                              style: GoogleFonts.inter(fontSize: 12, color: Colors.grey),
                            ),
                            const SizedBox(height: 8),
                            // Order items list snippet
                            Text(
                              'Items: ${(o['items'] as List).map((i) => "${i['quantity'].toString().replaceAll('.00', '')}x ${i['item_name']}").join(', ')}',
                              style: GoogleFonts.inter(fontSize: 12),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Total: ₹${double.parse(o['total'].toString()).toStringAsFixed(2)}',
                                  style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 15, color: primaryColor),
                                ),
                                Row(
                                  children: [
                                    if (o['status'] == 'pending' || o['status'] == 'preparing' || o['status'] == 'accepted') ...[
                                      TextButton.icon(
                                        icon: const Icon(Icons.cancel_outlined, size: 16, color: Colors.red),
                                        label: const Text('Cancel', style: TextStyle(color: Colors.red, fontSize: 12)),
                                        onPressed: () => updateOrderStatus(o['order_id'], 'cancelled'),
                                      ),
                                    ],
                                    if (o['status'] == 'ready' || o['status'] == 'served') ...[
                                      ElevatedButton(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: primaryColor,
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                        ),
                                        onPressed: () => checkoutOrder(o),
                                        child: const Text('Generate Bill', style: TextStyle(fontSize: 12)),
                                      ),
                                    ],
                                  ],
                                )
                              ],
                            )
                          ],
                        ),
                      ),
                    );
                  },
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: openNewOrderModal,
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add_shopping_cart_outlined),
      ),
    );
  }
}

class RestaurantOrderBuilderDialog extends StatefulWidget {
  final List<dynamic> tables;
  final List<dynamic> waiters;
  final List<dynamic> customers;
  final List<dynamic> menuItems;
  final VoidCallback onPlaced;

  const RestaurantOrderBuilderDialog({
    super.key,
    required this.tables,
    required this.waiters,
    required this.customers,
    required this.menuItems,
    required this.onPlaced,
  });

  @override
  State<RestaurantOrderBuilderDialog> createState() => _RestaurantOrderBuilderDialogState();
}

class _RestaurantOrderBuilderDialogState extends State<RestaurantOrderBuilderDialog> {
  final formKey = GlobalKey<FormState>();
  final notesCtrl = TextEditingController();

  String orderType = 'dine-in';
  int? tableId;
  int? waiterId;
  int? customerId;

  // Local draft cart
  List<Map<String, dynamic>> cart = [];

  // Dropdown selected item
  int? selectedMenuItemId;
  int selectedQty = 1;

  double get cartTotal {
    double t = 0;
    for (var i in cart) {
      t += i['price'] * i['quantity'];
    }
    return t;
  }

  void addToCart() {
    if (selectedMenuItemId == null) return;
    final item = widget.menuItems.firstWhere((i) => i['menu_item_id'] == selectedMenuItemId);

    setState(() {
      final existingIndex = cart.indexWhere((i) => i['menu_item_id'] == selectedMenuItemId);
      if (existingIndex >= 0) {
        cart[existingIndex]['quantity'] += selectedQty;
      } else {
        cart.add({
          'menu_item_id': item['menu_item_id'],
          'name': item['name'],
          'price': double.parse(item['price'].toString()),
          'quantity': selectedQty
        });
      }
      selectedMenuItemId = null;
      selectedQty = 1;
    });
  }

  Future<void> submitOrder() async {
    if (cart.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least 1 item to the order ticket')),
      );
      return;
    }

    final data = {
      'table_id': orderType == 'dine-in' ? tableId : null,
      'customer_id': customerId,
      'waiter_id': waiterId,
      'order_type': orderType,
      'notes': notesCtrl.text.trim(),
      'items': cart.map((c) => {'menu_item_id': c['menu_item_id'], 'quantity': c['quantity']}).toList()
    };

    try {
      final response = await ApiClient.post(
        Uri.parse('${AppConfig.baseUrl}/api/restaurant/orders'),
        body: json.encode(data),
      );

      if (response.statusCode == 201) {
        widget.onPlaced();
        if (mounted) Navigator.pop(context);
      }
    } catch (e) {
      debugPrint('Error placing order KOT: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('New KOT / Table Order', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
      content: Form(
        key: formKey,
        child: SizedBox(
          width: MediaQuery.of(context).size.width * 0.9,
          height: MediaQuery.of(context).size.height * 0.7,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: orderType,
                      decoration: const InputDecoration(labelText: 'Order Type'),
                      items: const [
                        DropdownMenuItem(value: 'dine-in', child: Text('Dine-In')),
                        DropdownMenuItem(value: 'takeaway', child: Text('Takeaway')),
                      ],
                      onChanged: (val) {
                        setState(() {
                          orderType = val!;
                          if (orderType != 'dine-in') tableId = null;
                        });
                      },
                    ),
                  ),
                  if (orderType == 'dine-in') ...[
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        value: tableId,
                        decoration: const InputDecoration(labelText: 'Select Table'),
                        items: widget.tables
                            .map<DropdownMenuItem<int>>((t) => DropdownMenuItem<int>(
                                  value: t['table_id'],
                                  child: Text('${t['table_no']} (${t['section']})'),
                                ))
                            .toList(),
                        onChanged: (val) => setState(() => tableId = val),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<int>(
                      value: waiterId,
                      decoration: const InputDecoration(labelText: 'Waiter'),
                      items: widget.waiters
                          .map<DropdownMenuItem<int>>((u) => DropdownMenuItem<int>(
                                value: u['user_id'],
                                child: Text(u['username']),
                              ))
                          .toList(),
                      onChanged: (val) => setState(() => waiterId = val),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<int>(
                      value: customerId,
                      decoration: const InputDecoration(labelText: 'Customer'),
                      items: widget.customers
                          .map<DropdownMenuItem<int>>((c) => DropdownMenuItem<int>(
                                value: c['customer_id'],
                                child: Text(c['name']),
                              ))
                          .toList(),
                      onChanged: (val) => setState(() => customerId = val),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: notesCtrl,
                decoration: const InputDecoration(labelText: 'Chef preparation note (e.g. Medium spicy)'),
              ),
              const SizedBox(height: 16),
              // Cart Builder row
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: DropdownButtonFormField<int>(
                      value: selectedMenuItemId,
                      decoration: const InputDecoration(labelText: 'Select Dish'),
                      items: widget.menuItems
                          .map<DropdownMenuItem<int>>((i) => DropdownMenuItem<int>(
                                value: i['menu_item_id'],
                                child: Text('${i['name']} (₹${i['price']})'),
                              ))
                          .toList(),
                      onChanged: (val) => setState(() => selectedMenuItemId = val),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 60,
                    child: TextFormField(
                      initialValue: '1',
                      decoration: const InputDecoration(labelText: 'Qty'),
                      keyboardType: TextInputType.number,
                      onChanged: (val) => selectedQty = int.tryParse(val) ?? 1,
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.add_shopping_cart, color: Colors.blue),
                    onPressed: addToCart,
                  )
                ],
              ),
              const SizedBox(height: 16),
              Text('KOT Ticket Items:', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13)),
              Expanded(
                child: cart.isEmpty
                    ? Center(child: Text('No items added to draft KOT.', style: TextStyle(color: Colors.grey.shade400)))
                    : ListView.builder(
                        itemCount: cart.length,
                        itemBuilder: (ctx, idx) {
                          final c = cart[idx];
                          return Card(
                            elevation: 0,
                            margin: const EdgeInsets.symmetric(vertical: 4),
                            color: Colors.grey.shade100,
                            child: ListTile(
                              title: Text(c['name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                              subtitle: Text('${c['quantity']}x @ ₹${c['price']}'),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    '₹${(c['price'] * c['quantity']).toStringAsFixed(2)}',
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                                    onPressed: () => setState(() => cart.removeAt(idx)),
                                  )
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'KOT Total: ₹${cartTotal.toStringAsFixed(2)}',
                    style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  ElevatedButton(
                    onPressed: submitOrder,
                    child: const Text('Send KOT to Kitchen'),
                  )
                ],
              )
            ],
          ),
        ),
      ),
    );
  }
}
