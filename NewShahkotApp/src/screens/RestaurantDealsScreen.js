import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
  Alert, ActivityIndicator, RefreshControl, TextInput, Image, Modal,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { restaurantsAPI } from '../services/api';

export default function RestaurantDealsScreen({ navigation }) {
  const { isAdmin } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [allDeals, setAllDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('deals'); // deals, restaurants, admin
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [showAddRestaurant, setShowAddRestaurant] = useState(false);
  const [search, setSearch] = useState('');

  // Add restaurant form
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formImage, setFormImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [restRes, dealsRes] = await Promise.allSettled([
        restaurantsAPI.getAll(search ? { search } : {}),
        restaurantsAPI.getAllDeals(),
      ]);
      if (restRes.status === 'fulfilled') setRestaurants(restRes.value.data.restaurants || []);
      if (dealsRes.status === 'fulfilled') setAllDeals(dealsRes.value.data.deals || []);
    } catch (err) {
      console.error('Load restaurants error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [search]);

  const loadRestaurantDetail = async (id) => {
    try {
      const res = await restaurantsAPI.getOne(id);
      setSelectedRestaurant(res.data);
    } catch (err) {
      Alert.alert('Error', 'Could not load restaurant details.');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) setFormImage(result.assets[0]);
  };

  const handleAddRestaurant = async () => {
    if (!formName.trim() || !formAddress.trim() || !formEmail.trim() || !formPassword.trim()) {
      return Alert.alert('Required', 'Name, address, email, and password are required.');
    }
    if (formPassword.length < 6) {
      return Alert.alert('Error', 'Password must be at least 6 characters.');
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', formName.trim());
      formData.append('address', formAddress.trim());
      formData.append('phone', formPhone.trim());
      formData.append('whatsapp', formWhatsapp.trim());
      formData.append('description', formDesc.trim());
      formData.append('email', formEmail.trim());
      formData.append('password', formPassword.trim());
      if (formImage) {
        formData.append('image', {
          uri: formImage.uri,
          type: 'image/jpeg',
          name: 'restaurant.jpg',
        });
      }

      const res = await restaurantsAPI.adminCreate(formData);
      Alert.alert('Created! 🎉', `${res.data.restaurant.name} added.\n\nLogin: ${res.data.restaurant.email}\nPassword: ${formPassword.trim()}\n\nShare these credentials with the restaurant owner.`);
      setShowAddRestaurant(false);
      resetForm();
      loadData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create restaurant.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRestaurant = (id, name) => {
    Alert.alert('Delete Restaurant', `Remove "${name}" and all its deals?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await restaurantsAPI.adminDelete(id);
            Alert.alert('Deleted', 'Restaurant removed.');
            loadData();
            setSelectedRestaurant(null);
          } catch (err) {
            Alert.alert('Error', 'Failed to delete.');
          }
        },
      },
    ]);
  };

  const toggleRestaurant = async (id, currentActive) => {
    try {
      await restaurantsAPI.adminUpdate(id, { isActive: !currentActive });
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to update.');
    }
  };

  const resetForm = () => {
    setFormName(''); setFormAddress(''); setFormPhone(''); setFormWhatsapp('');
    setFormDesc(''); setFormEmail(''); setFormPassword(''); setFormImage(null);
  };

  const callPhone = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const openWhatsApp = (whatsapp) => {
    if (whatsapp) {
      const num = whatsapp.replace(/[^0-9]/g, '');
      Linking.openURL(`https://wa.me/${num}`);
    }
  };

  // Render deal card
  const renderDealCard = ({ item }) => (
    <TouchableOpacity
      style={styles.dealCard}
      onPress={() => loadRestaurantDetail(item.restaurant?.id || item.restaurantId)}
    >
      {item.image && <Image source={{ uri: item.image }} style={styles.dealImage} />}
      <View style={styles.dealInfo}>
        <Text style={styles.dealTitle} numberOfLines={2}>{item.title}</Text>
        {item.description && <Text style={styles.dealDesc} numberOfLines={2}>{item.description}</Text>}
        <View style={styles.priceRow}>
          {item.originalPrice && (
            <Text style={styles.originalPrice}>{item.originalPrice}</Text>
          )}
          {item.price && <Text style={styles.dealPrice}>{item.price}</Text>}
        </View>
        <View style={styles.restaurantTag}>
          {item.restaurant?.image && (
            <Image source={{ uri: item.restaurant.image }} style={styles.miniLogo} />
          )}
          <Text style={styles.restaurantName} numberOfLines={1}>
            🍽️ {item.restaurant?.name || 'Restaurant'}
          </Text>
        </View>
        {item.expiresAt && (
          <Text style={styles.expiresText}>
            ⏰ Expires: {new Date(item.expiresAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  // Render restaurant card
  const renderRestaurantCard = ({ item }) => (
    <TouchableOpacity style={styles.restaurantCard} onPress={() => loadRestaurantDetail(item.id)}>
      <View style={styles.restHeader}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.restImage} />
        ) : (
          <View style={[styles.restImage, styles.restPlaceholder]}>
            <Text style={{ fontSize: 28 }}>🍽️</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.restName}>{item.name}</Text>
          <Text style={styles.restAddress} numberOfLines={1}>📍 {item.address}</Text>
          <Text style={styles.restDeals}>{item._count?.deals || 0} active deals</Text>
        </View>
      </View>
      {item.phone && (
        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactBtn} onPress={() => callPhone(item.phone)}>
            <Ionicons name="call" size={16} color={COLORS.primary} />
            <Text style={styles.contactText}>Call</Text>
          </TouchableOpacity>
          {item.whatsapp && (
            <TouchableOpacity style={[styles.contactBtn, { borderColor: '#25D366' }]} onPress={() => openWhatsApp(item.whatsapp)}>
              <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
              <Text style={[styles.contactText, { color: '#25D366' }]}>WhatsApp</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {isAdmin && (
        <View style={styles.adminActions}>
          <TouchableOpacity
            style={[styles.adminBtn, { borderColor: item.isActive ? '#EF4444' : '#10B981' }]}
            onPress={() => toggleRestaurant(item.id, item.isActive)}
          >
            <Text style={{ color: item.isActive ? '#EF4444' : '#10B981', fontSize: 12, fontWeight: '600' }}>
              {item.isActive ? 'Deactivate' : 'Activate'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.adminBtn, { borderColor: '#EF4444' }]}
            onPress={() => handleDeleteRestaurant(item.id, item.name)}
          >
            <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🍽️ Restaurants & Deals</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {[
          { key: 'deals', label: '🔥 Deals', count: allDeals.length },
          { key: 'restaurants', label: '🍽️ Restaurants', count: restaurants.length },
          ...(isAdmin ? [{ key: 'admin', label: '⚙️ Admin', count: 0 }] : []),
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Deals Tab */}
      {activeTab === 'deals' && (
        <FlatList
          data={allDeals}
          keyExtractor={(item) => item.id}
          renderItem={renderDealCard}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🍽️</Text>
              <Text style={styles.emptyText}>No deals available yet</Text>
              <Text style={styles.emptySubText}>Check back later for amazing offers!</Text>
            </View>
          }
        />
      )}

      {/* Restaurants Tab */}
      {activeTab === 'restaurants' && (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.id}
          renderItem={renderRestaurantCard}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🏪</Text>
              <Text style={styles.emptyText}>No restaurants yet</Text>
            </View>
          }
        />
      )}

      {/* Admin Tab */}
      {activeTab === 'admin' && isAdmin && (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddRestaurant(true)}>
            <Ionicons name="add-circle" size={22} color={COLORS.white} />
            <Text style={styles.addBtnText}>Add New Restaurant</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>All Restaurants ({restaurants.length})</Text>
          {restaurants.map((r) => (
            <View key={r.id} style={styles.adminCard}>
              <Text style={styles.adminCardName}>{r.name}</Text>
              <Text style={styles.adminCardSub}>📍 {r.address}</Text>
              <Text style={styles.adminCardSub}>📧 Active deals: {r._count?.deals || 0}</Text>
              <Text style={[styles.adminCardSub, { color: r.isActive ? '#10B981' : '#EF4444' }]}>
                {r.isActive ? '✅ Active' : '❌ Deactivated'}
              </Text>
              <View style={styles.adminActions}>
                <TouchableOpacity
                  style={[styles.adminBtn, { borderColor: r.isActive ? '#EF4444' : '#10B981' }]}
                  onPress={() => toggleRestaurant(r.id, r.isActive)}
                >
                  <Text style={{ color: r.isActive ? '#EF4444' : '#10B981', fontSize: 12, fontWeight: '600' }}>
                    {r.isActive ? 'Deactivate' : 'Activate'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adminBtn, { borderColor: '#EF4444' }]}
                  onPress={() => handleDeleteRestaurant(r.id, r.name)}
                >
                  <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Restaurant Detail Modal */}
      <Modal visible={!!selectedRestaurant} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedRestaurant(null)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>

            {selectedRestaurant && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {selectedRestaurant.image && (
                  <Image source={{ uri: selectedRestaurant.image }} style={styles.detailImage} />
                )}
                <Text style={styles.detailName}>{selectedRestaurant.name}</Text>
                <Text style={styles.detailAddr}>📍 {selectedRestaurant.address}</Text>
                {selectedRestaurant.description && (
                  <Text style={styles.detailDesc}>{selectedRestaurant.description}</Text>
                )}

                {(selectedRestaurant.phone || selectedRestaurant.whatsapp) && (
                  <View style={styles.contactRow}>
                    {selectedRestaurant.phone && (
                      <TouchableOpacity style={styles.contactBtn} onPress={() => callPhone(selectedRestaurant.phone)}>
                        <Ionicons name="call" size={16} color={COLORS.primary} />
                        <Text style={styles.contactText}>{selectedRestaurant.phone}</Text>
                      </TouchableOpacity>
                    )}
                    {selectedRestaurant.whatsapp && (
                      <TouchableOpacity style={[styles.contactBtn, { borderColor: '#25D366' }]} onPress={() => openWhatsApp(selectedRestaurant.whatsapp)}>
                        <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                        <Text style={[styles.contactText, { color: '#25D366' }]}>WhatsApp</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <Text style={styles.dealsHeader}>
                  🔥 Active Deals ({selectedRestaurant.deals?.length || 0})
                </Text>

                {(selectedRestaurant.deals || []).map(deal => (
                  <View key={deal.id} style={styles.detailDeal}>
                    {deal.image && <Image source={{ uri: deal.image }} style={styles.detailDealImage} />}
                    <Text style={styles.detailDealTitle}>{deal.title}</Text>
                    {deal.description && <Text style={styles.detailDealDesc}>{deal.description}</Text>}
                    <View style={styles.priceRow}>
                      {deal.originalPrice && <Text style={styles.originalPrice}>{deal.originalPrice}</Text>}
                      {deal.price && <Text style={styles.dealPrice}>{deal.price}</Text>}
                    </View>
                  </View>
                ))}

                {(!selectedRestaurant.deals || selectedRestaurant.deals.length === 0) && (
                  <Text style={styles.emptySubText}>No active deals right now</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Restaurant Modal */}
      <Modal visible={showAddRestaurant} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={styles.detailName}>Add Restaurant</Text>
                <TouchableOpacity onPress={() => { setShowAddRestaurant(false); resetForm(); }}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <TextInput style={styles.input} placeholder="Restaurant Name *" value={formName} onChangeText={setFormName} placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} placeholder="Address *" value={formAddress} onChangeText={setFormAddress} placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} placeholder="Phone" value={formPhone} onChangeText={setFormPhone} keyboardType="phone-pad" placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} placeholder="WhatsApp" value={formWhatsapp} onChangeText={setFormWhatsapp} keyboardType="phone-pad" placeholderTextColor={COLORS.textLight} />
                <TextInput style={[styles.input, { height: 80 }]} placeholder="Description" value={formDesc} onChangeText={setFormDesc} multiline placeholderTextColor={COLORS.textLight} />

                <Text style={styles.formSection}>🔑 Owner Login Credentials</Text>
                <TextInput style={styles.input} placeholder="Email (for login) *" value={formEmail} onChangeText={setFormEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} placeholder="Password *" value={formPassword} onChangeText={setFormPassword} secureTextEntry placeholderTextColor={COLORS.textLight} />

                <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                  <Text style={{ fontSize: 24 }}>{formImage ? '✅' : '📷'}</Text>
                  <Text style={styles.imagePickerText}>{formImage ? 'Image Selected' : 'Add Cover Photo'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
                  onPress={handleAddRestaurant}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.submitBtnText}>Create Restaurant</Text>
                  )}
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primary, paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  tabsRow: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.secondary },
  tabText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: COLORS.secondary },
  // Deal card
  dealCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, marginBottom: 12,
    overflow: 'hidden', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6,
  },
  dealImage: { width: '100%', height: 160, backgroundColor: COLORS.border },
  dealInfo: { padding: 14 },
  dealTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  dealDesc: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  originalPrice: { fontSize: 13, color: COLORS.textLight, textDecorationLine: 'line-through' },
  dealPrice: { fontSize: 16, fontWeight: '700', color: '#10B981' },
  restaurantTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  miniLogo: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.border },
  restaurantName: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  expiresText: { fontSize: 11, color: '#F59E0B', marginTop: 4 },
  // Restaurant card
  restaurantCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 12,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6,
  },
  restHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  restImage: { width: 56, height: 56, borderRadius: 12, backgroundColor: COLORS.border },
  restPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  restName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  restAddress: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  restDeals: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  contactText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  // Admin
  adminActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  adminBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, marginBottom: 16,
  },
  addBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  adminCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  adminCardName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  adminCardSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '85%',
  },
  modalClose: { position: 'absolute', top: 16, right: 16, zIndex: 10 },
  detailImage: { width: '100%', height: 180, borderRadius: 14, marginBottom: 14, backgroundColor: COLORS.border },
  detailName: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  detailAddr: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },
  detailDesc: { fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: 12 },
  dealsHeader: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 10 },
  detailDeal: {
    backgroundColor: COLORS.background, borderRadius: 12, padding: 12, marginBottom: 10,
  },
  detailDealImage: { width: '100%', height: 120, borderRadius: 10, marginBottom: 8, backgroundColor: COLORS.border },
  detailDealTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  detailDealDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  // Form
  input: {
    backgroundColor: COLORS.background, borderRadius: 10, padding: 14, fontSize: 14,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 10, color: COLORS.text,
  },
  formSection: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 8, marginBottom: 8 },
  imagePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed',
    borderColor: COLORS.border, marginBottom: 14, justifyContent: 'center',
  },
  imagePickerText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  submitBtn: {
    backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center',
  },
  submitBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  // Empty
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '600' },
  emptySubText: { fontSize: 13, color: COLORS.textLight, marginTop: 4, textAlign: 'center' },
});
