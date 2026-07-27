import 'package:flutter/material.dart';

enum DeviceType { mobileSmall, mobileStandard, tablet, desktop }

class Responsive extends StatelessWidget {
  final Widget mobile;
  final Widget? tablet;
  final Widget? desktop;

  const Responsive({
    super.key,
    required this.mobile,
    this.tablet,
    this.desktop,
  });

  static DeviceType getDeviceType(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width < 360) return DeviceType.mobileSmall;
    if (width < 600) return DeviceType.mobileStandard;
    if (width < 1024) return DeviceType.tablet;
    return DeviceType.desktop;
  }

  static bool isMobile(BuildContext context) => MediaQuery.of(context).size.width < 600;
  static bool isTablet(BuildContext context) => MediaQuery.of(context).size.width >= 600 && MediaQuery.of(context).size.width < 1024;
  static bool isDesktop(BuildContext context) => MediaQuery.of(context).size.width >= 1024;

  /// Dynamic scale calculation based on 375px mobile baseline
  static double sp(BuildContext context, double fontSize) {
    final width = MediaQuery.of(context).size.width;
    final scale = (width / 375.0).clamp(0.85, 1.4);
    return fontSize * scale;
  }

  /// Dynamic padding scaling
  static double dp(BuildContext context, double padding) {
    final width = MediaQuery.of(context).size.width;
    if (width < 360) return padding * 0.75;
    if (width < 600) return padding;
    if (width < 1024) return padding * 1.25;
    return padding * 1.5;
  }

  /// Dynamic Grid Cross Axis Count calculation
  static int gridCount(BuildContext context, {int mobileCount = 2, int tabletCount = 3, int desktopCount = 5}) {
    if (isMobile(context)) return mobileCount;
    if (isTablet(context)) return tabletCount;
    return desktopCount;
  }

  /// Dynamic Grid Aspect Ratio
  static double gridAspectRatio(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width < 360) return 0.9;
    if (width < 600) return 1.1;
    if (width < 1024) return 1.25;
    return 1.35;
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 1024) {
          return desktop ?? tablet ?? mobile;
        }
        if (constraints.maxWidth >= 600) {
          return tablet ?? mobile;
        }
        return mobile;
      },
    );
  }
}
