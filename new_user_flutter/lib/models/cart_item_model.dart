class CartItem {
  final int itemId;
  final String name;
  final bool isEditablePrice;
  double rate;
  double quantity;
  final double taxPercent;

  CartItem({
    required this.itemId,
    required this.name,
    required this.rate,
    required this.quantity,
    required this.taxPercent,
    required this.isEditablePrice,
  });

  double get gross => rate * quantity;
  double get taxAmount => gross * taxPercent;
  double get netAmount => gross + taxAmount;

  Map<String, dynamic> toJson() => {
    'item_id': itemId,
    'name': name,
    'rate': rate,
    'quantity': quantity,
    'taxPercent': taxPercent,
    'gross': gross,
    'tax_amount': taxAmount,
    'item_amount': netAmount,
    'editable_price': isEditablePrice,
  };
}
