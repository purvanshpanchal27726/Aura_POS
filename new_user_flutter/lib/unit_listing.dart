import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'config.dart';
import 'api_client.dart';

class UnitListingScreen extends StatefulWidget {
  final int? roleId;
  final bool canModify;
  const UnitListingScreen({super.key, this.roleId, this.canModify = false});

  @override
  State<UnitListingScreen> createState() => _UnitListingScreenState();
}

class _UnitListingScreenState extends State<UnitListingScreen> {
  final _formKey = GlobalKey<FormState>();

  bool get canModify => widget.canModify;

  List<dynamic> units = [];
  List<dynamic> filteredUnits = [];
  bool isLoading = true;
  String searchQuery = '';

  int? editingUnitId;
  final nameCtrl = TextEditingController();
  bool isActive = true;

  @override
  void initState() {
    super.initState();
    fetchUnits();
  }

  @override
  void dispose() {
    nameCtrl.dispose();
    super.dispose();
  }

  Future<void> fetchUnits() async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse(AppConfig.unitsApiUrl));
      if (response.statusCode == 200) {
        final List<dynamic> loaded = json.decode(response.body);
        setState(() {
          units = loaded;
          _filterUnits();
          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching units: $e');
      setState(() => isLoading = false);
    }
  }

  void _filterUnits() {
    if (searchQuery.trim().isEmpty) {
      filteredUnits = List.from(units);
    } else {
      final q = searchQuery.trim().toLowerCase();
      filteredUnits = units.where((u) {
        final name = (u['name'] ?? '').toString().toLowerCase();
        final id = (u['unit_id'] ?? '').toString();
        return name.contains(q) || id.contains(q);
      }).toList();
    }
  }

  Future<bool> saveUnit() async {
    if (!_formKey.currentState!.validate()) return false;

    final nameVal = nameCtrl.text.trim().toLowerCase();
    final isDuplicate = units.any((u) =>
        u['unit_id'] != editingUnitId &&
        (u['name'] ?? '').toString().trim().toLowerCase() == nameVal);

    if (isDuplicate) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('This unit is already added.'),
            backgroundColor: Color(0xFFDC2626),
          ),
        );
      }
      return false;
    }

    final unitData = {
      'name': nameCtrl.text.trim(),
      'active': isActive,
      'created_by': editingUnitId == null ? 'System' : null,
    };

    try {
      setState(() => isLoading = true);
      http.Response response;

      if (editingUnitId == null) {
        response = await ApiClient.post(
          Uri.parse(AppConfig.unitsApiUrl),
          body: json.encode(unitData),
        );
      } else {
        response = await ApiClient.put(
          Uri.parse('${AppConfig.unitsApiUrl}/$editingUnitId'),
          body: json.encode(unitData),
        );
      }

      if (response.statusCode == 200 || response.statusCode == 201) {
        await fetchUnits();
        return true;
      } else {
        final err = json.decode(response.body);
        throw Exception(err['error'] ?? 'Server returned error');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error saving unit: ${e.toString()}', style: GoogleFonts.inter()),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
      setState(() => isLoading = false);
      return false;
    }
  }

  void startEditUnit(Map<String, dynamic> unit) {
    editingUnitId = unit['unit_id'] as int;
    nameCtrl.text = unit['name'] ?? '';
    isActive = unit['active'] == 1 || unit['active'] == true;
  }

  Future<void> deleteUnit(int id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Theme.of(context).cardColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444)),
            const SizedBox(width: 8),
            Text('Confirm Delete', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
          ],
        ),
        content: Text(
          'Are you sure you want to delete this unit? This action cannot be undone.',
          style: GoogleFonts.inter(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: GoogleFonts.inter(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Delete', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      setState(() => isLoading = true);
      final response = await ApiClient.delete(Uri.parse('${AppConfig.unitsApiUrl}/$id'));
      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Unit deleted successfully!', style: GoogleFonts.inter()),
              backgroundColor: const Color(0xFFEF4444),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          );
        }
        if (editingUnitId == id) resetForm();
        fetchUnits();
      } else {
        throw Exception('Failed to delete unit');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error deleting unit: ${e.toString()}', style: GoogleFonts.inter()),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
      setState(() => isLoading = false);
    }
  }

  void resetForm() {
    editingUnitId = null;
    nameCtrl.clear();
    isActive = true;
  }

  void showFormDialog(BuildContext context, {Map<String, dynamic>? unitToEdit}) {
    if (unitToEdit != null) {
      startEditUnit(unitToEdit);
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

            return Dialog(
              backgroundColor: isDark ? const Color(0xFF151D30) : Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              child: Container(
                width: 450,
                padding: const EdgeInsets.all(24.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: primaryColor.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(
                              editingUnitId == null ? Icons.straighten_rounded : Icons.edit_note_rounded,
                              color: primaryColor,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            editingUnitId == null ? 'Register New Unit' : 'Edit Unit Details',
                            style: GoogleFonts.outfit(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : const Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      TextFormField(
                        controller: nameCtrl,
                        decoration: InputDecoration(
                          labelText: 'Unit Name *',
                          hintText: 'e.g. Kilograms, Litres, Pieces',
                          prefixIcon: const Icon(Icons.straighten_rounded, color: Color(0xFF2563EB)),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          filled: true,
                          fillColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                        ),
                        validator: (val) => val == null || val.trim().isEmpty ? 'Unit Name is required' : null,
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Checkbox(
                            value: isActive,
                            activeColor: primaryColor,
                            onChanged: (val) => setDialogState(() => isActive = val ?? true),
                          ),
                          Text(
                            'Active Unit Status',
                            style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            onPressed: () => Navigator.pop(dialogCtx),
                            child: Text('Cancel', style: GoogleFonts.inter(color: Colors.grey, fontWeight: FontWeight.bold)),
                          ),
                          const SizedBox(width: 12),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: primaryColor,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                            ),
                            icon: const Icon(Icons.save_rounded, size: 16),
                            label: Text(editingUnitId == null ? 'Save Unit' : 'Update Unit', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                            onPressed: () async {
                              final ok = await saveUnit();
                              if (ok && dialogCtx.mounted) Navigator.pop(dialogCtx);
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
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

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0B0F19) : const Color(0xFFF8FAFC),
      body: isLoading
          ? Center(child: CircularProgressIndicator(color: primaryColor))
          : Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top Header Card with Title, Search Bar, and Add Unit Action Button
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF151D30) : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.03),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  'Units Master',
                                  style: GoogleFonts.outfit(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w800,
                                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: primaryColor.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    '${filteredUnits.length} Total',
                                    style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: primaryColor),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Configure package measurement units (Kg, Ltr, Pcs, Pkt) for inventory items',
                              style: GoogleFonts.inter(fontSize: 12, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            SizedBox(
                              width: 240,
                              height: 42,
                              child: TextField(
                                onChanged: (val) {
                                  setState(() {
                                    searchQuery = val;
                                    _filterUnits();
                                  });
                                },
                                decoration: InputDecoration(
                                  hintText: 'Search units...',
                                  prefixIcon: const Icon(Icons.search_rounded, size: 18, color: Color(0xFF64748B)),
                                  contentPadding: const EdgeInsets.symmetric(vertical: 8),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                  filled: true,
                                  fillColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            if (canModify)
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: primaryColor,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                                ),
                                icon: const Icon(Icons.add_rounded, size: 18),
                                label: Text('+ New Unit', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                                onPressed: () => showFormDialog(context),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Enhanced Data Table Card Container
                  Expanded(
                    child: Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF151D30) : Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
                      ),
                      child: filteredUnits.isEmpty
                          ? Center(
                              child: Text(
                                'No matching units found.',
                                style: GoogleFonts.inter(fontSize: 14, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                              ),
                            )
                          : ClipRRect(
                              borderRadius: BorderRadius.circular(16),
                              child: SingleChildScrollView(
                                padding: const EdgeInsets.all(8),
                                child: DataTable(
                                  columnSpacing: 48,
                                  headingRowColor: WidgetStateProperty.all(
                                    isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                                  ),
                                  headingTextStyle: GoogleFonts.outfit(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569),
                                  ),
                                  columns: [
                                    const DataColumn(label: Text('UNIT ID')),
                                    const DataColumn(label: Text('UNIT NAME')),
                                    const DataColumn(label: Text('STATUS')),
                                    const DataColumn(label: Text('CREATED DATE')),
                                    if (canModify) const DataColumn(label: Text('ACTIONS')),
                                  ],
                                  rows: filteredUnits.map<DataRow>((u) {
                                    final bool activeState = u['active'] == 1 || u['active'] == true;
                                    final String cDate = u['created_date'] != null
                                        ? DateTime.parse(u['created_date'].toString()).toLocal().toString().split(' ')[0]
                                        : '2026-08-10';

                                    return DataRow(cells: [
                                      DataCell(
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text('#${u['unit_id']}', style: GoogleFonts.spaceMono(fontWeight: FontWeight.bold, fontSize: 12)),
                                        ),
                                      ),
                                      DataCell(Text(u['name'] ?? '', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13.5))),
                                      DataCell(
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: activeState ? const Color(0xFF10B981).withValues(alpha: 0.15) : const Color(0xFFEF4444).withValues(alpha: 0.15),
                                            borderRadius: BorderRadius.circular(20),
                                          ),
                                          child: Text(
                                            activeState ? 'ACTIVE' : 'INACTIVE',
                                            style: GoogleFonts.inter(
                                              fontSize: 10.5,
                                              fontWeight: FontWeight.bold,
                                              color: activeState ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                                            ),
                                          ),
                                        ),
                                      ),
                                      DataCell(Text(cDate, style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)))),
                                      if (canModify)
                                        DataCell(
                                          Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              IconButton(
                                                icon: const Icon(Icons.edit_rounded, color: Color(0xFF2563EB), size: 18),
                                                tooltip: 'Edit Unit',
                                                onPressed: () => showFormDialog(context, unitToEdit: Map<String, dynamic>.from(u)),
                                              ),
                                              IconButton(
                                                icon: const Icon(Icons.delete_rounded, color: Color(0xFFEF4444), size: 18),
                                                tooltip: 'Delete Unit',
                                                onPressed: () => deleteUnit(u['unit_id']),
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
                  ),
                ],
              ),
            ),
    );
  }
}
