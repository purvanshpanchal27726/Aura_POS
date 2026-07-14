import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'api_client.dart';
import 'config.dart';

class HotelRoomsScreen extends StatefulWidget {
  const HotelRoomsScreen({super.key});

  @override
  State<HotelRoomsScreen> createState() => _HotelRoomsScreenState();
}

class _HotelRoomsScreenState extends State<HotelRoomsScreen> {
  List<dynamic> rooms = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    fetchRooms();
  }

  Future<void> fetchRooms() async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/hotel/rooms'));
      if (response.statusCode == 200) {
        setState(() {
          rooms = json.decode(response.body);
          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching rooms: $e');
      setState(() => isLoading = false);
    }
  }

  Future<void> saveRoom({int? id, required String roomNo, required String roomType, required double price}) async {
    try {
      final data = {
        'room_no': roomNo,
        'room_type': roomType,
        'price_per_night': price,
      };

      final response = id == null
          ? await ApiClient.post(Uri.parse('${AppConfig.baseUrl}/api/hotel/rooms'), body: json.encode(data))
          : await ApiClient.put(Uri.parse('${AppConfig.baseUrl}/api/hotel/rooms/$id'), body: json.encode(data));

      if (response.statusCode == 200 || response.statusCode == 201) {
        fetchRooms();
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Room saved successfully!')));
      }
    } catch (e) {
      debugPrint('Error saving room: $e');
    }
  }

  Future<void> deleteRoom(int id) async {
    try {
      final response = await ApiClient.delete(Uri.parse('${AppConfig.baseUrl}/api/hotel/rooms/$id'));
      if (response.statusCode == 200) {
        fetchRooms();
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Room deleted successfully')));
      }
    } catch (e) {
      debugPrint('Error deleting room: $e');
    }
  }

  void showRoomForm({dynamic room}) {
    final roomNoController = TextEditingController(text: room?['room_no'] ?? '');
    final priceController = TextEditingController(text: room != null ? room['price_per_night'].toString() : '');
    String roomType = room?['room_type'] ?? 'Single';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(room == null ? 'Add Room' : 'Edit Room', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: roomNoController,
                decoration: const InputDecoration(labelText: 'Room Number *', hintText: 'e.g. 101'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: roomType,
                decoration: const InputDecoration(labelText: 'Room Type *'),
                items: const [
                  DropdownMenuItem(value: 'Single', child: Text('Single Bedroom')),
                  DropdownMenuItem(value: 'Double', child: Text('Double Bedroom')),
                  DropdownMenuItem(value: 'Deluxe', child: Text('Deluxe Suite')),
                  DropdownMenuItem(value: 'Executive', child: Text('Executive Suite')),
                ],
                onChanged: (val) {
                  if (val != null) roomType = val;
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: priceController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Price per Night (₹) *'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              if (roomNoController.text.trim().isEmpty || priceController.text.trim().isEmpty) {
                return;
              }
              Navigator.pop(ctx);
              saveRoom(
                id: room?['room_id'],
                roomNo: roomNoController.text.trim(),
                roomType: roomType,
                price: double.tryParse(priceController.text) ?? 0.0,
              );
            },
            child: const Text('Save'),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => showRoomForm(),
        child: const Icon(Icons.add),
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : rooms.isEmpty
              ? Center(
                  child: Text('No rooms registered yet', style: GoogleFonts.inter(color: Colors.grey)),
                )
              : GridView.builder(
                  padding: const EdgeInsets.all(12),
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 180,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    childAspectRatio: 0.95,
                  ),
                  itemCount: rooms.length,
                  itemBuilder: (ctx, idx) {
                    final r = rooms[idx];
                    Color statusColor = Colors.green;
                    if (r['status'] == 'occupied') statusColor = Colors.red;
                    else if (r['status'] == 'dirty') statusColor = Colors.orange;
                    else if (r['status'] == 'maintenance') statusColor = Colors.grey;

                    return Card(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: statusColor.withValues(alpha: 0.5), width: 1.5),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(8.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.bed, color: statusColor, size: 36),
                            const SizedBox(height: 4),
                            Text(
                              'Room ${r['room_no']}',
                              style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            Text(
                              '${r['room_type']}\n₹${double.parse(r['price_per_night'].toString()).toStringAsFixed(0)}/n',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.inter(fontSize: 10, color: Colors.grey.shade600),
                            ),
                            const Spacer(),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                InkWell(
                                  onTap: () => showRoomForm(room: r),
                                  child: const Icon(Icons.edit, size: 16, color: Colors.blue),
                                ),
                                const SizedBox(width: 16),
                                InkWell(
                                  onTap: () {
                                    showDialog(
                                      context: context,
                                      builder: (c) => AlertDialog(
                                        title: const Text('Delete Room?'),
                                        content: Text('De-register Room ${r['room_no']}?'),
                                        actions: [
                                          TextButton(onPressed: () => Navigator.pop(c), child: const Text('Cancel')),
                                          TextButton(
                                            onPressed: () {
                                              Navigator.pop(c);
                                              deleteRoom(r['room_id']);
                                            },
                                            child: const Text('Delete', style: TextStyle(color: Colors.red)),
                                          )
                                        ],
                                      ),
                                    );
                                  },
                                  child: const Icon(Icons.delete, size: 16, color: Colors.red),
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
