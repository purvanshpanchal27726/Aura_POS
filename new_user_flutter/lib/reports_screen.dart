import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'config.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  bool isLoading = true;

  // Selected config values
  String _selectedReportType = 'sales';
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();

  String? _selectedCategory;
  String? _selectedItem;
  String? _selectedCustomer;
  String? _selectedVendor;
  String? _selectedOperator;
  String? _selectedStatus;
  String? _selectedRole;
  final TextEditingController _cityController = TextEditingController();

  // Metrics (Sales / Purchases)
  List<dynamic> sales = [];
  List<dynamic> purchases = [];
  double totalSales = 0.0;
  double totalPurchases = 0.0;
  double netMargin = 0.0;

  // Metadata Lists
  List<dynamic> _categories = [];
  List<dynamic> _items = [];
  List<dynamic> _customers = [];
  List<dynamic> _vendors = [];
  List<dynamic> _users = [];
  List<dynamic> _salesDetails = [];
  List<dynamic> _purchaseDetails = [];

  // Filtered lists shown in ledger
  List<dynamic> _filteredRecords = [];

  @override
  void initState() {
    super.initState();
    fetchMetadataAndReport();
  }

  @override
  void dispose() {
    _cityController.dispose();
    super.dispose();
  }

  Future<void> fetchMetadataAndReport() async {
    try {
      setState(() => isLoading = true);

      final responses = await Future.wait([
        http.get(Uri.parse(AppConfig.categoriesApiUrl)),
        http.get(Uri.parse(AppConfig.itemsApiUrl)),
        http.get(Uri.parse(AppConfig.customersApiUrl)),
        http.get(Uri.parse(AppConfig.vendorsApiUrl)),
        http.get(Uri.parse(AppConfig.usersApiUrl)),
        http.get(Uri.parse('${AppConfig.salesApiUrl}/details/all')),
        http.get(Uri.parse('${AppConfig.purchasesApiUrl}/details/all')),
        http.get(Uri.parse(AppConfig.salesApiUrl)),
        http.get(Uri.parse(AppConfig.purchasesApiUrl)),
      ]);

      if (responses.every((r) => r.statusCode == 200)) {
        setState(() {
          _categories = json.decode(responses[0].body);
          _items = json.decode(responses[1].body);
          _customers = json.decode(responses[2].body);
          _vendors = json.decode(responses[3].body);
          _users = json.decode(responses[4].body);
          _salesDetails = json.decode(responses[5].body);
          _purchaseDetails = json.decode(responses[6].body);
          sales = json.decode(responses[7].body);
          purchases = json.decode(responses[8].body);

          // Calculate overview totals
          totalSales = sales.fold(0.0, (sum, item) => sum + (double.tryParse(item['total']?.toString() ?? '0') ?? 0.0));
          totalPurchases = purchases.fold(0.0, (sum, item) => sum + (double.tryParse(item['total']?.toString() ?? '0') ?? 0.0));
          netMargin = totalSales - totalPurchases;

          isLoading = false;
        });
        filterReport();
      } else {
        throw Exception('Failed to load metadata and details records from POS backend APIs');
      }
    } catch (e) {
      debugPrint('Error loading reports details: $e');
      setState(() => isLoading = false);
    }
  }

  void filterReport() {
    setState(() {
      if (_selectedReportType == 'sales') {
        _filteredRecords = _salesDetails.where((d) {
          final sDate = d['sales_date']?.toString().split('T')[0];
          final filterStart = _startDate.toIso8601String().split('T')[0];
          final filterEnd = _endDate.toIso8601String().split('T')[0];

          if (sDate != null) {
            if (sDate.compareTo(filterStart) < 0) return false;
            if (sDate.compareTo(filterEnd) > 0) return false;
          }
          if (_selectedCategory != null && d['category_id']?.toString() != _selectedCategory) return false;
          if (_selectedItem != null && d['item_id']?.toString() != _selectedItem) return false;
          if (_selectedCustomer != null && d['customer_id']?.toString() != _selectedCustomer) return false;
          if (_selectedOperator != null && d['created_by']?.toString() != _selectedOperator) return false;
          return true;
        }).toList();
      } else if (_selectedReportType == 'purchase') {
        _filteredRecords = _purchaseDetails.where((d) {
          final pDate = d['purchase_date']?.toString().split('T')[0];
          final filterStart = _startDate.toIso8601String().split('T')[0];
          final filterEnd = _endDate.toIso8601String().split('T')[0];

          if (pDate != null) {
            if (pDate.compareTo(filterStart) < 0) return false;
            if (pDate.compareTo(filterEnd) > 0) return false;
          }
          if (_selectedCategory != null && d['category_id']?.toString() != _selectedCategory) return false;
          if (_selectedItem != null && d['item_id']?.toString() != _selectedItem) return false;
          if (_selectedVendor != null && d['vendor_id']?.toString() != _selectedVendor) return false;
          if (_selectedOperator != null && d['created_by']?.toString() != _selectedOperator) return false;
          return true;
        }).toList();
      } else if (_selectedReportType == 'item') {
        _filteredRecords = _items.where((i) {
          if (_selectedCategory != null && i['category_id']?.toString() != _selectedCategory) return false;
          if (_selectedStatus != null && i['active']?.toString() != _selectedStatus) return false;
          return true;
        }).toList();
      } else if (_selectedReportType == 'category') {
        _filteredRecords = _categories.where((c) {
          if (_selectedStatus != null && c['active']?.toString() != _selectedStatus) return false;
          return true;
        }).toList();
      } else if (_selectedReportType == 'customer') {
        _filteredRecords = _customers.where((c) {
          final cityFilter = _cityController.text.toLowerCase().trim();
          if (cityFilter.isNotEmpty &&
              c['city']?.toString().toLowerCase().contains(cityFilter) == false) {
            return false;
          }
          return true;
        }).toList();
      } else if (_selectedReportType == 'user') {
        _filteredRecords = _users.where((u) {
          if (_selectedRole != null && u['role_id']?.toString() != _selectedRole) return false;
          return true;
        }).toList();
      }
    });
  }

  void _resetFilters() {
    setState(() {
      _startDate = DateTime.now();
      _endDate = DateTime.now();
      _selectedCategory = null;
      _selectedItem = null;
      _selectedCustomer = null;
      _selectedVendor = null;
      _selectedOperator = null;
      _selectedStatus = null;
      _selectedRole = null;
      _cityController.clear();
    });
    filterReport();
  }

  @override
  Widget build(BuildContext context) {
    final primaryColor = Theme.of(context).primaryColor;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: isLoading
          ? Center(child: CircularProgressIndicator(color: primaryColor))
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: ListView(
                physics: const BouncingScrollPhysics(),
                children: [
                  // Top Overview Cards Row
                  LayoutBuilder(builder: (ctx, constraints) {
                    final cols = constraints.maxWidth > 800 ? 3 : 1;
                    final list = [
                      _buildMetricCard(
                        title: 'TOTAL SALES VALUE',
                        value: '₹${totalSales.toStringAsFixed(2)}',
                        color: const Color(0xFF10B981),
                        icon: Icons.trending_up_rounded,
                        bgLight: isDark ? const Color(0xFF064E3B) : const Color(0xFFECFDF5),
                      ),
                      _buildMetricCard(
                        title: 'TOTAL PURCHASE VALUE',
                        value: '₹${totalPurchases.toStringAsFixed(2)}',
                        color: const Color(0xFFEF4444),
                        icon: Icons.trending_down_rounded,
                        bgLight: isDark ? const Color(0xFF7F1D1D) : const Color(0xFFFEF2F2),
                      ),
                      _buildMetricCard(
                        title: 'NET MARGIN PROFIT',
                        value: '₹${netMargin.toStringAsFixed(2)}',
                        color: netMargin >= 0.0 ? const Color(0xFF6366F1) : const Color(0xFFF59E0B),
                        icon: Icons.account_balance_wallet_rounded,
                        bgLight: netMargin >= 0.0
                            ? (isDark ? const Color(0xFF1E3A8A) : const Color(0xFFEFF6FF))
                            : (isDark ? const Color(0xFF78350F) : const Color(0xFFFFFBEB)),
                      ),
                    ];
                    if (cols == 3) {
                      return Row(
                        children: [
                          Expanded(child: list[0]),
                          const SizedBox(width: 16),
                          Expanded(child: list[1]),
                          const SizedBox(width: 16),
                          Expanded(child: list[2]),
                        ],
                      );
                    } else {
                      return Column(
                        children: [
                          list[0],
                          const SizedBox(height: 12),
                          list[1],
                          const SizedBox(height: 12),
                          list[2],
                        ],
                      );
                    }
                  }),
                  const SizedBox(height: 24),

                  // Filter Config Panel
                  _buildFilterConfigPanel(primaryColor, isDark),
                  const SizedBox(height: 24),

                  // Charts Section (Sales/Purchase only)
                  if (_selectedReportType == 'sales' || _selectedReportType == 'purchase') ...[
                    _buildChartsSection(primaryColor, isDark),
                    const SizedBox(height: 24),
                  ],

                  // Reports Data Table Card
                  _buildReportTableCard(primaryColor, isDark),
                ],
              ),
            ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required Color color,
    required IconData icon,
    required Color bgLight,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2)),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFF94A3B8), letterSpacing: 0.5),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 6),
                Text(
                  value,
                  style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w800, color: color),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: bgLight,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 22),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterConfigPanel(Color primaryColor, bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Report Configuration & Filters',
            style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A)),
          ),
          const Divider(height: 24),
          
          Row(
            children: [
              Text('Report Module: ', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13.5)),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonHideUnderline(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF0B0F19) : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFCBD5E1)),
                    ),
                    child: DropdownButton<String>(
                      value: _selectedReportType,
                      isExpanded: true,
                      dropdownColor: isDark ? const Color(0xFF151D30) : Colors.white,
                      style: GoogleFonts.inter(color: isDark ? Colors.white : const Color(0xFF0F172A), fontSize: 13),
                      items: const [
                        DropdownMenuItem(value: 'sales', child: Text('Sales Transaction Ledger')),
                        DropdownMenuItem(value: 'purchase', child: Text('Purchase Inward Ledger')),
                        DropdownMenuItem(value: 'item', child: Text('Registered Items Inventory')),
                        DropdownMenuItem(value: 'category', child: Text('Item Categories List')),
                        DropdownMenuItem(value: 'customer', child: Text('Customers Ledger')),
                        DropdownMenuItem(value: 'user', child: Text('Operator Users List')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setState(() {
                            _selectedReportType = val;
                          });
                          _resetFilters();
                        }
                      },
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Dynamic filters wrap list
          Wrap(
            spacing: 14,
            runSpacing: 14,
            crossAxisAlignment: WrapCrossAlignment.end,
            children: _buildDynamicFilters(primaryColor),
          ),
          const SizedBox(height: 24),

          // Action Buttons
          Row(
            children: [
              ElevatedButton.icon(
                icon: const Icon(Icons.analytics_rounded, size: 18),
                label: Text('Generate Report', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                ),
                onPressed: () {
                  filterReport();
                },
              ),
              const SizedBox(width: 12),
              OutlinedButton.icon(
                icon: const Icon(Icons.print_rounded, size: 18),
                label: Text('Print Preview', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: isDark ? Colors.white70 : const Color(0xFF334155),
                  side: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                ),
                onPressed: () {
                  _showPrintPreviewDialog();
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  List<Widget> _buildDynamicFilters(Color primaryColor) {
    if (_selectedReportType == 'sales') {
      return [
        _buildDatePicker('Start Date', _startDate, (d) => setState(() => _startDate = d)),
        _buildDatePicker('End Date', _endDate, (d) => setState(() => _endDate = d)),
        _buildDropdownFilter<String>(
          label: 'Category',
          value: _selectedCategory,
          items: [
            const DropdownMenuItem(value: null, child: Text('All Categories')),
            ..._categories.map((c) => DropdownMenuItem(value: c['category_id']?.toString(), child: Text(c['name'] ?? ''))),
          ],
          onChanged: (val) => setState(() => _selectedCategory = val),
        ),
        _buildDropdownFilter<String>(
          label: 'Item',
          value: _selectedItem,
          items: [
            const DropdownMenuItem(value: null, child: Text('All Items')),
            ..._items.map((i) => DropdownMenuItem(value: i['item_id']?.toString(), child: Text(i['name'] ?? ''))),
          ],
          onChanged: (val) => setState(() => _selectedItem = val),
        ),
        _buildDropdownFilter<String>(
          label: 'Customer',
          value: _selectedCustomer,
          items: [
            const DropdownMenuItem(value: null, child: Text('All Customers')),
            ..._customers.map((c) => DropdownMenuItem(
                  value: c['customer_id']?.toString(),
                  child: Text('${c['first_name'] ?? ''} ${c['last_name'] ?? ''}'),
                )),
          ],
          onChanged: (val) => setState(() => _selectedCustomer = val),
        ),
        _buildDropdownFilter<String>(
          label: 'Operator',
          value: _selectedOperator,
          items: [
            const DropdownMenuItem(value: null, child: Text('All Operators')),
            ..._users.map((u) => DropdownMenuItem(value: u['username']?.toString(), child: Text(u['username'] ?? ''))),
          ],
          onChanged: (val) => setState(() => _selectedOperator = val),
        ),
      ];
    } else if (_selectedReportType == 'purchase') {
      return [
        _buildDatePicker('Start Date', _startDate, (d) => setState(() => _startDate = d)),
        _buildDatePicker('End Date', _endDate, (d) => setState(() => _endDate = d)),
        _buildDropdownFilter<String>(
          label: 'Category',
          value: _selectedCategory,
          items: [
            const DropdownMenuItem(value: null, child: Text('All Categories')),
            ..._categories.map((c) => DropdownMenuItem(value: c['category_id']?.toString(), child: Text(c['name'] ?? ''))),
          ],
          onChanged: (val) => setState(() => _selectedCategory = val),
        ),
        _buildDropdownFilter<String>(
          label: 'Item',
          value: _selectedItem,
          items: [
            const DropdownMenuItem(value: null, child: Text('All Items')),
            ..._items.map((i) => DropdownMenuItem(value: i['item_id']?.toString(), child: Text(i['name'] ?? ''))),
          ],
          onChanged: (val) => setState(() => _selectedItem = val),
        ),
        _buildDropdownFilter<String>(
          label: 'Vendor',
          value: _selectedVendor,
          items: [
            const DropdownMenuItem(value: null, child: Text('All Vendors')),
            ..._vendors.map((v) => DropdownMenuItem(
                  value: v['vendor_id']?.toString(),
                  child: Text('${v['first_name'] ?? ''} ${v['last_name'] ?? ''} (${v['company'] ?? ''})'),
                )),
          ],
          onChanged: (val) => setState(() => _selectedVendor = val),
        ),
        _buildDropdownFilter<String>(
          label: 'Operator',
          value: _selectedOperator,
          items: [
            const DropdownMenuItem(value: null, child: Text('All Operators')),
            ..._users.map((u) => DropdownMenuItem(value: u['username']?.toString(), child: Text(u['username'] ?? ''))),
          ],
          onChanged: (val) => setState(() => _selectedOperator = val),
        ),
      ];
    } else if (_selectedReportType == 'item') {
      return [
        _buildDropdownFilter<String>(
          label: 'Category',
          value: _selectedCategory,
          items: [
            const DropdownMenuItem(value: null, child: Text('All Categories')),
            ..._categories.map((c) => DropdownMenuItem(value: c['category_id']?.toString(), child: Text(c['name'] ?? ''))),
          ],
          onChanged: (val) => setState(() => _selectedCategory = val),
        ),
        _buildDropdownFilter<String>(
          label: 'Status',
          value: _selectedStatus,
          items: [
            const DropdownMenuItem(value: null, child: Text('All Statuses')),
            const DropdownMenuItem(value: '1', child: Text('Active')),
            const DropdownMenuItem(value: '0', child: Text('Inactive')),
          ],
          onChanged: (val) => setState(() => _selectedStatus = val),
        ),
      ];
    } else if (_selectedReportType == 'category') {
      return [
        _buildDropdownFilter<String>(
          label: 'Status',
          value: _selectedStatus,
          items: [
            const DropdownMenuItem(value: null, child: Text('All Statuses')),
            const DropdownMenuItem(value: '1', child: Text('Active')),
            const DropdownMenuItem(value: '0', child: Text('Inactive')),
          ],
          onChanged: (val) => setState(() => _selectedStatus = val),
        ),
      ];
    } else if (_selectedReportType == 'customer') {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      return [
        SizedBox(
          width: 200,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('City Filter', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFF94A3B8))),
              const SizedBox(height: 6),
              TextField(
                controller: _cityController,
                style: GoogleFonts.inter(color: isDark ? Colors.white : const Color(0xFF0F172A), fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Enter city name',
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: Theme.of(context).primaryColor, width: 1.5),
                  ),
                ),
                onChanged: (val) {
                  filterReport();
                },
              ),
            ],
          ),
        ),
      ];
    } else if (_selectedReportType == 'user') {
      return [
        _buildDropdownFilter<String>(
          label: 'Role Filter',
          value: _selectedRole,
          items: const [
            DropdownMenuItem(value: null, child: Text('All Roles')),
            DropdownMenuItem(value: '1', child: Text('Admin')),
            DropdownMenuItem(value: '2', child: Text('Manager')),
            DropdownMenuItem(value: '3', child: Text('User')),
            DropdownMenuItem(value: '4', child: Text('Viewer')),
          ],
          onChanged: (val) => setState(() => _selectedRole = val),
        ),
      ];
    }
    return [];
  }

  Widget _buildDatePicker(String label, DateTime value, Function(DateTime) onSelected) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SizedBox(
      width: 160,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFF94A3B8))),
          const SizedBox(height: 6),
          OutlinedButton.icon(
            icon: const Icon(Icons.date_range_rounded, size: 14, color: Color(0xFF6366F1)),
            label: Text('${value.day}/${value.month}/${value.year}', style: GoogleFonts.inter(fontSize: 12.5, color: isDark ? Colors.white : const Color(0xFF334155))),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              side: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: value,
                firstDate: DateTime(2020),
                lastDate: DateTime(2030),
              );
              if (picked != null) {
                onSelected(picked);
                filterReport();
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildDropdownFilter<T>({
    required String label,
    required T? value,
    required List<DropdownMenuItem<T>> items,
    required Function(T?) onChanged,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SizedBox(
      width: 180,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFF94A3B8))),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF0B0F19) : Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<T>(
                value: value,
                isExpanded: true,
                dropdownColor: isDark ? const Color(0xFF151D30) : Colors.white,
                style: GoogleFonts.inter(color: isDark ? Colors.white : const Color(0xFF0F172A), fontSize: 13),
                items: items,
                onChanged: (val) {
                  onChanged(val);
                  filterReport();
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChartsSection(Color primaryColor, bool isDark) {
    final Map<String, Map<String, double>> barChartMap = {};
    
    for (var s in _salesDetails) {
      final sDate = s['sales_date']?.toString().split('T')[0];
      if (sDate != null) {
        if (!barChartMap.containsKey(sDate)) {
          barChartMap[sDate] = {'sales': 0.0, 'purchases': 0.0};
        }
        barChartMap[sDate]!['sales'] = (barChartMap[sDate]!['sales'] ?? 0.0) +
            (double.tryParse(s['item_amount']?.toString() ?? '0') ?? 0.0);
      }
    }
    
    for (var p in _purchaseDetails) {
      final pDate = p['purchase_date']?.toString().split('T')[0];
      if (pDate != null) {
        if (!barChartMap.containsKey(pDate)) {
          barChartMap[pDate] = {'sales': 0.0, 'purchases': 0.0};
        }
        barChartMap[pDate]!['purchases'] = (barChartMap[pDate]!['purchases'] ?? 0.0) +
            (double.tryParse(p['item_amount']?.toString() ?? '0') ?? 0.0);
      }
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final double width = constraints.maxWidth;
        final bool isDesktop = width >= 800;

        final cards = [
          // Bar Chart Card
          Container(
            padding: const EdgeInsets.all(20),
            height: 260,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF151D30) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Transaction Ledger Trends (10 days)', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold, color: isDark ? Colors.white70 : const Color(0xFF334155))),
                const SizedBox(height: 16),
                Expanded(
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: _buildBarChartWidget(barChartMap, primaryColor),
                  ),
                ),
              ],
            ),
          ),
          
          // Pie Chart Card
          Container(
            padding: const EdgeInsets.all(20),
            height: 260,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF151D30) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Revenue by Item Category', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold, color: isDark ? Colors.white70 : const Color(0xFF334155))),
                const SizedBox(height: 16),
                Expanded(
                  child: _buildPieChartWidget(primaryColor),
                ),
              ],
            ),
          ),
        ];

        if (isDesktop) {
          return Row(
            children: [
              Expanded(child: cards[0]),
              const SizedBox(width: 16),
              Expanded(child: cards[1]),
            ],
          );
        } else {
          return Column(
            children: [
              cards[0],
              const SizedBox(height: 16),
              cards[1],
            ],
          );
        }
      },
    );
  }

  Widget _buildBarChartWidget(Map<String, Map<String, double>> data, Color primaryColor) {
    final sortedDates = data.keys.toList()..sort();
    final last10Dates = sortedDates.length > 10 ? sortedDates.sublist(sortedDates.length - 10) : sortedDates;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    double maxVal = 0.0;
    for (var date in last10Dates) {
      final sVal = data[date]?['sales'] ?? 0.0;
      final pVal = data[date]?['purchases'] ?? 0.0;
      if (sVal > maxVal) maxVal = sVal;
      if (pVal > maxVal) maxVal = pVal;
    }
    if (maxVal == 0) maxVal = 1.0;

    if (last10Dates.isEmpty) {
      return Center(child: Text('No Ledger Transactions Found', style: GoogleFonts.inter(color: const Color(0xFF94A3B8))));
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: last10Dates.map((date) {
          final sVal = data[date]?['sales'] ?? 0.0;
          final pVal = data[date]?['purchases'] ?? 0.0;
          
          final sHeight = (sVal / maxVal) * 120.0;
          final pHeight = (pVal / maxVal) * 120.0;

          final dateParts = date.split('-');
          final displayDate = dateParts.length > 2 ? '${dateParts[2]}/${dateParts[1]}' : date;

          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    // Sales bar
                    Container(
                      width: 14,
                      height: sHeight > 2 ? sHeight : 2,
                      decoration: BoxDecoration(
                        color: const Color(0xFF6366F1),
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(4),
                          topRight: Radius.circular(4),
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    // Purchases bar
                    Container(
                      width: 14,
                      height: pHeight > 2 ? pHeight : 2,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444),
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(4),
                          topRight: Radius.circular(4),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  displayDate, 
                  style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildPieChartWidget(Color primaryColor) {
    final Map<String, double> catMap = {};
    for (var d in _salesDetails) {
      final catName = d['category_name']?.toString() ?? 'Uncategorized';
      final amt = double.tryParse(d['item_amount']?.toString() ?? '0') ?? 0.0;
      catMap[catName] = (catMap[catName] ?? 0.0) + amt;
    }

    if (catMap.isEmpty) {
      return Center(child: Text('No Category Sales Logged', style: GoogleFonts.inter(color: const Color(0xFF94A3B8))));
    }

    final categories = catMap.keys.toList();
    final values = catMap.values.toList();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final List<Color> pieColors = [
      const Color(0xFF6366F1), // Indigo
      const Color(0xFF10B981), // Emerald
      const Color(0xFFEC4899), // Pink
      const Color(0xFFF97316), // Orange
      const Color(0xFFEF4444), // Ruby
      const Color(0xFF06B6D4), // Cyan
      const Color(0xFFEAB308), // Amber
    ];

    return Row(
      children: [
        CustomPaint(
          size: const Size(110, 110),
          painter: PieChartPainter(values: values, colors: pieColors),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: ListView.builder(
            itemCount: categories.length,
            physics: const ClampingScrollPhysics(),
            itemBuilder: (context, index) {
              final cat = categories[index];
              final amt = values[index];
              final color = pieColors[index % pieColors.length];

              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4.0),
                child: Row(
                  children: [
                    Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '$cat: ₹${amt.toStringAsFixed(2)}',
                        style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: isDark ? Colors.white70 : const Color(0xFF334155)),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildReportTableCard(Color primaryColor, bool isDark) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(18.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _getReportTableName(),
                  style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${_filteredRecords.length} records found',
                    style: GoogleFonts.inter(color: isDark ? Colors.white70 : const Color(0xFF475569), fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          
          _filteredRecords.isEmpty
              ? Padding(
                  padding: const EdgeInsets.all(32.0),
                  child: Center(
                    child: Text(
                      'No matching records found. Try modifying the configurations.',
                      style: GoogleFonts.inter(color: const Color(0xFF94A3B8)),
                    ),
                  ),
                )
              : ClipRRect(
                  borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.vertical,
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: DataTable(
                        headingRowColor: WidgetStateProperty.all(
                          isDark ? const Color(0xFF1F2937) : const Color(0xFFF8FAFC),
                        ),
                        headingTextStyle: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 13, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569)),
                        dataTextStyle: GoogleFonts.inter(fontSize: 13, color: isDark ? Colors.white : const Color(0xFF1E293B)),
                        columns: _getReportTableColumns(),
                        rows: _getReportTableRows(isDark),
                      ),
                    ),
                  ),
                ),
        ],
      ),
    );
  }

  String _getReportTableName() {
    switch (_selectedReportType) {
      case 'sales':
        return 'Sales Report Details';
      case 'purchase':
        return 'Purchase Report Details';
      case 'item':
        return 'Registered Items Inventory';
      case 'category':
        return 'Registered Categories Listing';
      case 'customer':
        return 'Registered Customers Listing';
      case 'user':
        return 'Registered Users Listing';
      default:
        return 'Report Details';
    }
  }

  List<DataColumn> _getReportTableColumns() {
    switch (_selectedReportType) {
      case 'sales':
        return [
          const DataColumn(label: Text('Date')),
          const DataColumn(label: Text('Bill No')),
          const DataColumn(label: Text('Customer')),
          const DataColumn(label: Text('Category')),
          const DataColumn(label: Text('Item Name')),
          const DataColumn(label: Text('Rate')),
          const DataColumn(label: Text('Qty')),
          const DataColumn(label: Text('Amount')),
          const DataColumn(label: Text('Operator')),
        ];
      case 'purchase':
        return [
          const DataColumn(label: Text('Date')),
          const DataColumn(label: Text('Inward No')),
          const DataColumn(label: Text('Vendor')),
          const DataColumn(label: Text('Category')),
          const DataColumn(label: Text('Item Name')),
          const DataColumn(label: Text('Cost Rate')),
          const DataColumn(label: Text('Qty')),
          const DataColumn(label: Text('Amount')),
          const DataColumn(label: Text('Operator')),
        ];
      case 'item':
        return [
          const DataColumn(label: Text('Item ID')),
          const DataColumn(label: Text('Code')),
          const DataColumn(label: Text('Item Name')),
          const DataColumn(label: Text('Category')),
          const DataColumn(label: Text('Base Unit')),
          const DataColumn(label: Text('Tax Rate')),
          const DataColumn(label: Text('Sales Price')),
          const DataColumn(label: Text('Purchase Price')),
          const DataColumn(label: Text('Status')),
        ];
      case 'category':
        return [
          const DataColumn(label: Text('Cat ID')),
          const DataColumn(label: Text('Category Name')),
          const DataColumn(label: Text('Status')),
          const DataColumn(label: Text('Created Date')),
        ];
      case 'customer':
        return [
          const DataColumn(label: Text('Cust ID')),
          const DataColumn(label: Text('Full Name')),
          const DataColumn(label: Text('Address Details')),
          const DataColumn(label: Text('City & Country')),
          const DataColumn(label: Text('Contact Details')),
        ];
      case 'user':
        return [
          const DataColumn(label: Text('User ID')),
          const DataColumn(label: Text('Username')),
          const DataColumn(label: Text('Full Name')),
          const DataColumn(label: Text('City & Country')),
          const DataColumn(label: Text('Contact Details')),
          const DataColumn(label: Text('Role')),
        ];
      default:
        return [];
    }
  }

  List<DataRow> _getReportTableRows(bool isDark) {
    if (_selectedReportType == 'sales') {
      double totalQty = 0.0;
      double totalAmt = 0.0;

      final List<DataRow> rows = _filteredRecords.map((d) {
        final rate = double.tryParse(d['rate']?.toString() ?? '0') ?? 0.0;
        final qty = double.tryParse(d['quantity']?.toString() ?? '0') ?? 0.0;
        final amt = double.tryParse(d['item_amount']?.toString() ?? '0') ?? 0.0;

        totalQty += qty;
        totalAmt += amt;

        return DataRow(cells: [
          DataCell(Text(_formatDateStr(d['sales_date']))),
          DataCell(Text(d['sales_bill_no'] ?? '--', style: const TextStyle(fontWeight: FontWeight.bold))),
          DataCell(Text(d['customer_name'] ?? 'Walk-in')),
          DataCell(Text(d['category_name'] ?? '--')),
          DataCell(Text(d['item_name'] ?? '')),
          DataCell(Text('₹${rate.toStringAsFixed(2)}')),
          DataCell(Text(qty.toStringAsFixed(1))),
          DataCell(Text('₹${amt.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF6366F1)))),
          DataCell(Text(d['created_by'] ?? '')),
        ]);
      }).toList();

      if (rows.isNotEmpty) {
        rows.add(DataRow(
          color: WidgetStateProperty.all(isDark ? const Color(0xFF1F2937) : const Color(0xFFF1F5F9)),
          cells: [
            DataCell(Text('TOTAL:', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
            const DataCell(Text('')),
            const DataCell(Text('')),
            const DataCell(Text('')),
            const DataCell(Text('')),
            const DataCell(Text('')),
            DataCell(Text(totalQty.toStringAsFixed(1), style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
            DataCell(Text('₹${totalAmt.toStringAsFixed(2)}', style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: const Color(0xFF6366F1)))),
            const DataCell(Text('')),
          ],
        ));
      }
      return rows;
    } else if (_selectedReportType == 'purchase') {
      double totalQty = 0.0;
      double totalAmt = 0.0;

      final List<DataRow> rows = _filteredRecords.map((d) {
        final rate = double.tryParse(d['rate']?.toString() ?? '0') ?? 0.0;
        final qty = double.tryParse(d['quantity']?.toString() ?? '0') ?? 0.0;
        final amt = double.tryParse(d['item_amount']?.toString() ?? '0') ?? 0.0;

        totalQty += qty;
        totalAmt += amt;

        return DataRow(cells: [
          DataCell(Text(_formatDateStr(d['purchase_date']))),
          DataCell(Text(d['purchase_bill_no'] ?? '--', style: const TextStyle(fontWeight: FontWeight.bold))),
          DataCell(Text(d['vendor_company'] != null ? '${d['vendor_name']} (${d['vendor_company']})' : '${d['vendor_name'] ?? ''}')),
          DataCell(Text(d['category_name'] ?? '--')),
          DataCell(Text(d['item_name'] ?? '')),
          DataCell(Text('₹${rate.toStringAsFixed(2)}')),
          DataCell(Text(qty.toStringAsFixed(1))),
          DataCell(Text('₹${amt.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF10B981)))),
          DataCell(Text(d['created_by'] ?? '')),
        ]);
      }).toList();

      if (rows.isNotEmpty) {
        rows.add(DataRow(
          color: WidgetStateProperty.all(isDark ? const Color(0xFF1F2937) : const Color(0xFFF1F5F9)),
          cells: [
            DataCell(Text('TOTAL:', style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
            const DataCell(Text('')),
            const DataCell(Text('')),
            const DataCell(Text('')),
            const DataCell(Text('')),
            const DataCell(Text('')),
            DataCell(Text(totalQty.toStringAsFixed(1), style: GoogleFonts.inter(fontWeight: FontWeight.bold))),
            DataCell(Text('₹${totalAmt.toStringAsFixed(2)}', style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: const Color(0xFF10B981)))),
            const DataCell(Text('')),
          ],
        ));
      }
      return rows;
    } else if (_selectedReportType == 'item') {
      return _filteredRecords.map((i) {
        final salesPrice = double.tryParse(i['sales_price']?.toString() ?? '0') ?? 0.0;
        final purchasePrice = double.tryParse(i['purchase_price']?.toString() ?? '0') ?? 0.0;
        final isActive = i['active'] == true || i['active'] == 1;

        return DataRow(cells: [
          DataCell(Text(i['item_id']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.bold))),
          DataCell(Text(i['code'] ?? 'N/A')),
          DataCell(Text(i['name'] ?? '')),
          DataCell(Text(i['category_name'] ?? 'N/A')),
          DataCell(Text(i['unit_name'] ?? 'N/A')),
          DataCell(Text(i['tax_name'] ?? 'N/A')),
          DataCell(Text('₹${salesPrice.toStringAsFixed(2)}')),
          DataCell(Text('₹${purchasePrice.toStringAsFixed(2)}')),
          DataCell(
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: isActive ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                isActive ? 'Active' : 'Inactive',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: isActive ? const Color(0xFF15803D) : const Color(0xFFB91C1C)),
              ),
            ),
          ),
        ]);
      }).toList();
    } else if (_selectedReportType == 'category') {
      return _filteredRecords.map((c) {
        final isActive = c['active'] == true || c['active'] == 1;
        return DataRow(cells: [
          DataCell(Text(c['category_id']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.bold))),
          DataCell(Text(c['name'] ?? '')),
          DataCell(
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: isActive ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                isActive ? 'Active' : 'Inactive',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: isActive ? const Color(0xFF15803D) : const Color(0xFFB91C1C)),
              ),
            ),
          ),
          DataCell(Text(_formatDateStr(c['created_date']))),
        ]);
      }).toList();
    } else if (_selectedReportType == 'customer') {
      return _filteredRecords.map((c) {
        return DataRow(cells: [
          DataCell(Text(c['customer_id']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.bold))),
          DataCell(Text('${c['first_name'] ?? ''} ${c['last_name'] ?? ''}')),
          DataCell(Text(c['address_1'] ?? '')),
          DataCell(Text('${c['city'] ?? ''}, ${c['country'] ?? ''}')),
          DataCell(Text('P: ${c['phone_1'] ?? ''} | E: ${c['email'] ?? ''}')),
        ]);
      }).toList();
    } else if (_selectedReportType == 'user') {
      return _filteredRecords.map((u) {
        return DataRow(cells: [
          DataCell(Text(u['user_id']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.bold))),
          DataCell(Text(u['username'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold))),
          DataCell(Text('${u['first_name'] ?? ''} ${u['last_name'] ?? ''}')),
          DataCell(Text('${u['city'] ?? ''}, ${u['country'] ?? ''}')),
          DataCell(Text('P: ${u['phone_1'] ?? ''} | E: ${u['email_1'] ?? ''}')),
          DataCell(
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                u['role_name'] ?? 'Staff',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
              ),
            ),
          ),
        ]);
      }).toList();
    }
    return [];
  }

  String _formatDateStr(dynamic rawDate) {
    if (rawDate == null) return '--';
    try {
      final parsed = DateTime.tryParse(rawDate.toString());
      if (parsed != null) {
        return '${parsed.day}/${parsed.month}/${parsed.year}';
      }
    } catch (_) {}
    return rawDate.toString().split('T')[0];
  }

  void _showPrintPreviewDialog() {
    showDialog(
      context: context,
      builder: (ctx) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return AlertDialog(
          backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              const Icon(Icons.print_rounded, color: Color(0xFF6366F1)),
              const SizedBox(width: 8),
              Text('Print Report Preview', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Are you sure you want to export/print the generated "${_selectedReportType.toUpperCase()}" report data?',
                style: GoogleFonts.inter(height: 1.4, color: isDark ? Colors.white70 : const Color(0xFF334155)),
              ),
              const SizedBox(height: 12),
              Text(
                'Rows: ${_filteredRecords.length} records generated matching filters.',
                style: GoogleFonts.inter(fontSize: 12, color: Colors.grey, fontStyle: FontStyle.italic),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Cancel', style: GoogleFonts.inter(color: const Color(0xFF64748B), fontWeight: FontWeight.bold)),
            ),
            ElevatedButton.icon(
              icon: const Icon(Icons.print_rounded, size: 16),
              label: Text('Send to Printer', style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6366F1),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Sent print job to local POS printer...', style: GoogleFonts.inter()),
                    backgroundColor: const Color(0xFF6366F1),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
            ),
          ],
        );
      },
    );
  }
}

class PieChartPainter extends CustomPainter {
  final List<double> values;
  final List<Color> colors;

  PieChartPainter({required this.values, required this.colors});

  @override
  void paint(Canvas canvas, Size size) {
    final double total = values.fold(0.0, (sum, val) => sum + val);
    if (total == 0) return;

    final double radius = size.width / 2;
    final Offset center = Offset(size.width / 2, size.height / 2);
    final Rect rect = Rect.fromCircle(center: center, radius: radius);

    double startAngle = -3.14159 / 2; // Start from top
    final Paint paint = Paint()..style = PaintingStyle.fill;

    for (int i = 0; i < values.length; i++) {
      final double sweepAngle = (values[i] / total) * 2 * 3.14159;
      paint.color = colors[i % colors.length];
      canvas.drawArc(rect, startAngle, sweepAngle, true, paint);
      startAngle += sweepAngle;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
