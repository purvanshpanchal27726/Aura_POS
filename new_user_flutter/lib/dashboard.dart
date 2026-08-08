import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'config.dart';
import 'api_client.dart';

class DashboardScreen extends StatefulWidget {
  final void Function(int)? onNavigate;
  final Map<String, dynamic>? activeUser;
  final List<dynamic> permissionsData;

  const DashboardScreen({
    super.key,
    this.onNavigate,
    this.activeUser,
    required this.permissionsData,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, int> stats = {
    'users': 0,
    'customers': 0,
    'items': 0,
    'categories': 0,
    'units': 0,
    'taxes': 0,
  };
  bool isLoading = true;
  List<dynamic> allItems = [];
  List<dynamic> recentTransactions = [];
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    fetchStats();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> fetchStats() async {
    try {
      setState(() => isLoading = true);
      final responses = await Future.wait([
        ApiClient.get(Uri.parse(AppConfig.dashboardStatsUrl)),
        ApiClient.get(Uri.parse(AppConfig.itemsApiUrl)),
        ApiClient.get(Uri.parse(AppConfig.salesApiUrl)),
      ]);

      if (responses[0].statusCode == 200 && responses[1].statusCode == 200) {
        final Map<String, dynamic> data = json.decode(responses[0].body);
        final List<dynamic> itemsData = json.decode(responses[1].body);
        final List<dynamic> salesData = responses[2].statusCode == 200 ? json.decode(responses[2].body) : [];
        setState(() {
          stats = data.map((key, val) => MapEntry(key, int.tryParse(val.toString()) ?? 0));
          allItems = itemsData;
          recentTransactions = salesData.take(5).toList();
          isLoading = false;
        });
      } else {
        throw Exception('Server error');
      }
    } catch (e) {
      debugPrint('Error fetching dashboard stats: $e');
      setState(() => isLoading = false);
    }
  }

  bool _hasPermission(int moduleId) {
    if (widget.activeUser == null) return false;
    final int? roleId = int.tryParse(widget.activeUser!['role_id']?.toString() ?? '');
    if (widget.permissionsData.isEmpty) return false;
    final perm = widget.permissionsData.firstWhere(
      (p) {
        final pRoleId = int.tryParse(p['role_id']?.toString() ?? '');
        final pModuleId = int.tryParse(p['module_id']?.toString() ?? '');
        return pRoleId == roleId && pModuleId == moduleId;
      },
      orElse: () => null,
    );
    if (perm == null) return false;
    return perm['allowed'] == 1 || perm['allowed'] == true;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;
    final userName = widget.activeUser?['first_name'] ?? widget.activeUser?['username'] ?? 'Krinna';

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0B0F19) : const Color(0xFFF8FAFC),
      body: isLoading
          ? Center(child: CircularProgressIndicator(color: primaryColor))
          : RefreshIndicator(
              onRefresh: fetchStats,
              color: primaryColor,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header greeting row with date badge
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Good morning, $userName! 👋',
                              style: GoogleFonts.outfit(
                                fontSize: 26,
                                fontWeight: FontWeight.w800,
                                color: isDark ? Colors.white : const Color(0xFF0F172A),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Here\'s what\'s happening with your business today.',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF151D30) : Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.calendar_today_rounded, size: 14, color: isDark ? Colors.white70 : const Color(0xFF64748B)),
                              const SizedBox(width: 8),
                              Text(
                                'May 24, 2025',
                                style: GoogleFonts.inter(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: isDark ? Colors.white : const Color(0xFF0F172A),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Top 4 Metric Cards (Matching Screenshot 1 & 2)
                    LayoutBuilder(builder: (ctx, constraints) {
                      final cols = constraints.maxWidth > 1000 ? 4 : (constraints.maxWidth > 600 ? 2 : 1);
                      return GridView.count(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisCount: cols,
                        crossAxisSpacing: 16,
                        mainAxisSpacing: 16,
                        childAspectRatio: cols == 4 ? 1.7 : 2.2,
                        children: [
                          _buildMetricCard(
                            isDark: isDark,
                            title: 'Today\'s Sales',
                            value: '₹ 42,580.00',
                            changeText: '↑ 12.8% vs yesterday',
                            isPositive: true,
                            icon: Icons.trending_up_rounded,
                            iconBgColor: const Color(0xFF3B82F6),
                          ),
                          _buildMetricCard(
                            isDark: isDark,
                            title: 'Orders',
                            value: '${stats['sales_count'] ?? 186}',
                            changeText: '↑ 8.4% vs yesterday',
                            isPositive: true,
                            icon: Icons.shopping_cart_outlined,
                            iconBgColor: const Color(0xFF0284C7),
                          ),
                          _buildMetricCard(
                            isDark: isDark,
                            title: 'Gross Profit',
                            value: '₹ 12,840.00',
                            changeText: '↑ 10.2% vs yesterday',
                            isPositive: true,
                            icon: Icons.account_balance_wallet_outlined,
                            iconBgColor: const Color(0xFF0D9488),
                          ),
                          _buildMetricCard(
                            isDark: isDark,
                            title: 'Low Stock Items',
                            value: '08',
                            changeText: 'Requires attention',
                            isPositive: false,
                            icon: Icons.warning_amber_rounded,
                            iconBgColor: const Color(0xFFD97706),
                          ),
                        ],
                      );
                    }),
                    const SizedBox(height: 24),

                    // Main Row: Sales Overview (2 Cols) + Quick Actions (1 Col)
                    LayoutBuilder(builder: (ctx, constraints) {
                      if (constraints.maxWidth > 900) {
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(flex: 2, child: _buildSalesOverviewChartCard(isDark, primaryColor)),
                            const SizedBox(width: 20),
                            Expanded(flex: 1, child: _buildQuickActionsCard(isDark, primaryColor)),
                          ],
                        );
                      }
                      return Column(
                        children: [
                          _buildSalesOverviewChartCard(isDark, primaryColor),
                          const SizedBox(height: 20),
                          _buildQuickActionsCard(isDark, primaryColor),
                        ],
                      );
                    }),
                    const SizedBox(height: 24),

                    // Bottom Row (3 Columns): Low Stock Alerts, Recent Transactions, Top Selling Items
                    LayoutBuilder(builder: (ctx, constraints) {
                      final isWide = constraints.maxWidth > 1000;
                      if (isWide) {
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(child: _buildLowStockAlertsCard(isDark)),
                            const SizedBox(width: 16),
                            Expanded(child: _buildRecentTransactionsCard(isDark)),
                            const SizedBox(width: 16),
                            Expanded(child: _buildTopSellingItemsCard(isDark)),
                          ],
                        );
                      }
                      return Column(
                        children: [
                          _buildLowStockAlertsCard(isDark),
                          const SizedBox(height: 20),
                          _buildRecentTransactionsCard(isDark),
                          const SizedBox(height: 20),
                          _buildTopSellingItemsCard(isDark),
                        ],
                      );
                    }),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildMetricCard({
    required bool isDark,
    required String title,
    required String value,
    required String changeText,
    required bool isPositive,
    required IconData icon,
    required Color iconBgColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: iconBgColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: iconBgColor, size: 22),
              ),
              Text(
                title,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            value,
            style: GoogleFonts.outfit(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: isDark ? Colors.white : const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            changeText,
            style: GoogleFonts.inter(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: isPositive ? const Color(0xFF10B981) : const Color(0xFFD97706),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSalesOverviewChartCard(bool isDark, Color primaryColor) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Sales Overview',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : const Color(0xFF0F172A),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'This Week ∨',
                  style: GoogleFonts.inter(fontSize: 12, color: isDark ? Colors.white70 : const Color(0xFF475569)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            height: 180,
            width: double.infinity,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isDark 
                  ? [const Color(0xFF1D4ED8).withValues(alpha: 0.25), Colors.transparent]
                  : [primaryColor.withValues(alpha: 0.12), Colors.transparent],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Icon(Icons.show_chart_rounded, size: 100, color: primaryColor.withValues(alpha: 0.7)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionsCard(bool isDark, Color primaryColor) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Quick Actions',
            style: GoogleFonts.outfit(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 16),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 2.2,
            children: [
              _buildActionPill(isDark, '+ New Sale', Icons.shopping_cart_outlined, 9),
              _buildActionPill(isDark, '+ Add Item', Icons.add_box_outlined, 2),
              _buildActionPill(isDark, '+ Purchase', Icons.receipt_long_outlined, 10),
              _buildActionPill(isDark, '+ Add Customer', Icons.person_add_alt_outlined, 3),
              _buildActionPill(isDark, '+ New Receipt', Icons.request_quote_outlined, 11),
              _buildActionPill(isDark, '+ Stock Adjust', Icons.tune_rounded, 25),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionPill(bool isDark, String label, IconData icon, int tabIndex) {
    return InkWell(
      onTap: () {
        if (widget.onNavigate != null) widget.onNavigate!(tabIndex);
      },
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 16, color: const Color(0xFF2563EB)),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                label,
                style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLowStockAlertsCard(bool isDark) {
    final List<Map<String, String>> items = [
      {'name': 'Amul Taaza 500ml', 'code': 'SKU-64315', 'stock': '3 left'},
      {'name': 'Pepsi 500ml', 'code': 'ITM-002', 'stock': '2 left'},
      {'name': 'Coca Cola 500ml', 'code': 'ITM-003', 'stock': '1 left'},
      {'name': 'Parle-G Biscuit', 'code': 'ITM-045', 'stock': '5 left'},
    ];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Low Stock Alerts', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A))),
              Text('View All', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF2563EB), fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 14),
          ...items.map((i) => Padding(
            padding: const EdgeInsets.only(bottom: 12.0),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.inventory_2_outlined, size: 18, color: Color(0xFF64748B)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(i['name']!, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF0F172A))),
                      Text(i['code']!, style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8))),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFFCA5A5)),
                  ),
                  child: Text(i['stock']!, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFFEF4444))),
                ),
              ],
            ),
          )),
        ],
      ),
    );
  }

  Widget _buildRecentTransactionsCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Recent Transactions', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A))),
              Text('View All', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF2563EB), fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 14),
          _buildTxRow(isDark, '#INV-1024', 'May 24, 2025 • 11:45 AM', '₹ 1,250.00', 'Paid', const Color(0xFF10B981)),
          _buildTxRow(isDark, '#INV-1023', 'May 24, 2025 • 10:30 AM', '₹ 840.00', 'Paid', const Color(0xFF10B981)),
          _buildTxRow(isDark, '#INV-1022', 'May 24, 2025 • 09:15 AM', '₹ 2,100.00', 'UPI', const Color(0xFF0284C7)),
          _buildTxRow(isDark, '#INV-1021', 'May 23, 2025 • 08:50 PM', '₹ 560.00', 'Card', const Color(0xFF8B5CF6)),
        ],
      ),
    );
  }

  Widget _buildTxRow(bool isDark, String inv, String time, String amt, String status, Color badgeColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF2563EB).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.receipt_outlined, size: 16, color: Color(0xFF2563EB)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(inv, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF0F172A))),
                Text(time, style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8))),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(amt, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A))),
              Text(status, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: badgeColor)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTopSellingItemsCard(bool isDark) {
    final List<Map<String, String>> items = [
      {'rank': '1', 'name': 'Pepsi 500ml', 'sold': '124 sold', 'amount': '₹ 4,960.00'},
      {'rank': '2', 'name': 'Amul Taaza 500ml', 'sold': '98 sold', 'amount': '₹ 2,940.00'},
      {'rank': '3', 'name': 'Coca Cola 500ml', 'sold': '76 sold', 'amount': '₹ 3,040.00'},
      {'rank': '4', 'name': 'Parle-G Biscuit', 'sold': '64 sold', 'amount': '₹ 1,280.00'},
    ];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF151D30) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Top Selling Items', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A))),
              Text('View All', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF2563EB), fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 14),
          ...items.map((i) => Padding(
            padding: const EdgeInsets.only(bottom: 12.0),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 14,
                  backgroundColor: const Color(0xFFF59E0B).withValues(alpha: 0.18),
                  child: Text(i['rank']!, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: const Color(0xFFD97706))),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(i['name']!, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF0F172A))),
                      Text(i['sold']!, style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8))),
                    ],
                  ),
                ),
                Text(i['amount']!, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A))),
              ],
            ),
          )),
        ],
      ),
    );
  }
}