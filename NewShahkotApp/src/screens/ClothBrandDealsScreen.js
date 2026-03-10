import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
  Alert, ActivityIndicator, RefreshControl, TextInput, Image, Modal,
  KeyboardAvoidingView, Platform, Linking, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { clothBrandsAPI } from '../services/api';
import AdBanner from '../components/AdBanner';
import { useLanguage } from '../context/LanguageContext';

const { width } = Dimensions.get('window');

export default function ClothBrandDealsScreen({ navigation, route }) {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const [brands, setBrands] = useState([]);
  const [allDeals, setAllDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('deals');
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [search, setSearch] = useState('');

  // Add brand form
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formImage, setFormImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Owner state
  const [ownerToken, setOwnerToken] = useState(null);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerLoginLoading, setOwnerLoginLoading] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [dealTitle, setDealTitle] = useState('');
  const [dealDesc, setDealDesc] = useState('');
  const [dealPrice, setDealPrice] = useState('');
  const [dealOriginalPrice, setDealOriginalPrice] = useState('');
  const [dealMedia, setDealMedia] = useState([]); // images + optional video
  const [dealSubmitting, setDealSubmitting] = useState(false);
  const [showOwnerLoginModal, setShowOwnerLoginModal] = useState(false);

  useEffect(() => {
    loadData();
    const p = route?.params;
    if (p?.ownerToken && p?.ownerProfile) {
      setOwnerToken(p.ownerToken);
      setOwnerProfile(p.ownerProfile);
      setActiveTab('owner');
    }
  }, []);

  const loadData = async () => {
    try {
      const [brandRes, dealsRes] = await Promise.allSettled([
        clothBrandsAPI.getAll(search ? { search } : {}),
        clothBrandsAPI.getAllDeals(),
      ]);
      if (brandRes.status === 'fulfilled') setBrands(brandRes.value.data.brands || []);
      if (dealsRes.status === 'fulfilled') setAllDeals(dealsRes.value.data.deals || []);
    } catch (err) {
      console.error('Load brands error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [search]);

  const loadBrandDetail = async (id) => {
    try {
      const res = await clothBrandsAPI.getOne(id);
      setSelectedBrand(res.data);
    } catch {
      Alert.alert(t('error'), 'Could not load brand details.');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) setFormImage(result.assets[0]);
  };

  const handleAddBrand = async () => {
    if (!formName.trim() || !formAddress.trim() || !formEmail.trim() || !formPassword.trim()) {
      return Alert.alert(t('required'), 'Name, address, email, and password are required.');
    }
    if (formPassword.length < 6) {
      return Alert.alert(t('error'), 'Password must be at least 6 characters.');
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
        formData.append('image', { uri: formImage.uri, type: 'image/jpeg', name: 'brand.jpg' });
      }
      const res = await clothBrandsAPI.adminCreate(formData);
      Alert.alert(t('done') + ' 🎉', `${res.data.brand.name} added.\n\nLogin: ${res.data.brand.email}\nPassword: ${formPassword.trim()}\n\nShare these credentials with the brand owner.`);
      setShowAddBrand(false);
      resetForm();
      loadData();
    } catch (err) {
      Alert.alert(t('error'), err.response?.data?.error || 'Failed to create brand.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBrand = (id, name) => {
    Alert.alert(t('deleteBrand') || 'Delete Brand', `Remove "${name}" and all its deals?`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive',
        onPress: async () => {
          try {
            await clothBrandsAPI.adminDelete(id);
            Alert.alert(t('deleted'), 'Brand removed.');
            loadData();
            setSelectedBrand(null);
          } catch {
            Alert.alert(t('error'), 'Failed to delete.');
          }
        },
      },
    ]);
  };

  const toggleBrand = async (id, currentActive) => {
    try {
      await clothBrandsAPI.adminUpdate(id, { isActive: !currentActive });
      loadData();
    } catch {
      Alert.alert(t('error'), 'Failed to update.');
    }
  };

  const resetForm = () => {
    setFormName(''); setFormAddress(''); setFormPhone(''); setFormWhatsapp('');
    setFormDesc(''); setFormEmail(''); setFormPassword(''); setFormImage(null);
  };

  // ── Owner: login ──────────────────────────────────────────────────────
  const handleOwnerLogin = async () => {
    if (!ownerEmail.trim() || !ownerPassword.trim()) {
      return Alert.alert(t('required'), 'Please enter your email and password.');
    }
    setOwnerLoginLoading(true);
    try {
      const res = await clothBrandsAPI.ownerLogin({ email: ownerEmail.trim(), password: ownerPassword.trim() });
      const token = res.data.token;
      setOwnerToken(token);
      const profileRes = await clothBrandsAPI.ownerProfile(token);
      setOwnerProfile(profileRes.data);
      setShowOwnerLoginModal(false);
      setActiveTab('owner');
    } catch (err) {
      Alert.alert(t('loginFailed'), err.response?.data?.error || 'Invalid email or password.');
    } finally {
      setOwnerLoginLoading(false);
    }
  };

  const handleOwnerLogout = () => {
    setOwnerToken(null); setOwnerProfile(null);
    setOwnerEmail(''); setOwnerPassword('');
    setActiveTab('deals');
  };

  const reloadOwnerProfile = async () => {
    if (!ownerToken) return;
    try {
      const res = await clothBrandsAPI.ownerProfile(ownerToken);
      setOwnerProfile(res.data);
    } catch {}
  };

  // ── Owner: pick media (images + video) ────────────────────────────────
  const pickDealMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 6,
      videoMaxDuration: 120,
    });
    if (!result.canceled) {
      setDealMedia(result.assets.slice(0, 6));
    }
  };

  // ── Owner: add deal ───────────────────────────────────────────────────
  const handleAddDeal = async () => {
    if (!dealTitle.trim()) return Alert.alert(t('required'), 'Deal title is required.');
    setDealSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', dealTitle.trim());
      fd.append('description', dealDesc.trim());
      fd.append('price', dealPrice.trim());
      fd.append('originalPrice', dealOriginalPrice.trim());
      dealMedia.forEach((asset, i) => {
        const isVideo = asset.type === 'video';
        fd.append('media', {
          uri: asset.uri,
          type: isVideo ? 'video/mp4' : 'image/jpeg',
          name: isVideo ? `deal_video_${i}.mp4` : `deal_img_${i}.jpg`,
        });
      });
      await clothBrandsAPI.ownerCreateDeal(ownerToken, fd);
      Alert.alert(t('done') + ' 🎉', t('dealAdded'));
      setShowAddDeal(false);
      setDealTitle(''); setDealDesc(''); setDealPrice(''); setDealOriginalPrice(''); setDealMedia([]);
      reloadOwnerProfile();
      loadData();
    } catch (err) {
      Alert.alert(t('error'), err.response?.data?.error || 'Failed to add deal.');
    } finally {
      setDealSubmitting(false);
    }
  };

  const handleDeleteDeal = (dealId) => {
    Alert.alert(t('deleteDeal') || 'Delete Deal', t('deleteDealConfirm') || 'Remove this deal?', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'), style: 'destructive', onPress: async () => {
          try {
            await clothBrandsAPI.ownerDeleteDeal(ownerToken, dealId);
            reloadOwnerProfile();
            loadData();
          } catch {
            Alert.alert(t('error'), 'Failed to delete deal.');
          }
        },
      },
    ]);
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
  const renderDealCard = ({ item }) => {
    if (item.type === 'AD_ITEM') return <AdBanner />;
    const firstImage = item.images?.[0];
    return (
      <TouchableOpacity style={styles.dealCard} onPress={() => loadBrandDetail(item.brand?.id || item.brandId)}>
        {firstImage && <Image source={{ uri: firstImage }} style={styles.dealImage} />}
        {item.videos?.length > 0 && (
          <View style={styles.videoBadge}>
            <Ionicons name="videocam" size={14} color="#FFF" />
            <Text style={styles.videoBadgeText}>Video</Text>
          </View>
        )}
        <View style={styles.dealInfo}>
          <Text style={styles.dealTitle} numberOfLines={2}>{item.title}</Text>
          {item.description && <Text style={styles.dealDesc} numberOfLines={2}>{item.description}</Text>}
          <View style={styles.priceRow}>
            {item.originalPrice && <Text style={styles.originalPrice}>{item.originalPrice}</Text>}
            {item.price && <Text style={styles.dealPrice}>{item.price}</Text>}
          </View>
          <View style={styles.brandTag}>
            {item.brand?.image && <Image source={{ uri: item.brand.image }} style={styles.miniLogo} />}
            <Text style={styles.brandName} numberOfLines={1}>👔 {item.brand?.name || 'Brand'}</Text>
          </View>
          {item.expiresAt && (
            <Text style={styles.expiresText}>
              ⏰ Expires: {new Date(item.expiresAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render brand card
  const renderBrandCard = ({ item }) => {
    if (item.type === 'AD_ITEM') return <AdBanner />;
    return (
      <TouchableOpacity style={styles.brandCard} onPress={() => loadBrandDetail(item.id)}>
        <View style={styles.brandHeader}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.brandImage} />
          ) : (
            <View style={[styles.brandImage, styles.brandPlaceholder]}>
              <Text style={{ fontSize: 28 }}>👔</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.brandCardName}>{item.name}</Text>
            <Text style={styles.brandAddress} numberOfLines={1}>📍 {item.address}</Text>
            <Text style={styles.brandDeals}>{item._count?.deals || 0} {t('activeDeals')}</Text>
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
              onPress={() => toggleBrand(item.id, item.isActive)}
            >
              <Text style={{ color: item.isActive ? '#EF4444' : '#10B981', fontSize: 12, fontWeight: '600' }}>
                {item.isActive ? 'Deactivate' : 'Activate'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.adminBtn, { borderColor: '#EF4444' }]}
              onPress={() => handleDeleteBrand(item.id, item.name)}
            >
              <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

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
        <Text style={styles.headerTitle}>{t('brandsTitle')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {[
          { key: 'deals', label: '🔥 Deals', count: allDeals.length },
          { key: 'brands', label: '👔 Brands', count: brands.length },
          ...(ownerToken ? [{ key: 'owner', label: '👤 Owner', count: 0 }] : []),
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
          data={(() => { const out = []; allDeals.forEach((d, i) => { out.push(d); if ((i + 1) % 4 === 0) out.push({ id: `ad-deal-${i}`, type: 'AD_ITEM' }); }); return out; })()}
          keyExtractor={(item) => item.id}
          renderItem={renderDealCard}
          contentContainerStyle={{ padding: 12 }}
          ListHeaderComponent={<AdBanner />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>👔</Text>
              <Text style={styles.emptyText}>{t('noDealsYet')}</Text>
              <Text style={styles.emptySubText}>{t('checkBackLaterDeals')}</Text>
            </View>
          }
        />
      )}

      {/* Brands Tab */}
      {activeTab === 'brands' && (
        <FlatList
          data={(() => { const out = []; brands.forEach((r, i) => { out.push(r); if ((i + 1) % 4 === 0) out.push({ id: `ad-brand-${i}`, type: 'AD_ITEM' }); }); return out; })()}
          keyExtractor={(item) => item.id}
          renderItem={renderBrandCard}
          contentContainerStyle={{ padding: 12 }}
          ListHeaderComponent={<AdBanner />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🏪</Text>
              <Text style={styles.emptyText}>{t('noBrandsYet')}</Text>
            </View>
          }
          ListFooterComponent={
            !ownerToken ? (
              <TouchableOpacity
                onPress={() => setShowOwnerLoginModal(true)}
                style={{ alignItems: 'center', paddingVertical: 24 }}
              >
                <Text style={{ fontSize: 12, color: COLORS.textLight }}>{t('brandOwnerPrompt')}</Text>
                <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 2 }}>{t('loginToManage')}</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Owner Tab */}
      {activeTab === 'owner' && ownerToken && (
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View>
              <Text style={styles.sectionTitle}>👔 {ownerProfile?.name}</Text>
              <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>📍 {ownerProfile?.address}</Text>
            </View>
            <TouchableOpacity onPress={handleOwnerLogout} style={{ padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8 }}>
              <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '700' }}>Logout</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddDeal(true)}>
            <Ionicons name="add-circle" size={22} color={COLORS.white} />
            <Text style={styles.addBtnText}>{t('addNewDeal')}</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
            Your Deals ({ownerProfile?.deals?.length || 0})
          </Text>

          {(!ownerProfile?.deals || ownerProfile.deals.length === 0) ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>🏷️</Text>
              <Text style={styles.emptyText}>No deals yet</Text>
              <Text style={styles.emptySubText}>Tap "Add New Deal" to create your first deal</Text>
            </View>
          ) : (
            ownerProfile.deals.map(deal => (
              <View key={deal.id} style={[styles.adminCard, { borderLeftWidth: 3, borderLeftColor: deal.isActive ? '#10B981' : '#EF4444' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adminCardName}>{deal.title}</Text>
                    {deal.description ? <Text style={styles.adminCardSub}>{deal.description}</Text> : null}
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                      {deal.originalPrice ? <Text style={{ fontSize: 12, color: COLORS.textLight, textDecorationLine: 'line-through' }}>{deal.originalPrice}</Text> : null}
                      {deal.price ? <Text style={{ fontSize: 13, fontWeight: '700', color: '#10B981' }}>{deal.price}</Text> : null}
                    </View>
                    {deal.images?.length > 0 && (
                      <Text style={{ fontSize: 11, color: COLORS.textLight, marginTop: 2 }}>📷 {deal.images.length} image(s)</Text>
                    )}
                    {deal.videos?.length > 0 && (
                      <Text style={{ fontSize: 11, color: COLORS.textLight }}>🎥 {deal.videos.length} video(s)</Text>
                    )}
                    <Text style={[styles.adminCardSub, { color: deal.isActive ? '#10B981' : '#EF4444', marginTop: 4 }]}>
                      {deal.isActive ? '✅ Active' : '❌ Inactive'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteDeal(deal.id)}
                    style={{ padding: 8, backgroundColor: '#FEE2E2', borderRadius: 8, marginLeft: 8 }}
                  >
                    <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '700' }}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Admin Tab */}
      {activeTab === 'admin' && isAdmin && (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddBrand(true)}>
            <Ionicons name="add-circle" size={22} color={COLORS.white} />
            <Text style={styles.addBtnText}>{t('addNewBrand')}</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>{t('allBrands') || 'All Brands'} ({brands.length})</Text>
          {brands.map((r) => (
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
                  onPress={() => toggleBrand(r.id, r.isActive)}
                >
                  <Text style={{ color: r.isActive ? '#EF4444' : '#10B981', fontSize: 12, fontWeight: '600' }}>
                    {r.isActive ? 'Deactivate' : 'Activate'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adminBtn, { borderColor: '#EF4444' }]}
                  onPress={() => handleDeleteBrand(r.id, r.name)}
                >
                  <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Brand Detail Modal */}
      <Modal visible={!!selectedBrand} animationType="slide" transparent onRequestClose={() => setSelectedBrand(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedBrand(null)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>

            {selectedBrand && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {selectedBrand.image && (
                  <Image source={{ uri: selectedBrand.image }} style={styles.detailImage} />
                )}
                <Text style={styles.detailName}>{selectedBrand.name}</Text>
                <Text style={styles.detailAddr}>📍 {selectedBrand.address}</Text>
                {selectedBrand.description && (
                  <Text style={styles.detailDesc}>{selectedBrand.description}</Text>
                )}

                {(selectedBrand.phone || selectedBrand.whatsapp) && (
                  <View style={styles.contactRow}>
                    {selectedBrand.phone && (
                      <TouchableOpacity style={styles.contactBtn} onPress={() => callPhone(selectedBrand.phone)}>
                        <Ionicons name="call" size={16} color={COLORS.primary} />
                        <Text style={styles.contactText}>{selectedBrand.phone}</Text>
                      </TouchableOpacity>
                    )}
                    {selectedBrand.whatsapp && (
                      <TouchableOpacity style={[styles.contactBtn, { borderColor: '#25D366' }]} onPress={() => openWhatsApp(selectedBrand.whatsapp)}>
                        <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                        <Text style={[styles.contactText, { color: '#25D366' }]}>WhatsApp</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <Text style={styles.dealsHeader}>
                  🔥 Active Deals ({selectedBrand.deals?.length || 0})
                </Text>

                {(selectedBrand.deals || []).map(deal => (
                  <View key={deal.id} style={styles.detailDeal}>
                    {deal.images?.[0] && <Image source={{ uri: deal.images[0] }} style={styles.detailDealImage} />}
                    {deal.images?.length > 1 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                        {deal.images.slice(1).map((img, idx) => (
                          <Image key={idx} source={{ uri: img }} style={{ width: 100, height: 80, borderRadius: 8, marginRight: 8 }} />
                        ))}
                      </ScrollView>
                    )}
                    <Text style={styles.detailDealTitle}>{deal.title}</Text>
                    {deal.description && <Text style={styles.detailDealDesc}>{deal.description}</Text>}
                    <View style={styles.priceRow}>
                      {deal.originalPrice && <Text style={styles.originalPrice}>{deal.originalPrice}</Text>}
                      {deal.price && <Text style={styles.dealPrice}>{deal.price}</Text>}
                    </View>
                    {deal.videos?.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                        <Ionicons name="videocam" size={14} color={COLORS.primary} />
                        <Text style={{ fontSize: 12, color: COLORS.primary }}>{deal.videos.length} video(s)</Text>
                      </View>
                    )}
                  </View>
                ))}

                {(!selectedBrand.deals || selectedBrand.deals.length === 0) && (
                  <Text style={styles.emptySubText}>{t('noActiveDeals')}</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Brand Modal */}
      <Modal visible={showAddBrand} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={styles.detailName}>Add Brand</Text>
                <TouchableOpacity onPress={() => { setShowAddBrand(false); resetForm(); }}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <TextInput style={styles.input} placeholder={t('brandName')} value={formName} onChangeText={setFormName} placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} placeholder={t('restaurantAddress')} value={formAddress} onChangeText={setFormAddress} placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} placeholder="Phone" value={formPhone} onChangeText={setFormPhone} keyboardType="phone-pad" placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} placeholder="WhatsApp" value={formWhatsapp} onChangeText={setFormWhatsapp} keyboardType="phone-pad" placeholderTextColor={COLORS.textLight} />
                <TextInput style={[styles.input, { height: 80 }]} placeholder="Description" value={formDesc} onChangeText={setFormDesc} multiline placeholderTextColor={COLORS.textLight} />

                <Text style={styles.formSection}>🔑 Owner Login Credentials</Text>
                <TextInput style={styles.input} placeholder="Email (for login) *" value={formEmail} onChangeText={setFormEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} placeholder="Password *" value={formPassword} onChangeText={setFormPassword} secureTextEntry placeholderTextColor={COLORS.textLight} />

                <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                  <Text style={{ fontSize: 24 }}>{formImage ? '✅' : '📷'}</Text>
                  <Text style={styles.imagePickerText}>{formImage ? 'Image Selected' : 'Add Brand Logo'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
                  onPress={handleAddBrand}
                  disabled={submitting}
                >
                  {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitBtnText}>Create Brand</Text>}
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Owner Login Modal */}
      <Modal visible={showOwnerLoginModal} animationType="slide" transparent onRequestClose={() => setShowOwnerLoginModal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[styles.modalContent, { maxHeight: '70%' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={styles.detailName}>🔑 Brand Owner Login</Text>
                <TouchableOpacity onPress={() => setShowOwnerLoginModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 20, lineHeight: 18 }}>
                {t('ownerLoginSubtitle')}
              </Text>
              <TextInput
                style={styles.input} placeholder="Email address" value={ownerEmail}
                onChangeText={setOwnerEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={COLORS.textLight}
              />
              <TextInput
                style={styles.input} placeholder="Password" value={ownerPassword}
                onChangeText={setOwnerPassword} secureTextEntry placeholderTextColor={COLORS.textLight}
              />
              <TouchableOpacity
                style={[styles.submitBtn, ownerLoginLoading && { opacity: 0.5 }]}
                onPress={handleOwnerLogin} disabled={ownerLoginLoading}
              >
                {ownerLoginLoading
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.submitBtnText}>{t('loginAsBrandOwner')}</Text>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Add Deal Modal (Owner) */}
      <Modal visible={showAddDeal} animationType="slide" transparent onRequestClose={() => setShowAddDeal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={styles.detailName}>Add New Deal</Text>
                <TouchableOpacity onPress={() => setShowAddDeal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <TextInput style={styles.input} placeholder={t('dealTitle')} value={dealTitle} onChangeText={setDealTitle} placeholderTextColor={COLORS.textLight} />
                <TextInput style={[styles.input, { height: 80 }]} placeholder="Description (optional)" value={dealDesc} onChangeText={setDealDesc} multiline placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} placeholder="Price (e.g. Rs. 500 or 30% OFF)" value={dealPrice} onChangeText={setDealPrice} placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} placeholder="Original Price (e.g. Rs. 800)" value={dealOriginalPrice} onChangeText={setDealOriginalPrice} placeholderTextColor={COLORS.textLight} />

                <TouchableOpacity style={styles.imagePicker} onPress={pickDealMedia}>
                  <Text style={{ fontSize: 24 }}>{dealMedia.length > 0 ? '✅' : '📷'}</Text>
                  <Text style={styles.imagePickerText}>
                    {dealMedia.length > 0 ? `${dealMedia.length} file(s) selected` : 'Add Images / Video (max 6, 30MB)'}
                  </Text>
                </TouchableOpacity>
                {dealMedia.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {dealMedia.map((asset, i) => (
                      <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                        <Image source={{ uri: asset.uri }} style={{ width: 70, height: 70, borderRadius: 8 }} />
                        {asset.type === 'video' && (
                          <View style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 2 }}>
                            <Ionicons name="videocam" size={12} color="#FFF" />
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                )}

                <TouchableOpacity
                  style={[styles.submitBtn, dealSubmitting && { opacity: 0.5 }]}
                  onPress={handleAddDeal} disabled={dealSubmitting}
                >
                  {dealSubmitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitBtnText}>{t('addDealBtn')}</Text>}
                </TouchableOpacity>
                {dealSubmitting && (
                  <Text style={{ textAlign: 'center', color: COLORS.textLight, fontSize: 12, marginTop: 8 }}>
                    Uploading media... This may take a minute for videos.
                  </Text>
                )}
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
  videoBadge: {
    position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  videoBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  dealInfo: { padding: 14 },
  dealTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  dealDesc: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  originalPrice: { fontSize: 13, color: COLORS.textLight, textDecorationLine: 'line-through' },
  dealPrice: { fontSize: 16, fontWeight: '700', color: '#10B981' },
  brandTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  miniLogo: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.border },
  brandName: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  expiresText: { fontSize: 11, color: '#F59E0B', marginTop: 4 },
  // Brand card
  brandCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 12,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6,
  },
  brandHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  brandImage: { width: 56, height: 56, borderRadius: 12, backgroundColor: COLORS.border },
  brandPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  brandCardName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  brandAddress: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  brandDeals: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
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
