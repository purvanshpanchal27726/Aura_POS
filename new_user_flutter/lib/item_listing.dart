import 'dart:convert';
import 'dart:io' as io;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:file_picker/file_picker.dart';
import 'config.dart';

/// Stateful Item Administration Screen.
/// Renders registered items inside a data table, supporting full CRUD modal overlays with category, unit, and tax mappings.
class ItemListingScreen extends StatefulWidget {
  final int? roleId;
  final bool canModify;
  const ItemListingScreen({super.key, this.roleId, this.canModify = false});

  @override
  State<ItemListingScreen> createState() => _ItemListingScreenState();
}

class _ItemListingScreenState extends State<ItemListingScreen> {
  final _formKey = GlobalKey<FormState>();

  bool get canModify => widget.canModify;

  Widget _getItemImage(dynamic imageUrlOrBase64, {double size = 32}) {
    if (imageUrlOrBase64 == null || imageUrlOrBase64.toString().isEmpty) {
      return Icon(Icons.image, size: size, color: Colors.grey);
    }
    final imgStr = imageUrlOrBase64.toString();
    
    // Extract relative path from potential absolute/relative URL to ensure consistency
    final RegExp pathRegExp = RegExp(r'(/Images/[^?\s]+|/uploads/[^?\s]+)');
    final match = pathRegExp.firstMatch(imgStr);
    if (match != null) {
      final relativePath = match.group(1)!;
      final fullUrl = '${AppConfig.baseUrl}$relativePath';
      return Image.network(
        fullUrl,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (ctx, err, st) => Icon(Icons.broken_image, size: size, color: Colors.grey),
      );
    }

    if (imgStr.startsWith('http://') || imgStr.startsWith('https://')) {
      return Image.network(
        imgStr,
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

  List<dynamic> items = [];
  List<dynamic> categories = [];
  List<dynamic> units = [];
  List<dynamic> taxes = [];
  bool isLoading = true;

  int? editingItemId;

  // Form controllers
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _codeController = TextEditingController();
  final TextEditingController _shortNameController = TextEditingController();
  final TextEditingController _longNameController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  final TextEditingController _salesPriceController = TextEditingController();
  final TextEditingController _purchasePriceController = TextEditingController();
  final TextEditingController _baseQuantityController = TextEditingController(text: '1.00');

  int? selectedCategoryId;
  int? selectedUnitId;
  int? selectedTaxId;
  bool isActive = true;
  bool isVisible = true;
  bool isEditablePrice = false;
  String weightMeasurement = 'none';
  String? imageBase64;
  String? imageFilename;

  @override
  void initState() {
    super.initState();
    fetchData();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _codeController.dispose();
    _shortNameController.dispose();
    _longNameController.dispose();
    _descriptionController.dispose();
    _salesPriceController.dispose();
    _purchasePriceController.dispose();
    _baseQuantityController.dispose();
    super.dispose();
  }

  /// Reloads the items list and reference dropdown data from the database concurrently.
  Future<void> fetchData() async {
    try {
      setState(() => isLoading = true);
      
      final responses = await Future.wait([
        http.get(Uri.parse(AppConfig.itemsApiUrl)),
        http.get(Uri.parse(AppConfig.categoriesApiUrl)),
        http.get(Uri.parse(AppConfig.unitsApiUrl)),
        http.get(Uri.parse(AppConfig.taxesApiUrl)),
      ]);

      if (responses.every((res) => res.statusCode == 200)) {
        setState(() {
          items = json.decode(responses[0].body);
          categories = json.decode(responses[1].body).where((c) => c['active'] == 1 || c['active'] == true).toList();
          units = json.decode(responses[2].body).where((u) => u['active'] == 1 || u['active'] == true).toList();
          taxes = json.decode(responses[3].body).where((t) => t['active'] == 1 || t['active'] == true).toList();
          isLoading = false;
        });
      } else {
        throw Exception('Failed to load API data');
      }
    } catch (e) {
      debugPrint('Error loading item data: $e');
      setState(() => isLoading = false);
    }
  }

  /// Performs creation (POST) or update (PUT) on the items endpoint.
  Future<bool> saveItem() async {
    if (!_formKey.currentState!.validate()) return false;

    final salesPrice = double.tryParse(_salesPriceController.text) ?? 0.0;
    final purchasePrice = AppConfig.isRestaurantMode
        ? 0.0
        : (double.tryParse(_purchasePriceController.text) ?? 0.0);

    if (!AppConfig.isRestaurantMode && salesPrice < purchasePrice) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Retail Price cannot be less than Purchase Price'),
            backgroundColor: Color(0xFFDC2626),
          ),
        );
      }
      return false;
    }

