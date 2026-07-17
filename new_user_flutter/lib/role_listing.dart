import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'config.dart';
import 'api_client.dart';

/// Stateful Role Administration Screen.
/// Renders security roles in a responsive list (cards on mobile < 750, data table on desktop).
/// Styled according to the Indigo-Slate premium styling guide.
class RoleListingScreen extends StatefulWidget {
  final int? roleId;
  final bool canModify;
  const RoleListingScreen({super.key, this.roleId, this.canModify = false});

  @override
  State<RoleListingScreen> createState() => _RoleListingScreenState();
}

class _RoleListingScreenState extends State<RoleListingScreen> {
  final _formKey = GlobalKey<FormState>();

  bool get canModify => widget.canModify;

  List<dynamic> roles = [];
  bool isLoading = true;

  int? editingRoleId;
  final nameCtrl = TextEditingController();
  bool isActive = true;

  @override
  void initState() {
    super.initState();
    fetchRoles();
  }

  @override
  void dispose() {
    nameCtrl.dispose();
    super.dispose();
  }

  /// Reloads the security roles list from the database.
  Future<void> fetchRoles() async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.get(Uri.parse(AppConfig.rolesApiUrl));
      if (response.statusCode == 200) {
        setState(() {
          roles = json.decode(response.body);
          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching roles: $e');
      setState(() => isLoading = false);
    }
  }

  /// Performs creation (POST) or update (PUT) operations on the roles endpoints.
  Future<bool> saveRole() async {
    if (!_formKey.currentState!.validate()) return false;

    final roleData = {
      'name': nameCtrl.text.trim(),
      'active': isActive,
      'created_by': editingRoleId == null ? 'System' : null,
    };

    try {
      setState(() => isLoading = true);
      http.Response response;

      if (editingRoleId == null) {
        response = await ApiClient.post(
          Uri.parse(AppConfig.rolesApiUrl),
          body: json.encode(roleData),
        );
      } else {
        response = await ApiClient.put(
          Uri.parse('${AppConfig.rolesApiUrl}/$editingRoleId'),
          body: json.encode(roleData),
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

  /// Sets up form controllers for editing a role.
  void startEditRole(Map<String, dynamic> role) {
    editingRoleId = role['role_id'];
    nameCtrl.text = role['name'] ?? '';
    isActive = role['active'] == 1 || role['active'] == true;
  }

  /// Removes a role record.
  Future<void> deleteRole(int id) async {
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
              'Are you sure you want to delete this role record permanently?',
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
      final response = await ApiClient.delete(Uri.parse('${AppConfig.rolesApiUrl}/$id'));
      
      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Role deleted successfully!', style: GoogleFonts.inter()),
              backgroundColor: const Color(0xFFEF4444),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          );
        }
        if (editingRoleId == id) {
          resetForm();
        }
        fetchRoles();
      } else {
        throw Exception('Failed to delete role');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error deleting role: ${e.toString()}', style: GoogleFonts.inter()),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
      setState(() => isLoading = false);
    }
  }

  /// Resets the controllers, clearing form inputs.
  void resetForm() {
    editingRoleId = null;
    nameCtrl.clear();
    isActive = true;
  }

  /// Displays the modal dialog overlay containing the security role form.
  void showFormDialog(BuildContext context, {Map<String, dynamic>? roleToEdit}) {
    if (roleToEdit != null) {
      startEditRole(roleToEdit);
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
                width: screenWidth > 600 ? 450 : screenWidth * 0.95,
                constraints: BoxConstraints(
                  maxHeight: screenHeight * 0.75,
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
                            editingRoleId == null ? Icons.add_moderator_rounded : Icons.edit_note_rounded,
                            color: primaryColor,
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          editingRoleId == null ? 'Register New Role' : 'Edit Role Details',
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
                      editingRoleId == null
                          ? 'Enter information below to register a security role.'
                          : 'Modify role details and click Update.',
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
                              TextFormField(
                                controller: nameCtrl,
                                style: GoogleFonts.inter(fontSize: 13.5, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                                decoration: InputDecoration(
                                  labelText: 'Role Name *',
                                  labelStyle: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B), fontSize: 13),
                                  floatingLabelStyle: GoogleFonts.inter(color: primaryColor, fontSize: 12, fontWeight: FontWeight.w600),
                                  hintText: 'e.g. Sales Executive, Inventory Manager',
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
                                validator: (val) {
                                  if (val == null || val.trim().isEmpty) {
                                    return 'Role Name is required';
                                  }
                                  return null;
                                },
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  Checkbox(
                                    value: isActive,
                                    activeColor: primaryColor,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                    onChanged: (bool? val) {
                                      setDialogState(() {
                                        isActive = val ?? true;
                                      });
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
                            final success = await saveRole();
                            if (success && dialogCtx.mounted) {
                              Navigator.pop(dialogCtx);
                              resetForm();
                              fetchRoles();
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    roleToEdit == null
                                        ? 'Role registered successfully!'
                                        : 'Role updated successfully!',
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
                          icon: Icon(editingRoleId == null ? Icons.save_rounded : Icons.update_rounded, size: 18),
                          label: Text(
                            editingRoleId == null ? 'Save Role' : 'Update Role',
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
                    child: Wrap(
                      alignment: WrapAlignment.spaceBetween,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        Text(
                          'Roles Master',
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
                                label: Text('New Role', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                                onPressed: () => showFormDialog(context),
                              ),
                            if (canModify) const SizedBox(width: 10),
                            IconButton(
                              icon: Icon(Icons.refresh_rounded, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569)),
                              tooltip: 'Refresh Roles',
                              onPressed: fetchRoles,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Responsive Table or Card Grid
                  Expanded(
                    child: roles.isEmpty
                        ? Center(
                            child: Text(
                              'No roles registered yet.',
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
      itemCount: roles.length,
      itemBuilder: (ctx, idx) {
        final role = roles[idx];
        final bool activeState = role['active'] == 1 || role['active'] == true;
        final String createdDate = role['created_date'] != null
            ? DateTime.parse(role['created_date'].toString()).toLocal().toString().split(' ')[0]
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
                        'ID: ${role['role_id']}',
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
                        color: activeState ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        activeState ? 'ACTIVE' : 'INACTIVE',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: activeState ? const Color(0xFF065F46) : const Color(0xFF991B1B),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  role['name'] ?? '',
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
                      'Created: $createdDate',
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
                            tooltip: 'Edit Role',
                            onPressed: () => showFormDialog(context, roleToEdit: Map<String, dynamic>.from(role)),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_rounded, color: Color(0xFFEF4444), size: 20),
                            tooltip: 'Delete Role',
                            onPressed: () => deleteRole(role['role_id']),
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
                DataColumn(label: Text('ROLE ID', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Role Name', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Status', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Created Date', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                if (canModify) DataColumn(label: Text('Actions', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
              ],
              rows: roles.map<DataRow>((role) {
                final bool activeState = role['active'] == 1 || role['active'] == true;
                final String createdDate = role['created_date'] != null
                    ? DateTime.parse(role['created_date'].toString()).toLocal().toString().split(' ')[0]
                    : 'N/A';

                return DataRow(cells: [
                  DataCell(
                    Text(
                      role['role_id'].toString(),
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  DataCell(Text(role['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600))),
                  DataCell(
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: activeState ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        activeState ? 'ACTIVE' : 'INACTIVE',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: activeState ? const Color(0xFF065F46) : const Color(0xFF991B1B),
                        ),
                      ),
                    ),
                  ),
                  DataCell(Text(createdDate)),
                  if (canModify)
                    DataCell(
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit_rounded, color: Color(0xFF6366F1), size: 20),
                            tooltip: 'Edit Role',
                            onPressed: () => showFormDialog(context, roleToEdit: Map<String, dynamic>.from(role)),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_rounded, color: Color(0xFFEF4444), size: 20),
                            tooltip: 'Delete Role',
                            onPressed: () => deleteRole(role['role_id']),
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
