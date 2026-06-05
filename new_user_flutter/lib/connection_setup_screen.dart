import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'config.dart';

class ConnectionSetupScreen extends StatefulWidget {
  final VoidCallback onRetry;

  const ConnectionSetupScreen({super.key, required this.onRetry});

  @override
  State<ConnectionSetupScreen> createState() => _ConnectionSetupScreenState();
}

class _MainConnectState {
  static const darkBg = Color(0xFF0F172A); // Slate-900
  static const darkCard = Color(0xFF1E293B); // Slate-800
}

class _ConnectionSetupScreenState extends State<ConnectionSetupScreen> {
  final TextEditingController _hostController = TextEditingController();
  bool _isTesting = false;
  String? _testMessage;
  bool _testSuccess = false;

  @override
  void initState() {
    super.initState();
    _hostController.text = AppConfig.currentHost;
  }

  @override
  void dispose() {
    _hostController.dispose();
    super.dispose();
  }

  Future<void> _testConnection() async {
    final host = _hostController.text.trim();
    setState(() {
      _isTesting = true;
      _testMessage = 'Checking connection status...';
      _testSuccess = false;
    });

    // Temp set to allow baseUrl to update for testing
    await AppConfig.setCustomHost(host);

    try {
      final response = await http
          .get(Uri.parse(AppConfig.usersApiUrl), headers: AppConfig.extraHeaders)
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        setState(() {
          _isTesting = false;
          _testMessage = 'Connected successfully! Re-routing to login...';
          _testSuccess = true;
        });
        
        // Wait briefly for success animation, then retry booting
        await Future.delayed(const Duration(milliseconds: 800));
        widget.onRetry();
      } else {
        setState(() {
          _isTesting = false;
          _testMessage = 'Server responded with error status: ${response.statusCode}';
          _testSuccess = false;
        });
      }
    } catch (e) {
      setState(() {
        _isTesting = false;
        _testMessage = 'Connection failed. Ensure server is running at ${AppConfig.baseUrl}.\nError: ${e.toString()}';
        _testSuccess = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: isDark ? _MainConnectState.darkBg : const Color(0xFFF1F5F9),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Container(
            width: size.width > 500 ? 460 : size.width * 0.95,
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 36),
            decoration: BoxDecoration(
              color: isDark ? _MainConnectState.darkCard : Colors.white,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: isDark ? Colors.black38 : Colors.black12,
                  blurRadius: 25,
                  offset: const Offset(0, 10),
                )
              ],
              border: Border.all(
                color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                width: 1,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header Icon
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: _testSuccess 
                        ? const Color(0xFF10B981).withValues(alpha: 0.1) 
                        : const Color(0xFFEF4444).withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _testSuccess ? Icons.cloud_done_rounded : Icons.cloud_off_rounded,
                      color: _testSuccess ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                      size: 40,
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                
                Text(
                  'Connection Diagnostic',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: isDark ? Colors.white : const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'The app could not connect to the POS backend API. Please configure your server connection below.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.4,
                    color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                  ),
                ),
                const SizedBox(height: 28),

                // Guide Panel
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF0F172A).withValues(alpha: 0.5) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isDark ? const Color(0xFF334155).withValues(alpha: 0.5) : const Color(0xFFE2E8F0),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '💡 Quick Setup Guide:',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.bold,
                          color: isDark ? const Color(0xFF6366F1) : const Color(0xFF4F46E5),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '🌐 Render (Production — Recommended):\n'
                        '  Enter: pos-backend.onrender.com\n\n'
                        '📶 Local Wi-Fi:\n'
                        '1. Start the Node.js backend on your PC.\n'
                        '2. Both devices on same Wi-Fi.\n'
                        '3. Enter your PC\'s IP (e.g. 192.168.1.5:3000).\n\n'
                        '🔗 Ngrok Tunnel:\n'
                        '1. Run: ngrok http 3000 in terminal.\n'
                        '2. Paste the forwarding URL below.',
                        style: TextStyle(
                          fontSize: 11.5,
                          height: 1.5,
                          color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Host input
                TextFormField(
                  controller: _hostController,
                  style: TextStyle(color: isDark ? Colors.white : const Color(0xFF0F172A)),
                  decoration: InputDecoration(
                    labelText: 'Server Host IP & Port',
                    labelStyle: TextStyle(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                    hintText: 'e.g. 192.168.1.5:3000  or  sizzle-xxx.ngrok-free.dev',
                    hintStyle: const TextStyle(color: Colors.grey),
                    prefixIcon: Icon(Icons.dns_rounded, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
                  ),
                ),
                const SizedBox(height: 20),

                // Status message
                if (_testMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _testSuccess 
                        ? const Color(0xFF10B981).withValues(alpha: 0.08) 
                        : const Color(0xFFEF4444).withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      _testMessage!,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.4,
                        color: _testSuccess ? const Color(0xFF10B981) : const Color(0xFFF87171),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                // Action buttons
                ElevatedButton(
                  onPressed: _isTesting ? null : _testConnection,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6366F1),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: _isTesting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                        )
                      : const Text(
                          'Test Connection',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: widget.onRetry,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: BorderSide(
                      color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1),
                    ),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(
                    'Skip / Retry',
                    style: TextStyle(
                      color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
