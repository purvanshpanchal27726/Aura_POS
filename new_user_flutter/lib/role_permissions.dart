import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'config.dart';

/// Stateful Rolewise Permissions configuration screen.
/// Loads the current role-permission mapping matrix and supports bulk updates (PUT).
class RolewisePermissionsScreen extends StatefulWidget {
  final VoidCallback onSaved;
  const RolewisePermissionsScreen({super.key, required this.onSaved});

  @override
  State<RolewisePermissionsScreen> createState() => _RolewisePermissionsScreenState();
}

class _RolewisePermissionsScreenState extends State<RolewisePermissionsScreen> {
  bool isLoading = true;

  List<dynamic> roles = [];
  List<dynamic> modules = [];
  List<Map<String, dynamic>> permissions = [];

  @override
  void initState() {
    super.initState();
    loadPermissionsMatrix();
  }

  /// Fetches current matrix roles, modules, and role_permissions configuration.
  Future<void> loadPermissionsMatrix() async {
    try {
      setState(() => isLoading = true);
      final response = await http.get(Uri.parse(AppConfig.permissionsApiUrl));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        setState(() {
          roles = data['roles'] ?? [];
          modules = data['modules'] ?? [];
          
          final rawPerms = data['permissions'] as List<dynamic>? ?? [];
          permissions = rawPerms.map((p) => Map<String, dynamic>.from(p)).toList();
          
          isLoading = false;
        });
      } else {
        throw Exception('Failed to load permissions configuration');
      }
    } catch (e) {
      debugPrint('Error loading permissions: $e');
      setState(() => isLoading = false);
    }
  }

  bool _isAllowed(int roleId, int moduleId) {
    final mapping = permissions.firstWhere(
      (p) => p['role_id'] == roleId && p['module_id'] == moduleId,
      orElse: () => {},
    );
    return mapping.isNotEmpty && (mapping['allowed'] == 1 || mapping['allowed'] == true);
  }

  void _togglePermission(int roleId, int moduleId, bool isChecked) {
    final idx = permissions.indexWhere((p) => p['role_id'] == roleId && p['module_id'] == moduleId);
    setState(() {
      if (idx != -1) {
        permissions[idx]['allowed'] = isChecked ? 1 : 0;
      } else {
        permissions.add({
          'role_id': roleId,
          'module_id': moduleId,
          'allowed': isChecked ? 1 : 0,
        });
      }
    });
  }

  /// Bulk updates the permission matrix configuration.
  Future<void> savePermissionsMatrix() async {
    try {
      setState(() => isLoading = true);
      
      final payload = permissions.map((p) => {
        'role_id': p['role_id'],
        'module_id': p['module_id'],
        'allowed': (p['allowed'] == 1 || p['allowed'] == true) ? 1 : 0,
      }).toList();

      final response = await http.put(
        Uri.parse(AppConfig.permissionsApiUrl),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(payload),
      );

      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Permissions matrix updated successfully!'),
              backgroundColor: Color(0xFF10B981),
            ),
          );
        }
        widget.onSaved();
        loadPermissionsMatrix();
      } else {
        final err = json.decode(response.body);
        throw Exception(err['error'] ?? 'Server failed to update permissions matrix');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error saving: ${e.toString()}'),
            backgroundColor: Color(0xFFEF4444),
          ),
        );
      }
      setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      
      body: isLoading
          ? Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : Padding(
              padding: EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title / Actions header
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                    decoration: BoxDecoration(
                      color: Theme.of(context).cardColor,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Color(0xFFE2E8F0)),
                      boxShadow: [
                        BoxShadow(color: Color(0x0A000000), blurRadius: 6, offset: Offset(0, 2)),
                      ],
                    ),
                    child: Wrap(
                      alignment: WrapAlignment.spaceBetween,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        Text(
                          'Rolewise Module Settings',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Theme.of(context).brightness == Brightness.dark ? Colors.white : Color(0xFF1E293B)),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF2563EB),
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              ),
                              icon: const Icon(Icons.save, size: 18),
                              label: const Text('Save Settings'),
                              onPressed: savePermissionsMatrix,
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              icon: Icon(Icons.sync, color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                              tooltip: 'Refresh Matrix Data',
                              onPressed: loadPermissionsMatrix,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // General application setting card
                  Card(
                    margin: const EdgeInsets.only(bottom: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Row(
                        children: [
                          Icon(Icons.restaurant_rounded, color: Theme.of(context).primaryColor, size: 28),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Restaurant POS Mode',
                                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Hides purchase price configuration, purchase bills entry, and cost metrics in reports.',
                                  style: TextStyle(fontSize: 12, color: Theme.of(context).brightness == Brightness.dark ? Colors.white60 : Colors.black54),
                                ),
                              ],
                            ),
                          ),
                          Switch(
                            value: AppConfig.isRestaurantMode,
                            activeThumbColor: const Color(0xFF2563EB),
                            onChanged: (val) async {
                              await AppConfig.setRestaurantMode(val);
                              if (!context.mounted) return;
                              setState(() {});
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(val ? 'Restaurant mode activated.' : 'Retail mode activated.'),
                                  backgroundColor: const Color(0xFF2563EB),
                                  duration: const Duration(seconds: 2),
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Permission table
                  Expanded(
                    child: Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Theme.of(context).cardColor,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(color: Color(0x0A000000), blurRadius: 6, offset: Offset(0, 2)),
                        ],
                      ),
                      child: roles.isEmpty || modules.isEmpty
                          ? Center(
                              child: Text(
                                'No configuration files found in database.',
                                style: TextStyle(fontSize: 15, color: Color(0xFF94A3B8)),
                              ),
                            )
                          : SingleChildScrollView(
                              scrollDirection: Axis.vertical,
                              child: SingleChildScrollView(
                                scrollDirection: Axis.horizontal,
                                child: DataTable(
                                  headingRowColor: WidgetStateProperty.all(Theme.of(context).brightness == Brightness.dark ? Color(0xFF1E293B) : Color(0xFFF8FAFC)),
                                  headingTextStyle: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: Theme.of(context).brightness == Brightness.dark ? Color(0xFF94A3B8) : Color(0xFF475569),
                                    fontSize: 13,
                                  ),
                                  dividerThickness: 1,
                                  columns: [
                                    DataColumn(label: SizedBox(width: 120, child: Text('Role Name'))),
                                    ...modules.map((m) {
                                      // Human friendly names matching web
                                      String mName = m['name'] ?? '';
                                      if (mName == 'User') mName = 'User Master';
                                      if (mName == 'Customer') mName = 'Customer Master';
                                      if (mName == 'Item') mName = 'Item Master';
                                      if (mName == 'Sales') mName = 'Sales (Sell)';
                                      return DataColumn(
                                        label: SizedBox(width: 110, child: Center(child: Text(mName))),
                                      );
                                    }),
                                  ],
                                  rows: roles.map<DataRow>((role) {
                                    final roleId = role['role_id'] as int;
                                    final roleName = role['name'] ?? '';

                                    return DataRow(
                                      cells: [
                                        DataCell(SizedBox(
                                          width: 120,
                                          child: Text(
                                            roleName,
                                            style: const TextStyle(fontWeight: FontWeight.bold),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        )),
                                        ...modules.map((mod) {
                                          final moduleId = mod['module_id'] as int;
                                          final isAllowed = _isAllowed(roleId, moduleId);
                                          return DataCell(
                                            SizedBox(
                                              width: 110,
                                              child: Center(
                                                child: Checkbox(
                                                  value: isAllowed,
                                                  activeColor: const Color(0xFF2563EB),
                                                  onChanged: (val) {
                                                    _togglePermission(roleId, moduleId, val ?? false);
                                                  },
                                                ),
                                              ),
                                            ),
                                          );
                                        }),
                                      ],
                                    );
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
