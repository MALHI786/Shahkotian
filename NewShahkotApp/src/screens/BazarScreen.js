import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Image, RefreshControl, Modal, Alert, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, API_URL } from '../config/constants';
import { bazarAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AdBanner from '../components/AdBanner';

export default function BazarScreen() {
  const { user } = useAuth();

  // ========== NAVIGATION ==========
  const [currentView, setCurrentView] = useState('home');
  const [loading, setLoading] = useState(true);

  // ========== DATA ==========
  const [bazars, setBazars] = useState([]);
  const [myTrader, setMyTrader] = useState(null);

  // ========== REGISTRATION ==========
  const [regForm, setRegForm] = useState({ fullName: '', shopName: '', phone: '', bazarId: '' });
  const [regPhoto, setRegPhoto] = useState(null);
  const [registering, setRegistering] = useState(false);

  // ========== CHAT ==========
  const [chatBazar, setChatBazar] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatPage, setChatPage] = useState(1);
  const [chatHasMore, setChatHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const chatListRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // ========== VOTERS ==========
  const [votersBazar, setVotersBazar] = useState(null);
  const [voters, setVoters] = useState([]);
  const [voterSearch, setVoterSearch] = useState('');
  const [votersLoading, setVotersLoading] = useState(false);

  // ========== PRESIDENT ==========
  const [presidentToken, setPresidentToken] = useState(null);
  const [presidentData, setPresidentData] = useState(null);
  const [presidentEmail, setPresidentEmail] = useState('');
  const [presidentPassword, setPresidentPassword] = useState('');
  const [pendingTraders, setPendingTraders] = useState([]);
  const [presidentLoading, setPresidentLoading] = useState(false);
  const [presidentBazars, setPresidentBazars] = useState([]);
  const [newBazarName, setNewBazarName] = useState('');
  const [exportBazarId, setExportBazarId] = useState('all');
  const [presidentStats, setPresidentStats] = useState(null);

  // ========== DETAIL MODAL ==========
  const [detailTrader, setDetailTrader] = useState(null);

  // ========== EFFECTS ==========
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (myTrader) {
      if (myTrader.status === 'APPROVED') setCurrentView('features');
      else if (myTrader.status === 'PENDING') setCurrentView('pending');
    }
  }, [myTrader]);

  useEffect(() => {
    if (chatBazar && currentView === 'chatRoom') {
      loadChatMessages(1);
      pollIntervalRef.current = setInterval(() => loadChatMessages(1, true), 10000);
      return () => clearInterval(pollIntervalRef.current);
    }
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [chatBazar, currentView]);

  // ========== LOADERS ==========
  const loadInitialData = async () => {
    try {
      const [bazarRes, statusRes] = await Promise.all([
        bazarAPI.getBazars(),
        bazarAPI.getMyStatus(),
      ]);
      setBazars(bazarRes.data.bazars || []);
      setMyTrader(statusRes.data.trader);
      const token = await AsyncStorage.getItem('presidentToken');
      if (token) setPresidentToken(token);
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    try {
      const [bazarRes, statusRes] = await Promise.all([
        bazarAPI.getBazars(),
        bazarAPI.getMyStatus(),
      ]);
      setBazars(bazarRes.data.bazars || []);
      setMyTrader(statusRes.data.trader);
    } catch (e) {}
  };

  const loadVoters = async (bazarId) => {
    try {
      setVotersLoading(true);
      const res = await bazarAPI.getTraders(bazarId);
      setVoters(res.data.traders || []);
    } catch (e) {
      console.error('Load voters error:', e);
    } finally {
      setVotersLoading(false);
    }
  };

  // ====== CHAT ======
  const loadChatMessages = useCallback(async (pageNum = 1, isPoll = false) => {
    if (!chatBazar) return;
    try {
      const res = await bazarAPI.getMessages(chatBazar.id, pageNum);
      const msgs = res.data.messages || [];
      if (isPoll) {
        setMessages(prev => {
          if (prev.length === 0) return msgs;
          const ids = new Set(prev.map(m => m.id));
          const newMsgs = msgs.filter(m => !ids.has(m.id));
          return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
        });
      } else if (pageNum > 1) {
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const older = msgs.filter(m => !ids.has(m.id));
          return [...older, ...prev];
        });
      } else {
        setMessages(msgs);
      }
      setChatHasMore(res.data.hasMore);
      setChatPage(pageNum);
    } catch (e) {
      console.error('Chat load error:', e);
    }
  }, [chatBazar]);

  const sendChatMessage = async () => {
    if (!chatText.trim() && selectedImages.length === 0) return;
    if (!chatBazar) return;
    try {
      setSending(true);
      const formData = new FormData();
      formData.append('bazarId', chatBazar.id);
      if (chatText.trim()) formData.append('text', chatText.trim());
      selectedImages.forEach((uri, i) => {
        formData.append('images', { uri, name: `img_${i}.jpg`, type: 'image/jpeg' });
      });
      await bazarAPI.sendMessage(formData);
      setChatText('');
      setSelectedImages([]);
      loadChatMessages(1);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const pickChatImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: 5,
    });
    if (!result.canceled) {
      setSelectedImages(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, 5));
    }
  };

  const createPoll = async () => {
    const opts = pollOptions.filter(o => o.trim());
    if (!pollQuestion.trim() || opts.length < 2) {
      Alert.alert('Error', 'Enter a question and at least 2 options');
      return;
    }
    try {
      setSending(true);
      await bazarAPI.createPoll({ bazarId: chatBazar.id, pollQuestion: pollQuestion.trim(), pollOptions: opts });
      setShowPollModal(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      loadChatMessages(1);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed');
    } finally {
      setSending(false);
    }
  };

  const votePoll = async (msgId, optionIndex) => {
    try {
      await bazarAPI.votePoll(msgId, optionIndex);
      loadChatMessages(1);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Vote failed');
    }
  };

  const deleteChatMsg = async (id) => {
    Alert.alert('Delete', 'Delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await bazarAPI.deleteMessage(id);
          setMessages(prev => prev.filter(m => m.id !== id));
        } catch (e) { Alert.alert('Error', 'Failed to delete'); }
      }},
    ]);
  };

  // ====== REGISTRATION ======
  const pickRegPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) setRegPhoto(result.assets[0].uri);
  };

  const submitRegistration = async () => {
    if (!regForm.fullName.trim() || !regForm.shopName.trim() || !regForm.phone.trim() || !regForm.bazarId) {
      Alert.alert('ضروری / Required', 'براہ کرم تمام فیلڈز بھریں اور بازار منتخب کریں\nPlease fill Full Name, Shop Name, Phone and select a Bazar');
      return;
    }
    try {
      setRegistering(true);
      const formData = new FormData();
      formData.append('fullName', regForm.fullName.trim());
      formData.append('shopName', regForm.shopName.trim());
      formData.append('phone', regForm.phone.trim());
      formData.append('bazarId', regForm.bazarId);
      if (regPhoto) {
        formData.append('photo', { uri: regPhoto, name: 'photo.jpg', type: 'image/jpeg' });
      }
      const res = await bazarAPI.register(formData);
      Alert.alert('کامیاب / Success', res.data.message || 'Registration submitted!');
      setMyTrader(res.data.trader);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  // ====== PRESIDENT ======
  const presidentLogin = async () => {
    if (!presidentEmail.trim() || !presidentPassword.trim()) return;
    try {
      setPresidentLoading(true);
      const res = await bazarAPI.presidentLogin({ email: presidentEmail.trim(), password: presidentPassword });
      const token = res.data.token;
      setPresidentToken(token);
      await AsyncStorage.setItem('presidentToken', token);
      setPresidentData(res.data.president);
      setCurrentView('presidentDashboard');
      loadPresidentData(token);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Login failed');
    } finally {
      setPresidentLoading(false);
    }
  };

  const presidentLogout = async () => {
    setPresidentToken(null);
    setPresidentData(null);
    setPendingTraders([]);
    setPresidentStats(null);
    await AsyncStorage.removeItem('presidentToken');
    if (myTrader?.status === 'APPROVED') setCurrentView('features');
    else setCurrentView('home');
  };

  const loadPresidentData = async (token) => {
    try {
      setPresidentLoading(true);
      const [dashRes, pendRes, bazarRes] = await Promise.all([
        bazarAPI.presidentDashboard(token),
        bazarAPI.getPending(token),
        bazarAPI.getBazars(),
      ]);
      setPresidentData(dashRes.data.president);
      setPresidentStats(dashRes.data.stats);
      setPendingTraders(pendRes.data.traders || []);
      setPresidentBazars(bazarRes.data.bazars || []);
    } catch (e) {
      if (e.response?.status === 403) presidentLogout();
    } finally {
      setPresidentLoading(false);
    }
  };

  const approveTrader = async (id) => {
    try {
      await bazarAPI.approveTrader(id, presidentToken);
      Alert.alert('Done', 'Trader approved');
      loadPresidentData(presidentToken);
    } catch (e) { Alert.alert('Error', 'Failed'); }
  };

  const rejectTrader = async (id) => {
    try {
      await bazarAPI.rejectTrader(id, presidentToken);
      Alert.alert('Done', 'Trader rejected');
      loadPresidentData(presidentToken);
    } catch (e) { Alert.alert('Error', 'Failed'); }
  };

  const deleteTrader = async (id) => {
    Alert.alert('Delete', 'Remove this trader permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await bazarAPI.deleteTrader(id, presidentToken);
          loadPresidentData(presidentToken);
        } catch (e) { Alert.alert('Error', 'Failed'); }
      }},
    ]);
  };

  const addBazar = async () => {
    if (!newBazarName.trim()) return;
    try {
      await bazarAPI.addBazar(newBazarName.trim(), presidentToken);
      setNewBazarName('');
      loadPresidentData(presidentToken);
      Alert.alert('Success', 'Bazar added');
    } catch (e) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
  };

  const deleteBazar = async (id) => {
    Alert.alert('Delete Bazar', 'This will remove the bazar and all its data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await bazarAPI.deleteBazar(id, presidentToken);
          loadPresidentData(presidentToken);
        } catch (e) { Alert.alert('Error', 'Failed'); }
      }},
    ]);
  };

  const exportTraders = () => {
    const url = bazarAPI.getExportUrl(presidentToken, exportBazarId);
    Linking.openURL(url);
  };

  // ========== NAVIGATION ==========
  const goBack = () => {
    switch (currentView) {
      case 'register':
        if (myTrader?.status === 'APPROVED') setCurrentView('features');
        else setCurrentView('home');
        break;
      case 'pending':
        setCurrentView('home');
        break;
      case 'chat':
        setCurrentView('features');
        break;
      case 'chatRoom':
        setChatBazar(null);
        setMessages([]);
        clearInterval(pollIntervalRef.current);
        setCurrentView('chat');
        break;
      case 'voters':
        if (votersBazar) {
          setVotersBazar(null);
          setVoters([]);
          setVoterSearch('');
        } else {
          setCurrentView('features');
        }
        break;
      case 'presidentLogin':
        if (myTrader?.status === 'APPROVED') setCurrentView('features');
        else setCurrentView('home');
        break;
      case 'presidentDashboard':
        if (myTrader?.status === 'APPROVED') setCurrentView('features');
        else setCurrentView('home');
        break;
      default:
        setCurrentView('home');
    }
  };

  const handlePresidentNav = () => {
    if (presidentToken) {
      loadPresidentData(presidentToken);
      setCurrentView('presidentDashboard');
    } else {
      setCurrentView('presidentLogin');
    }
  };

  // ========== HEADER ==========
  const renderHeader = () => {
    const showMainHeader = currentView === 'home' || currentView === 'features';

    if (showMainHeader) {
      return (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>شاہکوٹ بازار</Text>
            <Text style={styles.headerSub}>Shahkot Bazar – Trader Community</Text>
          </View>
          {presidentToken && (
            <TouchableOpacity onPress={() => { loadPresidentData(presidentToken); setCurrentView('presidentDashboard'); }} style={styles.headerPresidentBtn}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>👔 Dashboard</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    const titles = {
      register: 'اندراج / Register',
      pending: 'درخواست کی صورتحال',
      chat: 'بحث کے لیے بازار منتخب کریں',
      chatRoom: chatBazar?.name || 'Chat',
      voters: votersBazar ? votersBazar.name : 'تصدیق شدہ ووٹرز',
      presidentLogin: 'President Login',
      presidentDashboard: 'President Dashboard',
    };

    return (
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.subHeaderTitle} numberOfLines={1}>{titles[currentView]}</Text>
        <View style={{ width: 44 }} />
      </View>
    );
  };

  // ========== HOME VIEW ==========
  const renderHome = () => (
    <ScrollView style={styles.viewContainer} contentContainerStyle={{ alignItems: 'center', paddingBottom: 40, paddingHorizontal: 20 }}>
      <AdBanner />
      <View style={styles.guideCard}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🏪</Text>
        <Text style={styles.guideUrdu}>
          اگر آپ کسی بازار میں دکاندار ہیں تو براہ کرم اپنا اندراج کروائیں۔{'\n'}
          بصورت دیگر آپ کو اندراج کی ضرورت نہیں۔
        </Text>
        <View style={styles.guideDivider} />
        <Text style={styles.guideEn}>
          If you are a trader in any bazar, please register yourself.{'\n'}
          Otherwise, you do not need to register.
        </Text>
      </View>

      {myTrader?.status === 'REJECTED' && (
        <View style={styles.alertCard}>
          <Text style={styles.alertText}>⚠️ آپ کی پچھلی درخواست مسترد ہوگئی۔ آپ دوبارہ اندراج کر سکتے ہیں۔</Text>
          <Text style={[styles.alertText, { fontSize: 12, marginTop: 4 }]}>Your previous registration was rejected.</Text>
        </View>
      )}

      <TouchableOpacity style={styles.bigBtn} onPress={() => setCurrentView('register')}>
        <Text style={{ fontSize: 28, marginRight: 14 }}>📝</Text>
        <View>
          <Text style={styles.bigBtnText}>Register / اندراج کریں</Text>
          <Text style={styles.bigBtnSub}>Join your bazar community</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.presidentLink} onPress={handlePresidentNav}>
        <Text style={styles.presidentLinkText}>👔 President Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ========== REGISTER VIEW ==========
  const renderRegister = () => {
    if (myTrader && myTrader.status !== 'REJECTED') {
      return (
        <ScrollView style={styles.viewContainer} contentContainerStyle={{ alignItems: 'center', paddingTop: 40, padding: 20 }}>
          <View style={styles.statusCard}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>✅</Text>
            <Text style={styles.statusTitle}>Already Registered</Text>
            <Text style={styles.statusMsg}>آپ پہلے سے ایک تاجر کے طور پر رجسٹرڈ ہیں۔</Text>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.viewContainer} keyboardShouldPersistTaps="handled">
        <AdBanner />
        <View style={{ padding: 16 }}>
          <Text style={styles.formTitle}>تاجر رجسٹریشن فارم</Text>
          <Text style={styles.formSubtitle}>Trader Registration Form</Text>

          <Text style={styles.inputLabel}>پورا نام / Full Name *</Text>
          <TextInput style={styles.input} value={regForm.fullName} onChangeText={v => setRegForm({...regForm, fullName: v})} placeholder="اپنا پورا نام درج کریں" placeholderTextColor={COLORS.textLight} />

          <Text style={styles.inputLabel}>دکان کا نام / Shop Name *</Text>
          <TextInput style={styles.input} value={regForm.shopName} onChangeText={v => setRegForm({...regForm, shopName: v})} placeholder="اپنی دکان کا نام درج کریں" placeholderTextColor={COLORS.textLight} />

          <Text style={styles.inputLabel}>فون نمبر / Phone Number *</Text>
          <TextInput style={styles.input} value={regForm.phone} onChangeText={v => setRegForm({...regForm, phone: v})} placeholder="03xx-xxxxxxx" keyboardType="phone-pad" placeholderTextColor={COLORS.textLight} />

          <Text style={styles.inputLabel}>بازار منتخب کریں / Select Bazar *</Text>
          <View style={styles.bazarGrid}>
            {bazars.map(b => (
              <TouchableOpacity key={b.id} style={[styles.bazarChip, regForm.bazarId === b.id && styles.bazarChipSelected]} onPress={() => setRegForm({...regForm, bazarId: b.id})}>
                <Text style={[styles.bazarChipText, regForm.bazarId === b.id && { color: '#fff' }]}>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>تصویر / Profile Picture (اختیاری / Optional)</Text>
          <TouchableOpacity style={styles.photoPicker} onPress={pickRegPhoto}>
            {regPhoto ? (
              <Image source={{ uri: regPhoto }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={{ fontSize: 28 }}>📷</Text>
                <Text style={styles.photoPlaceholderText}>Tap to add photo (optional)</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.submitBtn, registering && { opacity: 0.5 }]} onPress={submitRegistration} disabled={registering}>
            <Text style={styles.submitBtnText}>{registering ? 'جمع ہو رہا ہے...' : 'جمع کرائیں / Submit'}</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    );
  };

  // ========== PENDING VIEW ==========
  const renderPending = () => (
    <ScrollView style={styles.viewContainer} contentContainerStyle={{ alignItems: 'center', paddingTop: 30, paddingHorizontal: 20 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshStatus} colors={[COLORS.primary]} />}>
      <View style={styles.statusCard}>
        <Text style={{ fontSize: 52, marginBottom: 16 }}>⏳</Text>
        <Text style={styles.statusTitle}>منظوری کا انتظار</Text>
        <Text style={[styles.statusTitle, { fontSize: 16, marginTop: 4 }]}>Waiting for Approval</Text>
        <View style={styles.guideDivider} />
        <Text style={styles.statusMsg}>
          آپ کی درخواست جمع کر دی گئی ہے۔{'\n'}
          براہ کرم صدر کی منظوری کا انتظار کریں۔
        </Text>
        <Text style={[styles.statusMsg, { marginTop: 10, color: COLORS.textSecondary }]}>
          Your registration request has been submitted.{'\n'}
          Please wait for President approval.
        </Text>
        {myTrader && (
          <View style={styles.pendingDetails}>
            <Text style={styles.pendingDetailText}>📛 {myTrader.fullName}</Text>
            <Text style={styles.pendingDetailText}>🏪 {myTrader.shopName}</Text>
            <Text style={styles.pendingDetailText}>📍 {myTrader.bazar?.name}</Text>
            <Text style={styles.pendingDetailText}>📞 {myTrader.phone}</Text>
          </View>
        )}
      </View>
      <Text style={{ fontSize: 12, color: COLORS.textLight, marginTop: 24 }}>↓ نیچے کھینچیں ریفریش کرنے کے لیے / Pull down to refresh</Text>
    </ScrollView>
  );

  // ========== FEATURES VIEW (After Approval) ==========
  const renderFeatures = () => (
    <ScrollView style={styles.viewContainer} contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshStatus} colors={[COLORS.primary]} />}>
      <AdBanner />

      <View style={styles.approvedBanner}>
        <Text style={styles.approvedBannerText}>✅ تصدیق شدہ تاجر / Verified Trader</Text>
        <Text style={styles.approvedBannerSub}>{myTrader?.shopName} – {myTrader?.bazar?.name}</Text>
      </View>

      <TouchableOpacity style={styles.featureCard} onPress={() => setCurrentView('chat')} activeOpacity={0.7}>
        <View style={[styles.featureIcon, { backgroundColor: '#E3F2FD' }]}>
          <Text style={{ fontSize: 32 }}>💬</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.featureTitle}>Discuss Issues / مسائل پر بات</Text>
          <Text style={styles.featureSub}>Open chat room for bazar discussions</Text>
        </View>
        <Text style={{ fontSize: 22, color: COLORS.textLight }}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.featureCard} onPress={() => setCurrentView('voters')} activeOpacity={0.7}>
        <View style={[styles.featureIcon, { backgroundColor: '#E8F5E9' }]}>
          <Text style={{ fontSize: 32 }}>✅</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.featureTitle}>Verified Voters / تصدیق شدہ ووٹرز</Text>
          <Text style={styles.featureSub}>View registered traders by bazar</Text>
        </View>
        <Text style={{ fontSize: 22, color: COLORS.textLight }}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.presidentLink} onPress={handlePresidentNav}>
        <Text style={styles.presidentLinkText}>👔 President Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ========== CHAT SELECT VIEW ==========
  const renderChatSelect = () => (
    <ScrollView style={styles.viewContainer}>
      <AdBanner />
      <View style={{ padding: 16 }}>
        <Text style={styles.sectionTitle}>بحث کے لیے بازار منتخب کریں</Text>
        <Text style={styles.sectionSub}>Select a bazar to join the discussion</Text>
        {bazars.map(bazar => (
          <TouchableOpacity key={bazar.id} style={styles.bazarSelectCard} onPress={() => { setChatBazar(bazar); setCurrentView('chatRoom'); }} activeOpacity={0.7}>
            <View style={styles.bazarSelectIcon}><Text style={{ fontSize: 28 }}>💬</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bazarSelectName}>{bazar.name}</Text>
              <Text style={styles.bazarSelectCount}>{bazar._count?.traders || 0} traders</Text>
            </View>
            <Text style={{ fontSize: 18, color: COLORS.textLight }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  // ========== CHAT ROOM VIEW ==========
  const renderChatMessage = ({ item }) => {
    const isOwn = item.trader?.userId === user?.id || item.traderId === myTrader?.id;
    const isPoll = !!item.pollQuestion;

    if (isPoll) {
      const votes = item.pollVotes || [];
      const myVote = votes.find(v => v.startsWith(myTrader?.id + ':'));
      const totalVotes = votes.length;
      return (
        <View style={[styles.chatBubble, styles.pollBubble]}>
          <Text style={styles.pollSender}>{item.trader?.fullName} – {item.trader?.shopName}</Text>
          <Text style={styles.pollQuestion}>{item.pollQuestion}</Text>
          {(item.pollOptions || []).map((opt, idx) => {
            const optVotes = votes.filter(v => v.endsWith(':' + idx)).length;
            const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
            const voted = myVote?.endsWith(':' + idx);
            return (
              <TouchableOpacity key={idx} style={[styles.pollOption, voted && styles.pollOptionVoted]} onPress={() => !myVote && votePoll(item.id, idx)} disabled={!!myVote}>
                <Text style={[styles.pollOptionText, voted && { fontWeight: '700' }]}>{opt}</Text>
                {myVote && <Text style={styles.pollPct}>{pct}% ({optVotes})</Text>}
              </TouchableOpacity>
            );
          })}
          <Text style={styles.pollTotal}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity style={[styles.chatBubble, isOwn ? styles.chatBubbleOwn : styles.chatBubbleOther]} onLongPress={() => isOwn && deleteChatMsg(item.id)} activeOpacity={0.8}>
        {!isOwn && <Text style={styles.chatSenderName}>{item.trader?.fullName}</Text>}
        {item.images?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {item.images.map((img, i) => <Image key={i} source={{ uri: img }} style={styles.chatImage} />)}
          </ScrollView>
        )}
        {item.text && <Text style={[styles.chatMsgText, isOwn && { color: '#fff' }]}>{item.text}</Text>}
        <Text style={[styles.chatTime, isOwn && { color: 'rgba(255,255,255,0.6)' }]}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderChatRoom = () => (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 80}
    >
      <FlatList
        ref={chatListRef}
        data={messages}
        renderItem={renderChatMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 10, paddingBottom: 8, flexGrow: 1 }}
        onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>💬</Text>
            <Text style={styles.emptyText}>ابھی تک کوئی پیغام نہیں</Text>
            <Text style={[styles.emptyText, { fontSize: 13 }]}>No messages yet. Start the discussion!</Text>
          </View>
        }
      />

      {selectedImages.length > 0 && (
        <ScrollView horizontal style={styles.imagePreviewRow}>
          {selectedImages.map((uri, i) => (
            <View key={i} style={styles.previewItem}>
              <Image source={{ uri }} style={styles.previewThumb} />
              <TouchableOpacity style={styles.previewRemove} onPress={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <SafeAreaView style={styles.chatInputSafe}>
        <View style={styles.chatInputContainer}>
          <TouchableOpacity onPress={pickChatImages} style={styles.chatActionBtn}>
            <Text style={{ fontSize: 20 }}>📷</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowPollModal(true)} style={styles.chatActionBtn}>
            <Text style={{ fontSize: 20 }}>📊</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.chatInput}
            value={chatText}
            onChangeText={setChatText}
            placeholder="پیغام لکھیں..."
            placeholderTextColor={COLORS.textLight}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity onPress={sendChatMessage} disabled={sending} style={[styles.chatSendBtn, sending && { opacity: 0.5 }]}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{sending ? '...' : '➤'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal visible={showPollModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Poll / رائے شماری</Text>
            <TextInput style={styles.input} placeholder="سوال..." value={pollQuestion} onChangeText={setPollQuestion} placeholderTextColor={COLORS.textLight} />
            {pollOptions.map((opt, i) => (
              <TextInput key={i} style={[styles.input, { marginTop: 8 }]} placeholder={`آپشن ${i + 1}`} value={opt} onChangeText={text => { const c = [...pollOptions]; c[i] = text; setPollOptions(c); }} placeholderTextColor={COLORS.textLight} />
            ))}
            <TouchableOpacity onPress={() => setPollOptions(prev => [...prev, ''])} style={{ padding: 10, alignItems: 'center' }}>
              <Text style={{ color: COLORS.primary, fontWeight: '600' }}>+ Add Option</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.submitBtn, { flex: 1, backgroundColor: COLORS.background }]} onPress={() => setShowPollModal(false)}>
                <Text style={[styles.submitBtnText, { color: COLORS.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, { flex: 2 }]} onPress={createPoll} disabled={sending}>
                <Text style={styles.submitBtnText}>{sending ? 'Creating...' : 'Create Poll'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );

  // ========== VOTERS VIEW ==========
  const filteredVoters = voters.filter(v => {
    if (!voterSearch.trim()) return true;
    const q = voterSearch.toLowerCase();
    return v.fullName.toLowerCase().includes(q) || v.shopName.toLowerCase().includes(q) || v.phone.includes(q);
  });

  const renderVoters = () => {
    if (!votersBazar) {
      return (
        <ScrollView style={styles.viewContainer}>
          <AdBanner />
          <View style={{ padding: 16 }}>
            <Text style={styles.sectionTitle}>بازار منتخب کریں</Text>
            <Text style={styles.sectionSub}>Select a bazar to view verified traders</Text>
            {bazars.map(bazar => (
              <TouchableOpacity key={bazar.id} style={styles.bazarSelectCard} onPress={() => { setVotersBazar(bazar); loadVoters(bazar.id); }} activeOpacity={0.7}>
                <View style={styles.bazarSelectIcon}><Text style={{ fontSize: 28 }}>✅</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bazarSelectName}>{bazar.name}</Text>
                  <Text style={styles.bazarSelectCount}>{bazar._count?.traders || 0} verified traders</Text>
                </View>
                <Text style={{ fontSize: 18, color: COLORS.textLight }}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.searchBarContainer}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="نام، دکان یا فون سے تلاش کریں..."
            value={voterSearch}
            onChangeText={setVoterSearch}
            placeholderTextColor={COLORS.textLight}
          />
          {voterSearch.length > 0 && (
            <TouchableOpacity onPress={() => setVoterSearch('')} style={{ padding: 8 }}>
              <Text style={{ color: COLORS.textLight, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filteredVoters}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.voterCard} onPress={() => setDetailTrader(item)} activeOpacity={0.7}>
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.voterPhoto} />
              ) : (
                <View style={[styles.voterPhoto, styles.voterPhotoPlaceholder]}>
                  <Text style={{ fontSize: 20 }}>🏪</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.voterName}>{item.fullName}</Text>
                <Text style={styles.voterShop}>{item.shopName}</Text>
                <Text style={styles.voterPhone}>📞 {item.phone}</Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={votersLoading} onRefresh={() => loadVoters(votersBazar.id)} colors={[COLORS.primary]} />}
          ListHeaderComponent={
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 10 }}>
              {filteredVoters.length} trader{filteredVoters.length !== 1 ? 's' : ''} found
            </Text>
          }
          ListEmptyComponent={!votersLoading && (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48 }}>🏪</Text>
              <Text style={styles.emptyText}>No traders found</Text>
            </View>
          )}
        />
      </View>
    );
  };

  // ========== PRESIDENT LOGIN ==========
  const renderPresidentLogin = () => (
    <ScrollView style={styles.viewContainer} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
      <View style={[styles.statusCard, { marginTop: 20 }]}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>👔</Text>
        <Text style={styles.statusTitle}>President Login</Text>
        <Text style={styles.sectionSub}>Manage trader registrations and bazars</Text>
      </View>
      <View style={{ width: '100%', marginTop: 20 }}>
        <TextInput style={styles.input} placeholder="Email" value={presidentEmail} onChangeText={setPresidentEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={COLORS.textLight} />
        <TextInput style={[styles.input, { marginTop: 10 }]} placeholder="Password" value={presidentPassword} onChangeText={setPresidentPassword} secureTextEntry placeholderTextColor={COLORS.textLight} />
        <TouchableOpacity style={[styles.submitBtn, presidentLoading && { opacity: 0.5 }]} onPress={presidentLogin} disabled={presidentLoading}>
          <Text style={styles.submitBtnText}>{presidentLoading ? 'Logging in...' : 'Login'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // ========== PRESIDENT DASHBOARD ==========
  const renderPresidentDashboard = () => (
    <ScrollView style={styles.viewContainer} refreshControl={<RefreshControl refreshing={presidentLoading} onRefresh={() => loadPresidentData(presidentToken)} colors={[COLORS.primary]} />}>
      <View style={{ padding: 16 }}>
        {/* President Info */}
        <View style={styles.presidentHeader}>
          <View>
            <Text style={styles.presidentName}>{presidentData?.name || 'President'}</Text>
            <Text style={styles.presidentEmailText}>{presidentData?.email}</Text>
          </View>
          <TouchableOpacity onPress={presidentLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        {presidentStats && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}><Text style={styles.statNum}>{presidentStats.totalTraders}</Text><Text style={styles.statLabel}>Total</Text></View>
            <View style={styles.statCard}><Text style={[styles.statNum, { color: COLORS.warning }]}>{presidentStats.pendingTraders}</Text><Text style={styles.statLabel}>Pending</Text></View>
            <View style={styles.statCard}><Text style={[styles.statNum, { color: COLORS.success }]}>{presidentStats.approvedTraders}</Text><Text style={styles.statLabel}>Approved</Text></View>
            <View style={styles.statCard}><Text style={styles.statNum}>{presidentStats.totalBazars}</Text><Text style={styles.statLabel}>Bazars</Text></View>
          </View>
        )}

        {/* Pending Approvals */}
        <Text style={styles.dashSectionTitle}>📋 Pending Approvals ({pendingTraders.length})</Text>
        {pendingTraders.length === 0 && <Text style={styles.emptyMsg}>No pending registrations</Text>}
        {pendingTraders.map(trader => (
          <View key={trader.id} style={styles.pendingCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              {trader.photoUrl ? (
                <Image source={{ uri: trader.photoUrl }} style={styles.pendingPhoto} />
              ) : (
                <View style={[styles.pendingPhoto, styles.voterPhotoPlaceholder]}><Text>🏪</Text></View>
              )}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontWeight: '700', color: COLORS.text, fontSize: 15 }}>{trader.fullName}</Text>
                <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>{trader.shopName}</Text>
                <Text style={{ fontSize: 12, color: COLORS.primary }}>{trader.bazar?.name}</Text>
                <Text style={{ fontSize: 11, color: COLORS.textLight }}>📞 {trader.phone}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.approveBtn} onPress={() => approveTrader(trader.id)}>
                <Text style={styles.approveBtnText}>✓ Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectTrader(trader.id)}>
                <Text style={styles.rejectBtnText}>✗ Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.trashBtn} onPress={() => deleteTrader(trader.id)}>
                <Text style={{ fontSize: 16 }}>🗑</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Bazar Management */}
        <Text style={styles.dashSectionTitle}>🏪 Bazar Management</Text>
        <View style={styles.addBazarRow}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="New bazar name..." value={newBazarName} onChangeText={setNewBazarName} placeholderTextColor={COLORS.textLight} />
          <TouchableOpacity style={styles.addBazarBtn} onPress={addBazar}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {presidentBazars.map(b => (
          <View key={b.id} style={styles.bazarManageRow}>
            <Text style={{ flex: 1, fontWeight: '600', color: COLORS.text }}>{b.name}</Text>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginRight: 10 }}>{b._count?.traders || 0} traders</Text>
            <TouchableOpacity onPress={() => deleteBazar(b.id)}>
              <Text style={{ color: COLORS.error, fontSize: 13 }}>🗑 Delete</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Export CSV */}
        <Text style={styles.dashSectionTitle}>📥 Export Traders (Excel/CSV)</Text>
        <Text style={styles.sectionSub}>Download registered voters list bazar-wise</Text>
        <View style={styles.bazarGrid}>
          <TouchableOpacity style={[styles.bazarChip, exportBazarId === 'all' && styles.bazarChipSelected]} onPress={() => setExportBazarId('all')}>
            <Text style={[styles.bazarChipText, exportBazarId === 'all' && { color: '#fff' }]}>All Bazars</Text>
          </TouchableOpacity>
          {presidentBazars.map(b => (
            <TouchableOpacity key={b.id} style={[styles.bazarChip, exportBazarId === b.id && styles.bazarChipSelected]} onPress={() => setExportBazarId(b.id)}>
              <Text style={[styles.bazarChipText, exportBazarId === b.id && { color: '#fff' }]}>{b.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.submitBtn, { marginTop: 12 }]} onPress={exportTraders}>
          <Text style={styles.submitBtnText}>📥 Download CSV File</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );

  // ========== TRADER DETAIL MODAL ==========
  const renderTraderDetailModal = () => (
    <Modal visible={!!detailTrader} transparent animationType="slide" onRequestClose={() => setDetailTrader(null)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              {detailTrader?.photoUrl ? (
                <Image source={{ uri: detailTrader.photoUrl }} style={styles.detailPhoto} />
              ) : (
                <View style={[styles.detailPhoto, styles.voterPhotoPlaceholder]}>
                  <Text style={{ fontSize: 40 }}>🏪</Text>
                </View>
              )}
              <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.text, marginTop: 10 }}>{detailTrader?.fullName}</Text>
              <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>{detailTrader?.shopName}</Text>
            </View>
            <View style={styles.detailInfoRow}>
              <Text style={styles.detailInfoLabel}>Bazar</Text>
              <Text style={styles.detailInfoValue}>{detailTrader?.bazar?.name}</Text>
            </View>
            <View style={styles.detailInfoRow}>
              <Text style={styles.detailInfoLabel}>Phone</Text>
              <Text style={styles.detailInfoValue}>{detailTrader?.phone}</Text>
            </View>
            <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${detailTrader?.phone}`)}>
              <Text style={styles.callBtnText}>📞 Call Trader</Text>
            </TouchableOpacity>
          </ScrollView>
          <TouchableOpacity onPress={() => setDetailTrader(null)} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ========== LOADING ==========
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 12, color: COLORS.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  // ========== MAIN RENDER ==========
  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {currentView === 'home' && renderHome()}
      {currentView === 'register' && renderRegister()}
      {currentView === 'pending' && renderPending()}
      {currentView === 'features' && renderFeatures()}
      {currentView === 'chat' && renderChatSelect()}
      {currentView === 'chatRoom' && renderChatRoom()}
      {currentView === 'voters' && renderVoters()}
      {currentView === 'presidentLogin' && renderPresidentLogin()}
      {currentView === 'presidentDashboard' && renderPresidentDashboard()}
      {renderTraderDetailModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  viewContainer: { flex: 1 },

  // Main Header
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, padding: 16, paddingTop: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  headerPresidentBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },

  // Sub Header (feature screens)
  subHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 8 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { fontSize: 28, color: COLORS.white, fontWeight: '700' },
  subHeaderTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.white, textAlign: 'center' },

  // Guide Card
  guideCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 16, width: '100%', elevation: 2, borderWidth: 1, borderColor: COLORS.primary + '20' },
  guideUrdu: { fontSize: 16, color: COLORS.text, textAlign: 'center', lineHeight: 26, fontWeight: '600' },
  guideDivider: { width: 60, height: 2, backgroundColor: COLORS.primary + '30', marginVertical: 14 },
  guideEn: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Alert Card
  alertCard: { backgroundColor: COLORS.warning + '15', borderRadius: 12, padding: 14, marginTop: 14, width: '100%', borderWidth: 1, borderColor: COLORS.warning + '30' },
  alertText: { color: COLORS.warning, fontSize: 14, textAlign: 'center', fontWeight: '600' },

  // Big Button
  bigBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 18, paddingHorizontal: 24, borderRadius: 14, marginTop: 24, width: '100%', elevation: 3 },
  bigBtnText: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  bigBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // President Link
  presidentLink: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  presidentLinkText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },

  // Form
  formTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  formSubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 13, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },

  // Bazar Grid
  bazarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  bazarChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  bazarChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  bazarChipText: { fontSize: 13, color: COLORS.text },

  // Photo Picker
  photoPicker: { width: 100, height: 100, borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  photoPreview: { width: 100, height: 100, borderRadius: 12 },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  photoPlaceholderText: { fontSize: 10, color: COLORS.textLight, textAlign: 'center', marginTop: 4 },

  // Submit Button
  submitBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },

  // Status Card
  statusCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 28, alignItems: 'center', width: '100%', elevation: 2, borderWidth: 1, borderColor: COLORS.primary + '20' },
  statusTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  statusMsg: { fontSize: 14, color: COLORS.text, textAlign: 'center', lineHeight: 22, marginTop: 8 },

  // Pending Details
  pendingDetails: { backgroundColor: COLORS.background, borderRadius: 10, padding: 14, marginTop: 16, width: '100%' },
  pendingDetailText: { fontSize: 14, color: COLORS.text, marginBottom: 4 },

  // Approved Banner
  approvedBanner: { backgroundColor: COLORS.success + '12', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: COLORS.success + '30', alignItems: 'center' },
  approvedBannerText: { fontSize: 16, fontWeight: '700', color: COLORS.success },
  approvedBannerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },

  // Feature Card
  featureCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: 18, borderRadius: 14, marginBottom: 12, elevation: 2 },
  featureIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  featureTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  featureSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },

  // Section
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  sectionSub: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 14 },

  // Bazar Select Card
  bazarSelectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: 14, borderRadius: 12, marginBottom: 10, elevation: 1 },
  bazarSelectIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primary + '12', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  bazarSelectName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  bazarSelectCount: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  // Chat
  chatBubble: { maxWidth: '80%', padding: 10, borderRadius: 12, marginBottom: 6 },
  chatBubbleOwn: { backgroundColor: COLORS.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  chatBubbleOther: { backgroundColor: COLORS.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4, elevation: 1 },
  chatSenderName: { fontSize: 11, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
  chatMsgText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  chatTime: { fontSize: 10, color: COLORS.textLight, marginTop: 4, textAlign: 'right' },
  chatImage: { width: 160, height: 120, borderRadius: 8, marginRight: 6 },

  // Chat Input
  chatInputSafe: { backgroundColor: COLORS.surface },
  chatInputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, paddingBottom: Platform.OS === 'android' ? 10 : 8, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  chatActionBtn: { padding: 8 },
  chatInput: { flex: 1, backgroundColor: COLORS.background, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: COLORS.text, maxHeight: 100 },
  chatSendBtn: { backgroundColor: COLORS.primary, width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginLeft: 6 },

  // Poll
  pollBubble: { backgroundColor: COLORS.surface, alignSelf: 'stretch', maxWidth: '100%', borderWidth: 1, borderColor: COLORS.primary + '30', elevation: 1 },
  pollSender: { fontSize: 11, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  pollQuestion: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  pollOption: { backgroundColor: COLORS.background, padding: 12, borderRadius: 8, marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pollOptionVoted: { backgroundColor: COLORS.primary + '15', borderWidth: 1, borderColor: COLORS.primary + '30' },
  pollOptionText: { fontSize: 14, color: COLORS.text },
  pollPct: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  pollTotal: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },

  // Image Preview
  imagePreviewRow: { padding: 8, backgroundColor: COLORS.surface },
  previewItem: { position: 'relative', marginRight: 8 },
  previewThumb: { width: 60, height: 60, borderRadius: 8 },
  previewRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: COLORS.error, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  // Search Bar
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, marginHorizontal: 12, marginVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 14, color: COLORS.text },

  // Voter Card
  voterCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: 12, borderRadius: 12, marginBottom: 8, elevation: 1 },
  voterPhoto: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  voterPhotoPlaceholder: { backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  voterName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  voterShop: { fontSize: 13, color: COLORS.textSecondary },
  voterPhone: { fontSize: 12, color: COLORS.primary, marginTop: 2 },

  // President Dashboard
  presidentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, padding: 16, borderRadius: 12, marginBottom: 16, elevation: 1 },
  presidentName: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  presidentEmailText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  logoutBtn: { backgroundColor: COLORS.error + '15', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  logoutText: { color: COLORS.error, fontWeight: '600', fontSize: 13 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, alignItems: 'center', elevation: 1 },
  statNum: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },

  // Dashboard
  dashSectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginTop: 20, marginBottom: 10 },
  emptyMsg: { fontSize: 13, color: COLORS.textLight, fontStyle: 'italic', marginBottom: 10 },

  // Pending Card
  pendingCard: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 12, marginBottom: 10, elevation: 1, borderLeftWidth: 3, borderLeftColor: COLORS.warning },
  pendingPhoto: { width: 45, height: 45, borderRadius: 22 },
  approveBtn: { flex: 1, backgroundColor: COLORS.success + '15', padding: 10, borderRadius: 8, alignItems: 'center' },
  approveBtnText: { color: COLORS.success, fontWeight: '700', fontSize: 13 },
  rejectBtn: { flex: 1, backgroundColor: COLORS.error + '15', padding: 10, borderRadius: 8, alignItems: 'center' },
  rejectBtnText: { color: COLORS.error, fontWeight: '700', fontSize: 13 },
  trashBtn: { backgroundColor: COLORS.error + '10', padding: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // Bazar Management
  addBazarRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  addBazarBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 10 },
  bazarManageRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: 12, borderRadius: 10, marginBottom: 6, elevation: 1 },

  // Detail Modal
  detailPhoto: { width: 100, height: 100, borderRadius: 50 },
  detailInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailInfoLabel: { fontSize: 14, color: COLORS.textSecondary },
  detailInfoValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  callBtn: { backgroundColor: COLORS.success + '15', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: COLORS.success + '30' },
  callBtnText: { color: COLORS.success, fontWeight: '700', fontSize: 15 },
  closeBtn: { padding: 14, alignItems: 'center', marginTop: 10 },
  closeBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 15 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 12 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 50 },
  emptyText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600', marginTop: 10, textAlign: 'center' },
});
