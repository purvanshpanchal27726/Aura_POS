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
  List<dynamic> filteredItems = [];
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

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
      ]);

      if (responses[0].statusCode == 200 && responses[1].statusCode == 200) {
        final Map<String, dynamic> data = json.decode(responses[0].body);
        final List<dynamic> itemsData = json.decode(responses[1].body);
        setState(() {
          stats = data.map((key, val) => MapEntry(key, int.tryParse(val.toString()) ?? 0));
          allItems = itemsData;
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
    final userName = widget.activeUser?['first_name'] ?? widget.activeUser?['username'] ?? 'User';
    final roleName = widget.activeUser?['role_name'] ?? 'Staff';

    return Scaffold(
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
                    // Greeting Banner
                    Container(
                      padding: const EdgeInsets.all(28.0),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: isDark 
                            ? [const Color(0xFF312E81), const Color(0xFF1E1B4B), const Color(0xFF111827)]
                            : [primaryColor, primaryColor.withValues(alpha: 0.85), primaryColor.withValues(alpha: 0.7)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: primaryColor.withValues(alpha: isDark ? 0.2 : 0.3),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          )
                        ],
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Welcome back, $userName! 👋',
                                  style: GoogleFonts.outfit(
                                    fontSize: 26,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white,
                                    letterSpacing: -0.5,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'Logged in as $roleName. Here is your terminal administrative summary overview.',
                                  style: GoogleFonts.inter(
                                    fontSize: 13,
                                    color: Colors.white.withValues(alpha: 0.85),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (MediaQuery.of(context).size.width > 600)
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.15),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.point_of_sale_rounded, color: Colors.white, size: 40),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Quick Product Lookup Widget
                    _buildProductLookupWidget(isDark, primaryColor),
                    const SizedBox(height: 24),

                    // Quick Actions Section
                    Text(
                      'Terminal Quick Actions',
                      style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : const Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 14),
                    _buildQuickActionsGrid(isDark, primaryColor),
                    const SizedBox(height: 32),

                    // Real-time metrics title
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'System Configuration Statistics',
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : const Color(0xFF0F172A),
                          ),
                        ),
                        IconButton(
                          onPressed: fetchStats,
                          icon: Icon(Icons.refresh_rounded, color: isDark ? Colors.white70 : const Color(0xFF475569)),
                          tooltip: 'Refresh Metrics',
                        )
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Layout stats in a responsive grid
                    LayoutBuilder(
                      builder: (context, constraints) {
                        int crossAxisCount = 2;
                        if (constraints.maxWidth > 900) {
                          crossAxisCount = 3;
                        } else if (constraints.maxWidth < 600) {
                          crossAxisCount = 1;
                        }

                        final List<Widget> cards = [];
                        
                        if (_hasPermission(1)) {
                          cards.add(_buildStatCard(
                            title: 'Registered Users',
                            value: stats['users'] ?? 0,
                            icon: Icons.people_rounded,
                            gradientColors: [const Color(0xFF3B82F6), const Color(0xFF1D4ED8)],
                            tabIndex: 6,
                          ));
                        }
                        if (_hasPermission(3)) {
                          cards.add(_buildStatCard(
                            title: 'Stock Items',
                            value: stats['items'] ?? 0,
                            icon: Icons.inventory_2_rounded,
                            gradientColors: [const Color(0xFF10B981), const Color(0xFF047857)],
                            tabIndex: 2,
                          ));
                          cards.add(_buildStatCard(
                            title: 'Categories',
                            value: stats['categories'] ?? 0,
                            icon: Icons.category_rounded,
                            gradientColors: [const Color(0xFFF59E0B), const Color(0xFFB45309)],
                            tabIndex: 1,
                          ));
                          cards.add(_buildStatCard(
                            title: 'Measurement Units',
                            value: stats['units'] ?? 0,
                            icon: Icons.straighten_rounded,
                            gradientColors: [const Color(0xFF8B5CF6), const Color(0xFF6D28D9)],
                            tabIndex: 5,
                          ));
                          cards.add(_buildStatCard(
                            title: 'Tax Configurations',
                            value: stats['taxes'] ?? 0,
                            icon: Icons.percent_rounded,
                            gradientColors: [const Color(0xFFEC4899), const Color(0xFFBE185D)],
                            tabIndex: 7,
                          ));
                        }
                        if (_hasPermission(2)) {
                          cards.add(_buildStatCard(
                            title: 'Registered Customers',
                            value: stats['customers'] ?? 0,
                            icon: Icons.contact_mail_rounded,
                            gradientColors: [const Color(0xFF06B6D4), const Color(0xFF0891B2)],
                            tabIndex: 3,
                          ));
                        }

                        if (cards.isEmpty) {
                          return Center(
                            child: Padding(
                              padding: const EdgeInsets.all(32.0),
                              child: Text(
                                'No modules configured for your role access.', 
                                style: GoogleFonts.inter(color: const Color(0xFF64748B)),
                              ),
                            ),
                          );
                        }

                        return GridView.count(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisCount: crossAxisCount,
                          crossAxisSpacing: 18,
                          mainAxisSpacing: 18,
                          childAspectRatio: 2.1,
                          children: cards,
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildQuickActionsGrid(bool isDark, Color primaryColor) {
    final List<Widget> actions = [];

    if (_hasPermission(4)) {
      actions.add(_buildActionButton(
        label: 'New Sell',
        icon: Icons.shopping_cart_checkout_rounded,
        color: const Color(0xFF6366F1),
        tabIndex: 9, // Sell Screen index
      ));
    }
    if (_hasPermission(5) && !AppConfig.isRestaurantMode) {
      actions.add(_buildActionButton(
        label: 'Purchase Inward',
        icon: Icons.receipt_long_rounded,
        color: const Color(0xFF10B981),
        tabIndex: 10, // Purchase Screen
      ));
    }
    if (_hasPermission(6)) {
      actions.add(_buildActionButton(
        label: 'View Reports',
        icon: Icons.assessment_rounded,
        color: const Color(0xFFF59E0B),
        tabIndex: 12, // Reports Screen
      ));
    }
    if (_hasPermission(3)) {
      actions.add(_buildActionButton(
        label: 'Add Item',
        icon: Icons.add_circle_outline_rounded,
        color: const Color(0xFF06B6D4),
        tabIndex: 2, // Item Screen
      ));
    }

    if (actions.isEmpty) return const SizedBox();

    return LayoutBuilder(builder: (ctx, constraints) {
      final cols = constraints.maxWidth > 600 ? actions.length : 2;
      return GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: cols,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
        childAspectRatio: cols == 2 ? 2.5 : 3.0,
        children: actions,
      );
    });
  }

  Widget _buildActionButton({
    required String label,
    required IconData icon,
    required Color color,
    required int tabIndex,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return InkWell(
      onTap: () {
        if (widget.onNavigate != null) {
          widget.onNavigate!(tabIndex);
        }
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E293B) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
          ),
          boxShadow: const [
            BoxShadow(
              color: Colors.black12,
              blurRadius: 4,
              offset: Offset(0, 2),
            )
          ]
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.bold,
                  fontSize: 13.5,
                  color: isDark ? Colors.white : const Color(0xFF0F172A),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Icon(Icons.arrow_forward_ios_rounded, size: 12, color: color),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard({
    required String title,
    required int value,
    required IconData icon,
    required List<Color> gradientColors,
    required int tabIndex,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Card(
      child: InkWell(
        onTap: () {
          if (widget.onNavigate != null) {
            widget.onNavigate!(tabIndex);
          }
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(18.0),
          child: Row(
            children: [
              // Icon Badge Container with Gradient
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: gradientColors,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: gradientColors[0].withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    )
                  ],
                ),
                child: Icon(icon, color: Colors.white, size: 24),
              ),
              const SizedBox(width: 16),

              // Description and Count Value
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.inter(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      value.toString(),
                      style: GoogleFonts.outfit(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: isDark ? Colors.white : const Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ),

              // Arrow with style
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.chevron_right_rounded,
                  color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                  size: 18,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _getItemImage(dynamic imageUrlOrBase64, {double size = 36}) {
    if (imageUrlOrBase64 == null || imageUrlOrBase64.toString().isEmpty) {
      return Icon(Icons.image, size: size, color: Colors.grey);
    }
    final imgStr = imageUrlOrBase64.toString();
    if (imgStr.startsWith('http://') || imgStr.startsWith('https://')) {
      return Image.network(
        imgStr,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (ctx, err, st) => Icon(Icons.broken_image, size: size, color: Colors.grey),
      );
    } else if (imgStr.startsWith('/uploads/') || imgStr.startsWith('/Images/')) {
      final fullUrl = '${AppConfig.baseUrl}$imgStr';
      return Image.network(
        fullUrl,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (ctx, err, st) => Icon(Icons.broken_image, size: size, color: Colors.grey),
      );
    } else if (imgStr.contains('base64,')) {
      try {
        final base64Data = imgStr.split('base64,').last;
        return Image.memory(
          base64Decode(base64Data),
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (ctx, err, st) => Icon(Icons.broken_image, size: size, color: Colors.grey),
        );
      } catch (e) {
        return Icon(Icons.broken_image, size: size, color: Colors.grey);
      }
    } else {
      try {
        return Image.memory(
          base64Decode(imgStr),
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (ctx, err, st) => Icon(Icons.broken_image, size: size, color: Colors.grey),
        );
      } catch (e) {
        return Icon(Icons.image, size: size, color: Colors.grey);
      }
    }
  }

  Widget _buildProductLookupWidget(bool isDark, Color primaryColor) {
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
            'Quick Product Lookup',
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _searchController,
            onChanged: (val) {
              setState(() {
                _searchQuery = val.trim().toLowerCase();
                if (_searchQuery.isEmpty) {
                  filteredItems = [];
                } else {
                  filteredItems = allItems.where((item) {
                    final name = (item['name'] ?? '').toString().toLowerCase();
                    final code = (item['code'] ?? '').toString().toLowerCase();
                    return name.contains(_searchQuery) || code.contains(_searchQuery);
                  }).toList();
                }
              });
            },
            style: GoogleFonts.inter(color: isDark ? Colors.white : const Color(0xFF0F172A), fontSize: 14),
            decoration: InputDecoration(
              hintText: 'Scan barcode or type item name...',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded),
                      onPressed: () {
                        _searchController.clear();
                        setState(() {
                          _searchQuery = '';
                          filteredItems = [];
                        });
                      },
                    )
                  : null,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: primaryColor, width: 1.5),
              ),
            ),
          ),
          if (_searchQuery.isNotEmpty) ...[
            const SizedBox(height: 16),
            filteredItems.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16.0),
                      child: Text(
                        'No matching items found.',
                        style: GoogleFonts.inter(color: const Color(0xFF94A3B8), fontSize: 13),
                      ),
                    ),
                  )
                : Container(
                    constraints: const BoxConstraints(maxHeight: 220),
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: filteredItems.length,
                      itemBuilder: (context, index) {
                        final item = filteredItems[index];
                        final name = item['name'] ?? '';
                        final code = item['code'] ?? 'No Code';
                        final price = double.tryParse(item['sales_price']?.toString() ?? '0') ?? 0.0;
                        final desc = item['description'] ?? 'No description';
                        
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          elevation: 0,
                          color: isDark ? const Color(0xFF0B0F19) : const Color(0xFFF8FAFC),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                            side: BorderSide(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
                          ),
                          child: ListTile(
                            leading: ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: _getItemImage(item['image'], size: 40),
                            ),
                            title: Text(
                              name,
                              style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            subtitle: Text(
                              'Code: $code | $desc',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.inter(fontSize: 12),
                            ),
                            trailing: Text(
                              '₹${price.toStringAsFixed(2)}',
                              style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: primaryColor, fontSize: 14),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
          ],
        ],
      ),
    );
  }
}