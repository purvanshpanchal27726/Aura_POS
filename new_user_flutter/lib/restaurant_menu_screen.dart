import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'api_client.dart';
import 'config.dart';

class RestaurantMenuScreen extends StatefulWidget {
  const RestaurantMenuScreen({super.key});

  @override
  State<RestaurantMenuScreen> createState() => _RestaurantMenuScreenState();
}

class _RestaurantMenuScreenState extends State<RestaurantMenuScreen> with SingleTickerProviderStateMixin {
  late TabController tabCtrl;

  List<dynamic> categories = [];
  List<dynamic> menuItems = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    tabCtrl = TabController(length: 2, vsync: this);
    fetchData();
  }

  @override
  void dispose() {
    tabCtrl.dispose();
    super.dispose();
  }

  Future<void> fetchData() async {
    try {
      setState(() => isLoading = true);
      final resCat = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/restaurant/menu/categories'));
      final resItem = await ApiClient.get(Uri.parse('${AppConfig.baseUrl}/api/restaurant/menu/items'));

      if (resCat.statusCode == 200 && resItem.statusCode == 200) {
        setState(() {
          categories = json.decode(resCat.body);
          menuItems = json.decode(resItem.body);
          isLoading = false;
        });
      } else {
        setState(() => isLoading = false);
      }
    } catch (e) {
      debugPrint('Error loading restaurant menu: $e');
      setState(() => isLoading = false);
    }
  }

  // --- CATEGORIES ---
  Future<void> saveCategory(int? id, String name, String? imageUrl) async {
    final data = {'name': name.trim(), 'image_url': imageUrl?.trim()};
    try {
      setState(() => isLoading = true);
      final url = id != null
          ? '${AppConfig.baseUrl}/api/restaurant/menu/categories/$id'
          : '${AppConfig.baseUrl}/api/restaurant/menu/categories';
      final response = id != null
          ? await ApiClient.put(Uri.parse(url), body: json.encode(data))
          : await ApiClient.post(Uri.parse(url), body: json.encode(data));

      if (response.statusCode == 200 || response.statusCode == 201) {
        fetchData();
      } else {
        throw Exception('Server error');
      }
    } catch (e) {
      setState(() => isLoading = false);
    }
  }

  Future<void> deleteCategory(int id) async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.delete(Uri.parse('${AppConfig.baseUrl}/api/restaurant/menu/categories/$id'));
      if (response.statusCode == 200) {
        fetchData();
      }
    } catch (e) {
      setState(() => isLoading = false);
    }
  }

  // --- MENU ITEMS ---
  Future<void> saveMenuItem(int? id, Map<String, dynamic> data) async {
    try {
      setState(() => isLoading = true);
      final url = id != null
          ? '${AppConfig.baseUrl}/api/restaurant/menu/items/$id'
          : '${AppConfig.baseUrl}/api/restaurant/menu/items';
      final response = id != null
          ? await ApiClient.put(Uri.parse(url), body: json.encode(data))
          : await ApiClient.post(Uri.parse(url), body: json.encode(data));

      if (response.statusCode == 200 || response.statusCode == 201) {
        fetchData();
      }
    } catch (e) {
      setState(() => isLoading = false);
    }
  }

  Future<void> deleteMenuItem(int id) async {
    try {
      setState(() => isLoading = true);
      final response = await ApiClient.delete(Uri.parse('${AppConfig.baseUrl}/api/restaurant/menu/items/$id'));
      if (response.statusCode == 200) {
        fetchData();
      }
    } catch (e) {
      setState(() => isLoading = false);
    }
  }

  void openCategoryDialog([dynamic cat]) {
    final formKey = GlobalKey<FormState>();
    final nameCtrl = TextEditingController(text: cat != null ? cat['name'] : '');
    final imgCtrl = TextEditingController(text: cat != null ? cat['image_url'] : '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(cat != null ? 'Edit Category' : 'Add Category'),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Category Name *'),
                validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: imgCtrl,
                decoration: const InputDecoration(labelText: 'Image URL'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              if (formKey.currentState!.validate()) {
                Navigator.pop(ctx);
                saveCategory(
                  cat != null ? cat['category_id'] : null,
                  nameCtrl.text,
                  imgCtrl.text.isNotEmpty ? imgCtrl.text : null,
                );
              }
            },
            child: const Text('Save'),
          )
        ],
      ),
    );
  }

  void openMenuItemDialog([dynamic item]) {
    final formKey = GlobalKey<FormState>();
    final nameCtrl = TextEditingController(text: item != null ? item['name'] : '');
    final descCtrl = TextEditingController(text: item != null ? item['description'] : '');
    final priceCtrl = TextEditingController(text: item != null ? item['price'].toString() : '');
    final gstCtrl = TextEditingController(text: item != null ? item['gst_percent'].toString() : '5.00');
    final prepCtrl = TextEditingController(text: item != null ? item['preparation_time'].toString() : '10');
    final imgCtrl = TextEditingController(text: item != null ? item['image_url'] : '');

    int? categoryId = item != null ? item['category_id'] : (categories.isNotEmpty ? categories[0]['category_id'] : null);
    String kitchenDept = item != null ? item['kitchen_dept'] : 'Hot Kitchen';
    bool isVeg = item != null ? (item['is_veg'] == 1) : true;
    bool inStock = item != null ? (item['available'] == 1) : true;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(item != null ? 'Edit Menu Item' : 'Add Menu Item'),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: nameCtrl,
                    decoration: const InputDecoration(labelText: 'Dish Name *'),
                    validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int>(
                    value: categoryId,
                    decoration: const InputDecoration(labelText: 'Menu Category'),
                    items: categories
                        .map<DropdownMenuItem<int>>((c) => DropdownMenuItem<int>(
                              value: c['category_id'],
                              child: Text(c['name']),
                            ))
                        .toList(),
                    onChanged: (val) => setDialogState(() => categoryId = val),
                    validator: (v) => v == null ? 'Category is required' : null,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: priceCtrl,
                          decoration: const InputDecoration(labelText: 'Price (₹) *'),
                          keyboardType: TextInputType.number,
                          validator: (v) => double.tryParse(v ?? '') == null ? 'Invalid' : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: gstCtrl,
                          decoration: const InputDecoration(labelText: 'GST %'),
                          keyboardType: TextInputType.number,
                          validator: (v) => double.tryParse(v ?? '') == null ? 'Invalid' : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: prepCtrl,
                          decoration: const InputDecoration(labelText: 'Prep Time (m)'),
                          keyboardType: TextInputType.number,
                          validator: (v) => int.tryParse(v ?? '') == null ? 'Invalid' : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: kitchenDept,
                          decoration: const InputDecoration(labelText: 'Kitchen Routing'),
                          items: const [
                            DropdownMenuItem(value: 'Hot Kitchen', child: Text('Hot Kitchen')),
                            DropdownMenuItem(value: 'Cold Kitchen', child: Text('Cold Kitchen')),
                            DropdownMenuItem(value: 'Bar', child: Text('Bar / Drinks')),
                          ],
                          onChanged: (val) => setDialogState(() => kitchenDept = val!),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: descCtrl,
                    decoration: const InputDecoration(labelText: 'Short Description'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: imgCtrl,
                    decoration: const InputDecoration(labelText: 'Image URL'),
                  ),
                  const SizedBox(height: 16),
                  SwitchListTile(
                    title: const Text('Vegetarian Dish'),
                    value: isVeg,
                    onChanged: (val) => setDialogState(() => isVeg = val),
                    contentPadding: EdgeInsets.zero,
                  ),
                  SwitchListTile(
                    title: const Text('In Stock'),
                    value: inStock,
                    onChanged: (val) => setDialogState(() => inStock = val),
                    contentPadding: EdgeInsets.zero,
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () {
                if (formKey.currentState!.validate()) {
                  Navigator.pop(ctx);
                  saveMenuItem(
                    item != null ? item['menu_item_id'] : null,
                    {
                      'name': nameCtrl.text.trim(),
                      'category_id': categoryId,
                      'price': double.parse(priceCtrl.text),
                      'gst_percent': double.parse(gstCtrl.text),
                      'preparation_time': int.parse(prepCtrl.text),
                      'kitchen_dept': kitchenDept,
                      'description': descCtrl.text.trim(),
                      'image_url': imgCtrl.text.trim().isNotEmpty ? imgCtrl.text.trim() : null,
                      'is_veg': isVeg ? 1 : 0,
                      'available': inStock ? 1 : 0
                    },
                  );
                }
              },
              child: const Text('Save'),
            )
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final primaryColor = Theme.of(context).primaryColor;

    return Scaffold(
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(kToolbarHeight),
        child: Container(
          color: Theme.of(context).cardColor,
          child: TabBar(
            controller: tabCtrl,
            labelColor: primaryColor,
            unselectedLabelColor: Colors.grey,
            indicatorColor: primaryColor,
            tabs: const [
              Tab(text: 'Categories'),
              Tab(text: 'Dishes & Drinks'),
            ],
          ),
        ),
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: tabCtrl,
              children: [
                // Category List tab
                categories.isEmpty
                    ? Center(child: Text('No categories created yet', style: GoogleFonts.inter(color: Colors.grey)))
                    : ListView.separated(
                        itemCount: categories.length,
                        separatorBuilder: (c, idx) => const Divider(height: 1),
                        itemBuilder: (ctx, idx) {
                          final c = categories[idx];
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: primaryColor.withValues(alpha: 0.1),
                              child: Text(c['name'][0].toUpperCase(), style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold)),
                            ),
                            title: Text(c['name'], style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                            subtitle: Text('ID: #${c['category_id']}', style: GoogleFonts.inter(fontSize: 12)),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(icon: const Icon(Icons.edit_outlined), onPressed: () => openCategoryDialog(c)),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, color: Colors.red),
                                  onPressed: () => deleteCategory(c['category_id']),
                                ),
                              ],
                            ),
                          );
                        },
                      ),

                // Dishes List Tab
                menuItems.isEmpty
                    ? Center(child: Text('No dishes created yet', style: GoogleFonts.inter(color: Colors.grey)))
                    : ListView.separated(
                        itemCount: menuItems.length,
                        separatorBuilder: (c, idx) => const Divider(height: 1),
                        itemBuilder: (ctx, idx) {
                          final item = menuItems[idx];
                          return ListTile(
                            leading: Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                color: item['is_veg'] == 1 ? Colors.green.shade50 : Colors.red.shade50,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: item['is_veg'] == 1 ? Colors.green : Colors.red),
                              ),
                              child: Center(
                                child: Icon(
                                  Icons.circle,
                                  size: 16,
                                  color: item['is_veg'] == 1 ? Colors.green : Colors.red,
                                ),
                              ),
                            ),
                            title: Text(item['name'], style: GoogleFonts.inter(fontWeight: FontWeight.bold)),
                            subtitle: Text(
                              '${item['category_name'] ?? "Unassigned"} • ₹${item['price']} • ${item['kitchen_dept']}',
                              style: GoogleFonts.inter(fontSize: 12),
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(icon: const Icon(Icons.edit_outlined), onPressed: () => openMenuItemDialog(item)),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, color: Colors.red),
                                  onPressed: () => deleteMenuItem(item['menu_item_id']),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ],
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          if (tabCtrl.index == 0) {
            openCategoryDialog();
          } else {
            openMenuItemDialog();
          }
        },
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
    );
  }
}
