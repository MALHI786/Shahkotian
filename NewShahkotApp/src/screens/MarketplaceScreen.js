import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Image,
  StyleSheet, RefreshControl, Linking, Alert, ActivityIndicator, Modal,
  ScrollView, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, LISTING_CATEGORIES } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { listingsAPI } from '../services/api';
import AdBanner from '../components/AdBanner';
import { useLanguage } from '../context/LanguageContext';

const { width } = Dimensions.get('window');

export default function MarketplaceScreen() {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [showMyListings, setShowMyListings] = useState(false);

  // Create listing state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('ELECTRONICS');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || user?.phone || '');
  const [images, setImages] = useState([]);
  const [video, setVideo] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadListings();
  }, [selectedCategory]);

  const loadListings = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;

      const response = await listingsAPI.getAll(params);
      setListings(response.data.listings || []);
    } catch (error) {
      console.error('Listings error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openWhatsApp = (number, itemTitle) => {
    const msg = itemTitle ? `Hi, I'm interested in "${itemTitle}" listed on Shahkot App.` : '';
    const url = `https://wa.me/${number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => Alert.alert(t('error'), 'Unable to open WhatsApp'));
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImages(result.assets.slice(0, 5));
    }
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 30 * 1024 * 1024) {
        Alert.alert('Too Large', 'Video must be under 30MB.');
        return;
      }
      setVideo(asset);
    }
  };

  const createListing = async () => {
    if (!title || !description || !price || !whatsapp) {
      Alert.alert(t('requiredFields'), t('fillAllFieldsWhatsapp'));
      return;
    }
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('price', price);
      formData.append('category', category);
      formData.append('whatsapp', whatsapp);
      images.forEach((img, idx) => {
        formData.append('media', {
          uri: img.uri,
          type: 'image/jpeg',
          name: `listing_${idx}.jpg`,
        });
      });
      if (video) {
        formData.append('media', {
          uri: video.uri,
          type: 'video/mp4',
          name: 'listing_video.mp4',
        });
      }
      await listingsAPI.create(formData);
      setShowCreate(false);
      resetForm();
      loadListings();
      Alert.alert(t('success'), t('listingCreated'));
    } catch (error) {
      Alert.alert(t('error'), error.response?.data?.error || 'Failed to create listing.');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPrice('');
    setCategory('ELECTRONICS');
    setImages([]);
    setVideo(null);
  };

  const markAsSold = async (itemId) => {
    Alert.alert(t('markAsSold'), t('markAsSoldConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('markSold'),
        onPress: async () => {
          try {
            await listingsAPI.update(itemId, { isSold: true });
            setSelectedListing(null);
            loadListings();
            Alert.alert(t('done'), t('itemSold'));
          } catch (error) {
            Alert.alert(t('error'), 'Failed to update listing.');
          }
        },
      },
    ]);
  };

  const deleteListing = async (itemId) => {
    Alert.alert(t('deleteListing'), t('deleteListingConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await listingsAPI.delete(itemId);
            setSelectedListing(null);
            loadListings();
            Alert.alert(t('deleted'), t('listingDeleted'));
          } catch (error) {
            Alert.alert(t('error'), 'Failed to delete listing.');
          }
        },
      },
    ]);
  };

  const getCategoryInfo = (key) => {
    return LISTING_CATEGORIES.find(c => c.key === key) || { icon: '📦', label: key };
  };

  const renderListing = ({ item }) => {
    const catInfo = getCategoryInfo(item.category);
    return (
      <TouchableOpacity
        style={styles.listingCard}
        activeOpacity={0.8}
        onPress={() => setSelectedListing(item)}
      >
        {item.images && item.images.length > 0 ? (
          <Image
            source={{ uri: item.images[0] }}
            style={styles.listingImage}
            resizeMode="cover"
            defaultSource={undefined}
          />
        ) : (
          <View style={styles.noImagePlaceholder}>
            <Text style={styles.noImageIcon}>{catInfo.icon}</Text>
            <Text style={styles.noImageText}>{t('noPhoto')}</Text>
          </View>
        )}
        {item.isSold && (
          <View style={styles.soldBadge}>
            <Text style={styles.soldText}>{t('sold')}</Text>
          </View>
        )}
        <View style={styles.listingInfo}>
          <View style={styles.listingCategoryTag}>
            <Text style={styles.listingCategoryText}>{catInfo.icon} {catInfo.label}</Text>
          </View>
          <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.listingPrice}>Rs. {Number(item.price || 0).toLocaleString()}</Text>
          <Text style={styles.listingDesc} numberOfLines={2}>{item.description}</Text>
          <View style={styles.listingFooter}>
            <Text style={styles.listingUser}>👤 {item.user?.name || 'Unknown'}</Text>
            <TouchableOpacity
              style={styles.whatsappButton}
              onPress={() => openWhatsApp(item.whatsapp, item.title)}
            >
              <Text style={styles.whatsappText}>💬 Chat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Listing Detail Modal
  const renderDetailModal = () => {
    if (!selectedListing) return null;
    const item = selectedListing;
    const catInfo = getCategoryInfo(item.category);
    return (
      <Modal visible={true} animationType="slide" onRequestClose={() => setSelectedListing(null)}>
        <View style={styles.detailContainer}>
          {/* Header */}
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedListing(null)}>
              <Text style={styles.detailBackBtn}>{'<'} {t('back')}</Text>
            </TouchableOpacity>
            <Text style={styles.detailHeaderTitle}>{t('itemDetails')}</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.detailScroll}>
            {/* Image Gallery */}
            {item.images && item.images.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.imageGallery}
              >
                {item.images.map((uri, idx) => (
                  <Image
                    key={idx}
                    source={{ uri }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.noImagePlaceholder, { height: 250 }]}>  
                <Text style={styles.noImageIcon}>{catInfo.icon}</Text>
                <Text style={styles.noImageText}>{t('noPhoto')}</Text>
              </View>
            )}
            {item.images && item.images.length > 1 && (
              <Text style={styles.imageCount}>📷 {item.images.length} photos - swipe to see more</Text>
            )}

            {/* Video */}
            {item.videos && item.videos.length > 0 && (
              <View style={styles.videoSection}>
                <Video
                  source={{ uri: item.videos[0] }}
                  style={styles.detailVideo}
                  useNativeControls
                  resizeMode="contain"
                  shouldPlay={false}
                />
              </View>
            )}

            {/* Details */}
            <View style={styles.detailContent}>
              <View style={styles.detailCategoryTag}>
                <Text style={styles.detailCategoryText}>{catInfo.icon} {catInfo.label}</Text>
              </View>
              <Text style={styles.detailTitle}>{item.title}</Text>
              <Text style={styles.detailPrice}>Rs. {Number(item.price || 0).toLocaleString()}</Text>
              
              {item.isSold && (
                <View style={styles.soldBanner}>
                  <Text style={styles.soldBannerText}>🔴 This item has been sold</Text>
                </View>
              )}

              <View style={styles.divider} />
              
              <Text style={styles.sectionLabel}>{t('description')}</Text>
              <Text style={styles.detailDesc}>{item.description}</Text>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>{t('seller')}</Text>
              <View style={styles.sellerRow}>
                {item.user?.photoUrl ? (
                  <Image source={{ uri: item.user.photoUrl }} style={styles.sellerAvatar} />
                ) : (
                  <View style={styles.sellerAvatar}>
                    <Text style={styles.sellerAvatarText}>{item.user?.name?.[0] || '?'}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.sellerName}>{item.user?.name || 'Unknown'}</Text>
                  <Text style={styles.sellerSub}>{t('shahkotSeller')}</Text>
                </View>
              </View>

              <Text style={styles.detailDate}>
                Listed {new Date(item.createdAt).toLocaleDateString('en-PK', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}
              </Text>

              {/* Owner Actions: Mark Sold & Delete */}
              {(item.user?.id === user?.id || isAdmin) && (
                <View style={styles.ownerActions}>
                  {!item.isSold && item.user?.id === user?.id && (
                    <TouchableOpacity
                      style={styles.markSoldBtn}
                      onPress={() => markAsSold(item.id)}
                    >
                      <Text style={styles.markSoldText}>✅ {t('markAsSold')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.deleteListingBtn}
                    onPress={() => deleteListing(item.id)}
                  >
                      <Text style={styles.deleteListingText}>🗑️ {t('deleteListing')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          {/* WhatsApp CTA */}
          <View style={styles.detailCTA}>
            <TouchableOpacity
              style={styles.whatsappCTAButton}
              onPress={() => openWhatsApp(item.whatsapp, item.title)}
            >
              <Text style={styles.whatsappCTAText}>💬 {t('contactWhatsapp')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.callCTAButton}
              onPress={() => Linking.openURL(`tel:${item.whatsapp}`).catch(() => Alert.alert(t('error'), t('unableToCall')))}
            >
              <Text style={styles.callCTAText}>📞</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.marketHeader}>
        <Text style={styles.marketHeaderTitle}>{t('buySellTitle')}</Text>
        <TouchableOpacity onPress={() => setShowMyListings(!showMyListings)}>
          <Text style={styles.myListingsBtn}>{showMyListings ? t('allItems') : t('myListingsTab')}</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchItems')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={loadListings}
          returnKeyType="search"
          placeholderTextColor={COLORS.textLight}
        />
        <TouchableOpacity style={styles.searchButton} onPress={loadListings}>
          <Text style={{ fontSize: 18 }}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <FlatList
        horizontal
        data={[{ key: null, label: 'All', icon: '📋' }, ...LISTING_CATEGORIES]}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key || 'all'}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === item.key && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(item.key)}
          >
            <Text style={styles.categoryIcon}>{item.icon}</Text>
            <Text style={[styles.categoryLabel, selectedCategory === item.key && styles.categoryLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Listings */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={showMyListings ? listings.filter(l => l.user?.id === user?.id) : listings}
          renderItem={renderListing}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 6 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadListings(); }} />}
          ListHeaderComponent={<AdBanner />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🛒</Text>
              <Text style={styles.emptyText}>{t('noListingsFound')}</Text>
              <Text style={styles.emptySubtext}>{t('beFirstToSell')}</Text>
            </View>
          }
          ListFooterComponent={<AdBanner />}
          contentContainerStyle={{ paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Create Listing FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)}>
        <Text style={styles.fabText}>{t('sellFab')}</Text>
      </TouchableOpacity>

      {/* Create Listing Modal */}
      <Modal visible={showCreate} animationType="slide" transparent={false}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('sellSomething')}</Text>
            <View style={{ width: 30 }} />
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <TextInput style={styles.input} placeholder={t('titleField')} value={title} onChangeText={setTitle} placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder={t('descriptionSell')} value={description} onChangeText={setDescription} multiline placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} placeholder={t('pricePlaceholder')} value={price} onChangeText={setPrice} keyboardType="numeric" placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} placeholder={t('whatsappRequired')} value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" placeholderTextColor={COLORS.textLight} />

            <Text style={styles.fieldLabel}>{t('category')}</Text>
            <FlatList
              horizontal
              data={LISTING_CATEGORIES}
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.categoryChip, category === item.key && styles.categoryChipActive]}
                  onPress={() => setCategory(item.key)}
                >
                  <Text style={styles.categoryIcon}>{item.icon}</Text>
                  <Text style={[styles.categoryLabel, category === item.key && styles.categoryLabelActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity style={styles.imagePickBtn} onPress={pickImages}>
              <Text style={styles.imagePickIcon}>📷</Text>
              <Text style={styles.imagePickText}>{t('addPhotos')}</Text>
            </TouchableOpacity>

            {images.length > 0 && (
              <View style={styles.previewRow}>
                {images.map((img, idx) => (
                  <Image key={idx} source={{ uri: img.uri }} style={styles.previewImg} />
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.imagePickBtn} onPress={pickVideo}>
              <Text style={styles.imagePickIcon}>🎥</Text>
              <Text style={styles.imagePickText}>{video ? '✅ Video Selected (tap to change)' : 'Add Video (optional, up to 30MB)'}</Text>
            </TouchableOpacity>

            {video && (
              <View style={styles.videoPreviewRow}>
                <Video
                  source={{ uri: video.uri }}
                  style={styles.videoPreview}
                  useNativeControls
                  resizeMode="contain"
                />
                <TouchableOpacity onPress={() => setVideo(null)} style={styles.removeVideoBtn}>
                  <Text style={styles.removeVideoText}>✕ Remove</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, creating && { opacity: 0.6 }]}
              onPress={createListing}
              disabled={creating}
            >
              {creating ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitText}>{t('postListing')}</Text>}
            </TouchableOpacity>
            <View style={{ height: 60 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail Modal */}
      {renderDetailModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row',
    margin: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  searchInput: { flex: 1, padding: 14, fontSize: 15, color: COLORS.text },
  searchButton: { padding: 14, justifyContent: 'center' },
  categoryList: { paddingHorizontal: 12, marginBottom: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryIcon: { marginRight: 4, fontSize: 14 },
  categoryLabel: { fontSize: 12, color: COLORS.text },
  categoryLabelActive: { color: COLORS.white },
  // Listing Card - Compact small boxes
  listingCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 4,
    marginBottom: 6,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    width: '47%',
  },
  listingImage: { width: '100%', height: 90 },
  noImagePlaceholder: {
    width: '100%',
    height: 80,
    backgroundColor: COLORS.gray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageIcon: { fontSize: 26, marginBottom: 2 },
  noImageText: { fontSize: 9, color: COLORS.textLight },
  listingInfo: { padding: 8 },
  listingCategoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.gray,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    marginBottom: 3,
  },
  listingCategoryText: { fontSize: 8, color: COLORS.textSecondary },
  listingTitle: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  listingPrice: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: 3 },
  listingDesc: { fontSize: 9, color: COLORS.textSecondary, lineHeight: 12, marginBottom: 5 },
  listingFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listingUser: { fontSize: 9, color: COLORS.textSecondary },
  whatsappButton: {
    backgroundColor: '#25D366',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  whatsappText: { color: COLORS.white, fontWeight: '700', fontSize: 9 },
  soldBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.error,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 1,
  },
  soldText: { color: COLORS.white, fontWeight: '700', fontSize: 10 },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 18, color: COLORS.textSecondary, fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },
  // Create Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
    backgroundColor: COLORS.surface,
    elevation: 2,
  },
  closeButton: { fontSize: 24, color: COLORS.text, padding: 4 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalBody: { padding: 20, flex: 1 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
  },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginTop: 4 },
  imagePickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray,
    padding: 18,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  imagePickIcon: { fontSize: 24, marginRight: 8 },
  imagePickText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '500' },
  previewRow: { flexDirection: 'row', marginTop: 12, gap: 8, flexWrap: 'wrap' },
  previewImg: { width: 70, height: 70, borderRadius: 10 },
  videoPreviewRow: { marginTop: 12, alignItems: 'center' },
  videoPreview: { width: '100%', height: 200, borderRadius: 10, backgroundColor: '#000' },
  removeVideoBtn: { marginTop: 6 },
  removeVideoText: { color: COLORS.error || '#E53935', fontWeight: '600', fontSize: 13 },
  videoSection: { marginHorizontal: 16, marginTop: 8 },
  detailVideo: { width: '100%', height: 250, borderRadius: 10, backgroundColor: '#000' },
  submitButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  submitText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  // Detail Modal
  detailContainer: { flex: 1, backgroundColor: COLORS.background },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
  },
  detailBackBtn: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  detailHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  detailScroll: { flex: 1 },
  imageGallery: { height: 300 },
  galleryImage: { width: width, height: 300 },
  imageCount: { textAlign: 'center', fontSize: 12, color: COLORS.textLight, paddingVertical: 6 },
  detailContent: { padding: 20 },
  detailCategoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  detailCategoryText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  detailTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  detailPrice: { fontSize: 28, fontWeight: '800', color: COLORS.primary, marginBottom: 12 },
  soldBanner: {
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  soldBannerText: { color: '#DC2626', fontWeight: '600', fontSize: 14 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  detailDesc: { fontSize: 15, color: COLORS.text, lineHeight: 24 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  sellerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sellerAvatarText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  sellerName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  sellerSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  detailDate: { fontSize: 12, color: COLORS.textLight, marginTop: 16 },
  // CTA
  detailCTA: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 30,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  whatsappCTAButton: {
    flex: 1,
    backgroundColor: '#25D366',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  whatsappCTAText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  callCTAButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callCTAText: { fontSize: 22 },
  // Market header
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: COLORS.primary,
  },
  marketHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
  },
  myListingsBtn: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  // Owner actions
  ownerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  markSoldBtn: {
    flex: 1,
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  markSoldText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  deleteListingBtn: {
    flex: 1,
    backgroundColor: '#F44336',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteListingText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
