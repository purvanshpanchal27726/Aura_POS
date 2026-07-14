import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'api_client.dart';
import 'config.dart';

class RestaurantKdsScreen extends StatefulWidget {
  const RestaurantKdsScreen({super.key});

  @override
  State<RestaurantKdsScreen> createState() => _RestaurantKdsScreenState();
}

class _RestaurantKdsScreenState extends State<RestaurantKdsScreen> {
  List<dynamic> queueItems = [];
  bool isLoading = true;
  String departmentFilter = 'ALL';
  Timer? pollTimer;

  @override
  void initState() {
    super.initState();
    fetchQueue();
    // Poll the KDS kitchen queue every 8 seconds to fetch active KOT updates
    pollTimer = Timer.periodic(const Duration(seconds: 8), (timer) {
      if (mounted && !isLoading) {
        fetchQueue(silent: true);
      }
    });
  }

  @override
  void dispose() {
    pollTimer?.cancel();
    super.dispose();
  }

  Future<void> fetchQueue({bool silent = false}) async {
    try {
      if (!silent) setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/restaurant/kitchen/queue'));
      if (response.statusCode == 200) {
        if (mounted) {
          setState(() {
            queueItems = json.decode(response.body);
            isLoading = false;
          });
        }
      } else {
        if (mounted) setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching KDS queue: $e');
      if (mounted) setState(() => isLoading = false);
    }
  }

  Future<void> updateItemStatus(int itemId, String status) async {
    try {
      final response = await ApiClient.put(
        Uri.parse('${AppConfig.baseUrl}/api/restaurant/orders/items/$itemId/status'),
        body: json.encode({'status': status}),
      );

      if (response.statusCode == 200) {
        fetchQueue(silent: true);
      }
    } catch (e) {
      debugPrint('Error updating KDS item: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final primaryColor = Theme.of(context).primaryColor;

    // Filter queue items by department
    final filtered = queueItems.where((i) => departmentFilter == 'ALL' || i['kitchen_dept'] == departmentFilter).toList();

    // Group items by order_id
    final Map<int, List<dynamic>> orderGroups = {};
    for (var i in filtered) {
      final int orderId = i['order_id'];
      if (!orderGroups.containsKey(orderId)) {
        orderGroups[orderId] = [];
      }
      orderGroups[orderId]!.add(i);
    }

    final groupedKeys = orderGroups.keys.toList();

    return Scaffold(
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: Theme.of(context).cardColor,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'KDS Queue: ${filtered.length} Items',
                style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 15),
              ),
              DropdownButton<String>(
                value: departmentFilter,
                underline: const SizedBox(),
                items: const [
                  DropdownMenuItem(value: 'ALL', child: Text('All Kitchen Depts')),
                  DropdownMenuItem(value: 'Hot Kitchen', child: Text('Hot Kitchen')),
                  DropdownMenuItem(value: 'Cold Kitchen', child: Text('Cold Kitchen')),
                  DropdownMenuItem(value: 'Bar', child: Text('Bar / Drinks')),
                ],
                onChanged: (val) {
                  if (val != null) {
                    setState(() => departmentFilter = val);
                  }
                },
              )
            ],
          ),
        ),
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : filtered.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.check_circle_outline, size: 64, color: Colors.green.shade300),
                      const SizedBox(height: 12),
                      Text('Kitchen queue is clear!', style: GoogleFonts.inter(color: Colors.grey, fontSize: 15)),
                    ],
                  ),
                )
              : GridView.builder(
                  padding: const EdgeInsets.all(12),
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 320,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.82,
                  ),
                  itemCount: groupedKeys.length,
                  itemBuilder: (ctx, idx) {
                    final int orderId = groupedKeys[idx];
                    final ticketItems = orderGroups[orderId]!;
                    final t = ticketItems[0];
                    final createdTime = DateTime.parse(t['order_time']).toLocal();
                    final minutesAgo = DateTime.now().difference(createdTime).inMinutes;

                    return Card(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(
                          color: minutesAgo > 15 ? Colors.red : Colors.grey.shade300,
                          width: minutesAgo > 15 ? 1.5 : 1,
                        ),
                      ),
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
                                  '#OR-$orderId',
                                  style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade200,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    t['order_type'].toString().toUpperCase(),
                                    style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold),
                                  ),
                                )
                              ],
                            ),
                            const SizedBox(height: 4),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  t['table_no'] != null ? 'Table ${t['table_no']}' : 'Parcel',
                                  style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: primaryColor),
                                ),
                                Text(
                                  '$minutesAgo mins ago',
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    color: minutesAgo > 15 ? Colors.red : Colors.grey,
                                    fontWeight: minutesAgo > 15 ? FontWeight.bold : FontWeight.normal,
                                  ),
                                ),
                              ],
                            ),
                            const Divider(height: 16),
                            Expanded(
                              child: ListView.builder(
                                itemCount: ticketItems.length,
                                itemBuilder: (c, itemIdx) {
                                  final i = ticketItems[itemIdx];
                                  final isPreparing = i['status'] == 'preparing';
                                  
                                  return Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 4.0),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                '${i['quantity'].toString().replaceAll('.00', '')}x ${i['item_name']}',
                                                style: GoogleFonts.inter(
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 13,
                                                ),
                                              ),
                                              if (i['notes'] != null && i['notes'].toString().trim().isNotEmpty) ...[
                                                Text(
                                                  '* ${i['notes']}',
                                                  style: GoogleFonts.inter(fontSize: 11, color: Colors.red, fontStyle: FontStyle.italic),
                                                )
                                              ]
                                            ],
                                          ),
                                        ),
                                        ElevatedButton(
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: isPreparing ? Colors.green : Colors.grey.shade200,
                                            foregroundColor: isPreparing ? Colors.white : Colors.black87,
                                            elevation: 0,
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                            minimumSize: const Size(60, 28),
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                          ),
                                          onPressed: () {
                                            if (!isPreparing) {
                                              updateItemStatus(i['id'], 'preparing');
                                            } else {
                                              updateItemStatus(i['id'], 'ready');
                                            }
                                          },
                                          child: Text(
                                            isPreparing ? 'READY' : 'PREP',
                                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
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
                    );
                  },
                ),
    );
  }
}
