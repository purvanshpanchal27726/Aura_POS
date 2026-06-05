import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'config.dart';

/// Stateful Vendor Administration Screen.
/// Renders registered vendors in a responsive list (cards on mobile < 750, data table on desktop).
/// Styled according to the Indigo-Slate premium styling guide.
class VendorListingScreen extends StatefulWidget {
  final int? roleId;
  final bool canModify;
  const VendorListingScreen({super.key, this.roleId, this.canModify = false});

  @override
  State<VendorListingScreen> createState() => _VendorListingScreenState();
}

class _VendorListingScreenState extends State<VendorListingScreen> {
  final _formKey = GlobalKey<FormState>();

  bool get canModify => widget.canModify;

  List<dynamic> vendors = [];
  bool isLoading = true;

  int? editingVendorId;

  final firstNameCtrl = TextEditingController();
  final lastNameCtrl = TextEditingController();
  final companyCtrl = TextEditingController();
  final address1Ctrl = TextEditingController();
  final address2Ctrl = TextEditingController();
  final cityCtrl = TextEditingController();
  final countryCtrl = TextEditingController();
  final phone1Ctrl = TextEditingController();
  final phone2Ctrl = TextEditingController();
  final emailCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    fetchVendors();
  }

  @override
  void dispose() {
    firstNameCtrl.dispose();
    lastNameCtrl.dispose();
    companyCtrl.dispose();
    address1Ctrl.dispose();
    address2Ctrl.dispose();
    cityCtrl.dispose();
    countryCtrl.dispose();
    phone1Ctrl.dispose();
    phone2Ctrl.dispose();
    emailCtrl.dispose();
    super.dispose();
  }

  /// Reloads the vendor list from the database.
  Future<void> fetchVendors() async {
    try {
      setState(() => isLoading = true);
      final response = await http.get(Uri.parse(AppConfig.vendorsApiUrl));
      if (response.statusCode == 200) {
        setState(() {
          vendors = json.decode(response.body);
          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching vendors: $e');
      setState(() => isLoading = false);
    }
  }

  /// Performs creation (POST) or update (PUT) operations on the vendor endpoints.
  Future<bool> saveVendor() async {
    if (!_formKey.currentState!.validate()) return false;

    final vendorData = {
      'first_name': firstNameCtrl.text.trim(),
      'last_name': lastNameCtrl.text.trim(),
      'company': companyCtrl.text.trim().isNotEmpty ? companyCtrl.text.trim() : null,
      'address_1': address1Ctrl.text.trim(),
      'address_2': address2Ctrl.text.trim().isNotEmpty ? address2Ctrl.text.trim() : null,
      'city': cityCtrl.text.trim(),
      'country': countryCtrl.text.trim(),
      'phone_1': phone1Ctrl.text.trim(),
      'phone_2': phone2Ctrl.text.trim().isNotEmpty ? phone2Ctrl.text.trim() : null,
      'email': emailCtrl.text.trim(),
      'created_by': editingVendorId == null ? 'System' : null,
    };

    try {
      setState(() => isLoading = true);
      http.Response response;

      if (editingVendorId == null) {
        response = await http.post(
          Uri.parse(AppConfig.vendorsApiUrl),
          headers: {'Content-Type': 'application/json'},
          body: json.encode(vendorData),
        );
      } else {
        response = await http.put(
          Uri.parse('${AppConfig.vendorsApiUrl}/$editingVendorId'),
          headers: {'Content-Type': 'application/json'},
          body: json.encode(vendorData),
        );
      }

      if (response.statusCode == 200 || response.statusCode == 201) {
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

  /// Sets up form controllers for editing a vendor.
  void startEditVendor(Map<String, dynamic> vendor) {
    editingVendorId = vendor['vendor_id'];
    firstNameCtrl.text = vendor['first_name'] ?? '';
    lastNameCtrl.text = vendor['last_name'] ?? '';
    companyCtrl.text = vendor['company'] ?? '';
    address1Ctrl.text = vendor['address_1'] ?? '';
    address2Ctrl.text = vendor['address_2'] ?? '';
    cityCtrl.text = vendor['city'] ?? '';
    countryCtrl.text = vendor['country'] ?? '';
    phone1Ctrl.text = vendor['phone_1'] ?? '';
    phone2Ctrl.text = vendor['phone_2'] ?? '';
    emailCtrl.text = vendor['email'] ?? '';
  }

  /// Deletes a vendor record after confirmation.
  Future<void> deleteVendor(int id) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    bool confirm = await showDialog(
          context: context,
          builder: (context) => AlertDialog(
            backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Text(
              'Confirm Deletion', 
              style: GoogleFonts.inter(fontWeight: FontWeight.bold)
            ),
            content: Text(
              'Are you sure you want to delete this vendor record permanently?',
              style: GoogleFonts.inter()
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(
                  'Cancel', 
                  style: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B))
                ),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEF4444),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: Text('Delete', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ) ??
        false;

    if (!confirm) return;

    try {
      setState(() => isLoading = true);
      final response = await http.delete(Uri.parse('${AppConfig.vendorsApiUrl}/$id'));
      
      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Vendor deleted successfully!', style: GoogleFonts.inter()),
              backgroundColor: const Color(0xFFEF4444),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          );
        }
        if (editingVendorId == id) {
          resetForm();
        }
        fetchVendors();
      } else {
        throw Exception('Failed to delete vendor');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error deleting vendor: ${e.toString()}', style: GoogleFonts.inter()),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
      setState(() => isLoading = false);
    }
  }

  /// Resets the controllers, clearing form inputs.
  void resetForm() {
    editingVendorId = null;
    firstNameCtrl.clear();
    lastNameCtrl.clear();
    companyCtrl.clear();
    address1Ctrl.clear();
    address2Ctrl.clear();
    cityCtrl.clear();
    countryCtrl.clear();
    phone1Ctrl.clear();
    phone2Ctrl.clear();
    emailCtrl.clear();
  }

  /// Displays the modal dialog overlay containing the vendor details form.
  void showFormDialog(BuildContext context, {Map<String, dynamic>? vendorToEdit}) {
    if (vendorToEdit != null) {
      startEditVendor(vendorToEdit);
    } else {
      resetForm();
    }

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final isDark = Theme.of(context).brightness == Brightness.dark;
            final primaryColor = Theme.of(context).primaryColor;
            final double screenWidth = MediaQuery.of(context).size.width;
            final double screenHeight = MediaQuery.of(context).size.height;

            return Dialog(
              backgroundColor: isDark ? const Color(0xFF151D30) : Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
              child: Container(
                width: screenWidth > 800 ? 750 : screenWidth * 0.95,
                constraints: BoxConstraints(
                  maxHeight: screenHeight * 0.85,
                ),
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: primaryColor.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            editingVendorId == null ? Icons.storefront_rounded : Icons.edit_note_rounded,
                            color: primaryColor,
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          editingVendorId == null ? 'Register New Vendor' : 'Edit Vendor Details',
                          style: GoogleFonts.inter(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : const Color(0xFF0F172A),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      editingVendorId == null
                          ? 'Enter information below to register a vendor account.'
                          : 'Modify vendor details and click Update.',
                      style: GoogleFonts.inter(fontSize: 12.5, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                    ),
                    const Divider(height: 24, thickness: 1, color: Color(0xFFF1F5F9)),
                    Expanded(
                      child: SingleChildScrollView(
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildFormSectionHeader(context, 'Vendor Info'),
                              _buildResponsiveRow(
                                width: screenWidth,
                                children: [
                                  _buildTextField(
                                    context: context,
                                    controller: firstNameCtrl,
                                    labelText: 'First Name',
                                    placeholder: 'Enter First Name',
                                    isRequired: true,
                                  ),
                                  _buildTextField(
                                    context: context,
                                    controller: lastNameCtrl,
                                    labelText: 'Last Name',
                                    placeholder: 'Enter Last Name',
                                    isRequired: true,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              _buildResponsiveRow(
                                width: screenWidth,
                                columnCount: 1,
                                children: [
                                  _buildTextField(
                                    context: context,
                                    controller: companyCtrl,
                                    labelText: 'Company Name',
                                    placeholder: 'Enter Company (Optional)',
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),

                              _buildFormSectionHeader(context, 'Address Details'),
                              _buildResponsiveRow(
                                width: screenWidth,
                                children: [
                                  _buildTextField(
                                    context: context,
                                    controller: address1Ctrl,
                                    labelText: 'Address Line 1',
                                    placeholder: 'Address 1',
                                    isRequired: true,
                                  ),
                                  _buildTextField(
                                    context: context,
                                    controller: address2Ctrl,
                                    labelText: 'Address Line 2',
                                    placeholder: 'Address 2',
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              _buildResponsiveRow(
                                width: screenWidth,
                                children: [
                                  _buildTextField(
                                    context: context,
                                    controller: cityCtrl,
                                    labelText: 'City',
                                    placeholder: 'Enter City',
                                    isRequired: true,
                                  ),
                                  _buildTextField(
                                    context: context,
                                    controller: countryCtrl,
                                    labelText: 'Country',
                                    placeholder: 'Enter Country',
                                    isRequired: true,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),

                              _buildFormSectionHeader(context, 'Contact Details'),
                              _buildResponsiveRow(
                                width: screenWidth,
                                children: [
                                  _buildTextField(
                                    context: context,
                                    controller: phone1Ctrl,
                                    labelText: 'Primary Phone',
                                    placeholder: 'Enter Phone 1',
                                    isRequired: true,
                                    keyboardType: TextInputType.phone,
                                    validator: (val) {
                                      if (val == null || val.isEmpty) return 'Primary phone is required';
                                      if (val.trim().length < 8) return 'Enter a valid phone number';
                                      return null;
                                    },
                                  ),
                                  _buildTextField(
                                    context: context,
                                    controller: phone2Ctrl,
                                    labelText: 'Secondary Phone',
                                    placeholder: 'Enter Phone 2',
                                    keyboardType: TextInputType.phone,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              _buildResponsiveRow(
                                width: screenWidth,
                                columnCount: 1,
                                children: [
                                  _buildTextField(
                                    context: context,
                                    controller: emailCtrl,
                                    labelText: 'Email Address',
                                    placeholder: 'Enter Email',
                                    isRequired: true,
                                    keyboardType: TextInputType.emailAddress,
                                    validator: (val) {
                                      if (val == null || val.isEmpty) return 'Email is required';
                                      final emailReg = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
                                      if (!emailReg.hasMatch(val.trim())) return 'Enter a valid email address';
                                      return null;
                                    },
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const Divider(height: 24, thickness: 1, color: Color(0xFFF1F5F9)),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextButton(
                          onPressed: () {
                            resetForm();
                            Navigator.pop(dialogCtx);
                          },
                          child: Text(
                            'Cancel', 
                            style: GoogleFonts.inter(color: const Color(0xFF64748B), fontWeight: FontWeight.w600)
                          ),
                        ),
                        const SizedBox(width: 12),
                        ElevatedButton.icon(
                          onPressed: () async {
                            final success = await saveVendor();
                            if (success && dialogCtx.mounted) {
                              Navigator.pop(dialogCtx);
                              resetForm();
                              fetchVendors();
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    vendorToEdit == null
                                        ? 'Vendor registered successfully!'
                                        : 'Vendor updated successfully!',
                                    style: GoogleFonts.inter(fontWeight: FontWeight.w500),
                                  ),
                                  backgroundColor: const Color(0xFF10B981),
                                  behavior: SnackBarBehavior.floating,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                              );
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: primaryColor,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          icon: Icon(editingVendorId == null ? Icons.save_rounded : Icons.update_rounded, size: 18),
                          label: Text(
                            editingVendorId == null ? 'Save Vendor' : 'Update Vendor',
                            style: GoogleFonts.inter(fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
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
    final isMobile = MediaQuery.of(context).size.width < 750;

    return Scaffold(
      body: isLoading
          ? Center(child: CircularProgressIndicator(color: primaryColor))
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title / Actions Header Bar
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF151D30) : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
                      boxShadow: const [
                        BoxShadow(color: Colors.black12, blurRadius: 6, offset: Offset(0, 2)),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Vendors Master',
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : const Color(0xFF0F172A),
                          ),
                        ),
                        Row(
                          children: [
                            if (canModify)
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: primaryColor,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                ),
                                icon: const Icon(Icons.add_rounded, size: 18),
                                label: Text('New Vendor', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                                onPressed: () => showFormDialog(context),
                              ),
                            if (canModify) const SizedBox(width: 10),
                            IconButton(
                              icon: Icon(Icons.refresh_rounded, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569)),
                              tooltip: 'Refresh Vendors',
                              onPressed: fetchVendors,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Responsive Table or Card Grid
                  Expanded(
                    child: vendors.isEmpty
                        ? Center(
                            child: Text(
                              'No vendors registered yet.',
                              style: GoogleFonts.inter(fontSize: 15, color: const Color(0xFF94A3B8)),
                            ),
                          )
                        : isMobile
                            ? _buildMobileCardList(isDark)
                            : _buildDesktopDataTable(isDark),
                  ),
                ],
              ),
            ),
    );
  }

  // Mobile layout: ListView of premium Cards
  Widget _buildMobileCardList(bool isDark) {
    return ListView.builder(
      itemCount: vendors.length,
      itemBuilder: (ctx, idx) {
        final vendor = vendors[idx];
        final String fullName = '${vendor['first_name'] ?? ''} ${vendor['last_name'] ?? ''}';
        final String address = (vendor['address_2'] != null && vendor['address_2'].toString().trim().isNotEmpty)
            ? '${vendor['address_1']}, ${vendor['address_2']}'
            : '${vendor['address_1'] ?? ''}';

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'ID: ${vendor['vendor_id']}',
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                          color: isDark ? Colors.white70 : const Color(0xFF475569),
                        ),
                      ),
                    ),
                    Text(
                      vendor['phone_1'] ?? 'N/A',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w600,
                        fontSize: 12.5,
                        color: Theme.of(context).primaryColor,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  fullName,
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                  ),
                ),
                if (vendor['company'] != null && vendor['company'].toString().trim().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    vendor['company'],
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                _buildInfoRow(Icons.email_outlined, vendor['email'] ?? 'N/A', isDark),
                const SizedBox(height: 4),
                _buildInfoRow(Icons.location_on_outlined, '$address, ${vendor['city'] ?? ''}, ${vendor['country'] ?? ''}', isDark),
                const SizedBox(height: 12),
                const Divider(height: 1, color: Color(0xFFE2E8F0)),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (canModify) ...[
                      IconButton(
                        icon: const Icon(Icons.edit_rounded, color: Color(0xFF6366F1), size: 20),
                        tooltip: 'Edit Vendor',
                        onPressed: () => showFormDialog(context, vendorToEdit: Map<String, dynamic>.from(vendor)),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_rounded, color: Color(0xFFEF4444), size: 20),
                        tooltip: 'Delete Vendor',
                        onPressed: () => deleteVendor(vendor['vendor_id']),
                      ),
                    ],
                  ],
                )
              ],
            ),
          ),
        );
      },
    );
  }

  // Desktop layout: Styled DataTable
  Widget _buildDesktopDataTable(bool isDark) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: SingleChildScrollView(
          scrollDirection: Axis.vertical,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(
                isDark ? const Color(0xFF1F2937) : const Color(0xFFF8FAFC),
              ),
              headingTextStyle: GoogleFonts.inter(
                fontWeight: FontWeight.bold,
                color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569),
                fontSize: 13,
              ),
              dataTextStyle: GoogleFonts.inter(
                color: isDark ? Colors.white : const Color(0xFF1E293B),
                fontSize: 13.5,
              ),
              dividerThickness: 1,
              columns: [
                DataColumn(label: Text('VEND ID', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Vendor Name', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Company', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Address Details', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('City & Country', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Contact Details', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                if (canModify) DataColumn(label: Text('Actions', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
              ],
              rows: vendors.map<DataRow>((vendor) {
                final String fullName = '${vendor['first_name'] ?? ''} ${vendor['last_name'] ?? ''}';
                final String address = (vendor['address_2'] != null && vendor['address_2'].toString().trim().isNotEmpty)
                    ? '${vendor['address_1']}, ${vendor['address_2']}'
                    : '${vendor['address_1'] ?? ''}';

                return DataRow(cells: [
                  DataCell(
                    Text(
                      vendor['vendor_id'].toString(),
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  DataCell(Text(fullName)),
                  DataCell(Text(vendor['company'] ?? 'N/A')),
                  DataCell(Text(address)),
                  DataCell(Text('${vendor['city'] ?? ''}, ${vendor['country'] ?? ''}')),
                  DataCell(
                    Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(vendor['phone_1'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                        Text(vendor['email'] ?? '', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                      ],
                    ),
                  ),
                  if (canModify)
                    DataCell(
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit_rounded, color: Color(0xFF6366F1), size: 20),
                            tooltip: 'Edit Vendor',
                            onPressed: () => showFormDialog(context, vendorToEdit: Map<String, dynamic>.from(vendor)),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_rounded, color: Color(0xFFEF4444), size: 20),
                            tooltip: 'Delete Vendor',
                            onPressed: () => deleteVendor(vendor['vendor_id']),
                          ),
                        ],
                      ),
                    ),
                ]);
              }).toList(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String text, bool isDark) {
    return Row(
      children: [
        Icon(icon, size: 14, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            style: GoogleFonts.inter(
              fontSize: 12.5,
              color: isDark ? const Color(0xFFCBD5E1) : const Color(0xFF475569),
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _buildFormSectionHeader(BuildContext context, String title) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0, top: 4.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569),
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4),
          const Divider(height: 1, thickness: 1, color: Color(0xFFE2E8F0)),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Widget _buildResponsiveRow({
    required double width,
    required List<Widget> children,
    int columnCount = 2,
  }) {
    if (width < 600) {
      return Column(
        children: children
            .map((c) => Padding(
                  padding: const EdgeInsets.only(bottom: 12.0),
                  child: c,
                ))
            .toList(),
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: List.generate(children.length, (index) {
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(
              right: index == children.length - 1 ? 0 : 16.0,
            ),
            child: children[index],
          ),
        );
      }),
    );
  }

  Widget _buildTextField({
    required BuildContext context,
    required TextEditingController controller,
    required String labelText,
    required String placeholder,
    bool isRequired = false,
    TextInputType keyboardType = TextInputType.text,
    String? Function(String?)? validator,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;

    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      style: GoogleFonts.inter(fontSize: 13.5, color: isDark ? Colors.white : const Color(0xFF0F172A)),
      decoration: InputDecoration(
        labelText: isRequired ? '$labelText *' : labelText,
        labelStyle: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B), fontSize: 13),
        floatingLabelStyle: GoogleFonts.inter(color: primaryColor, fontSize: 12, fontWeight: FontWeight.w600),
        hintText: placeholder,
        hintStyle: GoogleFonts.inter(color: const Color(0xFF94A3B8), fontSize: 13),
        filled: true,
        fillColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0), width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: primaryColor, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.5),
        ),
        errorStyle: GoogleFonts.inter(fontSize: 11, color: const Color(0xFFEF4444)),
      ),
      validator: validator ??
          (val) {
            if (isRequired && (val == null || val.trim().isEmpty)) {
              return '$labelText is required';
            }
            return null;
          },
    );
  }
}
