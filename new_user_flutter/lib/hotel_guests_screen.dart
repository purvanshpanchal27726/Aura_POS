import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'api_client.dart';
import 'config.dart';

class HotelGuestsScreen extends StatefulWidget {
  const HotelGuestsScreen({super.key});

  @override
  State<HotelGuestsScreen> createState() => _HotelGuestsScreenState();
}

class _HotelGuestsScreenState extends State<HotelGuestsScreen> {
  List<dynamic> guests = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    fetchGuests();
  }

  Future<void> fetchGuests() async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/hotel/guests'));
      if (response.statusCode == 200) {
        setState(() {
          guests = json.decode(response.body);
          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching guests: $e');
      setState(() => isLoading = false);
    }
  }

  Future<void> saveGuest({
    int? id,
    required String name,
    required String phone,
    String? email,
    required String idType,
    String? idNo,
  }) async {
    try {
      final data = {
        'name': name,
        'phone': phone,
        'email': email,
        'id_proof_type': idType,
        'id_proof_no': idNo,
      };

      final response = id == null
          ? await ApiClient.post(Uri.parse('${AppConfig.baseUrl}/api/hotel/guests'), body: json.encode(data))
          : await ApiClient.put(Uri.parse('${AppConfig.baseUrl}/api/hotel/guests/$id'), body: json.encode(data));

      if (response.statusCode == 200 || response.statusCode == 201) {
        fetchGuests();
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Guest registered successfully!')));
      }
    } catch (e) {
      debugPrint('Error saving guest: $e');
    }
  }

  void showGuestForm({dynamic guest}) {
    final nameController = TextEditingController(text: guest?['name'] ?? '');
    final phoneController = TextEditingController(text: guest?['phone'] ?? '');
    final emailController = TextEditingController(text: guest?['email'] ?? '');
    final idNoController = TextEditingController(text: guest?['id_proof_no'] ?? '');
    String idType = guest?['id_proof_type'] ?? 'Aadhaar';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(guest == null ? 'Register Guest' : 'Edit Guest Details', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Full Name *', hintText: 'Enter guest name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Phone Number *', hintText: '10-digit number'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email Address', hintText: 'guest@example.com'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: idType,
                decoration: const InputDecoration(labelText: 'ID Proof Type'),
                items: const [
                  DropdownMenuItem(value: 'Aadhaar', child: Text('Aadhaar Card')),
                  DropdownMenuItem(value: 'Passport', child: Text('Passport')),
                  DropdownMenuItem(value: 'Driving License', child: Text('Driving License')),
                  DropdownMenuItem(value: 'Voter ID', child: Text('Voter ID Card')),
                ],
                onChanged: (val) {
                  if (val != null) idType = val;
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: idNoController,
                decoration: const InputDecoration(labelText: 'ID Proof Number', hintText: 'ID verification number'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              if (nameController.text.trim().isEmpty || phoneController.text.trim().isEmpty) {
                return;
              }
              Navigator.pop(ctx);
              saveGuest(
                id: guest?['guest_id'],
                name: nameController.text.trim(),
                phone: phoneController.text.trim(),
                email: emailController.text.trim().isNotEmpty ? emailController.text.trim() : null,
                idType: idType,
                idNo: idNoController.text.trim().isNotEmpty ? idNoController.text.trim() : null,
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
        onPressed: () => showGuestForm(),
        child: const Icon(Icons.add),
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : guests.isEmpty
              ? Center(child: Text('No guests registered yet', style: GoogleFonts.inter(color: Colors.grey)))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: guests.length,
                  itemBuilder: (ctx, idx) {
                    final g = guests[idx];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: Colors.indigo.shade50,
                          child: Icon(Icons.person, color: Colors.indigo.shade400),
                        ),
                        title: Text(
                          g['name'],
                          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        subtitle: Text(
                          'Phone: ${g['phone']} • ID: ${g['id_proof_type'] ?? "Aadhaar"}: ${g['id_proof_no'] ?? "N/A"}',
                          style: GoogleFonts.inter(fontSize: 12),
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.edit, color: Colors.blue, size: 20),
                          onPressed: () => showGuestForm(guest: g),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