    final baseQty = double.tryParse(_baseQuantityController.text) ?? 1.00;

    final itemData = {
      'name': _nameController.text.trim(),
      'code': _codeController.text.trim().isEmpty ? null : _codeController.text.trim(),
      'short_name': _shortNameController.text.trim().isEmpty ? null : _shortNameController.text.trim(),
      'long_name': _longNameController.text.trim().isEmpty ? null : _longNameController.text.trim(),
      'description': _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
      'sales_price': salesPrice,
      'purchase_price': purchasePrice,
      'category_id': selectedCategoryId,
      'unit_id': selectedUnitId,
      'tax_id': selectedTaxId,
      'active': isActive,
      'visible': isVisible,
      'editable_price': isEditablePrice,
      'base_quantity': baseQty,
      'weight_measurement': weightMeasurement,
      'image': imageBase64,
      'created_by': editingItemId == null ? 'System' : null,
    };

    try {
      setState(() => isLoading = true);
      http.Response response;

      if (editingItemId == null) {
        response = await http.post(
          Uri.parse(AppConfig.itemsApiUrl),
          headers: {'Content-Type': 'application/json'},
          body: json.encode(itemData),
        );
      } else {
        response = await http.put(
          Uri.parse('${AppConfig.itemsApiUrl}/$editingItemId'),
          headers: {'Content-Type': 'application/json'},
          body: json.encode(itemData),
        );
      }

      if (response.statusCode == 200 || response.statusCode == 201) {
        return true;
      } else {
        final errorBody = json.decode(response.body);
        throw Exception(errorBody['error'] ?? 'Failed to save item');
      }
    } catch (e) {
      if (mounted) {
        final errorMsg = e.toString().replaceFirst('Exception: ', '').replaceFirst('Error: ', '');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMsg),
            backgroundColor: Color(0xFFDC2626),
          ),
        );
      }
      setState(() => isLoading = false);
      return false;
    }
  }

  /// Deletes the item with the given [id] after user confirmation.
  Future<void> deleteItem(int id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Confirm Delete'),
        content: Text('Are you sure you want to delete this item?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: TextStyle(color: Theme.of(context).brightness == Brightness.dark ? Color(0xFF94A3B8) : Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Color(0xFFDC2626)),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      setState(() => isLoading = true);
      final response = await http.delete(
        Uri.parse('${AppConfig.itemsApiUrl}/$id'),
      );

      if (response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Item deleted successfully!'),
              backgroundColor: Color(0xFF16A34A),
            ),
          );
        }
        fetchData();
      } else {
        throw Exception('Failed to delete item');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: Color(0xFFDC2626),
          ),
        );
      }
      setState(() => isLoading = false);
    }
  }

  /// Resets the form to its default empty state.
  void _resetForm() {
    editingItemId = null;
    _nameController.clear();
    _codeController.clear();
    _shortNameController.clear();
    _longNameController.clear();
    _descriptionController.clear();
    _salesPriceController.clear();
    _purchasePriceController.clear();
    _baseQuantityController.text = '1.00';
    selectedCategoryId = null;
    selectedUnitId = null;
    selectedTaxId = null;
    isActive = true;
    isVisible = true;
    isEditablePrice = false;
    weightMeasurement = 'none';
    imageBase64 = null;
    imageFilename = null;
  }

  /// Opens file picker and converts image to Base64
  Future<void> _pickImage(StateSetter setDialogState) async {
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.image,
        allowMultiple: false,
        withData: kIsWeb,
      );
      if (result != null) {
        final file = result.files.single;
        Uint8List fileBytes;
        if (kIsWeb) {
          fileBytes = file.bytes!;
        } else {
          fileBytes = await io.File(file.path!).readAsBytes();
        }
        final base64Str = base64Encode(fileBytes);
        final extension = file.extension ?? 'png';
        setDialogState(() {
          imageBase64 = 'data:image/$extension;base64,$base64Str';
          imageFilename = file.name;
        });
      }
    } catch (e) {
      debugPrint('Error picking image: $e');
    }
  }

  /// Opens the Add/Edit modal dialog pre-filled for [item], or blank for a new entry.
  void _openItemDialog({Map<String, dynamic>? item}) {
    if (item != null) {
      editingItemId = item['item_id'];
      _nameController.text = item['name'] ?? '';
      _codeController.text = item['code'] ?? '';
      _shortNameController.text = item['short_name'] ?? '';
      _longNameController.text = item['long_name'] ?? '';
      _descriptionController.text = item['description'] ?? '';
      _salesPriceController.text = item['sales_price'] != null ? item['sales_price'].toString() : '';
      _purchasePriceController.text = item['purchase_price'] != null ? item['purchase_price'].toString() : '';
      _baseQuantityController.text = item['base_quantity'] != null ? item['base_quantity'].toString() : '1.00';
      
      final catId = item['category_id'];
      selectedCategoryId = categories.any((c) => c['category_id'] == catId) ? catId : null;

      final unitId = item['unit_id'];
      selectedUnitId = units.any((u) => u['unit_id'] == unitId) ? unitId : null;

      final taxId = item['tax_id'];
      selectedTaxId = taxes.any((t) => t['tax_id'] == taxId) ? taxId : null;

      isActive = item['active'] == true || item['active'] == 1;
      isVisible = item['visible'] == true || item['visible'] == 1;
      isEditablePrice = item['editable_price'] == true || item['editable_price'] == 1;
      weightMeasurement = item['weight_measurement'] ?? 'none';
      imageBase64 = item['image'];
      imageFilename = imageBase64 != null ? 'Existing Image' : null;
    } else {
      _resetForm();
    }

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: Theme.of(context).cardColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Text(
          item != null ? 'Edit Item Details' : 'Register New Item',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Theme.of(context).brightness == Brightness.dark ? Colors.white : Color(0xFF1E293B),
          ),
        ),
        content: SingleChildScrollView(
          child: SizedBox(
            width: 450,
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Item Code
                  TextFormField(
                    controller: _codeController,
                    decoration: InputDecoration(
                      labelText: 'Item Code / Barcode',
                      prefixIcon: const Icon(Icons.qr_code, color: Color(0xFF2563EB)),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      filled: true,
                      fillColor: Theme.of(context).brightness == Brightness.dark ? Color(0xFF1E293B) : Color(0xFFF8FAFC),
                    ),
                  ),
                  const SizedBox(height: 14),
                  // Item Name
                  TextFormField(
                    controller: _nameController,
                    decoration: InputDecoration(
                      labelText: 'Item Name *',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      filled: true,
                      fillColor: Theme.of(context).brightness == Brightness.dark ? Color(0xFF1E293B) : Color(0xFFF8FAFC),
                    ),
                    validator: (val) => val == null || val.trim().isEmpty ? 'Item Name is required' : null,
                  ),
                  const SizedBox(height: 14),
                  // Description
                  TextFormField(
                    controller: _descriptionController,
                    maxLines: 4,
                    decoration: InputDecoration(
                      labelText: 'Description',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      filled: true,
                      fillColor: Theme.of(context).brightness == Brightness.dark ? Color(0xFF1E293B) : Color(0xFFF8FAFC),
                    ),
                  ),
                  const SizedBox(height: 14),
                  // Category Selection Dropdown
                  DropdownButtonFormField<int>(
                    initialValue: selectedCategoryId,
                    decoration: InputDecoration(
                      labelText: 'Category',
                      prefixIcon: const Icon(Icons.category_outlined, color: Color(0xFF2563EB)),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      filled: true,
                      fillColor: Theme.of(context).brightness == Brightness.dark ? Color(0xFF1E293B) : Color(0xFFF8FAFC),
                    ),
                    dropdownColor: Theme.of(context).cardColor,
                    items: categories.map<DropdownMenuItem<int>>((cat) {
                      return DropdownMenuItem<int>(
                        value: cat['category_id'] as int,
                        child: Text(cat['name'] ?? ''),
                      );
                    }).toList(),
                    onChanged: (val) {
                      selectedCategoryId = val;
                    },
                  ),
                  // Retail Price (Sales Price)
                  TextFormField(
                    controller: _salesPriceController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: 'Retail Price (Sales Price) *',
                      prefixText: '₹',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      filled: true,
                      fillColor: Theme.of(context).brightness == Brightness.dark ? Color(0xFF1E293B) : Color(0xFFF8FAFC),
                    ),
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) {
                        return 'Retail Price is required';
                      }
                      if (double.tryParse(val) == null) {
                        return 'Please enter a valid price';
                      }
                      return null;
                    },
                  ),
                  if (!AppConfig.isRestaurantMode) ...[
                    const SizedBox(height: 14),
                    // Purchase Price
                    TextFormField(
                      controller: _purchasePriceController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: 'Purchase Price *',
                        prefixText: '₹',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        filled: true,
                        fillColor: Theme.of(context).brightness == Brightness.dark ? Color(0xFF1E293B) : Color(0xFFF8FAFC),
                      ),
                      validator: (val) {
                        if (AppConfig.isRestaurantMode) return null;
                        if (val == null || val.trim().isEmpty) {
                          return 'Purchase Price is required';
                        }
                        if (double.tryParse(val) == null) {
                          return 'Please enter a valid price';
                        }
                        return null;
                      },
                    ),
                  ],
                  const SizedBox(height: 14),
                  // Item Image Selector
                  Text('Item Image', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Theme.of(context).brightness == Brightness.dark ? Colors.white70 : Color(0xFF475569))),
                  const SizedBox(height: 6),
                  StatefulBuilder(
                    builder: (context, setDialogState) {
                      return Row(
                        children: [
                          Container(
                            width: 60,
                            height: 60,
                            decoration: BoxDecoration(
                              color: Theme.of(context).brightness == Brightness.dark ? Color(0xFF1E293B) : Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFFCBD5E1)),
                            ),
                            child: imageBase64 != null
                                ? ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: _getItemImage(imageBase64, size: 60),
                                  )
                                : const Icon(Icons.image_outlined, color: Colors.grey),
                          ),
                          const SizedBox(width: 12),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                              foregroundColor: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF1E293B),
                              elevation: 0,
                            ),
                            icon: const Icon(Icons.upload_file_rounded, size: 16),
                            label: Text(imageFilename != null ? 'Change Image' : 'Upload Image'),
                            onPressed: () => _pickImage(setDialogState),
                          ),
                          if (imageBase64 != null) ...[
                            const SizedBox(width: 8),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, color: Colors.red),
                              onPressed: () {
                                setDialogState(() {
                                  imageBase64 = null;
                                  imageFilename = null;
                                });
                              },
                            ),
                          ],
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _resetForm();
            },
            child: Text('Cancel', style: TextStyle(color: Theme.of(context).brightness == Brightness.dark ? Color(0xFF94A3B8) : Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            ),
            onPressed: () async {
              final scaffoldMessenger = ScaffoldMessenger.of(context);
              final navigator = Navigator.of(ctx);
              final success = await saveItem();
              if (success) {
                navigator.pop();
                _resetForm();
                fetchData();
                scaffoldMessenger.showSnackBar(
                  SnackBar(
                    content: Text('Item ${editingItemId == null ? "registered" : "updated"} successfully!'),
                    backgroundColor: const Color(0xFF16A34A),
                  ),
                );
              }
            },
            child: Text(item != null ? 'Update Item' : 'Save Item'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      
      body: isLoading
          ? Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : Padding(
              padding: EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header card with title and action buttons
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                    decoration: BoxDecoration(
                      color: Theme.of(context).cardColor,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Color(0xFFE2E8F0)),
                      boxShadow: [
                        BoxShadow(color: Color(0x0A000000), blurRadius: 6, offset: Offset(0, 2)),
                      ],
                    ),
                    child: Wrap(
                      alignment: WrapAlignment.spaceBetween,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        Text(
                          'Registered Items',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Theme.of(context).brightness == Brightness.dark ? Colors.white : Color(0xFF1E293B)),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (canModify)
                              ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF2563EB),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                ),
                                icon: const Icon(Icons.add, size: 18),
                                label: const Text('New Item'),
                                onPressed: () => _openItemDialog(),
                              ),
                            if (canModify) const SizedBox(width: 8),
                            IconButton(
                              icon: Icon(Icons.sync, color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                              tooltip: 'Reload Items Table',
                              onPressed: fetchData,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Data table
                  Expanded(
                    child: Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Theme.of(context).cardColor,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(color: Color(0x0A000000), blurRadius: 6, offset: Offset(0, 2)),
                        ],
                      ),
                      child: items.isEmpty
                          ? Center(
                              child: Text(
                                'No items registered yet.',
                                style: TextStyle(fontSize: 15, color: Color(0xFF94A3B8)),
                              ),
                            )
                          : SingleChildScrollView(
                              scrollDirection: Axis.vertical,
                              child: SingleChildScrollView(
                                scrollDirection: Axis.horizontal,
                                child: DataTable(
                                  headingRowColor: WidgetStateProperty.all(Theme.of(context).brightness == Brightness.dark ? Color(0xFF1E293B) : Color(0xFFF8FAFC)),
                                  headingTextStyle: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: Theme.of(context).brightness == Brightness.dark ? Color(0xFF94A3B8) : Color(0xFF475569),
                                    fontSize: 13,
                                  ),
                                  dataTextStyle: TextStyle(color: Theme.of(context).brightness == Brightness.dark ? Colors.white : Color(0xFF1E293B), fontSize: 13),
                                  dividerThickness: 1,
                                  columns: [
                                    DataColumn(label: SizedBox(width: 80, child: Text('Code'))),
                                    DataColumn(label: SizedBox(width: 220, child: Text('Item Name'))),
                                    DataColumn(label: SizedBox(width: 140, child: Text('Category'))),
                                    DataColumn(label: SizedBox(width: 200, child: Text('Description'))),
                                    if (canModify) DataColumn(label: SizedBox(width: 100, child: Text('Actions'))),
                                  ],
                                  rows: items.map<DataRow>((item) {
                                    final desc = item['description'] ?? 'No description';

                                    return DataRow(cells: [
                                      DataCell(SizedBox(
                                        width: 80,
                                        child: Text(
                                          item['code'] ?? 'N/A',
                                          style: const TextStyle(fontWeight: FontWeight.bold),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      )),
                                      DataCell(SizedBox(
                                        width: 220,
                                        child: Row(
                                          children: [
                                            ClipRRect(
                                              borderRadius: BorderRadius.circular(6),
                                              child: _getItemImage(item['image'], size: 40),
                                            ),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Text(
                                                item['name'] ?? '',
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(fontWeight: FontWeight.w500),
                                              ),
                                            ),
                                          ],
                                        ),
                                      )),
                                      DataCell(SizedBox(
                                        width: 140,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: Theme.of(context).primaryColor.withValues(alpha: 0.08),
                                            borderRadius: BorderRadius.circular(20),
                                            border: Border.all(color: Theme.of(context).primaryColor.withValues(alpha: 0.15)),
                                          ),
                                          child: Text(
                                            item['category_name'] ?? 'N/A',
                                            style: TextStyle(
                                              color: Theme.of(context).primaryColor,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 11,
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      )),
                                      DataCell(SizedBox(
                                        width: 200,
                                        child: Text(
                                          desc,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      )),
                                      if (canModify)
                                        DataCell(
                                          SizedBox(
                                            width: 100,
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                IconButton(
                                                  icon: const Icon(Icons.edit, color: Color(0xFF2563EB), size: 20),
                                                  tooltip: 'Edit Item',
                                                  padding: EdgeInsets.zero,
                                                  constraints: const BoxConstraints(),
                                                  onPressed: () => _openItemDialog(item: Map<String, dynamic>.from(item)),
                                                ),
                                                const SizedBox(width: 16),
                                                IconButton(
                                                  icon: const Icon(Icons.delete, color: Color(0xFFDC2626), size: 20),
                                                  tooltip: 'Delete Item',
                                                  padding: EdgeInsets.zero,
                                                  constraints: const BoxConstraints(),
                                                  onPressed: () => deleteItem(item['item_id']),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                    ]);
                                  }).toList(),
                                ),
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
