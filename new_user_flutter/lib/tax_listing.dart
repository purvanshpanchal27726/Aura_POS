import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'config.dart';

/// Stateful Tax Administration Screen.
/// Renders registered taxes inside responsive layout (card lists on mobile < 750, data table on desktop).
/// Styled according to the Indigo-Slate premium styling guide.
class TaxListingScreen extends StatefulWidget {
  final int? roleId;
  final bool canModify;
  const TaxListingScreen({super.key, this.roleId, this.canModify = false});

  @override
  State<TaxListingScreen> createState() => _TaxListingScreenState();
}

class _TaxListingScreenState extends State<TaxListingScreen> {
  final _formKey = GlobalKey<FormState>();

  bool get canModify => widget.canModify;

  List<dynamic> taxes = [];
  bool isLoading = true;

  int? editingTaxId;
  final nameCtrl = TextEditingController();
  final percentageCtrl = TextEditingController();
  bool isActive = true;

  @override
  void initState() {
    super.initState();
    fetchTaxes();
  }

  @override
  void dispose() {
    nameCtrl.dispose();
    percentageCtrl.dispose();
    super.dispose();
  }

  /// Reloads the tax list from the database.
  Future<void> fetchTaxes() async {
    try {
      setState(() => isLoading = true);
      final response = await http.get(Uri.parse(AppConfig.taxesApiUrl));
      if (response.statusCode == 200) {
        setState(() {
          taxes = json.decode(response.body);
          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching taxes: $e');
      setState(() => isLoading = false);
    }
  }

  /// Performs creation (POST) or update (PUT) operations on the taxes endpoints.
  Future<bool> saveTax() async {
    if (!_formKey.currentState!.validate()) return false;

    final taxData = {
      'name': nameCtrl.text.trim(),
      'percentage': double.tryParse(percentageCtrl.text) ?? 0.0,
      'active': isActive,
      'created_by': editingTaxId == null ? 'System' : null,
    };

    try {
      setState(() => isLoading = true);
      http.Response response;

      if (editingTaxId == null) {
        response = await http.post(
          Uri.parse(AppConfig.taxesApiUrl),
          headers: {'Content-Type': 'application/json'},
          body: json.encode(taxData),
        );
      } else {
        response = await http.put(
          Uri.parse('${AppConfig.taxesApiUrl}/$editingTaxId'),
          headers: {'Content-Type': 'application/json'},
          body: json.encode(taxData),
        );
      }

      if (response.statusCode == 200 || response.statusCode == 201) {
        return true;
      } else {
        final errorBody = json.decode(response.body);
        throw Exception(errorBody['error'] ?? 'Failed to save tax');
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

  /// Deletes the tax with the given [id] after user confirmation.
  Future<void> deleteTax(int id) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Confirm Delete', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
        content: Text('Are you sure you want to delete this tax record?', style: GoogleFonts.inter()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Delete', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      setState(() => isLoading = true);
      final response = await http.delete(Uri.parse('${AppConfig.taxesApiUrl}/$id'));

      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Tax deleted successfully!', style: GoogleFonts.inter()),
              backgroundColor: const Color(0xFFEF4444),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          );
        }
        fetchTaxes();
      } else {
        throw Exception('Failed to delete tax');
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
    }
  }

  /// Resets the form to its initial empty state.
  void _resetForm() {
    editingTaxId = null;
    nameCtrl.clear();
    percentageCtrl.clear();
    isActive = true;
  }

  /// Opens the Add/Edit modal dialog pre-filled for editing [tax], or blank for new entry.
  void _openTaxDialog({Map<String, dynamic>? tax}) {
    if (tax != null) {
      editingTaxId = tax['tax_id'];
      nameCtrl.text = tax['name'] ?? '';
      percentageCtrl.text = tax['percentage'] != null ? tax['percentage'].toString() : '0.00';
      isActive = tax['active'] == true || tax['active'] == 1;
    } else {
      _resetForm();
    }

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          final isDark = Theme.of(context).brightness == Brightness.dark;
          final primaryColor = Theme.of(context).primaryColor;
          final double screenWidth = MediaQuery.of(context).size.width;

          return AlertDialog(
            backgroundColor: isDark ? const Color(0xFF151D30) : Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: primaryColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    tax != null ? Icons.edit_note_rounded : Icons.percent_rounded,
                    color: primaryColor,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  tax != null ? 'Edit Tax Details' : 'Register New Tax',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                    color: isDark ? Colors.white : const Color(0xFF1E293B),
                  ),
                ),
              ],
            ),
            content: SizedBox(
              width: screenWidth > 500 ? 450 : screenWidth * 0.9,
              child: SingleChildScrollView(
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                    Text(
                      'Tax Details',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Tax Name Input
                    TextFormField(
                      controller: nameCtrl,
                      style: GoogleFonts.inter(fontSize: 13.5, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                      decoration: InputDecoration(
                        labelText: 'Tax Name *',
                        labelStyle: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B), fontSize: 13),
                        floatingLabelStyle: GoogleFonts.inter(color: primaryColor, fontSize: 12, fontWeight: FontWeight.w600),
                        prefixIcon: Icon(Icons.description_outlined, color: primaryColor, size: 18),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(color: primaryColor, width: 1.5),
                        ),
                        filled: true,
                        fillColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Please enter a tax name';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Tax Percentage Input
                    TextFormField(
                      controller: percentageCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: GoogleFonts.inter(fontSize: 13.5, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                      decoration: InputDecoration(
                        labelText: 'Tax Percentage (%) *',
                        labelStyle: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B), fontSize: 13),
                        floatingLabelStyle: GoogleFonts.inter(color: primaryColor, fontSize: 12, fontWeight: FontWeight.w600),
                        prefixIcon: Icon(Icons.calculate_outlined, color: primaryColor, size: 18),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: BorderSide(color: primaryColor, width: 1.5),
                        ),
                        filled: true,
                        fillColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Please enter tax percentage';
                        }
                        if (double.tryParse(val) == null) {
                          return 'Enter a valid decimal number';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Active Status Checkbox
                    Row(
                      children: [
                        Checkbox(
                          value: isActive,
                          activeColor: primaryColor,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                          onChanged: (val) {
                            setDialogState(() => isActive = val ?? true);
                          },
                        ),
                        Text(
                          'Is Active',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: isDark ? Colors.white : const Color(0xFF1E293B),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  _resetForm();
                },
                child: Text(
                  'Cancel',
                  style: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B), fontWeight: FontWeight.w600),
                ),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  elevation: 0,
                ),
                onPressed: () async {
                  final success = await saveTax();
                  if (success && ctx.mounted) {
                    Navigator.pop(ctx);
                    _resetForm();
                    fetchTaxes();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          'Tax ${editingTaxId == null ? "registered" : "updated"} successfully!',
                          style: GoogleFonts.inter(fontWeight: FontWeight.w500),
                        ),
                        backgroundColor: const Color(0xFF16A34A),
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    );
                  }
                },
                child: Text(tax != null ? 'Update Tax' : 'Save Tax', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
              ),
            ],
          );
        },
      ),
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
                  // Header card with title and action buttons
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF151D30) : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x0A000000),
                          blurRadius: 6,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Wrap(
                      alignment: WrapAlignment.spaceBetween,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        Text(
                          'Taxes Master',
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : const Color(0xFF1E293B),
                          ),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (canModify)
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: primaryColor,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(10)),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 16, vertical: 10),
                                ),
                                icon: const Icon(Icons.add_rounded, size: 18),
                                label: Text('New Tax', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                                onPressed: () => _openTaxDialog(),
                              ),
                            if (canModify) const SizedBox(width: 8),
                            IconButton(
                              icon: Icon(Icons.refresh_rounded, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                              tooltip: 'Refresh Taxes',
                              onPressed: fetchTaxes,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Responsive Table or Card Grid
                  Expanded(
                    child: taxes.isEmpty
                        ? Center(
                            child: Text(
                              'No taxes registered yet.',
                              style: GoogleFonts.inter(
                                fontSize: 15,
                                color: const Color(0xFF94A3B8),
                              ),
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
      itemCount: taxes.length,
      itemBuilder: (ctx, idx) {
        final tax = taxes[idx];
        final isActive = tax['active'] == true || tax['active'] == 1;
        final createdDate = tax['created_date'] != null
            ? DateTime.tryParse(tax['created_date'].toString())
            : null;
        final dateStr = createdDate != null
            ? '${createdDate.day}/${createdDate.month}/${createdDate.year}'
            : 'N/A';

        final double percentage = double.tryParse(tax['percentage']?.toString() ?? '0.0') ?? 0.0;

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
                        'ID: ${tax['tax_id']}',
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                          color: isDark ? Colors.white70 : const Color(0xFF475569),
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: isActive ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        isActive ? 'Active' : 'Inactive',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: isActive ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  tax['name'] ?? '',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Rate: ${percentage.toStringAsFixed(2)}%',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                    color: Theme.of(context).primaryColor,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Created: $dateStr',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                      ),
                    ),
                    if (canModify)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit_rounded, color: Color(0xFF6366F1), size: 20),
                            tooltip: 'Edit Tax',
                            onPressed: () => _openTaxDialog(tax: Map<String, dynamic>.from(tax)),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_rounded, color: Color(0xFFEF4444), size: 20),
                            tooltip: 'Delete Tax',
                            onPressed: () => deleteTax(tax['tax_id']),
                          ),
                        ],
                      ),
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
                DataColumn(
                  label: Text('TAX ID', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                ),
                DataColumn(label: Text('Tax Name', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Percentage', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Status', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Created Date', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                if (canModify) DataColumn(label: Text('Actions', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
              ],
              rows: taxes.map<DataRow>((tax) {
                final isActive = tax['active'] == true || tax['active'] == 1;
                final createdDate = tax['created_date'] != null
                    ? DateTime.tryParse(tax['created_date'].toString())
                    : null;
                final dateStr = createdDate != null
                    ? '${createdDate.day}/${createdDate.month}/${createdDate.year}'
                    : 'N/A';

                final double percentage = double.tryParse(tax['percentage']?.toString() ?? '0.0') ?? 0.0;

                return DataRow(cells: [
                  DataCell(
                    Text(
                      tax['tax_id'].toString(),
                      style: GoogleFonts.inter(fontWeight: FontWeight.bold),
                    ),
                  ),
                  DataCell(Text(tax['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600))),
                  DataCell(Text('${percentage.toStringAsFixed(2)}%')),
                  DataCell(
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: isActive ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        isActive ? 'Active' : 'Inactive',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isActive ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                        ),
                      ),
                    ),
                  ),
                  DataCell(Text(dateStr)),
                  if (canModify)
                    DataCell(
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit_rounded, color: Color(0xFF6366F1), size: 20),
                            tooltip: 'Edit Tax',
                            onPressed: () => _openTaxDialog(tax: Map<String, dynamic>.from(tax)),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_rounded, color: Color(0xFFEF4444), size: 20),
                            tooltip: 'Delete Tax',
                            onPressed: () => deleteTax(tax['tax_id']),
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
}
