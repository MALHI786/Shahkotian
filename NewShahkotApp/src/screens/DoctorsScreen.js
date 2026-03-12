import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Linking, RefreshControl, Modal, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  Image, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, DOCTOR_SPECIALTIES } from '../config/constants';

// Convert 24h time string ("17:00") to 12h format ("5:00 PM")
const formatTo12Hour = (time) => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};
import { doctorsAPI, appointmentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import AdBanner from '../components/AdBanner';
import ImageViewer from '../components/ImageViewer';

const { width } = Dimensions.get('window');

const STATUS_COLORS = {
  PENDING: '#F59E0B',
  APPROVED: '#3B82F6',
  PAYMENT_PENDING: '#8B5CF6',
  CONFIRMED: '#10B981',
  COMPLETED: '#6B7280',
  CANCELLED: '#EF4444',
  NO_SHOW: '#EF4444',
};
const STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved - Pay Now',
  PAYMENT_PENDING: 'Payment Sent',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
};

export default function DoctorsScreen({ navigation, route }) {
  const { isAdmin, user } = useAuth();
  const { t } = useLanguage();

  // Core state
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [activeTab, setActiveTab] = useState('doctors');

  // Modals
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(null); // appointment obj
  const [showDoctorLoginModal, setShowDoctorLoginModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Image viewer for payment proof
  const [viewerImages, setViewerImages] = useState([]);
  const [viewerVisible, setViewerVisible] = useState(false);

  // User appointments
  const [myAppointments, setMyAppointments] = useState([]);
  const [apptLoading, setApptLoading] = useState(false);
  // Live token polling: { [doctorId]: { currentToken, totalTokensToday } }
  const [liveTokens, setLiveTokens] = useState({});
  const liveTokenIntervalRef = useRef(null);

  // Doctor auth & dashboard
  const [doctorToken, setDoctorToken] = useState(null);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [doctorDashboard, setDoctorDashboard] = useState(null);
  const [doctorEmail, setDoctorEmail] = useState('');
  const [doctorPassword, setDoctorPassword] = useState('');
  const [doctorLoginLoading, setDoctorLoginLoading] = useState(false);

  // Admin form
  const [form, setForm] = useState({
    name: '', specialty: 'GENERAL_PHYSICIAN', clinicName: '', address: '',
    phone: '', whatsapp: '', timings: '', fee: '', education: '', experience: '',
    isVerified: false, email: '', password: '', onlineBooking: false,
    paymentMethod: '', paymentAccount: '', startTime: '', endTime: '', avgConsultTime: '15',
    weekdays: '', isAvailableNow: false,
  });

  // Doctor edit form
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    loadDoctors();
    const p = route?.params;
    if (p?.doctorToken && p?.doctorProfile) {
      setDoctorToken(p.doctorToken);
      setDoctorProfile(p.doctorProfile);
      setActiveTab('dashboard');
    }
  }, []);

  useEffect(() => {
    if (selectedSpecialty !== undefined) loadDoctors();
  }, [selectedSpecialty]);

  useEffect(() => {
    if (activeTab === 'bookings' && user) loadMyAppointments();
    if (activeTab === 'dashboard' && doctorToken) loadDoctorDashboard();
    // Start/stop live token polling based on active tab
    if (activeTab === 'bookings') {
      startLiveTokenPolling();
    } else {
      stopLiveTokenPolling();
    }
    return () => stopLiveTokenPolling();
  }, [activeTab]);

  const startLiveTokenPolling = () => {
    stopLiveTokenPolling();
    pollLiveTokens();
    liveTokenIntervalRef.current = setInterval(pollLiveTokens, 30000);
  };

  const stopLiveTokenPolling = () => {
    if (liveTokenIntervalRef.current) {
      clearInterval(liveTokenIntervalRef.current);
      liveTokenIntervalRef.current = null;
    }
  };

  const pollLiveTokens = async () => {
    const confirmedAppts = myAppointments.filter(a => a.status === 'CONFIRMED' && a.doctorId);
    if (!confirmedAppts.length) return;
    const uniqueDocIds = [...new Set(confirmedAppts.map(a => a.doctorId))];
    const updates = {};
    await Promise.all(uniqueDocIds.map(async (id) => {
      try {
        const res = await appointmentsAPI.getLiveToken(id);
        updates[id] = res.data;
      } catch (_) { /* ignore */ }
    }));
    if (Object.keys(updates).length) setLiveTokens(prev => ({ ...prev, ...updates }));
  };

  // Re-poll when appointment list updates
  useEffect(() => {
    if (activeTab === 'bookings') pollLiveTokens();
  }, [myAppointments]);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (selectedSpecialty) params.specialty = selectedSpecialty;
      const res = await doctorsAPI.getAll(params);
      setDoctors(res.data.doctors || []);
    } catch (e) { console.error('Load doctors:', e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const loadMyAppointments = async () => {
    try {
      setApptLoading(true);
      const res = await appointmentsAPI.getMine();
      setMyAppointments(res.data.appointments || []);
    } catch (e) { console.error('My appts:', e); }
    finally { setApptLoading(false); }
  };

  const loadDoctorDashboard = async () => {
    if (!doctorToken) return;
    try {
      const res = await doctorsAPI.doctorDashboard(doctorToken);
      setDoctorDashboard(res.data);
    } catch (e) { console.error('Dashboard:', e); }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (activeTab === 'doctors') loadDoctors();
    else if (activeTab === 'bookings') loadMyAppointments();
    else if (activeTab === 'dashboard') loadDoctorDashboard();
    else { setRefreshing(false); loadDoctors(); }
  }, [activeTab, doctorToken, searchQuery, selectedSpecialty]);

  // ── Actions ────────────────────────────────────────────────────────
  const callDoctor = (phone) => Linking.openURL(`tel:${phone}`);

  const getSpecialtyInfo = (key) =>
    DOCTOR_SPECIALTIES.find((s) => s.key === key) || { icon: '👨‍⚕️', label: key };

  const resetForm = () => setForm({
    name: '', specialty: 'GENERAL_PHYSICIAN', clinicName: '', address: '',
    phone: '', whatsapp: '', timings: '', fee: '', education: '', experience: '',
    isVerified: false, email: '', password: '', onlineBooking: false,
    paymentMethod: '', paymentAccount: '', startTime: '', endTime: '', avgConsultTime: '15',
    weekdays: '', isAvailableNow: false,
  });

  // ── Book Appointment ───────────────────────────────────────────────
  const handleBookAppointment = async () => {
    if (!selectedDoctor) return;
    setSaving(true);
    try {
      await appointmentsAPI.book({
        doctorId: selectedDoctor.id,
        appointmentDate: new Date().toISOString(),
      });
      Alert.alert('Done! 🎉', 'Appointment request sent. You will be notified when the doctor approves.');
      setShowBookingModal(false);
      setSelectedDoctor(null);
      if (activeTab === 'bookings') loadMyAppointments();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to book.');
    } finally { setSaving(false); }
  };

  // ── Upload Payment Proof ───────────────────────────────────────────
  const handleUploadPaymentProof = async () => {
    if (!showPaymentModal) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('image', { uri: result.assets[0].uri, type: 'image/jpeg', name: 'payment.jpg' });
      await appointmentsAPI.uploadPaymentProof(showPaymentModal.id, fd);
      Alert.alert('Done! ✅', 'Payment proof uploaded. Doctor will verify shortly.');
      setShowPaymentModal(null);
      loadMyAppointments();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to upload.');
    } finally { setSaving(false); }
  };

  const handleCancelAppointment = (id) => {
    Alert.alert('Cancel Appointment', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          try {
            await appointmentsAPI.cancel(id, 'Cancelled by user');
            loadMyAppointments();
          } catch { Alert.alert('Error', 'Failed to cancel.'); }
        },
      },
    ]);
  };

  // ── Doctor Login ───────────────────────────────────────────────────
  const handleDoctorLogin = async () => {
    if (!doctorEmail.trim() || !doctorPassword.trim()) {
      return Alert.alert('Required', 'Enter email and password.');
    }
    setDoctorLoginLoading(true);
    try {
      const res = await doctorsAPI.doctorLogin({ email: doctorEmail.trim(), password: doctorPassword.trim() });
      setDoctorToken(res.data.token);
      const profRes = await doctorsAPI.doctorProfile(res.data.token);
      setDoctorProfile(profRes.data);
      setShowDoctorLoginModal(false);
      setActiveTab('dashboard');
    } catch (e) {
      Alert.alert('Login Failed', e.response?.data?.error || 'Invalid credentials.');
    } finally { setDoctorLoginLoading(false); }
  };

  const handleDoctorLogout = () => {
    setDoctorToken(null); setDoctorProfile(null); setDoctorDashboard(null);
    setDoctorEmail(''); setDoctorPassword('');
    setActiveTab('doctors');
  };

  // ── Doctor Dashboard Actions ───────────────────────────────────────
  const handleApproveAppt = async (id) => {
    try {
      await appointmentsAPI.approve(doctorToken, id);
      Alert.alert('Done', 'Appointment approved. User notified.');
      loadDoctorDashboard();
    } catch (e) { Alert.alert('Error', e.response?.data?.error || 'Failed.'); }
  };

  const handleRejectAppt = (id) => {
    Alert.alert('Reject', 'Reject this appointment?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Reject', style: 'destructive',
        onPress: async () => {
          try {
            await appointmentsAPI.reject(doctorToken, id, 'Doctor unavailable');
            loadDoctorDashboard();
          } catch { Alert.alert('Error', 'Failed.'); }
        },
      },
    ]);
  };

  const handleVerifyPayment = async (id) => {
    try {
      await appointmentsAPI.verifyPayment(doctorToken, id);
      Alert.alert('Done! 🎫', 'Payment verified. Token assigned and user notified.');
      loadDoctorDashboard();
    } catch (e) { Alert.alert('Error', e.response?.data?.error || 'Failed.'); }
  };

  const handleCompleteAppt = async (id) => {
    try {
      await appointmentsAPI.complete(doctorToken, id);
      loadDoctorDashboard();
    } catch { Alert.alert('Error', 'Failed.'); }
  };

  const handleNoShow = async (id) => {
    try {
      await appointmentsAPI.noShow(doctorToken, id);
      loadDoctorDashboard();
    } catch { Alert.alert('Error', 'Failed.'); }
  };

  const handleUpdateCurrentToken = async (val) => {
    try {
      await doctorsAPI.doctorUpdateToken(doctorToken, val);
      loadDoctorDashboard();
    } catch { Alert.alert('Error', 'Failed.'); }
  };

  const handleToggleAvailability = async () => {
    if (!doctorToken || !doctorDashboard?.doctor) return;
    const current = doctorDashboard.doctor.isAvailableNow;
    try {
      await doctorsAPI.doctorUpdateProfile(doctorToken, { isAvailableNow: !current });
      loadDoctorDashboard();
    } catch {
      Alert.alert('Error', 'Failed to update availability.');
    }
  };

  // ── Doctor Edit Profile ────────────────────────────────────────────
  const openEditProfile = () => {
    if (!doctorProfile) return;
    setEditForm({
      clinicName: doctorProfile.clinicName || '',
      address: doctorProfile.address || '',
      phone: doctorProfile.phone || '',
      whatsapp: doctorProfile.whatsapp || '',
      timings: doctorProfile.timings || '',
      fee: doctorProfile.fee ? String(doctorProfile.fee) : '',
      education: doctorProfile.education || '',
      experience: doctorProfile.experience || '',
      onlineBooking: doctorProfile.onlineBooking || false,
      paymentMethod: doctorProfile.paymentMethod || '',
      paymentAccount: doctorProfile.paymentAccount || '',
      startTime: doctorProfile.startTime || '',
      endTime: doctorProfile.endTime || '',
      avgConsultTime: doctorProfile.avgConsultTime ? String(doctorProfile.avgConsultTime) : '15',
      weekdays: doctorProfile.weekdays || '',
      isAvailableNow: doctorProfile.isAvailableNow || false,
    });
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await doctorsAPI.doctorUpdateProfile(doctorToken, editForm);
      const res = await doctorsAPI.doctorProfile(doctorToken);
      setDoctorProfile(res.data);
      setShowEditProfileModal(false);
      Alert.alert('Done', 'Profile updated.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed.');
    } finally { setSaving(false); }
  };

  // ── Admin Save Doctor ──────────────────────────────────────────────
  const saveDoctor = async () => {
    if (!form.name.trim() || !form.address.trim() || !form.phone.trim()) {
      return Alert.alert('Required', 'Name, Address, and Phone are required');
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.fee) payload.fee = parseInt(payload.fee, 10);
      if (payload.avgConsultTime) payload.avgConsultTime = parseInt(payload.avgConsultTime, 10);
      await doctorsAPI.create(payload);
      const msg = form.email ? `Doctor added!\n\nLogin: ${form.email}\nPassword: ${form.password}\n\nShare these with the doctor.` : 'Doctor added!';
      Alert.alert('Done 🎉', msg);
      setShowAddModal(false);
      resetForm();
      loadDoctors();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally { setSaving(false); }
  };

  const deleteDoctor = (id) => {
    Alert.alert('Delete Doctor', 'Remove this doctor and all appointments?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await doctorsAPI.delete(id);
            setSelectedDoctor(null);
            loadDoctors();
          } catch { Alert.alert('Error', 'Failed to delete.'); }
        },
      },
    ]);
  };

  // ── Render: Doctor Card ────────────────────────────────────────────
  const renderDoctor = ({ item }) => {
    if (item.type === 'AD_ITEM') return <AdBanner />;
    const spec = getSpecialtyInfo(item.specialty);
    return (
      <TouchableOpacity style={styles.doctorCard} onPress={() => setSelectedDoctor(item)}>
        <View style={styles.doctorHeader}>
          <View style={styles.doctorIcon}><Text style={{ fontSize: 24 }}>{spec.icon}</Text></View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.doctorName}>Dr. {item.name}</Text>
              {item.isVerified && <Text style={styles.verifiedBadge}>✓</Text>}
            </View>
            <Text style={styles.specialtyText}>{spec.label}</Text>
            {item.clinicName && <Text style={styles.clinicText}>🏥 {item.clinicName}</Text>}
          </View>
          {item.onlineBooking && (
            <View style={styles.onlineBadge}>
              <Text style={styles.onlineBadgeText}>Online</Text>
            </View>
          )}
        </View>
        <Text style={styles.addressText}>📍 {item.address}</Text>
        {item.startTime && item.endTime && <Text style={styles.timingsText}>🕐 {formatTo12Hour(item.startTime)} - {formatTo12Hour(item.endTime)}</Text>}
        {item.weekdays && <Text style={styles.timingsText}>📅 {item.weekdays}</Text>}
        {item.fee != null && <Text style={styles.feeText}>💰 Rs. {item.fee}</Text>}
        {item.isAvailableNow
          ? <View style={styles.availableNow}><Text style={styles.availableNowText}>🟢 Available Now</Text></View>
          : <View style={styles.notAvailable}><Text style={styles.notAvailableText}>⭕ Not Available</Text></View>
        }
        {item.onlineBooking && item.currentToken > 0 && (
          <View style={styles.liveTokenSmall}>
            <Text style={styles.liveTokenSmallText}>{'🔴 Now serving: Token #'}{item.currentToken}</Text>
          </View>
        )}
        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.callButton} onPress={() => callDoctor(item.phone)}>
            <Text style={styles.callText}>📞 Call</Text>
          </TouchableOpacity>
          {item.onlineBooking && (
            <TouchableOpacity
              style={styles.bookButton}
              onPress={() => { setSelectedDoctor(item); setShowBookingModal(true); }}
            >
              <Text style={styles.bookText}>📋 Book</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Render: Appointment Card (user) ────────────────────────────────
  const renderAppointment = ({ item }) => {
    if (item.type === 'AD_ITEM') return <AdBanner />;
    const color = STATUS_COLORS[item.status] || '#6B7280';
    return (
      <View style={[styles.apptCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.apptDoctor}>Dr. {item.doctor?.name}</Text>
            <Text style={styles.apptSpecialty}>{getSpecialtyInfo(item.doctor?.specialty).label}</Text>
            <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[item.status]}</Text>
            </View>
          </View>
          {item.tokenNumber && (
            <View style={styles.tokenBig}>
              <Text style={styles.tokenLabel}>Token</Text>
              <Text style={styles.tokenNum}>#{item.tokenNumber}</Text>
              {item.estimatedTime && <Text style={styles.tokenEst}>{item.estimatedTime}</Text>}
            </View>
          )}
        </View>

        {item.status === 'CONFIRMED' && (liveTokens[item.doctorId]?.currentToken > 0 || item.doctor?.currentToken > 0) && (
          <View style={styles.liveToken}>
            <Text style={styles.liveTokenText}>
              🔴 Live: Token #{(liveTokens[item.doctorId]?.currentToken ?? item.doctor?.currentToken)} being served
              {liveTokens[item.doctorId]?.totalTokensToday
                ? ` / ${liveTokens[item.doctorId].totalTokensToday} today`
                : ''}
            </Text>
          </View>
        )}

        {item.fee != null && <Text style={styles.apptFee}>{'💰 Fee: Rs. '}{item.fee}</Text>}

        {item.status === 'APPROVED' && (
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentLabel}>
              Send Rs.{item.fee || 0} via {item.paymentMethod || item.doctor?.paymentMethod || 'N/A'}
            </Text>
            <Text style={styles.paymentAccount}>
              Account: {item.paymentAccount || item.doctor?.paymentAccount || 'N/A'}
            </Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={() => setShowPaymentModal(item)}>
              <Ionicons name="image-outline" size={16} color={COLORS.white} />
              <Text style={styles.uploadBtnText}>Select Screenshot</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'PAYMENT_PENDING' && item.paymentProof && (
          <Text style={{ fontSize: 12, color: '#8B5CF6', marginTop: 6 }}>
            ⏳ Payment proof sent. Waiting for doctor verification...
          </Text>
        )}

        {['PENDING', 'APPROVED', 'PAYMENT_PENDING'].includes(item.status) && (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelAppointment(item.id)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Render: Doctor Detail Modal ────────────────────────────────────
  const renderDetailModal = () => {
    if (!selectedDoctor) return null;
    const item = selectedDoctor;
    const spec = getSpecialtyInfo(item.specialty);
    return (
      <Modal visible animationType="slide" onRequestClose={() => setSelectedDoctor(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedDoctor(null)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chevron-back" size={22} color={COLORS.white} />
              <Text style={{ color: COLORS.white, fontSize: 16 }}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Doctor Details</Text>
            <View style={{ width: 50 }} />
          </View>
          <ScrollView style={{ flex: 1 }}>
            <View style={{ padding: 20, alignItems: 'center' }}>
              <View style={styles.detailIconBig}><Text style={{ fontSize: 40 }}>{spec.icon}</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                <Text style={styles.detailName}>Dr. {item.name}</Text>
                {item.isVerified && (
                  <View style={styles.verifiedTag}><Text style={styles.verifiedTagText}>Verified</Text></View>
                )}
              </View>
              <Text style={styles.detailSpec}>{spec.label}</Text>
              {item.education && <Text style={styles.detailSub}>🎓 {item.education}</Text>}
              {item.experience && <Text style={styles.detailSub}>📅 {item.experience} experience</Text>}
            </View>
            <View style={styles.divider} />
            <View style={{ padding: 20 }}>
              {item.clinicName && <DetailRow label="Clinic" value={item.clinicName} />}
              <DetailRow label="Address" value={item.address} />
              {item.startTime && item.endTime && <DetailRow label="Hours" value={`${formatTo12Hour(item.startTime)} - ${formatTo12Hour(item.endTime)}`} />}
              {item.weekdays && <DetailRow label="Available Days" value={item.weekdays} />}
              {item.fee != null && <DetailRow label="Fee" value={`Rs. ${item.fee}`} highlight />}
              <DetailRow label="Phone" value={item.phone} />
              {item.onlineBooking && (
                <View style={styles.onlineBookingInfo}>
                  <Text style={styles.onlineInfoTitle}>📋 Online Booking Available</Text>
                  {item.paymentMethod && <Text style={styles.onlineInfoText}>Payment: {item.paymentMethod}</Text>}
                </View>
              )}
              {isAdmin && (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteDoctor(item.id)}>
                  <Text style={styles.deleteBtnText}>🗑️ Delete Doctor</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
          <View style={styles.detailCTA}>
            <TouchableOpacity style={styles.callCTA} onPress={() => callDoctor(item.phone)}>
              <Text style={styles.callCTAText}>📞 Call</Text>
            </TouchableOpacity>
            {item.onlineBooking && (
              <TouchableOpacity style={styles.bookCTA} onPress={() => setShowBookingModal(true)}>
                <Text style={styles.bookCTAText}>📋 Book Appointment</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  // ── Render: Tabs ───────────────────────────────────────────────────
  const tabs = doctorToken
    ? [{ key: 'dashboard', label: '👨‍⚕️ Dashboard' }]
    : [
        { key: 'doctors', label: '🏥 Doctors' },
        ...(user ? [{ key: 'bookings', label: '📋 Bookings' }] : []),
        ...(isAdmin ? [{ key: 'admin', label: '⚙️ Admin' }] : []),
      ];

  // ── Render: Doctor Dashboard ───────────────────────────────────────
  const renderDashboard = () => {
    const d = doctorDashboard;
    if (!d) return <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />;
    const doc = d.doctor;
    const appts = d.todayAppointments || [];
    const stats = d.stats || {};

    return (
      <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDoctorDashboard().finally(() => setRefreshing(false)); }} />
      }>
        {/* Profile Summary */}
        <View style={styles.dashCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.dashTitle}>Dr. {doctorProfile?.name}</Text>
              <Text style={styles.dashSub}>📍 {doctorProfile?.address}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.editBtn} onPress={openEditProfile}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutBtn} onPress={handleDoctorLogout}>
                <Text style={styles.logoutBtnText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Current Token */}
        <View style={[styles.dashCard, { backgroundColor: COLORS.primary }]}>
          <Text style={{ color: COLORS.white, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
            🔴 Current Token Being Served
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <TouchableOpacity
              style={styles.tokenCtrl}
              onPress={() => handleUpdateCurrentToken(Math.max(0, (doc?.currentToken || 0) - 1))}
            >
              <Ionicons name="remove" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={{ color: COLORS.white, fontSize: 48, fontWeight: '800' }}>
              #{doc?.currentToken || 0}
            </Text>
            <TouchableOpacity
              style={styles.tokenCtrl}
              onPress={() => handleUpdateCurrentToken((doc?.currentToken || 0) + 1)}
            >
              <Ionicons name="add" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
            Total tokens today: {doc?.totalTokensToday || 0}
          </Text>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Confirmed', val: stats.CONFIRMED || 0, color: '#10B981' },
            { label: 'Completed', val: stats.COMPLETED || 0, color: '#6B7280' },
            { label: 'No Shows', val: stats.NO_SHOW || 0, color: '#EF4444' },
            { label: 'Pending', val: stats.PENDING || 0, color: '#F59E0B' },
          ].map((s) => (
            <View key={s.label} style={[styles.statBox, { borderTopColor: s.color }]}>
              <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Availability Toggle */}
        <TouchableOpacity
          style={[styles.availToggle, doc?.isAvailableNow ? styles.availToggleOn : styles.availToggleOff]}
          onPress={handleToggleAvailability}
          activeOpacity={0.8}
        >
          <Text style={styles.availToggleText}>
            {doc?.isAvailableNow ? '🟢 Available Now — Tap to go offline' : '⭕ Not Available — Tap to go online'}
          </Text>
          <Text style={{ color: doc?.isAvailableNow ? '#065F46' : COLORS.textLight, fontSize: 11, marginTop: 2, textAlign: 'center' }}>
            This status is visible to patients on the doctor list
          </Text>
        </TouchableOpacity>

        {/* Settings */}
        <View style={styles.dashCard}>
          <Text style={styles.dashCardTitle}>⚙️ Booking Settings</Text>
          <Text style={styles.settingRow}>
            Online Booking: <Text style={{ color: doc?.onlineBooking ? '#10B981' : '#EF4444', fontWeight: '700' }}>
              {doc?.onlineBooking ? 'ON' : 'OFF'}
            </Text>
          </Text>
          {doc?.paymentMethod && <Text style={styles.settingRow}>Payment: {doc.paymentMethod} — {doc.paymentAccount}</Text>}
          {doc?.startTime && <Text style={styles.settingRow}>Hours: {formatTo12Hour(doc.startTime)} - {formatTo12Hour(doc.endTime)}</Text>}
          {doc?.weekdays ? <Text style={styles.settingRow}>Days: {doc.weekdays}</Text> : null}
          <Text style={styles.settingRow}>Avg time per patient: {doc?.avgConsultTime || 15} min</Text>
        </View>

        {/* Today's Appointments */}
        <Text style={styles.sectionTitle}>Today's Appointments ({appts.length})</Text>
        {appts.length === 0 ? (
          <View style={styles.emptySmall}><Text style={styles.emptyText}>No appointments today</Text></View>
        ) : (
          appts.map((a) => {
            const color = STATUS_COLORS[a.status] || '#6B7280';
            return (
              <View key={a.id} style={[styles.dashApptCard, { borderLeftColor: color }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dashApptName}>{a.user?.name || 'Patient'}</Text>
                    <Text style={styles.dashApptPhone}>{a.user?.phone}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: color + '20', alignSelf: 'flex-start' }]}>
                      <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[a.status]}</Text>
                    </View>
                  </View>
                  {a.tokenNumber && (
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: COLORS.textLight }}>Token</Text>
                      <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.primary }}>#{a.tokenNumber}</Text>
                    </View>
                  )}
                </View>

                {a.paymentProof && (
                  <TouchableOpacity onPress={() => { setViewerImages([a.paymentProof]); setViewerVisible(true); }}>
                    <Image source={{ uri: a.paymentProof }} style={styles.proofThumb} />
                    <Text style={{ fontSize: 11, color: COLORS.primary, textAlign: 'center', marginTop: 2 }}>{'Tap to view full'}</Text>
                  </TouchableOpacity>
                )}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {a.status === 'PENDING' && (
                    <>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => handleApproveAppt(a.id)}>
                        <Text style={styles.actionBtnText}>✓ Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleRejectAppt(a.id)}>
                        <Text style={styles.actionBtnText}>✕ Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {a.status === 'PAYMENT_PENDING' && a.paymentProof && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => handleVerifyPayment(a.id)}>
                      <Text style={styles.actionBtnText}>💰 Payment Done</Text>
                    </TouchableOpacity>
                  )}
                  {a.status === 'CONFIRMED' && (
                    <>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]} onPress={() => handleCompleteAppt(a.id)}>
                        <Text style={styles.actionBtnText}>✓ Complete</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleNoShow(a.id)}>
                        <Text style={styles.actionBtnText}>No Show</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    );
  };

  // ── Render: Admin Tab ──────────────────────────────────────────────
  const renderAdmin = () => (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
        <Ionicons name="add-circle" size={22} color={COLORS.white} />
        <Text style={styles.addBtnText}>Add New Doctor</Text>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>All Doctors ({doctors.length})</Text>
      {doctors.map((d) => (
        <View key={d.id} style={styles.adminCard}>
          <Text style={styles.adminCardName}>Dr. {d.name}</Text>
          <Text style={styles.adminCardSub}>📍 {d.address}</Text>
          <Text style={styles.adminCardSub}>📞 {d.phone}</Text>
          <Text style={[styles.adminCardSub, { color: d.onlineBooking ? '#10B981' : COLORS.textLight }]}>
            Online Booking: {d.onlineBooking ? 'ON' : 'OFF'}
          </Text>
          <TouchableOpacity style={styles.adminDeleteBtn} onPress={() => deleteDoctor(d.id)}>
            <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>Delete</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );

  // ── MAIN RENDER ────────────────────────────────────────────────────
  if (loading && doctors.length === 0) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
          <Text style={{ color: COLORS.white, fontSize: 16 }}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Doctors & Appointments</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Doctors Tab */}
      {activeTab === 'doctors' && (
        <>
          {/* Search */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search doctors..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={loadDoctors}
              returnKeyType="search"
              placeholderTextColor={COLORS.textLight}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={loadDoctors}>
              <Ionicons name="search" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          {/* Specialty Filter */}
          <FlatList
            horizontal
            data={[{ key: null, label: 'All', icon: '🏥' }, ...DOCTOR_SPECIALTIES]}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.key || 'all'}
            contentContainerStyle={{ paddingHorizontal: 12, marginBottom: 6 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.filterChip, selectedSpecialty === item.key && styles.filterChipActive]}
                onPress={() => setSelectedSpecialty(item.key)}
              >
                <Text style={{ marginRight: 4 }}>{item.icon}</Text>
                <Text style={[styles.filterLabel, selectedSpecialty === item.key && { color: COLORS.white }]}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
          <FlatList
            data={(() => { const out = []; doctors.forEach((d, i) => { out.push(d); if ((i + 1) % 4 === 0) out.push({ id: `ad-doc-${i}`, type: 'AD_ITEM' }); }); return out; })()}
            renderItem={renderDoctor}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListHeaderComponent={<AdBanner />}
            ListEmptyComponent={
              <View style={styles.emptySmall}><Text style={{ fontSize: 48 }}>🏥</Text><Text style={styles.emptyText}>No doctors found</Text></View>
            }
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            ListFooterComponent={
              !doctorToken ? (
                <TouchableOpacity onPress={() => setShowDoctorLoginModal(true)} style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Text style={{ fontSize: 12, color: COLORS.textLight }}>Are you a doctor?</Text>
                  <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: '600' }}>Login to Dashboard →</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </>
      )}

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <FlatList
          data={(() => { const out = []; myAppointments.forEach((a, i) => { out.push(a); if ((i + 1) % 3 === 0) out.push({ id: `ad-appt-${i}`, type: 'AD_ITEM' }); }); return out; })()}
          renderItem={renderAppointment}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMyAppointments().finally(() => setRefreshing(false)); }} />}
          ListHeaderComponent={<AdBanner />}
          ListEmptyComponent={
            apptLoading ? <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} /> : (
              <View style={styles.emptySmall}>
                <Text style={{ fontSize: 48 }}>📋</Text>
                <Text style={styles.emptyText}>No appointments yet</Text>
                <Text style={styles.emptySub}>Book from the Doctors tab</Text>
              </View>
            )
          }
          contentContainerStyle={{ padding: 16 }}
        />
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && doctorToken && renderDashboard()}

      {/* Admin Tab */}
      {activeTab === 'admin' && isAdmin && renderAdmin()}

      {/* ── MODALS ──────────────────────────────────────────────────── */}

      {/* Detail Modal */}
      {selectedDoctor && !showBookingModal && renderDetailModal()}

      {/* Booking Confirmation Modal */}
      <Modal visible={showBookingModal} transparent animationType="fade" onRequestClose={() => setShowBookingModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.popup}>
            <Text style={styles.popupTitle}>Book Appointment</Text>
            <Text style={styles.popupText}>
              Dr. {selectedDoctor?.name}{'\n'}
              Fee: Rs. {selectedDoctor?.fee || 'N/A'}{'\n'}
              Payment: {selectedDoctor?.paymentMethod || 'Will be shared after approval'}
            </Text>
            <Text style={styles.popupSub}>
              After booking, the doctor will review and approve. You'll be notified to send payment.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.popupBtn, { backgroundColor: COLORS.border }]} onPress={() => setShowBookingModal(false)}>
                <Text style={{ color: COLORS.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.popupBtn, { backgroundColor: COLORS.primary, flex: 1 }]} onPress={handleBookAppointment} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={{ color: COLORS.white, fontWeight: '700' }}>Confirm Booking</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Proof Modal */}
      <Modal visible={!!showPaymentModal} transparent animationType="fade" onRequestClose={() => setShowPaymentModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.popup}>
            <Text style={styles.popupTitle}>Upload Payment Proof</Text>
            <Text style={styles.popupText}>
              Send Rs.{showPaymentModal?.fee || 0} via {showPaymentModal?.paymentMethod || showPaymentModal?.doctor?.paymentMethod || 'N/A'}{'\n'}
              Account: {showPaymentModal?.paymentAccount || showPaymentModal?.doctor?.paymentAccount || 'N/A'}
            </Text>
            <Text style={styles.popupSub}>Take a screenshot of your payment and upload below.</Text>
            <TouchableOpacity style={[styles.popupBtn, { backgroundColor: COLORS.primary, marginTop: 16 }]} onPress={handleUploadPaymentProof} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={{ color: COLORS.white, fontWeight: '700' }}>📷 Select & Upload Screenshot</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 10, alignItems: 'center' }} onPress={() => setShowPaymentModal(null)}>
              <Text style={{ color: COLORS.textLight }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Doctor Login Modal */}
      <Modal visible={showDoctorLoginModal} transparent animationType="slide" onRequestClose={() => setShowDoctorLoginModal(false)}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={styles.sheet}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={styles.sheetTitle}>🔑 Doctor Login</Text>
                <TouchableOpacity onPress={() => setShowDoctorLoginModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 }}>
                Login with credentials provided by admin to access your dashboard.
              </Text>
              <TextInput style={styles.input} placeholder="Email" value={doctorEmail} onChangeText={setDoctorEmail}
                keyboardType="email-address" autoCapitalize="none" placeholderTextColor={COLORS.textLight} />
              <TextInput style={styles.input} placeholder="Password" value={doctorPassword} onChangeText={setDoctorPassword}
                secureTextEntry placeholderTextColor={COLORS.textLight} />
              <TouchableOpacity style={[styles.submitBtn, doctorLoginLoading && { opacity: 0.5 }]} onPress={handleDoctorLogin} disabled={doctorLoginLoading}>
                {doctorLoginLoading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitBtnText}>Login</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Doctor Edit Profile Modal */}
      <Modal visible={showEditProfileModal} animationType="slide" onRequestClose={() => setShowEditProfileModal(false)}>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditProfileModal(false)}>
              <Text style={{ color: COLORS.white, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <View style={{ width: 30 }} />
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {[
              { key: 'clinicName', label: 'Clinic Name', ph: 'Clinic name' },
              { key: 'address', label: 'Address', ph: 'Full address' },
              { key: 'phone', label: 'Phone', ph: 'Phone', kb: 'phone-pad' },
              { key: 'whatsapp', label: 'WhatsApp', ph: 'WhatsApp', kb: 'phone-pad' },
              { key: 'timings', label: 'Timings', ph: 'e.g. Mon-Sat: 5PM-9PM' },
              { key: 'fee', label: 'Fee (PKR)', ph: 'e.g. 500', kb: 'numeric' },
              { key: 'education', label: 'Education', ph: 'e.g. MBBS, FCPS' },
              { key: 'experience', label: 'Experience', ph: 'e.g. 15 years' },
              { key: 'paymentMethod', label: 'Payment Method', ph: 'EasyPaisa / JazzCash' },
              { key: 'paymentAccount', label: 'Payment Account', ph: 'Account number' },
              { key: 'avgConsultTime', label: 'Avg. Time Per Patient (min)', ph: '15', kb: 'numeric' },
            ].map((f) => (
              <View key={f.key}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={f.ph}
                  value={editForm[f.key] || ''}
                  onChangeText={(v) => setEditForm({ ...editForm, [f.key]: v })}
                  keyboardType={f.kb || 'default'}
                  placeholderTextColor={COLORS.textLight}
                />
              </View>
            ))}
            <WeekdaySelector label="Available Days" value={editForm.weekdays || ''} onChange={(v) => setEditForm({ ...editForm, weekdays: v })} />
            <TimePicker12hr label="Start Time" value={editForm.startTime || ''} onChange={(v) => setEditForm({ ...editForm, startTime: v })} />
            <TimePicker12hr label="End Time" value={editForm.endTime || ''} onChange={(v) => setEditForm({ ...editForm, endTime: v })} />
            <TouchableOpacity
              style={[styles.toggleBtn, editForm.isAvailableNow && { backgroundColor: '#D1FAE5', borderColor: '#10B981' }]}
              onPress={() => setEditForm({ ...editForm, isAvailableNow: !editForm.isAvailableNow })}
            >
              <Text style={{ fontWeight: '600', color: editForm.isAvailableNow ? '#065F46' : COLORS.textLight }}>
                {editForm.isAvailableNow ? '🟢 Currently Seeing Patients (Available Now)' : '⭕ Not Available Now'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, editForm.onlineBooking && styles.toggleBtnActive]}
              onPress={() => setEditForm({ ...editForm, onlineBooking: !editForm.onlineBooking })}
            >
              <Text style={{ fontWeight: '600', color: editForm.onlineBooking ? COLORS.primary : COLORS.textLight }}>
                {editForm.onlineBooking ? '✅ Online Booking ON' : 'Enable Online Booking'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.5 }]} onPress={handleSaveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Admin Add Doctor Modal */}
      <Modal visible={showAddModal} animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
              <Text style={{ color: COLORS.white, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Doctor</Text>
            <View style={{ width: 30 }} />
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Doctor Name *</Text>
            <TextInput style={styles.input} placeholder="Full name" value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })} placeholderTextColor={COLORS.textLight} />

            <Text style={styles.fieldLabel}>Specialty</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {DOCTOR_SPECIALTIES.map((s) => (
                <TouchableOpacity key={s.key}
                  style={[styles.filterChip, form.specialty === s.key && styles.filterChipActive]}
                  onPress={() => setForm({ ...form, specialty: s.key })}>
                  <Text style={{ marginRight: 4 }}>{s.icon}</Text>
                  <Text style={[styles.filterLabel, form.specialty === s.key && { color: COLORS.white }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {[
              { key: 'clinicName', label: 'Clinic Name', ph: 'Optional' },
              { key: 'address', label: 'Address *', ph: 'Full address' },
              { key: 'phone', label: 'Phone *', ph: 'Phone number', kb: 'phone-pad' },
              { key: 'whatsapp', label: 'WhatsApp', ph: 'WhatsApp number', kb: 'phone-pad' },
              { key: 'timings', label: 'Timings', ph: 'e.g. Mon-Sat: 5PM-9PM' },
              { key: 'fee', label: 'Fee (PKR)', ph: 'e.g. 500', kb: 'numeric' },
              { key: 'education', label: 'Education', ph: 'e.g. MBBS, FCPS' },
              { key: 'experience', label: 'Experience', ph: 'e.g. 15 years' },
            ].map((f) => (
              <View key={f.key}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput style={styles.input} placeholder={f.ph} value={form[f.key]}
                  onChangeText={(v) => setForm({ ...form, [f.key]: v })}
                  keyboardType={f.kb || 'default'} placeholderTextColor={COLORS.textLight} />
              </View>
            ))}

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>🔑 Doctor Login Credentials</Text>
            <Text style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 8 }}>
              Set email & password so the doctor can login to manage their dashboard.
            </Text>
            <TextInput style={styles.input} placeholder="Email for login" value={form.email}
              onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address"
              autoCapitalize="none" placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} placeholder="Password (min 6 chars)" value={form.password}
              onChangeText={(v) => setForm({ ...form, password: v })} secureTextEntry placeholderTextColor={COLORS.textLight} />

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>� Availability</Text>
            <WeekdaySelector label="Available Days" value={form.weekdays} onChange={(v) => setForm({ ...form, weekdays: v })} />
            <TimePicker12hr label="Start Time" value={form.startTime} onChange={(v) => setForm({ ...form, startTime: v })} />
            <TimePicker12hr label="End Time" value={form.endTime} onChange={(v) => setForm({ ...form, endTime: v })} />

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>📋 Online Booking Settings</Text>
            <TouchableOpacity
              style={[styles.toggleBtn, form.onlineBooking && styles.toggleBtnActive]}
              onPress={() => setForm({ ...form, onlineBooking: !form.onlineBooking })}
            >
              <Text style={{ fontWeight: '600', color: form.onlineBooking ? COLORS.primary : COLORS.textLight }}>
                {form.onlineBooking ? '✅ Online Booking ON' : 'Enable Online Booking'}
              </Text>
            </TouchableOpacity>
            {form.onlineBooking && (
              <>
                {[
                  { key: 'paymentMethod', label: 'Payment Method', ph: 'EasyPaisa / JazzCash' },
                  { key: 'paymentAccount', label: 'Payment Account', ph: 'Account number' },
                ].map((f) => (
                  <View key={f.key}>
                    <Text style={styles.fieldLabel}>{f.label}</Text>
                    <TextInput style={styles.input} placeholder={f.ph} value={form[f.key]}
                      onChangeText={(v) => setForm({ ...form, [f.key]: v })}
                      keyboardType={f.kb || 'default'} placeholderTextColor={COLORS.textLight} />
                  </View>
                ))}
                <Text style={styles.fieldLabel}>Avg Min Per Patient</Text>
                <TextInput style={styles.input} placeholder="15" value={form.avgConsultTime}
                  onChangeText={(v) => setForm({ ...form, avgConsultTime: v })}
                  keyboardType="numeric" placeholderTextColor={COLORS.textLight} />
              </>
            )}

            <TouchableOpacity
              style={[styles.toggleBtn, form.isVerified && styles.toggleBtnActive, { marginTop: 12 }]}
              onPress={() => setForm({ ...form, isVerified: !form.isVerified })}
            >
              <Text style={{ fontWeight: '600', color: form.isVerified ? COLORS.primary : COLORS.textLight }}>
                {form.isVerified ? '✅ Marked as Verified' : 'Mark as Verified'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.5 }]} onPress={saveDoctor} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitBtnText}>Add Doctor</Text>}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Image Viewer for payment proof */}
      <ImageViewer
        images={viewerImages}
        visible={viewerVisible}
        initialIndex={0}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}

