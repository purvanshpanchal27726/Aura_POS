import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  Future<void> _launch(BuildContext context, String urlString, String clipboardFallback) async {
    final Uri url = Uri.parse(urlString);
    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        throw 'Could not launch $urlString';
      }
    } catch (e) {
      // Fallback: Copy to clipboard and show feedback
      await Clipboard.setData(ClipboardData(text: clipboardFallback));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Copied to clipboard: $clipboardFallback'),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryColor = Theme.of(context).primaryColor;
    final cardColor = Theme.of(context).cardColor;
    final textColor = isDark ? Colors.white : const Color(0xFF1E293B);
    final subTextColor = isDark ? Colors.white70 : const Color(0xFF64748B);

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Premium Card for Logo & Company Name
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(28.0),
                  decoration: BoxDecoration(
                    color: cardColor,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(isDark ? 0.3 : 0.05),
                        blurRadius: 16,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      // Logo container
                      Container(
                        width: 110,
                        height: 110,
                        padding: const EdgeInsets.all(8.0),
                        decoration: BoxDecoration(
                          color: Colors.white, // White background ensures transparent logos look perfect
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.08),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: ClipOval(
                          child: Image.asset(
                            'assets/logo.png',
                            fit: BoxFit.contain,
                            errorBuilder: (context, error, stackTrace) {
                              return Icon(Icons.business, size: 50, color: primaryColor);
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'Vanshee Infotech',
                        style: GoogleFonts.outfit(
                          fontSize: 26,
                          fontWeight: FontWeight.bold,
                          color: textColor,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Feel free to contact us',
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          color: subTextColor,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Contact Cards List
                _buildContactCard(
                  context,
                  icon: Icons.phone_outlined,
                  title: 'Phone Number',
                  value: '+91 88497 11764',
                  subtitle: 'Tap to call our support team',
                  isDark: isDark,
                  cardColor: cardColor,
                  primaryColor: primaryColor,
                  onTap: () => _launch(context, 'tel:+918849711764', '+918849711764'),
                ),
                const SizedBox(height: 16),
                _buildContactCard(
                  context,
                  icon: Icons.email_outlined,
                  title: 'Email Address',
                  value: 'vansheeinfotech@gmail.com',
                  subtitle: 'Send us an email anytime',
                  isDark: isDark,
                  cardColor: cardColor,
                  primaryColor: primaryColor,
                  onTap: () => _launch(context, 'mailto:vansheeinfotech@gmail.com', 'vansheeinfotech@gmail.com'),
                ),
                const SizedBox(height: 16),
                _buildContactCard(
                  context,
                  icon: Icons.language_outlined,
                  title: 'Official Website',
                  value: 'www.vansheeinfotech.com',
                  subtitle: 'Visit our site to explore products',
                  isDark: isDark,
                  cardColor: cardColor,
                  primaryColor: primaryColor,
                  onTap: () => _launch(context, 'https://www.vansheeinfotech.com', 'https://www.vansheeinfotech.com'),
                ),
                const SizedBox(height: 16),
                _buildContactCard(
                  context,
                  icon: Icons.location_on_outlined,
                  title: 'Office Address',
                  value: '903, Orchid Blues, Shela,\nAhmedabad, Gujarat 380058',
                  subtitle: 'Tap to navigate on Google Maps',
                  isDark: isDark,
                  cardColor: cardColor,
                  primaryColor: primaryColor,
                  onTap: () => _launch(
                    context,
                    'https://www.google.com/maps/search/?api=1&query=Vanshee+Infotech+Orchid+Blues+Shela',
                    '903, Orchid Blues, Shela, Ahmedabad, Gujarat 380058',
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildContactCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String value,
    required String subtitle,
    required bool isDark,
    required Color cardColor,
    required Color primaryColor,
    required VoidCallback onTap,
  }) {
    final textColor = isDark ? Colors.white : const Color(0xFF1E293B);
    final subTextColor = isDark ? Colors.white70 : const Color(0xFF64748B);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: cardColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.04),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(isDark ? 0.2 : 0.02),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            // Icon Container
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: primaryColor.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: primaryColor, size: 24),
            ),
            const SizedBox(width: 16),
            // Text Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: primaryColor,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: textColor,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: subTextColor,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: subTextColor.withOpacity(0.5),
            ),
          ],
        ),
      ),
    );
  }
}
