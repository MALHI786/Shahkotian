import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Linking, RefreshControl, Modal, Alert, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS } from '../config/constants';
import { shopsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function BazarScreen() {
  const { user } = useAuth();
  const [shops, setShops] = useState([]);
  const [myShop, setMyShop] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [shopForm, setShopForm] = useState({
    name: '', address: '', contact: '', description: '', categories: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSuggestions();
    loadMyShop();
  }, []);

  const loadMyShop = async () => {
    if (!user) return;
    try {
      const response = await shopsAPI.search('');
      const found = response.data.shops?.find(s => s.ownerId === user.id);
      if (found) {
        setMyShop(found);
        setShopForm({
          name: found.name || '',
          address: found.address || '',
          contact: found.contact || '',
          description: found.description || '',
          categories: found.categories?.join(', ') || ''
        });
      }
    } catch (error) {
      console.error('Load my shop error:', error);
    }
  };

  const loadSuggestions = async () => {
    try {
      const response = await shopsAPI.getSuggestions();
      setSuggestions(response.data.suggestions);
    } catch (error) {
      console.error('Suggestions error:', error);
    }
  };

  const searchShops = async (query = searchQuery) => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      setHasSearched(true);
      const response = await shopsAPI.search(query.trim());
      setShops(response.data.shops);
    } catch (error) {
      console.error('Shop search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const callShop = (number) => {
    Linking.openURL(`tel:${number}`);
  };

  const whatsappShop = (number) => {
    const cleaned = number.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/92${cleaned.slice(-10)}`).catch(() => {
      Linking.openURL(`tel:${number}`);
    });
  };

  const saveShop = async () => {
    if (!shopForm.name.trim() || !shopForm.contact.trim() || !shopForm.address.trim()) {
      Alert.alert('Required', 'Name, Contact and Address are required');
      return;
    }
    try {
      setSaving(true);
      const data = {
        ...shopForm,
        categories: shopForm.categories.split(',').map(c => c.trim()).filter(Boolean)
      };
      if (myShop) {
        await shopsAPI.update(myShop.id, data);
        Alert.alert('Success', 'Shop updated successfully!');
      } else {
        await shopsAPI.create(data);
        Alert.alert('Success', 'Shop added successfully!');
      }
      setShowAddModal(false);
      loadMyShop();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to save shop');
    } finally {
      setSaving(false);
    }
  };

  const deleteShop = () => {
    Alert.alert('Delete Shop', 'Are you sure you want to delete your shop?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await shopsAPI.delete(myShop.id);
            setMyShop(null);
            setShopForm({ name: '', address: '', contact: '', description: '', categories: '' });
            Alert.alert('Deleted', 'Shop removed successfully');
          } catch (error) {
            Alert.alert('Error', 'Failed to delete shop');
          }
        }
      }
    ]);
  };

  const renderShop = ({ item }) => (
    <View style={styles.shopCard}>
      <View style={styles.shopHeader}>
        <View style={styles.shopIcon}>
          <Text style={styles.iconText}>🏪</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.shopName}>{item.name}</Text>
          <Text style={styles.shopAddress}>📍 {item.address}</Text>
        </View>
      </View>

      {item.description && (
        <Text style={styles.shopDesc}>{item.description}</Text>
      )}

      <View style={styles.categoriesRow}>
        {item.categories?.map((cat, idx) => (
          <View key={idx} style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>{cat}</Text>
          </View>
        ))}
      </View>

      <View style={styles.contactRow}>
        <TouchableOpacity style={styles.contactButton} onPress={() => callShop(item.contact)}>
          <Text style={styles.contactText}>📞 Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.whatsappButton} onPress={() => whatsappShop(item.contact)}>
          <Text style={styles.whatsappText}>💬 WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>What do you want to buy?</Text>
            <Text style={styles.headerSub}>Type the item and find shops in Shahkot</Text>
          </View>
          {user && (
            <TouchableOpacity style={styles.myShopBtn} onPress={() => setShowAddModal(true)}>
              <Text style={styles.myShopBtnText}>{myShop ? '🏪 My Shop' : '➕ Add Shop'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder='e.g. "shoes", "mobile", "furniture"'
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => searchShops()}
            returnKeyType="search"
            placeholderTextColor={COLORS.textLight}
          />
          <TouchableOpacity style={styles.searchButton} onPress={() => searchShops()}>
            <Text style={styles.searchBtnText}>🔍 Find</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* My Shop Card */}
      {myShop && !hasSearched && (
        <View style={styles.myShopSection}>
          <Text style={styles.myShopTitle}>🏪 Your Shop</Text>
          <View style={[styles.shopCard, styles.myShopCard]}>
            <View style={styles.shopHeader}>
              <View style={styles.shopIcon}>
                <Text style={styles.iconText}>🏪</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName}>{myShop.name}</Text>
                <Text style={styles.shopAddress}>📍 {myShop.address}</Text>
              </View>
            </View>
            <View style={styles.myShopActions}>
              <TouchableOpacity style={styles.editShopBtn} onPress={() => setShowAddModal(true)}>
                <Text style={styles.editBtnText}>✏️ Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteShopBtn} onPress={deleteShop}>
                <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Add/Edit Shop Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{myShop ? '✏️ Edit Your Shop' : '🏪 Add Your Shop'}</Text>
              <Text style={styles.modalSubtitle}>Let people in Shahkot find your business</Text>
              
              <Text style={styles.inputLabel}>Shop Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Ali Mobile Shop"
                value={shopForm.name}
                onChangeText={(t) => setShopForm({ ...shopForm, name: t })}
                placeholderTextColor={COLORS.textLight}
              />
              
              <Text style={styles.inputLabel}>Contact Number *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 0300-1234567"
                value={shopForm.contact}
                onChangeText={(t) => setShopForm({ ...shopForm, contact: t })}
                keyboardType="phone-pad"
                placeholderTextColor={COLORS.textLight}
              />
              
              <Text style={styles.inputLabel}>Address *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Main Bazar, Near Mosque"
                value={shopForm.address}
                onChangeText={(t) => setShopForm({ ...shopForm, address: t })}
                placeholderTextColor={COLORS.textLight}
              />
              
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, { height: 70, textAlignVertical: 'top' }]}
                placeholder="What do you sell? (optional)"
                value={shopForm.description}
                onChangeText={(t) => setShopForm({ ...shopForm, description: t })}
                multiline
                placeholderTextColor={COLORS.textLight}
              />
              
              <Text style={styles.inputLabel}>Categories (comma separated)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Mobile, Accessories, Repair"
                value={shopForm.categories}
                onChangeText={(t) => setShopForm({ ...shopForm, categories: t })}
                placeholderTextColor={COLORS.textLight}
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveShop} disabled={saving}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : myShop ? 'Update Shop' : 'Add Shop'}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Quick Suggestions */}
      {!hasSearched && suggestions.length > 0 && (
        <View style={styles.suggestionsSection}>
          <Text style={styles.suggestionsTitle}>Popular Searches</Text>
          <View style={styles.suggestionsGrid}>
            {suggestions.slice(0, 12).map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.suggestionChip}
                onPress={() => { setSearchQuery(item); searchShops(item); }}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Results */}
      {hasSearched && (
        <FlatList
          data={shops}
          renderItem={renderShop}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => searchShops()} colors={[COLORS.primary]} />}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {shops.length > 0
                ? `Found ${shops.length} shop(s) for "${searchQuery}"`
                : `No shops found for "${searchQuery}"`}
            </Text>
          }
          ListEmptyComponent={
            !loading && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🏪</Text>
                <Text style={styles.emptyText}>No shops found for this item</Text>
                <Text style={styles.emptySubText}>Try different keywords</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchHeader: {
    backgroundColor: COLORS.primary,
    padding: 20,
    paddingTop: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.white, marginBottom: 4 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 16 },
  searchBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchInput: { flex: 1, padding: 14, fontSize: 15, color: COLORS.text },
  searchButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnText: { color: COLORS.white, fontWeight: '600' },
  suggestionsSection: { padding: 16 },
  suggestionsTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestionText: { fontSize: 13, color: COLORS.text },
  resultCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
    fontWeight: '600',
  },
  shopCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
  },
  shopHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  shopIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.info + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: { fontSize: 24 },
  shopName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  shopAddress: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  shopDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 8 },
  categoriesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  categoryTag: {
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryTagText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  contactRow: { flexDirection: 'row', gap: 10 },
  contactButton: {
    flex: 1,
    backgroundColor: COLORS.success + '12',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.success + '30',
  },
  contactText: { color: COLORS.success, fontWeight: '700', fontSize: 14 },
  whatsappButton: {
    flex: 1,
    backgroundColor: '#25D366' + '15',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#25D366' + '30',
  },
  whatsappText: { color: '#25D366', fontWeight: '700', fontSize: 14 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '600' },
  emptySubText: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  // New Shop Management Styles
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  myShopBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  myShopBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
  myShopSection: { padding: 12 },
  myShopTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  myShopCard: { borderWidth: 2, borderColor: COLORS.primary },
  myShopActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  editShopBtn: {
    flex: 1,
    backgroundColor: COLORS.info + '15',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  editBtnText: { color: COLORS.info, fontWeight: '600', fontSize: 13 },
  deleteShopBtn: {
    flex: 1,
    backgroundColor: COLORS.error + '15',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteBtnText: { color: COLORS.error, fontWeight: '600', fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 8 },
  formInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  saveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
