import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  Alert, ActivityIndicator, Modal, TextInput, ScrollView, Linking,
} from 'react-native';
import { COLORS } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { bloodAPI } from '../services/api';

const BLOOD_GROUPS = [
  { key: 'A_POSITIVE', label: 'A+', color: '#EF4444' },
  { key: 'A_NEGATIVE', label: 'A-', color: '#DC2626' },
  { key: 'B_POSITIVE', label: 'B+', color: '#F97316' },
  { key: 'B_NEGATIVE', label: 'B-', color: '#EA580C' },
  { key: 'AB_POSITIVE', label: 'AB+', color: '#8B5CF6' },
  { key: 'AB_NEGATIVE', label: 'AB-', color: '#7C3AED' },
  { key: 'O_POSITIVE', label: 'O+', color: '#10B981' },
  { key: 'O_NEGATIVE', label: 'O-', color: '#059669' },
];

const FINDER_MODES = [
  { key: 'all', emoji: '🔍', label: 'All', color: '#3B82F6' },
  { key: 'emergency', emoji: '🚨', label: 'SOS', color: '#DC2626' },
  { key: 'normal', emoji: '📋', label: 'Normal', color: '#10B981' },
];

export default function BloodDonationScreen({ navigation }) {
  const { user } = useAuth();
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [finderMode, setFinderMode] = useState('all');
  const [myDonation, setMyDonation] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  // Register form state
  const [regName, setRegName] = useState(user?.name || '');
  const [regPhone, setRegPhone] = useState(user?.phone || '');
  const [regWhatsapp, setRegWhatsapp] = useState(user?.whatsapp || '');
  const [regBloodGroup, setRegBloodGroup] = useState(null);
  const [regAddress, setRegAddress] = useState('');
  const [regEmergency, setRegEmergency] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    loadDonors();
    loadMyDonation();
  }, [selectedGroup, finderMode]);

  const loadDonors = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedGroup) params.bloodGroup = selectedGroup;
      if (finderMode === 'emergency') params.emergency = 'true';
      const response = await bloodAPI.getDonors(params);
      setDonors(response.data.donors || []);
    } catch (error) {
      console.error('Blood donors error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMyDonation = async () => {
    try {
      const response = await bloodAPI.getMyDonation();
      setMyDonation(response.data.donor);
    } catch (error) {
      console.error('My donation error:', error);
    }
  };

  const registerDonor = async () => {
    if (!regName.trim() || !regPhone.trim() || !regBloodGroup) {
      Alert.alert('Required', 'Please fill name, phone and blood group.');
      return;
    }
    setRegistering(true);
    try {
      await bloodAPI.register({
        name: regName.trim(),
        phone: regPhone.trim(),
        whatsapp: regWhatsapp.trim() || null,
        bloodGroup: regBloodGroup,
        address: regAddress.trim() || null,
        isEmergency: regEmergency,
      });
      setShowRegister(false);
      loadDonors();
      loadMyDonation();
      Alert.alert('✅ Registered!', 'You are now registered as a blood donor. Thank you!');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to register.');
    } finally {
      setRegistering(false);
    }
  };

  const toggleAvailability = async () => {
    if (!myDonation) return;
    try {
      await bloodAPI.update({ isAvailable: !myDonation.isAvailable });
      loadMyDonation();
      Alert.alert('Updated', myDonation.isAvailable ? 'You are now unavailable.' : 'You are now available!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update status.');
    }
  };

  const unregister = async () => {
    Alert.alert('Unregister', 'Remove yourself from the blood donor list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unregister', style: 'destructive',
        onPress: async () => {
          try {
            await bloodAPI.unregister();
            setMyDonation(null);
            loadDonors();
            Alert.alert('Done', 'You have been removed from the donor list.');
          } catch (error) {
            Alert.alert('Error', 'Failed to unregister.');
          }
        },
      },
    ]);
  };

  const callDonor = (phone) => {
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Error', 'Cannot make call.'));
  };

  const whatsappDonor = (whatsapp, name) => {
    const msg = encodeURIComponent(`Assalam-o-Alaikum ${name}, I need blood donation help. Are you available?`);
    const url = `whatsapp://send?phone=${whatsapp.replace('+', '')}&text=${msg}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'WhatsApp not installed.'));
  };

  const getGroupInfo = (key) => BLOOD_GROUPS.find(g => g.key === key) || { label: key, color: '#999' };

  const renderDonor = ({ item }) => {
    const groupInfo = getGroupInfo(item.bloodGroup);
    return (
      <View style={[styles.donorCard, item.isEmergency && styles.emergencyCard]}>
        <View style={styles.donorHeader}>
          <View style={[styles.bloodBadge, { backgroundColor: groupInfo.color }]}>
            <Text style={styles.bloodBadgeText}>{groupInfo.label}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.donorName}>{item.name}</Text>
              {item.isEmergency && (
                <View style={styles.emergencyTag}>
                  <Text style={styles.emergencyTagText}>🚨 Emergency</Text>
                </View>
              )}
            </View>
            {item.address && <Text style={styles.donorAddress}>📍 {item.address}</Text>}
            {item.lastDonated && (
              <Text style={styles.donorLastDonated}>
                Last donated: {new Date(item.lastDonated).toLocaleDateString('en-PK')}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.donorActions}>
          <TouchableOpacity style={styles.callBtn} onPress={() => callDonor(item.phone)}>
            <Text style={styles.callBtnText}>📞 Call</Text>
          </TouchableOpacity>
          {item.whatsapp && (
            <TouchableOpacity style={styles.whatsappBtn} onPress={() => whatsappDonor(item.whatsapp, item.name)}>
              <Text style={styles.whatsappBtnText}>💬 WhatsApp</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🩸 Blood Donation</Text>
        <TouchableOpacity onPress={() => setShowRegister(true)}>
          <Text style={styles.addBtn}>+ Donate</Text>
        </TouchableOpacity>
      </View>

      {/* My Donor Status */}
      {myDonation && (
        <View style={styles.myStatus}>
          <View style={{ flex: 1 }}>
            <Text style={styles.myStatusTitle}>Your Donor Status</Text>
            <Text style={styles.myStatusLabel}>
              {getGroupInfo(myDonation.bloodGroup).label} • {myDonation.isAvailable ? '🟢 Available' : '🔴 Unavailable'}
              {myDonation.isEmergency ? ' • 🚨 Emergency' : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.toggleAvailBtn} onPress={toggleAvailability}>
            <Text style={styles.toggleAvailText}>{myDonation.isAvailable ? 'Go Offline' : 'Go Online'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.unregBtn} onPress={unregister}>
            <Text style={styles.unregText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Finder Mode Selector - Circles */}
      <View style={styles.finderRow}>
        {FINDER_MODES.map((mode) => (
          <TouchableOpacity
            key={mode.key}
            style={styles.finderCircleWrap}
            onPress={() => setFinderMode(mode.key)}
          >
            <View style={[styles.finderCircle, finderMode === mode.key && { backgroundColor: mode.color, borderColor: mode.color }]}>
              <Text style={styles.finderCircleEmoji}>{mode.emoji}</Text>
            </View>
            <Text style={[styles.finderCircleLabel, finderMode === mode.key && { color: mode.color, fontWeight: '700' }]}>{mode.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Blood Group Filter - Circles */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupFilter}>
        {[{ key: null, label: '🩸', color: '#6B7280' }, ...BLOOD_GROUPS].map((item) => (
          <TouchableOpacity
            key={item.key || 'all'}
            style={styles.groupCircleWrap}
            onPress={() => setSelectedGroup(item.key)}
          >
            <View style={[
              styles.groupCircle,
              { borderColor: item.color },
              selectedGroup === item.key && { backgroundColor: item.color },
            ]}>
              <Text style={[styles.groupCircleText, selectedGroup === item.key && { color: '#fff' }]}>
                {item.key ? item.label : '🩸'}
              </Text>
            </View>
            <Text style={[styles.groupCircleLabel, selectedGroup === item.key && { color: item.color, fontWeight: '700' }]}>
              {item.key ? item.label : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Emergency Banner */}
      {finderMode === 'emergency' && (
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyBannerText}>🚨 Showing emergency-ready donors only</Text>
        </View>
      )}

      {/* Donors List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#DC2626" />
        </View>
      ) : (
        <FlatList
          data={donors}
          keyExtractor={(item) => item.id}
          renderItem={renderDonor}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDonors(); }} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🩸</Text>
              <Text style={styles.emptyTitle}>No Donors Found</Text>
              <Text style={styles.emptySubtext}>
                {finderMode === 'emergency'
                  ? 'No emergency donors available for this blood group.'
                  : 'Be the first to register as a blood donor!'}
              </Text>
              <TouchableOpacity style={styles.registerBtn} onPress={() => setShowRegister(true)}>
                <Text style={styles.registerBtnText}>Register as Donor</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Register Modal */}
      <Modal visible={showRegister} animationType="slide" transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowRegister(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Register as Donor</Text>
            <View style={{ width: 30 }} />
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.heroSection}>
              <Text style={styles.heroEmoji}>🩸</Text>
              <Text style={styles.heroTitle}>Save a Life Today</Text>
              <Text style={styles.heroSubtext}>Register to help someone in need of blood</Text>
            </View>

            <TextInput style={styles.input} placeholder="Your Name *" value={regName}
              onChangeText={setRegName} placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} placeholder="Phone Number *" value={regPhone}
              onChangeText={setRegPhone} keyboardType="phone-pad" placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} placeholder="WhatsApp Number"
              value={regWhatsapp} onChangeText={setRegWhatsapp} keyboardType="phone-pad"
              placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} placeholder="Address / Area in Shahkot"
              value={regAddress} onChangeText={setRegAddress} placeholderTextColor={COLORS.textLight} />

            <Text style={styles.fieldLabel}>Blood Group *</Text>
            <View style={styles.bloodGroupGrid}>
              {BLOOD_GROUPS.map((group) => (
                <TouchableOpacity
                  key={group.key}
                  style={[
                    styles.bloodGroupBtn,
                    regBloodGroup === group.key && { backgroundColor: group.color, borderColor: group.color },
                  ]}
                  onPress={() => setRegBloodGroup(group.key)}
                >
                  <Text style={[
                    styles.bloodGroupBtnText,
                    regBloodGroup === group.key && { color: '#fff' },
                  ]}>
                    {group.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Availability Type</Text>
            <View style={styles.availTypeRow}>
              <TouchableOpacity
                style={[styles.availTypeBtn, !regEmergency && styles.availTypeBtnActive]}
                onPress={() => setRegEmergency(false)}
              >
                <Text style={[styles.availTypeText, !regEmergency && styles.availTypeTextActive]}>
                  📋 Normal Donor
                </Text>
                <Text style={[styles.availTypeDesc, !regEmergency && { color: 'rgba(255,255,255,0.8)' }]}>
                  Available for scheduled requests
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.availTypeBtn, regEmergency && styles.availTypeBtnEmergency]}
                onPress={() => setRegEmergency(true)}
              >
                <Text style={[styles.availTypeText, regEmergency && styles.availTypeTextActive]}>
                  🚨 Emergency Donor
                </Text>
                <Text style={[styles.availTypeDesc, regEmergency && { color: 'rgba(255,255,255,0.8)' }]}>
                  Available 24/7 for emergencies
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, registering && { opacity: 0.6 }]}
              onPress={registerDonor}
              disabled={registering}
            >
              {registering ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>🩸 Register as Donor</Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backBtn: { color: '#fff', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  addBtn: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // My Status
  myStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    marginHorizontal: 12,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  myStatusTitle: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  myStatusLabel: { fontSize: 14, color: COLORS.text, fontWeight: '700', marginTop: 2 },
  toggleAvailBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
  },
  toggleAvailText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  unregBtn: { padding: 6 },
  unregText: { fontSize: 16, color: '#EF4444', fontWeight: '700' },
  // Finder Mode - Circular
  finderRow: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 24 },
  finderCircleWrap: { alignItems: 'center' },
  finderCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  finderCircleEmoji: { fontSize: 22 },
  finderCircleLabel: { fontSize: 11, fontWeight: '500', color: COLORS.textSecondary, marginTop: 4 },
  // Blood Group Filter - Circular
  groupFilter: { paddingHorizontal: 8, paddingBottom: 10, gap: 10 },
  groupCircleWrap: { alignItems: 'center', marginHorizontal: 4 },
  groupCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  groupCircleText: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  groupCircleLabel: { fontSize: 10, fontWeight: '500', color: COLORS.textSecondary, marginTop: 3 },
  // Emergency Banner - Compact
  emergencyBanner: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  emergencyBannerText: { color: '#991B1B', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  // Donor Card - Compact 2-column grid style
  donorCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  emergencyCard: {
    borderWidth: 1.5,
    borderColor: '#DC2626',
    backgroundColor: '#FFF8F8',
  },
  donorHeader: { flexDirection: 'row', alignItems: 'center' },
  bloodBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bloodBadgeText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  donorName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  donorAddress: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  donorLastDonated: { fontSize: 10, color: COLORS.textLight, marginTop: 1 },
  emergencyTag: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  emergencyTagText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  donorActions: { flexDirection: 'row', marginTop: 8, gap: 6 },
  callBtn: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  callBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  whatsappBtn: {
    flex: 1,
    backgroundColor: '#25D366',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  whatsappBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  // Empty
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  emptySubtext: { fontSize: 14, color: COLORS.textLight, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
  registerBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  registerBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#DC2626',
  },
  modalClose: { fontSize: 24, color: '#fff', padding: 4 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  modalBody: { padding: 20 },
  heroSection: { alignItems: 'center', marginBottom: 20 },
  heroEmoji: { fontSize: 56 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  heroSubtext: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
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
  bloodGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  bloodGroupBtn: {
    width: '22%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  bloodGroupBtnText: { fontWeight: '700', fontSize: 16, color: COLORS.text },
  availTypeRow: { gap: 10, marginBottom: 16 },
  availTypeBtn: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  availTypeBtnActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  availTypeBtnEmergency: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  availTypeText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  availTypeTextActive: { color: '#fff' },
  availTypeDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  submitBtn: {
    backgroundColor: '#DC2626',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
