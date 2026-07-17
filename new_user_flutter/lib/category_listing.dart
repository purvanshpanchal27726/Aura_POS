import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'config.dart';
import 'api_client.dart';

class CategoryListingScreen extends StatefulWidget {
  final int? roleId;
  final bool canModify;
  const CategoryListingScreen({super.key, this.roleId, this.canModify = false});

  @override
  State<CategoryListingScreen> createState() => _CategoryListingScreenState();
}

class _CategoryListingScreenState extends State<CategoryListingScreen> {
  final _formKey = GlobalKey<FormState>();

  bool get canModify => widget.canModify;

  List<dynamic> categories = [];
  bool isLoading = true;

  int? editingCategoryId;
  final TextEditingController nameCtrl = TextEditingController();
  bool isActive = true;

  @override
  void initState() {
    super.initState();
    fetchCategories();
  }

  @override
  void dispose() {
    nameCtrl.dispose();
    super.dispose();
  }

  Future<void> fetchCategories() async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse(AppConfig.categoriesApiUrl));
      if (response.statusCode == 200) {
        setState(() {
          categories = json.decode(response.body);
          isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error fetching categories: $e');
      setState(() => isLoading = false);
    }
  }

  Future<bool> saveCategory() async {
    if (!_formKey.currentState!.validate()) return false;

    final name = nameCtrl.text.trim();
    final nameLower = name.toLowerCase();
    final isDuplicate = categories.any((cat) =>
        cat['name'].toString().trim().toLowerCase() == nameLower &&
        cat['category_id'] != editingCategoryId);
    if (isDuplicate) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'This category is already added.',
              style: GoogleFonts.inter(fontWeight: FontWeight.w500),
            ),
            backgroundColor: const Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        );
      }
      return false;
    }

    final categoryData = {
      'name': name,
      'active': isActive,
      'created_by': editingCategoryId == null ? 'System' : null,
    };

    try {
      setState(() => isLoading = true);
      http.Response response;

      if (editingCategoryId == null) {
        response = await ApiClient.post(
          Uri.parse(AppConfig.categoriesApiUrl),
          body: json.encode(categoryData),
        );
      } else {
        response = await ApiClient.put(
          Uri.parse('${AppConfig.categoriesApiUrl}/$editingCategoryId'),
          body: json.encode(categoryData),
        );
      }

      if (response.statusCode == 200 || response.statusCode == 201) {
        return true;
      } else {
        final errorBody = json.decode(response.body);
        throw Exception(errorBody['error'] ?? 'Failed to save category');
      }
    } catch (e) {
      if (mounted) {
        final errorMsg = e.toString().replaceFirst('Exception: ', '').replaceFirst('Error: ', '');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              errorMsg,
              style: GoogleFonts.inter(fontWeight: FontWeight.w500),
            ),
            backgroundColor: const Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        );
      }
      setState(() => isLoading = false);
      return false;
    }
  }

  Future<void> deleteCategory(int id) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Confirm Delete',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold),
        ),
        content: Text(
          'Are you sure you want to delete this category?',
          style: GoogleFonts.inter(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: GoogleFonts.inter(color: const Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
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
      final response = await ApiClient.delete(
        Uri.parse('${AppConfig.categoriesApiUrl}/$id'),
      );

      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Category deleted successfully!', style: GoogleFonts.inter()),
              backgroundColor: const Color(0xFF10B981),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          );
        }
        fetchCategories();
      } else {
        throw Exception('Failed to delete category');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
      setState(() => isLoading = false);
    }
  }

  void _resetForm() {
    editingCategoryId = null;
    nameCtrl.clear();
    isActive = true;
  }

  void _openCategoryDialog({Map<String, dynamic>? category}) {
    if (category != null) {
      editingCategoryId = category['category_id'];
      nameCtrl.text = category['name'] ?? '';
      isActive = category['active'] == true || category['active'] == 1;
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
                  child: Icon(Icons.category_rounded, color: primaryColor, size: 20),
                ),
                const SizedBox(width: 12),
                Text(
                  category != null ? 'Edit Category' : 'New Category',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
            content: SizedBox(
              width: 380,
              child: SingleChildScrollView(
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                    Text(
                      'Provide a unique name for this category segment.',
                      style: GoogleFonts.inter(
                        fontSize: 12.5,
                        color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Category Name Input
                    TextFormField(
                      controller: nameCtrl,
                      style: GoogleFonts.inter(color: isDark ? Colors.white : const Color(0xFF0F172A)),
                      decoration: InputDecoration(
                        labelText: 'Category Name *',
                        labelStyle: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: primaryColor, width: 2),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Please enter a category name';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Active Status Checkbox
                    CheckboxListTile(
                      title: Text(
                        'Is Active',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: isDark ? Colors.white : const Color(0xFF0F172A),
                        ),
                      ),
                      value: isActive,
                      activeColor: primaryColor,
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      onChanged: (val) {
                        setDialogState(() => isActive = val ?? true);
                      },
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
                  style: GoogleFonts.inter(color: const Color(0xFF64748B), fontWeight: FontWeight.w600),
                ),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                ),
                onPressed: () async {
                  final success = await saveCategory();
                  if (success && ctx.mounted) {
                    Navigator.pop(ctx);
                    _resetForm();
                    fetchCategories();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          'Category saved successfully!', 
                          style: GoogleFonts.inter(fontWeight: FontWeight.w500),
                        ),
                        backgroundColor: const Color(0xFF10B981),
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    );
                  }
                },
                child: Text(
                  category != null ? 'Update' : 'Save Category',
                  style: GoogleFonts.inter(fontWeight: FontWeight.bold),
                ),
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
                    child: Wrap(
                      alignment: WrapAlignment.spaceBetween,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        Text(
                          'Category Master',
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : const Color(0xFF0F172A),
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
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                ),
                                icon: const Icon(Icons.add_rounded, size: 18),
                                label: Text('Add Category', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                                onPressed: () => _openCategoryDialog(),
                              ),
                            if (canModify) const SizedBox(width: 10),
                            IconButton(
                              icon: Icon(Icons.refresh_rounded, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569)),
                              tooltip: 'Refresh Categories',
                              onPressed: fetchCategories,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Responsive Table or Card Grid
                  Expanded(
                    child: categories.isEmpty
                        ? Center(
                            child: Text(
                              'No categories registered yet.',
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
      itemCount: categories.length,
      itemBuilder: (ctx, idx) {
        final category = categories[idx];
        final isActive = category['active'] == true || category['active'] == 1;
        final createdDate = category['created_date'] != null
            ? DateTime.tryParse(category['created_date'].toString())
            : null;
        final dateStr = createdDate != null
            ? '${createdDate.day}/${createdDate.month}/${createdDate.year}'
            : 'N/A';

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
                        'ID: ${category['category_id']}',
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                          color: isDark ? Colors.white70 : const Color(0xFF475569),
                        ),
                      ),
                    ),
                    _buildStatusBadge(isActive),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  category['name'] ?? '',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 8),
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
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit_rounded, color: Color(0xFF6366F1), size: 20),
                            onPressed: () => _openCategoryDialog(category: Map<String, dynamic>.from(category)),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_rounded, color: Color(0xFFEF4444), size: 20),
                            onPressed: () => deleteCategory(category['category_id']),
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
              DataColumn(label: Text('CAT ID', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
              DataColumn(label: Text('Category Name', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
              DataColumn(label: Text('Status', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
              DataColumn(label: Text('Created Date', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
              if (canModify) DataColumn(label: Text('Actions', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
            ],
            rows: categories.map<DataRow>((category) {
              final isActive = category['active'] == true || category['active'] == 1;
              final createdDate = category['created_date'] != null
                  ? DateTime.tryParse(category['created_date'].toString())
                  : null;
              final dateStr = createdDate != null
                  ? '${createdDate.day}/${createdDate.month}/${createdDate.year}'
                  : 'N/A';

              return DataRow(cells: [
                DataCell(
                  Text(
                    category['category_id'].toString(),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                DataCell(Text(category['name'] ?? '')),
                DataCell(_buildStatusBadge(isActive)),
                DataCell(Text(dateStr)),
                if (canModify)
                  DataCell(
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.edit_rounded, color: Color(0xFF6366F1), size: 20),
                          tooltip: 'Edit Category',
                          onPressed: () => _openCategoryDialog(category: Map<String, dynamic>.from(category)),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_rounded, color: Color(0xFFEF4444), size: 20),
                          tooltip: 'Delete Category',
                          onPressed: () => deleteCategory(category['category_id']),
                        ),
                      ],
                    ),
                  ),
              ]);
            }).toList(),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(bool isActive) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isActive ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        isActive ? 'Active' : 'Inactive',
        style: GoogleFonts.inter(
          fontSize: 11.5,
          fontWeight: FontWeight.w600,
          color: isActive ? const Color(0xFF15803D) : const Color(0xFFB91C1C),
        ),
      ),
    );
  }
}
