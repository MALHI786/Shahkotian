import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Linking, RefreshControl, Modal, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, DOCTOR_SPECIALTIES } from '../config/constants';
import { doctorsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DoctorsScreen({ navigation }) {
  const { isAdmin } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for admin
  const [form, setForm] = useState({
    name: '',
    specialty: 'GENERAL_PHYSICIAN',
    clinicName: '',
    address: '',
    phone: '',
    whatsapp: '',
    timings: '',
    fee: '',
    education: '',
    experience: '',
    isVerified: false,
  });

  useEffect(() => {
    loadDoctors();
  }, [selectedSpecialty]);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (selectedSpecialty) params.specialty = selectedSpecialty;
      
      const response = await doctorsAPI.getAll(params);
      setDoctors(response.data.doctors || []);
    } catch (error) {
      console.error('Load doctors error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const callDoctor = (phone) => {
    Linking.openURL(`tel:${phone}`);
  };

  const whatsappDoctor = (number, name) => {
    const cleaned = number.replace(/[^0-9]/g, '');
    const msg = `Hi Dr. ${name}, I found your contact on Shahkot App. I would like to book an appointment.`;
    Linking.openURL(`https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`).catch(() => {
      Linking.openURL(`tel:${number}`);
    });
  };

  const getSpecialtyInfo = (key) => {
    return DOCTOR_SPECIALTIES.find(s => s.key === key) || { icon: '👨‍⚕️', label: key };
  };

  const resetForm = () => {
    setForm({
      name: '',
      specialty: 'GENERAL_PHYSICIAN',
      clinicName: '',
      address: '',
      phone: '',
      whatsapp: '',
      timings: '',
      fee: '',
      education: '',
      experience: '',
      isVerified: false,
    });
  };

  const saveDoctor = async () => {
    if (!form.name.trim() || !form.address.trim() || !form.phone.trim()) {
      Alert.alert('Required', 'Name, Address, and Phone are required');
      return;
    }
    try {
      setSaving(true);
      await doctorsAPI.create(form);
      Alert.alert('Success', 'Doctor added successfully!');
      setShowAddModal(false);
      resetForm();
      loadDoctors();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to add doctor');
    } finally {
      setSaving(false);
    }
  };

  const deleteDoctor = (id) => {
    Alert.alert('Delete Doctor', 'Are you sure you want to delete this record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await doctorsAPI.delete(id);
            setSelectedDoctor(null);
            loadDoctors();
            Alert.alert('Deleted', 'Doctor record removed.');
          } catch (error) {
            Alert.alert('Error', 'Failed to delete doctor');
          }
        },
      },
    ]);
  };

  const renderDoctor = ({ item }) => {
    const specialtyInfo = getSpecialtyInfo(item.specialty);
    return (
      <TouchableOpacity
        style={styles.doctorCard}
        activeOpacity={0.8}
        onPress={() => setSelectedDoctor(item)}
      >
        <View style={styles.doctorHeader}>
          <View style={styles.doctorIcon}>
            <Text style={styles.iconText}>{specialtyInfo.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.doctorName}>Dr. {item.name}</Text>
              {item.isVerified && <Text style={styles.verifiedBadge}>✓</Text>}
            </View>
            <Text style={styles.specialtyText}>{specialtyInfo.label}</Text>
            {item.clinicName && (
              <Text style={styles.clinicText}>🏥 {item.clinicName}</Text>
            )}
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.addressText}>📍 {item.address}</Text>
        </View>

        {item.timings && (
          <Text style={styles.timingsText}>🕐 {item.timings}</Text>
        )}

        {item.fee && (
          <Text style={styles.feeText}>💰 Fee: Rs. {item.fee}</Text>
        )}

        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.callButton} onPress={() => callDoctor(item.phone)}>
            <Text style={styles.callText}>📞 Call</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.whatsappButton}
            onPress={() => whatsappDoctor(item.whatsapp || item.phone, item.name)}
          >
            <Text style={styles.whatsappText}>💬 WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailModal = () => {
    if (!selectedDoctor) return null;
    const item = selectedDoctor;
    const specialtyInfo = getSpecialtyInfo(item.specialty);

    return (
      <Modal visible={true} animationType="slide" onRequestClose={() => setSelectedDoctor(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedDoctor(null)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chevron-back" size={22} color={COLORS.white} />
              <Text style={styles.backBtn}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Doctor Details</Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.detailScroll}>
            <View style={styles.detailContent}>
              <View style={styles.detailIconContainer}>
                <Text style={styles.detailIcon}>{specialtyInfo.icon}</Text>
              </View>

              <View style={styles.nameRow}>
                <Text style={styles.detailName}>Dr. {item.name}</Text>
                {item.isVerified && (
                  <View style={styles.verifiedTag}>
                    <Text style={styles.verifiedTagText}>✓ Verified</Text>
                  </View>
                )}
              </View>

              <Text style={styles.detailSpecialty}>{specialtyInfo.label}</Text>

              {item.education && (
                <Text style={styles.detailEducation}>🎓 {item.education}</Text>
              )}

              {item.experience && (
                <Text style={styles.detailExperience}>📅 {item.experience} experience</Text>
              )}

              <View style={styles.divider} />

              {item.clinicName && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Clinic</Text>
                  <Text style={styles.detailValue}>{item.clinicName}</Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address</Text>
                <Text style={styles.detailValue}>{item.address}</Text>
              </View>

              {item.timings && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Timings</Text>
                  <Text style={styles.detailValue}>{item.timings}</Text>
                </View>
              )}

              {item.fee && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Consultation Fee</Text>
                  <Text style={[styles.detailValue, { color: COLORS.primary, fontWeight: '700' }]}>
                    Rs. {item.fee}
                  </Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{item.phone}</Text>
              </View>

              {isAdmin && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteDoctor(item.id)}
                >
                  <Text style={styles.deleteBtnText}>🗑️ Delete Record</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          <View style={styles.detailCTA}>
            <TouchableOpacity
              style={styles.callCTAButton}
              onPress={() => callDoctor(item.phone)}
            >
              <Text style={styles.callCTAText}>📞 Call Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.whatsappCTAButton}
              onPress={() => whatsappDoctor(item.whatsapp || item.phone, item.name)}
            >
              <Text style={styles.whatsappCTAText}>💬 WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderAddModal = () => (
    <Modal visible={showAddModal} animationType="slide" onRequestClose={() => setShowAddModal(false)}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowAddModal(false)}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Doctor</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Doctor Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter name"
            value={form.name}
            onChangeText={(v) => setForm({ ...form, name: v })}
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.fieldLabel}>Specialty *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {DOCTOR_SPECIALTIES.map((spec) => (
              <TouchableOpacity
                key={spec.key}
                style={[styles.specialtyChip, form.specialty === spec.key && styles.specialtyChipActive]}
                onPress={() => setForm({ ...form, specialty: spec.key })}
              >
                <Text style={styles.specialtyChipIcon}>{spec.icon}</Text>
                <Text style={[styles.specialtyChipText, form.specialty === spec.key && styles.specialtyChipTextActive]}>
                  {spec.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Clinic Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Clinic/Hospital name"
            value={form.clinicName}
            onChangeText={(v) => setForm({ ...form, clinicName: v })}
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.fieldLabel}>Address *</Text>
          <TextInput
            style={styles.input}
            placeholder="Full address"
            value={form.address}
            onChangeText={(v) => setForm({ ...form, address: v })}
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.fieldLabel}>Phone *</Text>
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            value={form.phone}
            onChangeText={(v) => setForm({ ...form, phone: v })}
            keyboardType="phone-pad"
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.fieldLabel}>WhatsApp</Text>
          <TextInput
            style={styles.input}
            placeholder="WhatsApp number (if different)"
            value={form.whatsapp}
            onChangeText={(v) => setForm({ ...form, whatsapp: v })}
            keyboardType="phone-pad"
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.fieldLabel}>Timings</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Mon-Sat: 5PM-9PM"
            value={form.timings}
            onChangeText={(v) => setForm({ ...form, timings: v })}
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.fieldLabel}>Consultation Fee (Rs.)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 500"
            value={form.fee}
            onChangeText={(v) => setForm({ ...form, fee: v })}
            keyboardType="numeric"
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.fieldLabel}>Education/Qualifications</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., MBBS, FCPS"
            value={form.education}
            onChangeText={(v) => setForm({ ...form, education: v })}
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.fieldLabel}>Experience</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 15 years"
            value={form.experience}
            onChangeText={(v) => setForm({ ...form, experience: v })}
            placeholderTextColor={COLORS.textLight}
          />

          <TouchableOpacity
            style={[styles.verifyToggle, form.isVerified && styles.verifyToggleActive]}
            onPress={() => setForm({ ...form, isVerified: !form.isVerified })}
          >
            <Text style={styles.verifyToggleText}>
              {form.isVerified ? '✓ Marked as Verified' : 'Mark as Verified'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, saving && { opacity: 0.6 }]}
            onPress={saveDoctor}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.submitText}>Add Doctor</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
          <Text style={styles.headerBackBtn}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Doctors & Clinics</Text>
        {isAdmin ? (
          <TouchableOpacity onPress={() => setShowAddModal(true)}>
            <Text style={styles.addBtn}>+ Add</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search doctors, clinics..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={loadDoctors}
          returnKeyType="search"
          placeholderTextColor={COLORS.textLight}
        />
        <TouchableOpacity style={styles.searchButton} onPress={loadDoctors}>
          <Ionicons name="search" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Specialty Filter */}
      <FlatList
        horizontal
        data={[{ key: null, label: 'All', icon: '🏥' }, ...DOCTOR_SPECIALTIES]}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key || 'all'}
        contentContainerStyle={styles.specialtyList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, selectedSpecialty === item.key && styles.filterChipActive]}
            onPress={() => setSelectedSpecialty(item.key)}
          >
            <Text style={styles.filterIcon}>{item.icon}</Text>
            <Text style={[styles.filterLabel, selectedSpecialty === item.key && styles.filterLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Doctors List */}
      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={doctors}
          renderItem={renderDoctor}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDoctors(); }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🏥</Text>
              <Text style={styles.emptyText}>No doctors found</Text>
              <Text style={styles.emptySubtext}>
                {isAdmin ? 'Add doctors using the + button' : 'Check back later'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        />
      )}

      {/* Detail Modal */}
      {renderDetailModal()}

      {/* Add Modal */}
      {renderAddModal()}
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
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    backgroundColor: COLORS.primary,
  },
  headerBackBtn: { color: COLORS.white, fontSize: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
  addBtn: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
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
  specialtyList: { paddingHorizontal: 12, marginBottom: 8, paddingRight: 20 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexShrink: 0,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterIcon: { marginRight: 4, fontSize: 14 },
  filterLabel: { fontSize: 12, color: COLORS.text },
  filterLabelActive: { color: COLORS.white },
  // Doctor Card
  doctorCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  doctorHeader: { flexDirection: 'row', marginBottom: 10 },
  doctorIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: { fontSize: 24 },
  doctorName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  verifiedBadge: {
    marginLeft: 6,
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  specialtyText: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  clinicText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  infoRow: { marginBottom: 6 },
  addressText: { fontSize: 13, color: COLORS.textSecondary },
  timingsText: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  feeText: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginBottom: 10 },
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  callButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  callText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  whatsappButton: {
    flex: 1,
    backgroundColor: '#25D366',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  whatsappText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 18, color: COLORS.textSecondary, fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
  },
  backBtn: { color: COLORS.white, fontSize: 16 },
  closeBtn: { color: COLORS.white, fontSize: 22 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  detailScroll: { flex: 1 },
  detailContent: { padding: 20 },
  detailIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  detailIcon: { fontSize: 40 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  detailName: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  verifiedTag: {
    marginLeft: 10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedTagText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  detailSpecialty: { fontSize: 16, color: COLORS.primary, fontWeight: '600', textAlign: 'center', marginBottom: 6 },
  detailEducation: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 4 },
  detailExperience: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 16 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  detailRow: { marginBottom: 14 },
  detailLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  detailValue: { fontSize: 15, color: COLORS.text },
  deleteBtn: {
    marginTop: 20,
    backgroundColor: '#FFEBEE',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#F44336', fontWeight: '700' },
  detailCTA: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 30,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  callCTAButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  callCTAText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  whatsappCTAButton: {
    flex: 1,
    backgroundColor: '#25D366',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  whatsappCTAText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  // Form
  formScroll: { padding: 20, flex: 1 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
  },
  specialtyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  specialtyChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  specialtyChipIcon: { marginRight: 4 },
  specialtyChipText: { fontSize: 12, color: COLORS.text },
  specialtyChipTextActive: { color: COLORS.white },
  verifyToggle: {
    backgroundColor: COLORS.gray,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  verifyToggleActive: { backgroundColor: COLORS.primary + '20', borderColor: COLORS.primary },
  verifyToggleText: { fontWeight: '600', color: COLORS.primary },
  submitButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  submitText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
});
