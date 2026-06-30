import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'config.dart';

class LicenseScreen extends StatefulWidget {
  const LicenseScreen({super.key});

  @override
  State<LicenseScreen> createState() => _LicenseScreenState();
}

class _LicenseScreenState extends State<LicenseScreen> {
  bool isLoading = false;
  Map<String, dynamic>? licenseData;
  String? errorMessage;

  // Renewal Form state
  String selectedPlan = '1'; // '1' = 1 year standard, '2' = 2 years premium
  String selectedPaymentMethod = 'UPI';

  @override
  void initState() {
    super.initState();
    fetchLicenseData();
  }

  Future<void> fetchLicenseData() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final url = Uri.parse('${AppConfig.baseUrl}/api/license');
      final response = await http.get(url);
      if (response.statusCode == 200) {
        setState(() {
          licenseData = json.decode(response.body);
          isLoading = false;
        });
      } else {
        throw Exception('Server returned code ${response.statusCode}');
      }
    } catch (e) {
      setState(() {
        errorMessage = 'Failed to load license info: $e';
        isLoading = false;
      });
    }
  }

  Future<void> processRenewal() async {
    setState(() {
      isLoading = true;
    });

    try {
      final url = Uri.parse('${AppConfig.baseUrl}/api/license/renew');
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('AMC License renewed successfully for 1 Year!'),
              backgroundColor: Color(0xFF10B981),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        fetchLicenseData();
      } else {
        throw Exception('Renewal failed: Code ${response.statusCode}');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: const Color(0xFFEF4444),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      setState(() {
        isLoading = false;
      });
    }
  }

  void openRenewalModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final modalBg = isDark ? const Color(0xFF151D30) : Colors.white;
        final textCol = isDark ? Colors.white : const Color(0xFF0F172A);

        return StatefulBuilder(
          builder: (context, setModalState) {
            final amt = selectedPlan == '1' ? '₹5,000' : '₹9,000';
            final amtRaw = selectedPlan == '1' ? '5000' : '9000';
            final qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=vansheeinfotech@okaxis%26pn=Vanshee%20Infotech%26am=$amtRaw%26cu=INR';

            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom,
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: modalBg,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                ),
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Online AMC & License Renewal',
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: textCol,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    Text(
                      'Select Support/License Package:',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white70 : const Color(0xFF475569),
                      ),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      initialValue: selectedPlan,
                      dropdownColor: modalBg,
                      style: GoogleFonts.inter(color: textCol, fontSize: 13.5),
                      decoration: InputDecoration(
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      items: const [
                        DropdownMenuItem(value: '1', child: Text('1 Year AMC + Standard License (₹5,000)')),
                        DropdownMenuItem(value: '2', child: Text('2 Years AMC + Premium License (₹9,000)')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() => selectedPlan = val);
                        }
                      },
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Choose Payment Method:',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white70 : const Color(0xFF475569),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => setModalState(() => selectedPaymentMethod = 'UPI'),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: selectedPaymentMethod == 'UPI'
                                    ? const Color(0xFFECFDF5)
                                    : (isDark ? const Color(0xFF0B0F19) : const Color(0xFFF8FAFC)),
                                border: Border.all(
                                  color: selectedPaymentMethod == 'UPI'
                                      ? const Color(0xFF10B981)
                                      : (isDark ? const Color(0xFF1F2937) : const Color(0xFFCBD5E1)),
                                  width: 1.5,
                                ),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Center(
                                child: Text(
                                  'UPI Instant QR',
                                  style: GoogleFonts.inter(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.bold,
                                    color: selectedPaymentMethod == 'UPI'
                                        ? const Color(0xFF15803D)
                                        : textCol,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: InkWell(
                            onTap: () => setModalState(() => selectedPaymentMethod = 'Card'),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              decoration: BoxDecoration(
                                color: selectedPaymentMethod == 'Card'
                                    ? const Color(0xFFEEF2FF)
                                    : (isDark ? const Color(0xFF0B0F19) : const Color(0xFFF8FAFC)),
                                border: Border.all(
                                  color: selectedPaymentMethod == 'Card'
                                      ? const Color(0xFF6366F1)
                                      : (isDark ? const Color(0xFF1F2937) : const Color(0xFFCBD5E1)),
                                  width: 1.5,
                                ),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Center(
                                child: Text(
                                  'Credit / Debit Card',
                                  style: GoogleFonts.inter(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.bold,
                                    color: selectedPaymentMethod == 'Card'
                                        ? const Color(0xFF4F46E5)
                                        : textCol,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    if (selectedPaymentMethod == 'UPI') ...[
                      Center(
                        child: Column(
                          children: [
                            Text(
                              'Scan UPI QR Code to Pay $amt',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: textCol,
                              ),
                            ),
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.grey.shade300),
                              ),
                              child: Image.network(
                                qrUrl,
                                width: 140,
                                height: 140,
                                errorBuilder: (context, error, stackTrace) => const Icon(
                                  Icons.qr_code_2_rounded,
                                  size: 140,
                                  color: Colors.grey,
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Merchant: Vanshee Infotech',
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                color: const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ] else ...[
                      Column(
                        children: [
                          TextField(
                            style: GoogleFonts.inter(color: textCol, fontSize: 13),
                            decoration: InputDecoration(
                              labelText: 'Card Number',
                              labelStyle: TextStyle(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                              isDense: true,
                              prefixIcon: const Icon(Icons.credit_card_rounded),
                            ),
                            keyboardType: TextInputType.number,
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  style: GoogleFonts.inter(color: textCol, fontSize: 13),
                                  decoration: InputDecoration(
                                    labelText: 'Expiry (MM/YY)',
                                    labelStyle: TextStyle(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                    isDense: true,
                                  ),
                                  keyboardType: TextInputType.number,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: TextField(
                                  style: GoogleFonts.inter(color: textCol, fontSize: 13),
                                  decoration: InputDecoration(
                                    labelText: 'CVV / Secure Code',
                                    labelStyle: TextStyle(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                    isDense: true,
                                  ),
                                  keyboardType: TextInputType.number,
                                  obscureText: true,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF6366F1),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: () {
                          Navigator.pop(context);
                          processRenewal();
                        },
                        child: Text(
                          'Confirm & Process Payment ($amt)',
                          style: GoogleFonts.inter(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
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
    final primaryColor = Theme.of(context).primaryColor;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textCol = isDark ? Colors.white : const Color(0xFF0F172A);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'AMC & License Management',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        elevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: textCol,
      ),
      body: isLoading
          ? Center(child: CircularProgressIndicator(color: primaryColor))
          : RefreshIndicator(
              onRefresh: fetchLicenseData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (errorMessage != null) ...[
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEE2E2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFEF4444)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, color: Color(0xFFB91C1C)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                errorMessage!,
                                style: GoogleFonts.inter(
                                  color: const Color(0xFFB91C1C),
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    if (licenseData != null) ...[
                      _buildAlertBanner(isDark),
                      const SizedBox(height: 18),
                      _buildLicenseDetailsCard(isDark, primaryColor),
                      const SizedBox(height: 24),
                      _buildRenewalSupportCard(isDark, primaryColor),
                    ],
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildAlertBanner(bool isDark) {
    final status = licenseData!['status'] ?? 'Active';
    final remainingDays = licenseData!['remaining_days'] ?? 0;
    final valToRaw = licenseData!['valid_to']?.toString().split('T')[0] ?? '';
    
    if (status == 'Expired') {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFFEE2E2),
          borderRadius: BorderRadius.circular(12),
          border: const Border(left: BorderSide(color: Color(0xFFEF4444), width: 5)),
        ),
        child: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: Color(0xFFB91C1C), size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Your software license and AMC support expired on $valToRaw. Please renew online instantly to restore all operations.',
                style: GoogleFonts.inter(
                  color: const Color(0xFF991B1B),
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      );
    } else if (status == 'Renewal Due') {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF3C7),
          borderRadius: BorderRadius.circular(12),
          border: const Border(left: BorderSide(color: Color(0xFFD97706), width: 5)),
        ),
        child: Row(
          children: [
            const Icon(Icons.info_outline_rounded, color: Color(0xFFB45309), size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Your Annual Maintenance Contract is expiring in $remainingDays days. Please renew online instantly to prevent system disruption.',
                style: GoogleFonts.inter(
                  color: const Color(0xFF92400E),
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      );
    }
    return const SizedBox();
  }

  Widget _buildLicenseDetailsCard(bool isDark, Color primaryColor) {
    final status = licenseData!['status'] ?? 'Active';
    final valKey = licenseData!['license_key'] ?? '--';
    final valFrom = licenseData!['valid_from']?.toString().split('T')[0] ?? '';
    final valTo = licenseData!['valid_to']?.toString().split('T')[0] ?? '';
    final amcStart = licenseData!['amc_start_date']?.toString().split('T')[0] ?? '';
    final amcEnd = licenseData!['amc_end_date']?.toString().split('T')[0] ?? '';
    final remainingDays = licenseData!['remaining_days'] ?? 0;

    Color badgeBg;
    Color badgeText;
    if (status == 'Expired') {
      badgeBg = const Color(0xFFFEE2E2);
      badgeText = const Color(0xFFB91C1C);
    } else if (status == 'Renewal Due') {
      badgeBg = const Color(0xFFFEF3C7);
      badgeText = const Color(0xFFB45309);
    } else {
      badgeBg = const Color(0xFFDCFCE7);
      badgeText = const Color(0xFF15803D);
    }

    final cardBg = isDark ? const Color(0xFF151D30) : Colors.white;
    final textCol = isDark ? Colors.white : const Color(0xFF0F172A);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF1F2937) : const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'License Parameters',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: textCol,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: badgeBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: badgeText,
                  ),
                ),
              ),
            ],
          ),
          const Divider(height: 24),
          _buildInfoRow('License Key', valKey, textCol),
          _buildInfoRow('Registered From', valFrom, textCol),
          _buildInfoRow('Valid Until', valTo, textCol),
          _buildInfoRow('AMC Coverage Period', '$amcStart to $amcEnd', textCol),
          _buildInfoRow('Support SLA Status', remainingDays > 0 ? 'Covered' : 'Expired / Off SLA', textCol),
          _buildInfoRow('Remaining Validity', '$remainingDays Days', remainingDays > 30 ? const Color(0xFF10B981) : const Color(0xFFEF4444), isBold: true),
        ],
      ),
    );
  }

  Widget _buildRenewalSupportCard(bool isDark, Color primaryColor) {
    final cardBg = isDark ? const Color(0xFF151D30) : Colors.white;
    final textCol = isDark ? Colors.white : const Color(0xFF0F172A);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardBg,
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
            'Instant Renewal Panel',
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: textCol,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Your AMC support contract includes major software enhancements, statutory GST updates, daily secure cloud backup storage, and direct WhatsApp support channel access.',
            style: GoogleFonts.inter(
              fontSize: 12.5,
              height: 1.4,
              color: isDark ? Colors.white70 : const Color(0xFF475569),
            ),
          ),
          const Divider(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.bolt_rounded),
              label: Text(
                'Renew License & Support Now',
                style: GoogleFonts.inter(fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: openRenewalModal,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, Color valColor, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 12.5,
              color: const Color(0xFF94A3B8),
              fontWeight: FontWeight.w600,
            ),
          ),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 13,
              color: valColor,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }
}
