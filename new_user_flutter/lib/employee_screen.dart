import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'api_client.dart';
import 'config.dart';

class EmployeeScreen extends StatefulWidget {
  const EmployeeScreen({super.key});

  @override
  State<EmployeeScreen> createState() => _EmployeeScreenState();
}

class _EmployeeScreenState extends State<EmployeeScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> employees = [];
  List<dynamic> attendance = [];
  List<dynamic> roles = [];
  bool isLoadingEmp = true;
  bool isLoadingAtt = true;
  DateTime selectedDate = DateTime.now();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    fetchEmployees();
    fetchAttendance();
    loadRoles();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> fetchEmployees() async {
    try {
      setState(() => isLoadingEmp = true);
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/employees'));
      if (response.statusCode == 200) {
        setState(() {
          employees = json.decode(response.body);
          isLoadingEmp = false;
        });
      } else {
        setState(() => isLoadingEmp = false);
      }
    } catch (e) {
      debugPrint('Error loading employees: $e');
      setState(() => isLoadingEmp = false);
    }
  }

  Future<void> loadRoles() async {
    try {
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/roles'));
      if (response.statusCode == 200) {
        setState(() {
          roles = json.decode(response.body);
        });
      }
    } catch (e) {
      debugPrint('Error loading roles: $e');
    }
  }

  Future<void> fetchAttendance() async {
    try {
      setState(() => isLoadingAtt = true);
      final dateStr = selectedDate.toIso8601String().substring(0, 10);
      final response = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/employees/attendance?date=$dateStr'));
      if (response.statusCode == 200) {
        setState(() {
          attendance = json.decode(response.body);
          isLoadingAtt = false;
        });
      } else {
        setState(() => isLoadingAtt = false);
      }
    } catch (e) {
      debugPrint('Error loading attendance: $e');
      setState(() => isLoadingAtt = false);
    }
  }

  Future<void> saveEmployee({
    int? id,
    required String firstName,
    required String lastName,
    required String phone,
    String? email,
    String? designation,
    String? department,
    required double salary,
    String? joinDate,
    int? roleId,
    String? password,
  }) async {
    try {
      final data = {
        'first_name': firstName,
        'last_name': lastName,
        'phone': phone,
        'email': email,
        'designation': designation,
        'department': department,
        'salary': salary,
        'join_date': joinDate,
        'role_id': roleId,
        'password': password,
      };

      final response = id == null
          ? await ApiClient.post(Uri.parse('${AppConfig.baseUrl}/api/employees'), body: json.encode(data))
          : await ApiClient.put(Uri.parse('${AppConfig.baseUrl}/api/employees/$id'), body: json.encode(data));

      if (response.statusCode == 200 || response.statusCode == 201) {
        fetchEmployees();
        fetchAttendance();
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Employee profile saved!')));
      }
    } catch (e) {
      debugPrint('Error saving employee: $e');
    }
  }

  Future<void> logCheckIn(int empId) async {
    try {
      final dateStr = selectedDate.toIso8601String().substring(0, 10);
      final response = await ApiClient.post(
        Uri.parse('${AppConfig.baseUrl}/api/employees/attendance/check-in'),
        body: json.encode({'employee_id': empId, 'date': dateStr}),
      );
      if (response.statusCode == 200) {
        fetchAttendance();
      }
    } catch (e) {
      debugPrint('Error check-in: $e');
    }
  }

  Future<void> logCheckOut(int empId) async {
    try {
      final dateStr = selectedDate.toIso8601String().substring(0, 10);
      final response = await ApiClient.post(
        Uri.parse('${AppConfig.baseUrl}/api/employees/attendance/check-out'),
        body: json.encode({'employee_id': empId, 'date': dateStr}),
      );
      if (response.statusCode == 200) {
        fetchAttendance();
      }
    } catch (e) {
      debugPrint('Error check-out: $e');
    }
  }

  Future<void> updateAttendanceStatus(int empId, String status) async {
    try {
      final dateStr = selectedDate.toIso8601String().substring(0, 10);
      final response = await ApiClient.post(
        Uri.parse('${AppConfig.baseUrl}/api/employees/attendance/status'),
        body: json.encode({'employee_id': empId, 'date': dateStr, 'status': status}),
      );
      if (response.statusCode == 200) {
        fetchAttendance();
      }
    } catch (e) {
      debugPrint('Error updating status: $e');
    }
  }

  void showEmployeeForm({dynamic emp}) {
    final firstController = TextEditingController(text: emp?['first_name'] ?? '');
    final lastController = TextEditingController(text: emp?['last_name'] ?? '');
    final phoneController = TextEditingController(text: emp?['phone'] ?? '');
    final emailController = TextEditingController(text: emp?['email'] ?? '');
    final desController = TextEditingController(text: emp?['designation'] ?? '');
    final deptController = TextEditingController(text: emp?['department'] ?? '');
    final salaryController = TextEditingController(text: emp != null ? emp['salary'].toString() : '20000');
    final joinController = TextEditingController(text: emp?['join_date'] != null ? emp['join_date'].toString().substring(0, 10) : DateTime.now().toIso8601String().substring(0, 10));
    final passwordController = TextEditingController();
    int? selectedRole = emp?['role_id'];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setStateDialog) => AlertDialog(
          title: Text(emp == null ? 'Register Employee' : 'Edit Employee Profile', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: firstController,
                        decoration: const InputDecoration(labelText: 'First Name *'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: lastController,
                        decoration: const InputDecoration(labelText: 'Last Name *'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: phoneController,
                  decoration: const InputDecoration(labelText: 'Phone Number *'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: emailController,
                  decoration: const InputDecoration(labelText: 'Email Address'),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: desController,
                        decoration: const InputDecoration(labelText: 'Designation'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: deptController,
                        decoration: const InputDecoration(labelText: 'Department'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: salaryController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Monthly Salary (₹)'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: joinController,
                        decoration: const InputDecoration(labelText: 'Join Date'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<int>(
                  value: selectedRole,
                  decoration: const InputDecoration(labelText: 'System Access Role'),
                  items: [
                    const DropdownMenuItem<int>(value: null, child: Text('No Login (Staff)')),
                    ...roles.map<DropdownMenuItem<int>>((r) {
                      return DropdownMenuItem<int>(
                        value: r['role_id'],
                        child: Text(r['role_name']),
                      );
                    })
                  ],
                  onChanged: (val) => setStateDialog(() => selectedRole = val),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Access Password', hintText: 'Default uses phone number'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () {
                if (firstController.text.trim().isEmpty || lastController.text.trim().isEmpty || phoneController.text.trim().isEmpty) return;
                Navigator.pop(ctx);
                saveEmployee(
                  id: emp?['employee_id'],
                  firstName: firstController.text.trim(),
                  lastName: lastController.text.trim(),
                  phone: phoneController.text.trim(),
                  email: emailController.text.trim().isNotEmpty ? emailController.text.trim() : null,
                  designation: desController.text.trim().isNotEmpty ? desController.text.trim() : null,
                  department: deptController.text.trim().isNotEmpty ? deptController.text.trim() : null,
                  salary: double.tryParse(salaryController.text) ?? 0.0,
                  joinDate: joinController.text.trim().isNotEmpty ? joinController.text.trim() : null,
                  roleId: selectedRole,
                  password: passwordController.text.trim().isNotEmpty ? passwordController.text.trim() : null,
                );
              },
              child: const Text('Save'),
            )
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(kToolbarHeight),
        child: Container(
          color: Theme.of(context).cardColor,
          child: TabBar(
            controller: _tabController,
            tabs: const [
              Tab(icon: Icon(Icons.people_alt_outlined), text: 'Staff Directory'),
              Tab(icon: Icon(Icons.edit_calendar_outlined), text: 'Attendance Logs'),
            ],
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Staff Directory
          Scaffold(
            floatingActionButton: FloatingActionButton(
              onPressed: () => showEmployeeForm(),
              child: const Icon(Icons.person_add),
            ),
            body: isLoadingEmp
                ? const Center(child: CircularProgressIndicator())
                : employees.isEmpty
                    ? Center(child: Text('No employees registered yet', style: GoogleFonts.inter(color: Colors.grey)))
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: employees.length,
                        itemBuilder: (ctx, idx) {
                          final e = employees[idx];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: Colors.teal.shade50,
                                child: Icon(Icons.person, color: Colors.teal.shade400, size: 22),
                              ),
                              title: Text(
                                '${e['first_name']} ${e['last_name']}',
                                style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                              subtitle: Text(
                                '${e['designation'] ?? "Staff"} • ${e['department'] ?? "General"}\nPhone: ${e['phone']}',
                                style: GoogleFonts.inter(fontSize: 11),
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    '₹${double.parse(e['salary'].toString()).toStringAsFixed(0)}',
                                    style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.teal.shade700),
                                  ),
                                  const SizedBox(width: 8),
                                  IconButton(
                                    icon: const Icon(Icons.edit, color: Colors.blue, size: 20),
                                    onPressed: () => showEmployeeForm(emp: e),
                                  )
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),

          // Tab 2: Attendance Logs
          Scaffold(
            bottomNavigationBar: Container(
              padding: const EdgeInsets.all(12),
              color: Theme.of(context).cardColor,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Sheet Date: ${selectedDate.day}/${selectedDate.month}/${selectedDate.year}',
                    style: GoogleFonts.inter(fontWeight: FontWeight.bold),
                  ),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.calendar_today, size: 14),
                    label: const Text('Pick Date'),
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: selectedDate,
                        firstDate: DateTime(2025),
                        lastDate: DateTime(2030),
                      );
                      if (picked != null) {
                        setState(() => selectedDate = picked);
                        fetchAttendance();
                      }
                    },
                  )
                ],
              ),
            ),
            body: isLoadingAtt
                ? const Center(child: CircularProgressIndicator())
                : attendance.isEmpty
                    ? Center(child: Text('No active staff to log attendance', style: GoogleFonts.inter(color: Colors.grey)))
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: attendance.length,
                        itemBuilder: (ctx, idx) {
                          final att = attendance[idx];
                          final checkIn = att['check_in'] ?? '--:--';
                          final checkOut = att['check_out'] ?? '--:--';
                          final status = att['status'] ?? 'absent';

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
                                        '${att['first_name']} ${att['last_name']}',
                                        style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14),
                                      ),
                                      DropdownButton<String>(
                                        value: status,
                                        items: const [
                                          DropdownMenuItem(value: 'present', child: Text('Present', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold))),
                                          DropdownMenuItem(value: 'absent', child: Text('Absent', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold))),
                                          DropdownMenuItem(value: 'leave', child: Text('On Leave', style: TextStyle(color: Colors.orange, fontWeight: FontWeight.bold))),
                                        ],
                                        onChanged: (val) {
                                          if (val != null) {
                                            updateAttendanceStatus(att['employee_id'], val);
                                          }
                                        },
                                      ),
                                    ],
                                  ),
                                  Text(
                                    '${att['designation'] ?? "Staff"} • ${att['department'] ?? "General"}',
                                    style: GoogleFonts.inter(fontSize: 11, color: Colors.grey),
                                  ),
                                  const Divider(height: 16),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text('In: $checkIn  •  Out: $checkOut', style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13)),
                                      Row(
                                        children: [
                                          ElevatedButton(
                                            style: ElevatedButton.styleFrom(
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                                              minimumSize: const Size(60, 28),
                                            ),
                                            onPressed: () => logCheckIn(att['employee_id']),
                                            child: const Text('In', style: TextStyle(fontSize: 11)),
                                          ),
                                          const SizedBox(width: 6),
                                          ElevatedButton(
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.grey.shade300,
                                              foregroundColor: Colors.black87,
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                                              minimumSize: const Size(60, 28),
                                            ),
                                            onPressed: () => logCheckOut(att['employee_id']),
                                            child: const Text('Out', style: TextStyle(fontSize: 11)),
                                          ),
                                        ],
                                      )
                                    ],
                                  )
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
