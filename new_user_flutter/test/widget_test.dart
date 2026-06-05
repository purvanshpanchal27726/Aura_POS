import 'package:flutter_test/flutter_test.dart';

import 'package:new_user_flutter/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const MyApp(initialThemeMode: 'light', initialAccentColor: 'blue'));

    // Verify that the main user registration form header is displayed.
    expect(find.text('User Registration Form'), findsOneWidget);
  });
}
