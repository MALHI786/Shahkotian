import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, ActivityIndicator, ScrollView, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export default function ProfileScreen({ navigation }) {
  const { user, logout, isAdmin, updateUser } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const pickProfilePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      uploadPhoto(result.assets[0]);
    }
  };

  const takeProfilePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Camera permission is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      uploadPhoto(result.assets[0]);
    }
  };

  const uploadPhoto = async (asset) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', {
        uri: asset.uri,
        type: 'image/jpeg',
        name: 'profile_photo.jpg',
      });
      const response = await authAPI.uploadPhoto(formData);
      if (response.data.user && updateUser) {
        updateUser(response.data.user);
      }
      Alert.alert('Success', 'Profile photo updated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to upload photo. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert('Profile Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: takeProfilePhoto },
      { text: 'Choose from Gallery', onPress: pickProfilePhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.avatarContainer} onPress={showPhotoOptions} disabled={uploading}>
          {user?.photoUrl ? (
            <Image source={{ uri: user.photoUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.[0] || '?'}</Text>
            </View>
          )}
          <View style={styles.cameraOverlay}>
            {uploading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.cameraIcon}>📷</Text>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{user?.name}</Text>
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>⭐ ADMIN</Text>
            </View>
          )}
        </View>
        <Text style={styles.phone}>{user?.phone}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role?.replace('_', ' ')}</Text>
        </View>
      </View>

      {/* Info Cards */}
      <View style={styles.infoSection}>
        <InfoItem icon="📱" label="Phone" value={user?.phone} />
        <InfoItem icon="📧" label="Email" value={user?.email || 'Not set'} />
        <InfoItem icon="💬" label="WhatsApp" value={user?.whatsapp || user?.phone} />
      </View>

      {/* Quick Links */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Feed')}>
          <Text style={styles.actionIcon}>📝</Text>
          <Text style={styles.actionText}>My Posts</Text>
          <Text style={styles.actionArrow}>></Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Market')}>
          <Text style={styles.actionIcon}>🛒</Text>
          <Text style={styles.actionText}>My Listings</Text>
          <Text style={styles.actionArrow}>></Text>
        </TouchableOpacity>

        {isAdmin && (
          <TouchableOpacity style={[styles.actionButton, styles.adminAction]} onPress={() => navigation.navigate('AdminDashboard')}>
            <Text style={styles.actionIcon}>⚙️</Text>
            <Text style={[styles.actionText, { color: COLORS.primary }]}>Admin Dashboard</Text>
            <Text style={styles.actionArrow}>></Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionButton} onPress={showPhotoOptions}>
          <Text style={styles.actionIcon}>📸</Text>
          <Text style={styles.actionText}>Change Profile Photo</Text>
          <Text style={styles.actionArrow}>></Text>
        </TouchableOpacity>

        {/* Contact Admin */}
        <View style={styles.contactAdminCard}>
          <View style={styles.contactAdminHeader}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
            <Text style={styles.contactAdminTitle}>Contact Admin</Text>
          </View>
          <Text style={styles.contactAdminSub}>Need help? Reach out to the admin</Text>
          <View style={styles.contactAdminRow}>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: '#10B98112' }]} onPress={() => Linking.openURL('tel:03160623838')}>
              <Ionicons name="call" size={18} color="#10B981" />
              <Text style={[styles.contactBtnText, { color: '#10B981' }]}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: '#25D36612' }]} onPress={() => Linking.openURL('https://wa.me/923160623838')}>
              <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
              <Text style={[styles.contactBtnText, { color: '#25D366' }]}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: '#2563EB12' }]} onPress={() => Linking.openURL('mailto:salmanmalhig@gmail.com')}>
              <Ionicons name="mail" size={18} color="#2563EB" />
              <Text style={[styles.contactBtnText, { color: '#2563EB' }]}>Email</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.contactAdminInfo}>📱 03160623838  •  📧 salmanmalhig@gmail.com</Text>
        </View>

        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('PrivacyPolicy')}>
          <Text style={styles.actionIcon}>🔒</Text>
          <Text style={styles.actionText}>Privacy Policy</Text>
          <Text style={styles.actionArrow}>></Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.logoutButton]} onPress={handleLogout}>
          <Text style={styles.actionIcon}>🚪</Text>
          <Text style={[styles.actionText, { color: COLORS.error }]}>Logout</Text>
          <Text style={styles.actionArrow}>></Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingTop: 60,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { color: COLORS.white, fontSize: 36, fontWeight: 'bold' },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primaryDark,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  cameraIcon: { fontSize: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 24, fontWeight: 'bold', color: COLORS.white },
  adminBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  adminBadgeText: { fontSize: 11, fontWeight: '800', color: '#333' },
  phone: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 8,
  },
  roleText: { color: COLORS.white, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginTop: -15,
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    justifyContent: 'center',
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statValue: { fontSize: 20 },
  statLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  infoSection: {
    backgroundColor: COLORS.surface,
    margin: 20,
    borderRadius: 14,
    padding: 4,
    elevation: 2,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoIcon: { fontSize: 20, marginRight: 14 },
  infoLabel: { fontSize: 12, color: COLORS.textLight },
  infoValue: { fontSize: 15, color: COLORS.text, fontWeight: '600', marginTop: 2 },
  actions: { paddingHorizontal: 20 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
  },
  actionIcon: { fontSize: 20, marginRight: 12 },
  actionText: { fontSize: 16, fontWeight: '600', color: COLORS.text, flex: 1 },
  actionArrow: { fontSize: 18, color: COLORS.textLight },
  adminAction: { borderWidth: 1, borderColor: COLORS.primary + '30' },
  logoutButton: { borderWidth: 1, borderColor: COLORS.error + '30' },
  contactAdminCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  contactAdminHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  contactAdminTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  contactAdminSub: { fontSize: 12, color: COLORS.textLight, marginBottom: 12 },
  contactAdminRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  contactBtnText: { fontSize: 13, fontWeight: '700' },
  contactAdminInfo: { fontSize: 11, color: COLORS.textLight, textAlign: 'center' },
});
