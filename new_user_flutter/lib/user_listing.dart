import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'config.dart';
import 'api_client.dart';

/// Stateful User Administration Screen.
/// Renders registered system users in a responsive layout (card lists on mobile < 750, data table on desktop).
/// Styled according to the Indigo-Slate premium styling guide.
class UserListingScreen extends StatefulWidget {
  final int? roleId;
  final bool canModify;
  const UserListingScreen({super.key, this.roleId, this.canModify = false});

  @override
  State<UserListingScreen> createState() => _UserListingScreenState();
}

class _UserListingScreenState extends State<UserListingScreen> {
  final _formKey = GlobalKey<FormState>();

  bool get canModify => widget.canModify;

  List<dynamic> users = [];
  List<dynamic> roles = [];
  bool isLoading = true;

  int? editingUserId;
  int? selectedRoleId;
  bool isObscurePassword = true;

  final usernameCtrl = TextEditingController();
  final passwordCtrl = TextEditingController();
  final firstNameCtrl = TextEditingController();
  final middleNameCtrl = TextEditingController();
  final lastNameCtrl = TextEditingController();
  final address1Ctrl = TextEditingController();
  final address2Ctrl = TextEditingController();
  final address3Ctrl = TextEditingController();
  final cityCtrl = TextEditingController();
  final countryCtrl = TextEditingController();
  final phone1Ctrl = TextEditingController();
  final phone2Ctrl = TextEditingController();
  final email1Ctrl = TextEditingController();
  final email2Ctrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    fetchUsers();
  }

  @override
  void dispose() {
    usernameCtrl.dispose();
    passwordCtrl.dispose();
    firstNameCtrl.dispose();
    middleNameCtrl.dispose();
    lastNameCtrl.dispose();
    address1Ctrl.dispose();
    address2Ctrl.dispose();
    address3Ctrl.dispose();
    cityCtrl.dispose();
    countryCtrl.dispose();
    phone1Ctrl.dispose();
    phone2Ctrl.dispose();
    email1Ctrl.dispose();
    email2Ctrl.dispose();
    super.dispose();
  }

  /// Refreshes the user list and roles from the backend database.
  Future<void> fetchUsers() async {
    try {
      setState(() => isLoading = true);
      final responses = await Future.wait([
        ApiClient.get(Uri.parse(AppConfig.usersApiUrl)),
        ApiClient.get(Uri.parse(AppConfig.rolesApiUrl)),
      ]);
      if (responses[0].statusCode == 200 && responses[1].statusCode == 200) {
        setState(() {
          users = json.decode(responses[0].body);
          roles = json.decode(responses[1].body);
          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error fetching users or roles: $e');
      setState(() => isLoading = false);
    }
  }

  /// Sends a creation (POST) or modification (PUT) request to the server.
  Future<bool> saveUser() async {
    if (!_formKey.currentState!.validate()) return false;

    final userData = {
      'username': usernameCtrl.text.trim(),
      'password': passwordCtrl.text.isNotEmpty ? passwordCtrl.text : null,
      'first_name': firstNameCtrl.text.trim(),
      'middle_name': middleNameCtrl.text.trim().isNotEmpty ? middleNameCtrl.text.trim() : null,
      'last_name': lastNameCtrl.text.trim(),
      'address_1': address1Ctrl.text.trim(),
      'address_2': address2Ctrl.text.trim().isNotEmpty ? address2Ctrl.text.trim() : null,
      'address_3': address3Ctrl.text.trim().isNotEmpty ? address3Ctrl.text.trim() : null,
      'city': cityCtrl.text.trim(),
      'country': countryCtrl.text.trim(),
      'phone_1': phone1Ctrl.text.trim(),
      'phone_2': phone2Ctrl.text.trim().isNotEmpty ? phone2Ctrl.text.trim() : null,
      'email_1': email1Ctrl.text.trim(),
      'email_2': email2Ctrl.text.trim().isNotEmpty ? email2Ctrl.text.trim() : null,
      'role_id': selectedRoleId,
      'created_by': editingUserId == null ? 'System' : null,
    };

    try {
      setState(() => isLoading = true);
      http.Response response;

      if (editingUserId == null) {
        response = await ApiClient.post(
          Uri.parse(AppConfig.usersApiUrl),
          body: json.encode(userData),
        );
      } else {
        response = await ApiClient.put(
          Uri.parse('${AppConfig.usersApiUrl}/$editingUserId'),
          body: json.encode(userData),
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
            content: Text('Error saving user: ${e.toString()}', style: GoogleFonts.inter()),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
      setState(() => isLoading = false);
      return false;
    }
  }

  /// Sets up form state with existing user attributes for editing.
  void startEditUser(Map<String, dynamic> user) {
    editingUserId = user['user_id'];
    usernameCtrl.text = user['username'] ?? '';
    passwordCtrl.clear();
    firstNameCtrl.text = user['first_name'] ?? '';
    middleNameCtrl.text = user['middle_name'] ?? '';
    lastNameCtrl.text = user['last_name'] ?? '';
    address1Ctrl.text = user['address_1'] ?? '';
    address2Ctrl.text = user['address_2'] ?? '';
    address3Ctrl.text = user['address_3'] ?? '';
    cityCtrl.text = user['city'] ?? '';
    countryCtrl.text = user['country'] ?? '';
    phone1Ctrl.text = user['phone_1'] ?? '';
    phone2Ctrl.text = user['phone_2'] ?? '';
    email1Ctrl.text = user['email_1'] ?? '';
    email2Ctrl.text = user['email_2'] ?? '';
    selectedRoleId = user['role_id'];
  }

  /// Sends a request to remove a user record from the database.
  Future<void> deleteUser(int id) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    bool confirm = await showDialog(
          context: context,
          builder: (context) => AlertDialog(
            backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Text('Confirm Deletion', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
            content: Text('Are you sure you want to delete this user record permanently?', style: GoogleFonts.inter()),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text('Cancel', style: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B))),
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
      final response = await ApiClient.delete(Uri.parse('${AppConfig.usersApiUrl}/$id'));
      
      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('User deleted successfully!', style: GoogleFonts.inter()),
              backgroundColor: const Color(0xFFEF4444),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          );
        }
        if (editingUserId == id) {
          resetForm();
        }
        fetchUsers();
      } else {
        throw Exception('Failed to delete user');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error deleting user: ${e.toString()}', style: GoogleFonts.inter()),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
      setState(() => isLoading = false);
    }
  }

  /// Resets the controllers, clearing form inputs and validation messages.
  void resetForm() {
    editingUserId = null;
    selectedRoleId = null;
    usernameCtrl.clear();
    passwordCtrl.clear();
    firstNameCtrl.clear();
    middleNameCtrl.clear();
    lastNameCtrl.clear();
    address1Ctrl.clear();
    address2Ctrl.clear();
    address3Ctrl.clear();
    cityCtrl.clear();
    countryCtrl.clear();
    phone1Ctrl.clear();
    phone2Ctrl.clear();
    email1Ctrl.clear();
    email2Ctrl.clear();
  }

  /// Displays the modal dialog overlay containing the dynamic user details form.
  void showFormDialog(BuildContext context, {Map<String, dynamic>? userToEdit}) {
    if (userToEdit != null) {
      startEditUser(userToEdit);
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
                            editingUserId == null ? Icons.person_add_rounded : Icons.edit_note_rounded,
                            color: primaryColor,
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(
                          editingUserId == null ? 'Register New User' : 'Edit Registered User',
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
                      editingUserId == null
                          ? 'Enter information below to register a system account.'
                          : 'Modify account details and click Update.',
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
                              // 1. Account Details & Role
                              _buildFormSectionHeader(context, 'Account & System Role'),
                              _buildResponsiveRow(
                                width: screenWidth,
                                children: [
                                  if (editingUserId == null)
                                    _buildTextField(
                                      context: context,
                                      controller: usernameCtrl,
                                      labelText: 'Username',
                                      placeholder: 'Enter User Name',
                                      isRequired: true,
                                      prefixIcon: Icons.account_circle_outlined,
                                    )
                                  else
                                    TextFormField(
                                      initialValue: usernameCtrl.text,
                                      enabled: false,
                                      style: GoogleFonts.inter(fontSize: 13.5, color: Colors.grey),
                                      decoration: InputDecoration(
                                        labelText: 'Username (Read-Only)',
                                        prefixIcon: const Icon(Icons.account_circle_outlined, size: 18, color: Colors.grey),
                                        filled: true,
                                        fillColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                                      ),
                                    ),
                                  DropdownButtonFormField<int>(
                                    key: ValueKey(selectedRoleId),
                                    initialValue: selectedRoleId,
                                    decoration: InputDecoration(
                                      labelText: 'System Role *',
                                      labelStyle: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B), fontSize: 13),
                                      floatingLabelStyle: GoogleFonts.inter(color: primaryColor, fontSize: 12, fontWeight: FontWeight.w600),
                                      prefixIcon: Icon(Icons.security, size: 18, color: primaryColor),
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
                                    ),
                                    hint: Text('Select Role', style: GoogleFonts.inter(fontSize: 13)),
                                    dropdownColor: isDark ? const Color(0xFF151D30) : Colors.white,
                                    items: roles.map<DropdownMenuItem<int>>((r) {
                                      return DropdownMenuItem<int>(
                                        value: r['role_id'],
                                        child: Text(r['name'] ?? '', style: GoogleFonts.inter(fontSize: 13.5)),
                                      );
                                    }).toList(),
                                    onChanged: (val) {
                                      setDialogState(() {
                                        selectedRoleId = val;
                                      });
                                    },
                                    validator: (val) {
                                      if (val == null) return 'Role is required';
                                      return null;
                                    },
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              if (editingUserId == null) ...[
                                _buildResponsiveRow(
                                  width: screenWidth,
                                  children: [
                                    _buildTextField(
                                      context: context,
                                      controller: passwordCtrl,
                                      labelText: 'Password',
                                      placeholder: 'Enter Password',
                                      isRequired: true,
                                      isObscure: isObscurePassword,
                                      prefixIcon: Icons.lock_outline_rounded,
                                      suffixIcon: IconButton(
                                        icon: Icon(
                                          isObscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                          size: 18,
                                          color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                                        ),
                                        onPressed: () {
                                          setDialogState(() {
                                            isObscurePassword = !isObscurePassword;
                                          });
                                        },
                                      ),
                                    ),
                                    const SizedBox(),
                                  ],
                                ),
                                const SizedBox(height: 16),
                              ],

                              // 2. Personal Details
                              _buildFormSectionHeader(context, 'Personal Info'),
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
                                    controller: middleNameCtrl,
                                    labelText: 'Middle Name',
                                    placeholder: 'Enter Middle Name (Optional)',
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),

                              // 3. Location Details
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
                                    controller: address3Ctrl,
                                    labelText: 'Address Line 3',
                                    placeholder: 'Address 3 (Optional)',
                                  ),
                                  _buildTextField(
                                    context: context,
                                    controller: cityCtrl,
                                    labelText: 'City',
                                    placeholder: 'Enter City',
                                    isRequired: true,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              _buildResponsiveRow(
                                width: screenWidth,
                                children: [
                                  _buildTextField(
                                    context: context,
                                    controller: countryCtrl,
                                    labelText: 'Country',
                                    placeholder: 'Enter Country',
                                    isRequired: true,
                                  ),
                                  const SizedBox(),
                                ],
                              ),
                              const SizedBox(height: 16),

                              // 4. Contact Details
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
                                children: [
                                  _buildTextField(
                                    context: context,
                                    controller: email1Ctrl,
                                    labelText: 'Primary Email',
                                    placeholder: 'Enter Email 1',
                                    isRequired: true,
                                    keyboardType: TextInputType.emailAddress,
                                    validator: (val) {
                                      if (val == null || val.isEmpty) return 'Primary email is required';
                                      final emailReg = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
                                      if (!emailReg.hasMatch(val.trim())) return 'Enter a valid email address';
                                      return null;
                                    },
                                  ),
                                  _buildTextField(
                                    context: context,
                                    controller: email2Ctrl,
                                    labelText: 'Secondary Email',
                                    placeholder: 'Enter Email 2',
                                    keyboardType: TextInputType.emailAddress,
                                    validator: (val) {
                                      if (val == null || val.isEmpty) return null;
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
                            final success = await saveUser();
                            if (success && dialogCtx.mounted) {
                              Navigator.pop(dialogCtx);
                              resetForm();
                              fetchUsers();
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    userToEdit == null
                                        ? 'User registered successfully!'
                                        : 'User updated successfully!',
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
                          icon: Icon(editingUserId == null ? Icons.save_rounded : Icons.update_rounded, size: 18),
                          label: Text(
                            editingUserId == null ? 'Save User' : 'Update User',
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
                          'Users Master',
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
                                label: Text('New User', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                                onPressed: () => showFormDialog(context),
                              ),
                            if (canModify) const SizedBox(width: 10),
                            IconButton(
                              icon: Icon(Icons.refresh_rounded, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569)),
                              tooltip: 'Refresh Users',
                              onPressed: fetchUsers,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Responsive Table or Card Grid
                  Expanded(
                    child: users.isEmpty
                        ? Center(
                            child: Text(
                              'No users registered yet.',
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
      itemCount: users.length,
      itemBuilder: (ctx, idx) {
        final user = users[idx];
        final String middle = (user['middle_name'] != null && user['middle_name'].toString().trim().isNotEmpty)
            ? ' ${user['middle_name']}'
            : '';
        final String fullName = '${user['first_name'] ?? ''}$middle ${user['last_name'] ?? ''}';
        final String address = '${user['address_1'] ?? ''}, ${user['city'] ?? ''}, ${user['country'] ?? ''}';

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
                        'ID: ${user['user_id']}',
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                          color: isDark ? Colors.white70 : const Color(0xFF475569),
                        ),
                      ),
                    ),
                    Text(
                      user['role_name'] ?? 'User',
                      style: GoogleFonts.inter(
                        color: Theme.of(context).primaryColor,
                        fontWeight: FontWeight.bold,
                        fontSize: 12.5,
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
                const SizedBox(height: 4),
                Text(
                  '@${user['username']}',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                  ),
                ),
                const SizedBox(height: 12),
                _buildInfoRow(Icons.email_outlined, user['email_1'] ?? 'N/A', isDark),
                const SizedBox(height: 4),
                _buildInfoRow(Icons.phone_outlined, user['phone_1'] ?? 'N/A', isDark),
                const SizedBox(height: 4),
                _buildInfoRow(Icons.location_on_outlined, address, isDark),
                const SizedBox(height: 12),
                const Divider(height: 1, color: Color(0xFFE2E8F0)),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (canModify) ...[
                      IconButton(
                        icon: const Icon(Icons.edit_rounded, color: Color(0xFF6366F1), size: 20),
                        tooltip: 'Edit User',
                        onPressed: () => showFormDialog(context, userToEdit: Map<String, dynamic>.from(user)),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_rounded, color: Color(0xFFEF4444), size: 20),
                        tooltip: 'Delete User',
                        onPressed: () => deleteUser(user['user_id']),
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
                DataColumn(label: Text('USER ID', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Username', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Role', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Full Name', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Address & City', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                DataColumn(label: Text('Contact Details', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
                if (canModify) DataColumn(label: Text('Actions', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
              ],
              rows: users.map<DataRow>((user) {
                final String middle = (user['middle_name'] != null && user['middle_name'].toString().trim().isNotEmpty)
                    ? ' ${user['middle_name']}'
                    : '';
                final String fullName = '${user['first_name'] ?? ''}$middle ${user['last_name'] ?? ''}';

                return DataRow(cells: [
                  DataCell(
                    Text(
                      user['user_id'].toString(),
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  DataCell(Text(user['username'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600))),
                  DataCell(
                    Text(
                      user['role_name'] ?? 'User',
                      style: GoogleFonts.inter(color: Theme.of(context).primaryColor, fontWeight: FontWeight.bold),
                    ),
                  ),
                  DataCell(Text(fullName)),
                  DataCell(Text('${user['address_1'] ?? ''}, ${user['city'] ?? ''}')),
                  DataCell(
                    Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user['phone_1'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                        Text(user['email_1'] ?? '', style: const TextStyle(fontSize: 11, color: Colors.grey)),
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
                            tooltip: 'Edit User',
                            onPressed: () => showFormDialog(context, userToEdit: Map<String, dynamic>.from(user)),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_rounded, color: Color(0xFFEF4444), size: 20),
                            tooltip: 'Delete User',
                            onPressed: () => deleteUser(user['user_id']),
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
    bool isObscure = false,
    TextInputType keyboardType = TextInputType.text,
    Widget? suffixIcon,
    IconData? prefixIcon,
    String? Function(String?)? validator,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;

    return TextFormField(
      controller: controller,
      obscureText: isObscure,
      keyboardType: keyboardType,
      style: GoogleFonts.inter(fontSize: 13.5, color: isDark ? Colors.white : const Color(0xFF0F172A)),
      decoration: InputDecoration(
        labelText: isRequired ? '$labelText *' : labelText,
        labelStyle: GoogleFonts.inter(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B), fontSize: 13),
        floatingLabelStyle: GoogleFonts.inter(color: primaryColor, fontSize: 12, fontWeight: FontWeight.w600),
        hintText: placeholder,
        hintStyle: GoogleFonts.inter(color: const Color(0xFF94A3B8), fontSize: 13),
        prefixIcon: prefixIcon != null ? Icon(prefixIcon, size: 18, color: primaryColor) : null,
        suffixIcon: suffixIcon,
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