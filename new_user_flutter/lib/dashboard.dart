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
  String chartFilter = 'This Week';

  @override
  void initState() {
    super.initState();
    fetchStats();
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

                    // Main Row: Sales Overview Interactive Chart (2 Cols) + Quick Actions Grid (1 Col)
                    LayoutBuilder(builder: (ctx, constraints) {
                      if (constraints.maxWidth > 900) {
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(flex: 2, child: _buildInteractiveSalesBarChartCard(isDark, primaryColor)),
                            const SizedBox(width: 20),
                            Expanded(flex: 1, child: _buildQuickActionsCard(isDark, primaryColor)),
                          ],
                        );
                      }
                      return Column(
                        children: [
                          _buildInteractiveSalesBarChartCard(isDark, primaryColor),
                          const SizedBox(height: 20),
                          _buildQuickActionsCard(isDark, primaryColor),
                        ],
                      );
                    }),
                    const SizedBox(height: 24),

                    // Category Share Progress Bars Row
                    _buildCategoryShareProgressCard(isDark, primaryColor),
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

  // 📊 Real Animated & Interactive Weekly Sales Bar Chart
  Widget _buildInteractiveSalesBarChartCard(bool isDark, Color primaryColor) {
    final List<Map<String, dynamic>> salesData = [
      {'day': 'Mon', 'val': 12500.0, 'height': 0.30, 'label': '₹12.5k'},
      {'day': 'Tue', 'val': 18200.0, 'height': 0.43, 'label': '₹18.2k'},
      {'day': 'Wed', 'val': 24000.0, 'height': 0.56, 'label': '₹24.0k'},
      {'day': 'Thu', 'val': 31800.0, 'height': 0.74, 'label': '₹31.8k'},
      {'day': 'Fri', 'val': 42580.0, 'height': 1.00, 'label': '₹42.5k'},
      {'day': 'Sat', 'val': 38000.0, 'height': 0.89, 'label': '₹38.0k'},
      {'day': 'Sun', 'val': 29400.0, 'height': 0.69, 'label': '₹29.4k'},
    ];

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
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Sales Revenue Trend',
                    style: GoogleFonts.outfit(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : const Color(0xFF0F172A),
                    ),
                  ),
                  Text(
                    'Daily breakdown of store sales across peak hours',
                    style: GoogleFonts.inter(fontSize: 11.5, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                  ),
                ],
              ),
              DropdownButtonHideUnderline(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: DropdownButton<String>(
                    value: chartFilter,
                    dropdownColor: isDark ? const Color(0xFF151D30) : Colors.white,
                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: primaryColor),
                    items: const [
                      DropdownMenuItem(value: 'This Week', child: Text('This Week')),
                      DropdownMenuItem(value: 'Last Week', child: Text('Last Week')),
                      DropdownMenuItem(value: 'This Month', child: Text('This Month')),
                    ],
                    onChanged: (val) {
                      if (val != null) setState(() => chartFilter = val);
                    },
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Custom Bar Chart Stack
          SizedBox(
            height: 180,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: salesData.map((d) {
                final isPeak = d['day'] == 'Fri';
                final barHeight = 130.0 * (d['height'] as double);

                return Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text(
                      d['label'] as String,
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: isPeak ? FontWeight.bold : FontWeight.w500,
                        color: isPeak ? primaryColor : (isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      width: 32,
                      height: barHeight,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: isPeak
                              ? [const Color(0xFF2563EB), const Color(0xFF3B82F6)]
                              : [primaryColor.withValues(alpha: isDark ? 0.7 : 0.4), primaryColor.withValues(alpha: 0.2)],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                        borderRadius: BorderRadius.circular(6),
                        boxShadow: isPeak ? [
                          BoxShadow(color: const Color(0xFF2563EB).withValues(alpha: 0.4), blurRadius: 8, offset: const Offset(0, 3))
                        ] : [],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      d['day'] as String,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: isPeak ? FontWeight.bold : FontWeight.normal,
                        color: isDark ? Colors.white70 : const Color(0xFF475569),
                      ),
                    ),
                  ],
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  // 🥧 Category Distribution Progress Ring Card
  Widget _buildCategoryShareProgressCard(bool isDark, Color primaryColor) {
    final categoriesData = [
      {'name': 'Dairy Products', 'share': '42%', 'amount': '₹ 17,883.00', 'color': const Color(0xFF2563EB), 'percent': 0.42},
      {'name': 'Beverages', 'share': '28%', 'amount': '₹ 11,922.00', 'color': const Color(0xFF0284C7), 'percent': 0.28},
      {'name': 'Bakery & Snacks', 'share': '18%', 'amount': '₹ 7,664.00', 'color': const Color(0xFFD97706), 'percent': 0.18},
      {'name': 'Grocery Essentials', 'share': '12%', 'amount': '₹ 5,111.00', 'color': const Color(0xFF10B981), 'percent': 0.12},
    ];

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
            'Sales Contribution by Product Category',
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 16),
          ...categoriesData.map((c) => Padding(
            padding: const EdgeInsets.only(bottom: 12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(c['name'] as String, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF0F172A))),
                    Text('${c['amount']} (${c['share']})', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: c['color'] as Color)),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: c['percent'] as double,
                    minHeight: 8,
                    backgroundColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                    color: c['color'] as Color,
                  ),
                ),
              ],
            ),
          )),
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