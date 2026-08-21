import 'dart:js' as js;

class BonrixDisplayService {
  static bool get isConnected {
    try { 
      return js.context.callMethod('isBonrixConnected') == true; 
    } catch(e) { 
      return false; 
    }
  }

  static void disconnect() {
    try { 
      js.context.callMethod('disconnectBonrixDisplay'); 
    } catch(e) {}
  }

  /// Request connection to the customer display via Web Serial API
  static void connect(int baudRate) {
    try {
      js.context.callMethod('connectBonrixDisplay', [baudRate]);
    } catch (e) {
      print('Bonrix Connect Error: ');
    }
  }

  /// Show the Welcome Screen
  static void showWelcome() {
    try {
      if (js.context.hasProperty('sendBonrixWelcome')) {
        js.context.callMethod('sendBonrixWelcome');
      }
    } catch (e) {
      print('Bonrix Welcome Error: ');
    }
  }

  /// Show the QR Code Payment Screen
  static void showQR(String amount, String upiId, String upiUrl) {
    try {
      if (js.context.hasProperty('sendBonrixQR')) {
        js.context.callMethod('sendBonrixQR', [amount, upiId, upiUrl]);
      }
    } catch (e) {
      print('Bonrix QR Error: ');
    }
  }

  /// Show the Success Screen
  static void showSuccess(String amount) {
    try {
      if (js.context.hasProperty('sendBonrixSuccess')) {
        js.context.callMethod('sendBonrixSuccess', [amount]);
      }
    } catch (e) {
      print('Bonrix Success Error: ');
    }
  }

  /// Show the Cancel/Fail Screen
  static void showCancel() {
    try {
      if (js.context.hasProperty('sendBonrixCancel')) {
        js.context.callMethod('sendBonrixCancel');
      }
    } catch (e) {
      print('Bonrix Cancel Error: ');
    }
  }
}
