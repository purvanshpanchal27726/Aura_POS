import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'api_client.dart';
import 'config.dart';

class HotelBookingsScreen extends StatefulWidget {
  const HotelBookingsScreen({super.key});

  @override
  State<HotelBookingsScreen> createState() => _HotelBookingsScreenState();
}

class _HotelBookingsScreenState extends State<HotelBookingsScreen> {
  List<dynamic> bookings = [];
  List<dynamic> rooms = [];
  List<dynamic> guests = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    fetchBookings();
  }

  Future<void> fetchBookings() async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/hotel/bookings'));
      if (response.statusCode == 200) {
        setState(() {
          bookings = json.decode(response.body);
          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching bookings: $e');
      setState(() => isLoading = false);
    }
  }

  Future<void> checkInGuest({required int guestId, required int roomId, required String checkIn, String? checkOut, String? notes}) async {
    try {
      final data = {
        'guest_id': guestId,
        'room_id': roomId,
        'check_in_date': checkIn,
        'check_out_date': checkOut,
        'notes': notes ?? '',
      };

      final response = await ApiClient.post(Uri.parse('${AppConfig.baseUrl}/api/hotel/bookings'), body: json.encode(data));
      if (response.statusCode == 200 || response.statusCode == 201) {
        fetchBookings();
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Guest checked in successfully!')));
      }
    } catch (e) {
      debugPrint('Error checking in: $e');
    }
  }

  Future<void> showCheckInForm() async {
    try {
      final resG = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/hotel/guests'));
      final resR = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/hotel/rooms'));
      if (resG.statusCode == 200 && resR.statusCode == 200) {
        setState(() {
          guests = json.decode(resG.body);
          rooms = json.decode(resR.body);
        });
      }
    } catch (e) {
      debugPrint('Error prefetching: $e');
    }

    final availableRooms = rooms.where((r) => r['status'] == 'available').toList();
    if (guests.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please register a guest in the Guest Registry first!')));
      }
      return;
    }
    if (availableRooms.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No available rooms right now!')));
      }
      return;
    }

    int? selectedGuest = guests[0]['guest_id'];
    int? selectedRoom = availableRooms[0]['room_id'];
    final notesController = TextEditingController();

    if (mounted) {
      showDialog(
        context: context,
        builder: (ctx) => StatefulBuilder(
          builder: (context, setStateDialog) => AlertDialog(
            title: Text('Stay Check-in / Booking', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<int>(
                    value: selectedGuest,
                    decoration: const InputDecoration(labelText: 'Select Guest *'),
                    items: guests.map<DropdownMenuItem<int>>((g) {
                      return DropdownMenuItem<int>(
                        value: g['guest_id'],
                        child: Text(g['name']),
                      );
                    }).toList(),
                    onChanged: (val) => setStateDialog(() => selectedGuest = val),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int>(
                    value: selectedRoom,
                    decoration: const InputDecoration(labelText: 'Select Available Room *'),
                    items: availableRooms.map<DropdownMenuItem<int>>((r) {
                      return DropdownMenuItem<int>(
                        value: r['room_id'],
                        child: Text('Room ${r['room_no']} (${r['room_type']})'),
                      );
                    }).toList(),
                    onChanged: (val) => setStateDialog(() => selectedRoom = val),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notesController,
                    decoration: const InputDecoration(labelText: 'Booking Remarks / Requests'),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              ElevatedButton(
                onPressed: () {
                  if (selectedGuest == null || selectedRoom == null) return;
                  Navigator.pop(ctx);
                  checkInGuest(
                    guestId: selectedGuest!,
                    roomId: selectedRoom!,
                    checkIn: DateTime.now().toIso8601String(),
                    notes: notesController.text.trim(),
                  );
                },
                child: const Text('Check In'),
              )
            ],
          ),
        ),
      );
    }
  }

  Future<void> openRoomServiceDialog(int bookingId, String guestName, String roomNo) async {
    final itemController = TextEditingController();
    final qtyController = TextEditingController(text: '1');
    final priceController = TextEditingController();
    List<dynamic> serviceOrders = [];

    Future<void> loadServices(StateSetter setStateDialog) async {
      try {
        final res = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/hotel/bookings/$bookingId/services'));
        if (res.statusCode == 200) {
          setStateDialog(() {
            serviceOrders = json.decode(res.body);
          });
        }
      } catch (e) {
        debugPrint('Error loading services: $e');
      }
    }

    Future<void> submitService(StateSetter setStateDialog) async {
      if (itemController.text.isEmpty || priceController.text.isEmpty) return;
      try {
        final data = {
          'item_name': itemController.text.trim(),
          'quantity': int.tryParse(qtyController.text) ?? 1,
          'price': double.tryParse(priceController.text) ?? 0.0,
        };
        final res = await ApiClient.post(Uri.parse('${AppConfig.baseUrl}/api/hotel/bookings/$bookingId/services'), body: json.encode(data));
        if (res.statusCode == 201 || res.statusCode == 200) {
          itemController.clear();
          priceController.clear();
          qtyController.text = '1';
          loadServices(setStateDialog);
        }
      } catch (e) {
        debugPrint('Error submitting service: $e');
      }
    }

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setStateDialog) {
          if (serviceOrders.isEmpty) {
            loadServices(setStateDialog);
          }
          return AlertDialog(
            title: Text('Room Service: Room $roomNo ($guestName)', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 15)),
            content: SizedBox(
              width: double.maxFinite,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: itemController,
                          decoration: const InputDecoration(labelText: 'Description *', hintText: 'e.g. Laundry'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 50,
                        child: TextField(
                          controller: qtyController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Qty'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 70,
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
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('Add Charge'),
                      onPressed: () => submitService(setStateDialog),
                    ),
                  ),
                  const Divider(height: 20),
                  Expanded(
                    child: serviceOrders.isEmpty
                        ? const Center(child: Text('No service charges recorded yet.'))
                        : ListView.builder(
                            itemCount: serviceOrders.length,
                            itemBuilder: (c, idx) {
                              final s = serviceOrders[idx];
                              return ListTile(
                                dense: true,
                                title: Text(s['item_name'], style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                                subtitle: Text('${s['quantity'].toString().replaceAll('.00', '')}x @ ₹${s['price']}'),
                                trailing: Text(
                                  '₹${(double.parse(s['price'].toString()) * double.parse(s['quantity'].toString())).toStringAsFixed(2)}',
                                  style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Theme.of(context).primaryColor),
                                ),
                              );
                            },
                          ),
                  )
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
            ],
          );
        },
      ),
    );
  }

  Future<void> checkoutBooking(dynamic b) async {
    final inDate = DateTime.parse(b['check_in_date']);
    final days = DateTime.now().difference(inDate).inDays;
    final nights = days <= 0 ? 1 : days;
    final roomCost = nights * double.parse(b['price_per_night'].toString());

    double servicesCost = 0.0;
    List<dynamic> serviceItems = [];
    try {
      final res = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/hotel/bookings/${b['booking_id']}/services'));
      if (res.statusCode == 200) {
        serviceItems = json.decode(res.body);
        for (var s in serviceItems) {
          servicesCost += double.parse(s['price'].toString()) * double.parse(s['quantity'].toString());
        }
      }
    } catch (e) {
      debugPrint('Error getting services: $e');
    }

    final subTotal = roomCost + servicesCost;
    final tax = subTotal * 0.12;
    final grandTotal = subTotal + tax;

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Checkout Stay: Room ${b['room_no']}', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Guest: ${b['guest_name']}', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
            const Divider(height: 16),
            Text('Stay duration: $nights night(s)'),
            Text('Room accommodation: ₹${roomCost.toStringAsFixed(2)}'),
            Text('Room service charges: ₹${servicesCost.toStringAsFixed(2)}'),
            Text('GST Stay Tax (12%): ₹${tax.toStringAsFixed(2)}'),
            const Divider(height: 16),
            Text(
              'Grand Total Due: ₹${grandTotal.toStringAsFixed(2)}',
              style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 15, color: Theme.of(context).primaryColor),
            )
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await completeCheckout(b, subTotal, tax, grandTotal, nights, serviceItems);
            },
            child: const Text('Process Bill & Checkout'),
          )
        ],
      ),
    );
  }

  Future<void> completeCheckout(
    dynamic b,
    double subTotal,
    double tax,
    double grandTotal,
    int nights,
    List<dynamic> serviceItems,
  ) async {
    try {
      final Map<String, dynamic> salesInvoice = {
        'customer_id': null,
        'customer_name': b['guest_name'],
        'gross': subTotal,
        'tax': tax,
        'total': grandTotal,
        'payment_method': 'Cash',
        'items': [
          {
            'item_id': null,
            'item_name': 'Room Accommodation (Room ${b['room_no']} - $nights Nights)',
            'quantity': nights.toDouble(),
            'item_amount': double.parse(b['price_per_night'].toString()),
            'tax_amount': double.parse(b['price_per_night'].toString()) * nights * 0.12,
          }
        ]
      };

      for (var s in serviceItems) {
        (salesInvoice['items'] as List).add({
          'item_id': null,
          'item_name': 'Room Service: ${s['item_name']}',
          'quantity': double.parse(s['quantity'].toString()),
          'item_amount': double.parse(s['price'].toString()),
          'tax_amount': double.parse(s['price'].toString()) * double.parse(s['quantity'].toString()) * 0.12,
        });
      }

      final responseInvoice = await ApiClient.post(Uri.parse('${AppConfig.baseUrl}/api/sales'), body: json.encode(salesInvoice));
      final responseStatus = await ApiClient.put(
        Uri.parse('${AppConfig.baseUrl}/api/hotel/bookings/${b['booking_id']}/status'),
        body: json.encode({'status': 'checked-out', 'total_amount': grandTotal}),
      );

      if (responseInvoice.statusCode == 201 && responseStatus.statusCode == 200) {
        fetchBookings();
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Checkout invoice created and room released!')));
      }
    } catch (e) {
      debugPrint('Error checkout: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = bookings.where((b) => b['status'] == 'checked-in').toList();
    final settled = bookings.where((b) => b['status'] == 'checked-out' || b['status'] == 'cancelled').toList();

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: const PreferredSize(
          preferredSize: Size.fromHeight(48),
          child: TabBar(
            tabs: [
              Tab(text: 'Active Stay Folios'),
              Tab(text: 'Historical/Settled'),
            ],
          ),
        ),
        floatingActionButton: FloatingActionButton(
          onPressed: showCheckInForm,
          child: const Icon(Icons.add),
        ),
        body: TabBarView(
          children: [
            buildBookingsList(active, isActiveTab: true),
            buildBookingsList(settled, isActiveTab: false),
          ],
        ),
      ),
    );
  }

  Widget buildBookingsList(List<dynamic> list, {required bool isActiveTab}) {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (list.isEmpty) {
      return Center(child: Text('No bookings to display', style: GoogleFonts.inter(color: Colors.grey)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: list.length,
      itemBuilder: (ctx, idx) {
        final b = list[idx];
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
                      'Booking #BK-${b['booking_id']}',
                      style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    Text(
                      b['status'].toString().toUpperCase(),
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.bold,
                        fontSize: 10,
                        color: b['status'] == 'checked-in' ? Colors.orange : Colors.green,
                      ),
                    )
                  ],
                ),
                const Divider(height: 16),
                Text(
                  'Room ${b['room_no']} (${b['room_type']})',
                  style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Theme.of(context).primaryColor, fontSize: 14),
                ),
                const SizedBox(height: 4),
                Text(
                  'Guest: ${b['guest_name']} (${b['guest_phone']})',
                  style: GoogleFonts.inter(fontSize: 12, color: Colors.grey.shade700),
                ),
                if (isActiveTab) ...[
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.grey.shade200,
                          foregroundColor: Colors.black87,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          minimumSize: const Size(80, 32),
                        ),
                        onPressed: () => openRoomServiceDialog(b['booking_id'], b['guest_name'], b['room_no']),
                        child: const Text('Room Service', style: TextStyle(fontSize: 11)),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          minimumSize: const Size(80, 32),
                        ),
                        onPressed: () => checkoutBooking(b),
                        child: const Text('Checkout Folio', style: TextStyle(fontSize: 11)),
                      ),
                    ],
                  )
                ]
              ],
            ),
          ),
        );
      },
    );
  }
}