// ── Helper Component ─────────────────────────────────────────────────
function DetailRow({ label, value, highlight }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, color: COLORS.textLight, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 15, color: highlight ? COLORS.primary : COLORS.text, fontWeight: highlight ? '700' : '400' }}>{value}</Text>
    </View>
  );
}

function WeekdaySelector({ label, value, onChange }) {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const selected = value ? value.split(',').map(d => d.trim()).filter(Boolean) : [];
  const toggle = (day) => {
    const next = selected.includes(day) ? selected.filter(d => d !== day) : [...selected, day];
    onChange(next.join(','));
  };
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.fieldLabel}>{label || 'Available Days'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {DAYS.map(d => {
          const active = selected.includes(d);
          return (
            <TouchableOpacity key={d} style={[styles.tpBtn, active && styles.tpBtnActive]} onPress={() => toggle(d)}>
              <Text style={[styles.tpBtnText, active && { color: COLORS.white }]}>{d}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function TimePicker12hr({ label, value, onChange }) {
  const parseTime = (v) => {
    if (!v) return { hour: null, minute: null, period: null };
    const [h, m] = v.split(':').map(Number);
    if (isNaN(h)) return { hour: null, minute: null, period: null };
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return { hour: hour12, minute: m || 0, period };
  };
  const t = parseTime(value);
  const update = (field, newVal) => {
    const hour = field === 'hour' ? newVal : (t.hour ?? 9);
    const minute = field === 'minute' ? newVal : (t.minute ?? 0);
    const period = field === 'period' ? newVal : (t.period ?? 'AM');
    let h = hour % 12;
    if (period === 'PM') h += 12;
    onChange(`${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };
  const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const MINUTES = [0, 15, 30, 45];
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
        {HOURS.map(h => (
          <TouchableOpacity key={h} style={[styles.tpBtn, t.hour === h && styles.tpBtnActive]} onPress={() => update('hour', h)}>
            <Text style={[styles.tpBtnText, t.hour === h && { color: COLORS.white }]}>{h}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
        {MINUTES.map(m => (
          <TouchableOpacity key={m} style={[styles.tpBtn, t.minute === m && t.minute !== null && styles.tpBtnActive]} onPress={() => update('minute', m)}>
            <Text style={[styles.tpBtnText, t.minute === m && t.minute !== null && { color: COLORS.white }]}>:{String(m).padStart(2, '0')}</Text>
          </TouchableOpacity>
        ))}
        {['AM', 'PM'].map(p => (
          <TouchableOpacity key={p} style={[styles.tpBtn, t.period === p && styles.tpBtnActive]} onPress={() => update('period', p)}>
            <Text style={[styles.tpBtnText, t.period === p && { color: COLORS.white }]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {value
        ? <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 }}>✓ {t.hour}:{String(t.minute ?? 0).padStart(2, '0')} {t.period}</Text>
        : <Text style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 8 }}>Tap to set time</Text>
      }
    </View>
  );
}

// ── STYLES ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 14, backgroundColor: COLORS.primary,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  tabsRow: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.secondary || COLORS.primary },
  tabText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary },
  searchBar: { flexDirection: 'row', margin: 12, backgroundColor: COLORS.surface, borderRadius: 12, elevation: 2 },
  searchInput: { flex: 1, padding: 14, fontSize: 15, color: COLORS.text },
  searchBtn: { padding: 14 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    paddingHorizontal: 14, height: 36, borderRadius: 20, marginRight: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterLabel: { fontSize: 12, color: COLORS.text },
  // Doctor card
  doctorCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 12,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6,
  },
  doctorHeader: { flexDirection: 'row', marginBottom: 10, alignItems: 'center' },
  doctorIcon: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: (COLORS.primaryLight || '#E8F5E9') + '20',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  doctorName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  verifiedBadge: { marginLeft: 6, color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  specialtyText: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  clinicText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  onlineBadge: { backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  onlineBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  addressText: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  timingsText: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  feeText: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginBottom: 8 },
  contactRow: { flexDirection: 'row', gap: 10 },
  callButton: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  callText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  bookButton: { flex: 1, backgroundColor: '#10B981', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  bookText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  // Appointment card
  apptCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 12,
    elevation: 2, borderLeftWidth: 4,
  },
  apptDoctor: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  apptSpecialty: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  statusText: { fontSize: 12, fontWeight: '700' },
  tokenBig: { alignItems: 'center', marginLeft: 12 },
  tokenLabel: { fontSize: 11, color: COLORS.textLight },
  tokenNum: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  tokenEst: { fontSize: 11, color: COLORS.textSecondary },
  liveToken: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 8, marginTop: 8 },
  liveTokenText: { fontSize: 12, color: '#EF4444', fontWeight: '600', textAlign: 'center' },
  liveTokenSmall: { backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8, alignSelf: 'flex-start' },
  liveTokenSmallText: { fontSize: 11, color: '#EF4444', fontWeight: '600' },
  apptFee: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 6 },
  paymentInfo: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginTop: 10 },
  paymentLabel: { fontSize: 14, fontWeight: '700', color: '#3B82F6', marginBottom: 4 },
  paymentAccount: { fontSize: 13, color: COLORS.text, marginBottom: 8 },
  uploadBtn: {
    flexDirection: 'row', backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  uploadBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  cancelBtn: { marginTop: 8, alignSelf: 'flex-end' },
  cancelBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  // Dashboard
  dashCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 12,
    elevation: 2,
  },
  dashTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  dashSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  dashCardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  tokenCtrl: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
  },
  statBox: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 10, padding: 12,
    alignItems: 'center', borderTopWidth: 3, elevation: 1,
  },
  statVal: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  settingRow: { fontSize: 13, color: COLORS.text, marginBottom: 4 },
  editBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.primary + '15', borderRadius: 8 },
  editBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FEE2E2', borderRadius: 8 },
  logoutBtnText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  dashApptCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, marginBottom: 10,
    borderLeftWidth: 4, elevation: 1,
  },
  dashApptName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  dashApptPhone: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  proofThumb: { width: '100%', height: 120, borderRadius: 10, marginTop: 8, backgroundColor: COLORS.border },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  // Admin
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
  adminDeleteBtn: { marginTop: 8, alignSelf: 'flex-end', padding: 6 },
  // Modals
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: COLORS.primary,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  detailIconBig: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: (COLORS.primaryLight || '#E8F5E9') + '20',
    justifyContent: 'center', alignItems: 'center',
  },
  detailName: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  detailSpec: { fontSize: 16, color: COLORS.primary, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  detailSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4 },
  verifiedTag: { marginLeft: 10, backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  verifiedTagText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  deleteBtn: { marginTop: 20, backgroundColor: '#FFEBEE', padding: 14, borderRadius: 12, alignItems: 'center' },
  deleteBtnText: { color: '#F44336', fontWeight: '700' },
  onlineBookingInfo: { backgroundColor: '#ECFDF5', borderRadius: 12, padding: 14, marginTop: 8 },
  onlineInfoTitle: { fontSize: 15, fontWeight: '700', color: '#10B981', marginBottom: 6 },
  onlineInfoText: { fontSize: 13, color: COLORS.text, marginBottom: 2 },
  detailCTA: {
    flexDirection: 'row', padding: 16, paddingBottom: 30, backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border, gap: 10,
  },
  callCTA: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  callCTAText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  bookCTA: { flex: 1, backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  bookCTAText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  // Popup / Sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  popup: { backgroundColor: COLORS.surface, margin: 24, borderRadius: 20, padding: 24 },
  popupTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  popupText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  popupSub: { fontSize: 12, color: COLORS.textLight, marginTop: 8 },
  popupBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', flex: 1 },
  sheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  // Form
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: COLORS.background, borderRadius: 10, padding: 14, fontSize: 14,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, color: COLORS.text,
  },
  toggleBtn: {
    padding: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', marginBottom: 8,
  },
  toggleBtnActive: { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary },
  submitBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  submitBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  // Empty
  emptySmall: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '600', marginTop: 8 },
  emptySub: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  // Time picker & weekday selector
  tpBtn: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface,
    minWidth: 36, alignItems: 'center',
  },
  tpBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tpBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  // Availability badge on doctor cards
  availableNow: {
    backgroundColor: '#D1FAE5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 6,
  },
  availableNowText: { color: '#065F46', fontSize: 11, fontWeight: '700' },
  notAvailable: {
    backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 6,
  },
  notAvailableText: { color: '#9CA3AF', fontSize: 11, fontWeight: '600' },
  // Dashboard availability toggle
  availToggle: {
    borderRadius: 14, padding: 16, marginBottom: 12, alignItems: 'center',
    elevation: 2,
  },
  availToggleOn: { backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#6EE7B7' },
  availToggleOff: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: COLORS.border },
  availToggleText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
});
