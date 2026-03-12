import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Image, RefreshControl, Modal, Alert, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../config/constants';
import { bazarAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import AdBanner from '../components/AdBanner';

const TABS = ['bazars', 'chat', 'search', 'register', 'president'];

export default function BazarScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Main state
  const [activeTab, setActiveTab] = useState('bazars');
  const [bazars, setBazars] = useState([]);
  const [selectedBazar, setSelectedBazar] = useState(null);
  const [traders, setTraders] = useState([]);
  const [myTrader, setMyTrader] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatBazar, setChatBazar] = useState(null);
  const [chatPage, setChatPage] = useState(1);
  const [chatHasMore, setChatHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const chatListRef = useRef(null);
  const pollRef = useRef(null);

  // Poll creation
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Registration form
  const [regForm, setRegForm] = useState({ fullName: '', shopName: '', phone: '', bazarId: '' });
  const [regPhoto, setRegPhoto] = useState(null);
  const [registering, setRegistering] = useState(false);

  // President state
  const [presidentToken, setPresidentToken] = useState(null);
  const [presidentData, setPresidentData] = useState(null);
  const [presidentEmail, setPresidentEmail] = useState('');
  const [presidentPassword, setPresidentPassword] = useState('');
  const [pendingTraders, setPendingTraders] = useState([]);
  const [presidentLoading, setPresidentLoading] = useState(false);

  // Trader detail modal
  const [detailTrader, setDetailTrader] = useState(null);

  useEffect(() => {
    loadBazars();
    loadMyStatus();
    loadPresidentSession();
  }, []);

  useEffect(() => {
    if (chatBazar) {
      loadChatMessages(1);
      // Poll for new messages every 5s
      pollRef.current = setInterval(() => loadChatMessages(1, true), 5000);
      return () => clearInterval(pollRef.current);
    }
  }, [chatBazar]);

  const loadPresidentSession = async () => {
    const token = await AsyncStorage.getItem('presidentToken');
    if (token) {
      setPresidentToken(token);
      loadPresidentDashboard(token);
    }
  };

  const loadBazars = async () => {
    try {
      setLoading(true);
      const res = await bazarAPI.getBazars();
      setBazars(res.data.bazars || []);
    } catch (e) {
      console.error('Load bazars error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMyStatus = async () => {
    try {
      const res = await bazarAPI.getMyStatus();
      setMyTrader(res.data.trader);
    } catch (e) {
      console.error('My status error:', e);
    }
  };

  const loadTraders = async (bazarId) => {
    try {
      setLoading(true);
      const res = await bazarAPI.getTraders(bazarId);
      setTraders(res.data.traders || []);
    } catch (e) {
      console.error('Load traders error:', e);
    } finally {
      setLoading(false);
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
      Alert.alert('Error', e.response?.data?.error || 'Failed to send message');
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
      Alert.alert('Error', e.response?.data?.error || 'Failed to create poll');
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
        } catch (e) {
          Alert.alert('Error', 'Failed to delete');
        }
      }},
    ]);
  };

  // ====== SEARCH ======
  const searchTraders = async () => {
    if (!searchQuery.trim()) return;
    try {
      setLoading(true);
      const res = await bazarAPI.searchTraders(searchQuery.trim());
      setSearchResults(res.data.traders || []);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
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
      Alert.alert('Required', 'Please fill all fields and select a bazar');
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
      Alert.alert('Success', res.data.message || 'Registration submitted!');
      setMyTrader(res.data.trader);
      setActiveTab('bazars');
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
      loadPendingTraders(token);
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
    await AsyncStorage.removeItem('presidentToken');
  };

  const loadPresidentDashboard = async (token) => {
    try {
      const res = await bazarAPI.presidentDashboard(token);
      setPresidentData(res.data.president);
      loadPendingTraders(token);
    } catch (e) {
      // Token expired
      if (e.response?.status === 403) presidentLogout();
    }
  };

  const loadPendingTraders = async (token) => {
    try {
      const res = await bazarAPI.getPending(token);
      setPendingTraders(res.data.traders || []);
    } catch (e) {
      console.error('Load pending error:', e);
    }
  };

  const approveTrader = async (id) => {
    try {
      await bazarAPI.approveTrader(id, presidentToken);
      Alert.alert('Done', 'Trader approved');
      loadPendingTraders(presidentToken);
    } catch (e) {
      Alert.alert('Error', 'Failed to approve');
    }
  };

  const rejectTrader = async (id) => {
    try {
      await bazarAPI.rejectTrader(id, presidentToken);
      Alert.alert('Done', 'Trader rejected');
      loadPendingTraders(presidentToken);
    } catch (e) {
      Alert.alert('Error', 'Failed to reject');
    }
  };

  const deleteTrader = async (id) => {
    Alert.alert('Delete', 'Remove this trader permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await bazarAPI.deleteTrader(id, presidentToken);
          loadPendingTraders(presidentToken);
        } catch (e) {
          Alert.alert('Error', 'Failed to delete');
        }
      }},
    ]);
  };

  // ====== RENDER HELPERS ======
  const renderTraderCard = (item) => (
    <TouchableOpacity key={item.id} style={styles.traderCard} onPress={() => setDetailTrader(item)} activeOpacity={0.7}>
      {item.photoUrl ? (
        <Image source={{ uri: item.photoUrl }} style={styles.traderPhoto} />
      ) : (
        <View style={[styles.traderPhoto, styles.traderPhotoPlaceholder]}>
          <Text style={{ fontSize: 22 }}>🏪</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.traderName}>{item.fullName}</Text>
        <Text style={styles.traderShop}>{item.shopName}</Text>
        <Text style={styles.traderBazar}>{item.bazar?.name}</Text>
      </View>
      <View style={[styles.statusBadge, item.status === 'APPROVED' && styles.statusApproved, item.status === 'PENDING' && styles.statusPending, item.status === 'REJECTED' && styles.statusRejected]}>
        <Text style={styles.statusText}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderChatMessage = ({ item }) => {
    const isOwn = item.trader?.userId === user?.id || item.traderId === myTrader?.id;
    const isPoll = !!item.pollQuestion;

    if (isPoll) {
      const votes = item.pollVotes || [];
      const myVote = votes.find(v => v.startsWith(myTrader?.id + ':'));
      const totalVotes = votes.length;
      return (
        <View style={[styles.chatBubble, styles.pollBubble]}>
          <Text style={styles.pollSender}>{item.trader?.fullName} - {item.trader?.shopName}</Text>
          <Text style={styles.pollQuestion}>{item.pollQuestion}</Text>
          {(item.pollOptions || []).map((opt, idx) => {
            const optVotes = votes.filter(v => v.endsWith(':' + idx)).length;
            const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
            const voted = myVote?.endsWith(':' + idx);
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.pollOption, voted && styles.pollOptionVoted]}
                onPress={() => !myVote && votePoll(item.id, idx)}
                disabled={!!myVote}
              >
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
      <TouchableOpacity
        style={[styles.chatBubble, isOwn ? styles.chatBubbleOwn : styles.chatBubbleOther]}
        onLongPress={() => isOwn && deleteChatMsg(item.id)}
        activeOpacity={0.8}
      >
        {!isOwn && <Text style={styles.chatSender}>{item.trader?.fullName}</Text>}
        {item.images?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {item.images.map((img, i) => (
              <Image key={i} source={{ uri: img }} style={styles.chatImage} />
            ))}
          </ScrollView>
        )}
        {item.text && <Text style={[styles.chatText, isOwn && { color: '#fff' }]}>{item.text}</Text>}
        <Text style={[styles.chatTime, isOwn && { color: 'rgba(255,255,255,0.6)' }]}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
        </Text>
      </TouchableOpacity>
    );
  };

  // ====== TAB CONTENT ======
  const renderBazarsTab = () => (
    <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadBazars().then(() => setRefreshing(false)); }} colors={[COLORS.primary]} />}>
      <AdBanner />
      {/* My Status */}
      {myTrader && (
        <View style={styles.myStatusCard}>
          <Text style={styles.myStatusTitle}>Your Trader Profile</Text>
          <View style={styles.myStatusRow}>
            <Text style={styles.myStatusLabel}>Status:</Text>
            <View style={[styles.statusBadge, myTrader.status === 'APPROVED' && styles.statusApproved, myTrader.status === 'PENDING' && styles.statusPending, myTrader.status === 'REJECTED' && styles.statusRejected]}>
              <Text style={styles.statusText}>{myTrader.status}</Text>
            </View>
          </View>
          <Text style={styles.myStatusInfo}>{myTrader.shopName} - {myTrader.bazar?.name}</Text>
          {myTrader.status === 'PENDING' && <Text style={styles.pendingNote}>Your registration is awaiting approval from admin/president.</Text>}
          {myTrader.status === 'APPROVED' && <Text style={styles.approvedNote}>You can now participate in bazar chat!</Text>}
        </View>
      )}

      {/* Bazar List */}
      <Text style={styles.sectionTitle}>Shahkot Bazars</Text>
      {loading && bazars.length === 0 && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 30 }} />}
      {bazars.map(bazar => (
        <TouchableOpacity key={bazar.id} style={styles.bazarCard} onPress={() => { setSelectedBazar(bazar); loadTraders(bazar.id); }}>
          <View style={styles.bazarIcon}><Text style={{ fontSize: 28 }}>🏪</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bazarName}>{bazar.name}</Text>
            <Text style={styles.bazarCount}>{bazar._count?.traders || 0} verified traders</Text>
          </View>
          <Text style={{ fontSize: 18, color: COLORS.textLight }}>›</Text>
        </TouchableOpacity>
      ))}

      {/* Registration CTA */}
      {!myTrader && user && (
        <TouchableOpacity style={styles.registerCta} onPress={() => setActiveTab('register')}>
          <Text style={styles.registerCtaIcon}>📝</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.registerCtaTitle}>Register as Trader</Text>
            <Text style={styles.registerCtaSub}>Join your bazar community and connect with other traders</Text>
          </View>
        </TouchableOpacity>
      )}
      <View style={{ height: 20 }} />
    </ScrollView>
  );

  const renderChatTab = () => {
    if (!chatBazar) {
      return (
        <ScrollView style={{ flex: 1, padding: 16 }}>
          <AdBanner />
          <Text style={styles.sectionTitle}>Select Bazar for Chat</Text>
          {bazars.map(bazar => (
            <TouchableOpacity key={bazar.id} style={styles.bazarCard} onPress={() => setChatBazar(bazar)}>
              <View style={styles.bazarIcon}><Text style={{ fontSize: 28 }}>💬</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bazarName}>{bazar.name}</Text>
                <Text style={styles.bazarCount}>Open group chat</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      );
    }

    const canChat = myTrader?.status === 'APPROVED';

    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => { setChatBazar(null); setMessages([]); clearInterval(pollRef.current); }}>
            <Text style={styles.chatBack}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.chatHeaderTitle}>{chatBazar.name}</Text>
        </View>

        {/* Messages */}
        <FlatList
          ref={chatListRef}
          data={messages}
          renderItem={renderChatMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 10, paddingBottom: 4 }}
          onEndReached={() => { if (chatHasMore) loadChatMessages(chatPage + 1); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyIcon}>💬</Text><Text style={styles.emptyText}>No messages yet</Text></View>}
        />

        {/* Image preview */}
        {selectedImages.length > 0 && (
          <ScrollView horizontal style={styles.imagePreviewRow}>
            {selectedImages.map((uri, i) => (
              <View key={i} style={styles.previewItem}>
                <Image source={{ uri }} style={styles.previewImage} />
                <TouchableOpacity style={styles.previewRemove} onPress={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Input */}
        {canChat ? (
          <View style={styles.chatInputRow}>
            <TouchableOpacity onPress={pickChatImages} style={styles.chatIconBtn}>
              <Text style={{ fontSize: 20 }}>📷</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPollModal(true)} style={styles.chatIconBtn}>
              <Text style={{ fontSize: 20 }}>📊</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.chatInput}
              value={chatText}
              onChangeText={setChatText}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.textLight}
              multiline
            />
            <TouchableOpacity onPress={sendChatMessage} disabled={sending} style={[styles.chatSendBtn, sending && { opacity: 0.5 }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{sending ? '...' : '➤'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.chatDisabled}>
            <Text style={styles.chatDisabledText}>
              {myTrader ? 'Your registration is pending approval' : 'Register as a trader to join the chat'}
            </Text>
          </View>
        )}

        {/* Poll Modal */}
        <Modal visible={showPollModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create Poll</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Poll question..."
                value={pollQuestion}
                onChangeText={setPollQuestion}
                placeholderTextColor={COLORS.textLight}
              />
              {pollOptions.map((opt, i) => (
                <TextInput
                  key={i}
                  style={[styles.formInput, { marginTop: 8 }]}
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChangeText={text => { const copy = [...pollOptions]; copy[i] = text; setPollOptions(copy); }}
                  placeholderTextColor={COLORS.textLight}
                />
              ))}
              <TouchableOpacity onPress={() => setPollOptions(prev => [...prev, ''])} style={styles.addOptionBtn}>
                <Text style={styles.addOptionText}>+ Add Option</Text>
              </TouchableOpacity>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPollModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={createPoll} disabled={sending}>
                  <Text style={styles.saveBtnText}>{sending ? 'Creating...' : 'Create Poll'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  };

  const renderSearchTab = () => (
    <ScrollView style={{ flex: 1 }}>
      <AdBanner />
      <View style={{ padding: 16 }}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search traders by name or shop..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={searchTraders}
            returnKeyType="search"
            placeholderTextColor={COLORS.textLight}
          />
          <TouchableOpacity style={styles.searchButton} onPress={searchTraders}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>
        {loading && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />}
        {searchResults.map(item => renderTraderCard(item))}
        {searchQuery && !loading && searchResults.length === 0 && (
          <View style={styles.empty}><Text style={styles.emptyIcon}>🔍</Text><Text style={styles.emptyText}>No traders found</Text></View>
        )}
      </View>
    </ScrollView>
  );

  const renderRegisterTab = () => {
    if (myTrader) {
      return (
        <ScrollView style={{ flex: 1, padding: 16 }}>
          <AdBanner />
          <View style={styles.myStatusCard}>
            <Text style={styles.myStatusTitle}>Your Registration</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
              {myTrader.photoUrl ? <Image source={{ uri: myTrader.photoUrl }} style={styles.regAvatar} /> : <View style={[styles.regAvatar, styles.traderPhotoPlaceholder]}><Text style={{ fontSize: 28 }}>🏪</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.traderName}>{myTrader.fullName}</Text>
                <Text style={styles.traderShop}>{myTrader.shopName}</Text>
                <Text style={styles.traderBazar}>{myTrader.bazar?.name}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, myTrader.status === 'APPROVED' && styles.statusApproved, myTrader.status === 'PENDING' && styles.statusPending, myTrader.status === 'REJECTED' && styles.statusRejected, { alignSelf: 'flex-start', marginTop: 10 }]}>
              <Text style={styles.statusText}>{myTrader.status}</Text>
            </View>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
        <AdBanner />
        <Text style={styles.sectionTitle}>Register as Trader</Text>
        <Text style={styles.sectionSub}>Fill in your details to join your bazar community</Text>

        <Text style={styles.inputLabel}>Full Name *</Text>
        <TextInput style={styles.formInput} value={regForm.fullName} onChangeText={v => setRegForm({ ...regForm, fullName: v })} placeholder="Your full name" placeholderTextColor={COLORS.textLight} />

        <Text style={styles.inputLabel}>Shop Name *</Text>
        <TextInput style={styles.formInput} value={regForm.shopName} onChangeText={v => setRegForm({ ...regForm, shopName: v })} placeholder="Your shop name" placeholderTextColor={COLORS.textLight} />

        <Text style={styles.inputLabel}>Phone *</Text>
        <TextInput style={styles.formInput} value={regForm.phone} onChangeText={v => setRegForm({ ...regForm, phone: v })} placeholder="03xx-xxxxxxx" keyboardType="phone-pad" placeholderTextColor={COLORS.textLight} />

        <Text style={styles.inputLabel}>Select Bazar *</Text>
        <View style={styles.bazarPicker}>
          {bazars.map(b => (
            <TouchableOpacity key={b.id} style={[styles.bazarPickerItem, regForm.bazarId === b.id && styles.bazarPickerSelected]} onPress={() => setRegForm({ ...regForm, bazarId: b.id })}>
              <Text style={[styles.bazarPickerText, regForm.bazarId === b.id && { color: COLORS.white }]}>{b.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>Photo (Optional)</Text>
        <TouchableOpacity style={styles.photoPicker} onPress={pickRegPhoto}>
          {regPhoto ? <Image source={{ uri: regPhoto }} style={styles.photoPreview} /> : <Text style={styles.photoPickerText}>📷 Tap to add photo</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.submitBtn, registering && { opacity: 0.5 }]} onPress={submitRegistration} disabled={registering}>
          <Text style={styles.submitBtnText}>{registering ? 'Submitting...' : 'Submit Registration'}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  const renderPresidentTab = () => {
    if (!presidentToken) {
      return (
        <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
          <AdBanner />
          <Text style={styles.sectionTitle}>President Login</Text>
          <Text style={styles.sectionSub}>Login to manage trader registrations</Text>
          <TextInput style={[styles.formInput, { marginTop: 16 }]} placeholder="Email" value={presidentEmail} onChangeText={setPresidentEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={COLORS.textLight} />
          <TextInput style={[styles.formInput, { marginTop: 10 }]} placeholder="Password" value={presidentPassword} onChangeText={setPresidentPassword} secureTextEntry placeholderTextColor={COLORS.textLight} />
          <TouchableOpacity style={[styles.submitBtn, presidentLoading && { opacity: 0.5 }]} onPress={presidentLogin} disabled={presidentLoading}>
            <Text style={styles.submitBtnText}>{presidentLoading ? 'Logging in...' : 'Login'}</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return (
      <ScrollView style={{ flex: 1, padding: 16 }} refreshControl={<RefreshControl refreshing={presidentLoading} onRefresh={() => loadPresidentDashboard(presidentToken)} colors={[COLORS.primary]} />}>
        <View style={styles.presidentHeader}>
          <View>
            <Text style={styles.presidentName}>{presidentData?.name || 'President'}</Text>
            <Text style={styles.presidentEmail}>{presidentData?.email}</Text>
          </View>
          <TouchableOpacity onPress={presidentLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Pending Approvals ({pendingTraders.length})</Text>
        {pendingTraders.length === 0 && <Text style={styles.pendingNote}>No pending registrations</Text>}
        {pendingTraders.map(trader => (
          <View key={trader.id} style={styles.pendingCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              {trader.photoUrl ? <Image source={{ uri: trader.photoUrl }} style={styles.pendingPhoto} /> : <View style={[styles.pendingPhoto, styles.traderPhotoPlaceholder]}><Text>🏪</Text></View>}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.traderName}>{trader.fullName}</Text>
                <Text style={styles.traderShop}>{trader.shopName}</Text>
                <Text style={styles.traderBazar}>{trader.bazar?.name}</Text>
                <Text style={{ fontSize: 12, color: COLORS.textLight }}>📞 {trader.phone}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.approveBtn} onPress={() => approveTrader(trader.id)}>
                <Text style={styles.approveBtnText}>✓ Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectTrader(trader.id)}>
                <Text style={styles.rejectBtnText}>✗ Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteTrader(trader.id)}>
                <Text style={styles.deleteBtnText}>🗑</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>
    );
  };

  // ====== BAZAR DETAIL MODAL (traders list) ======
  const renderBazarDetail = () => (
    <Modal visible={!!selectedBazar} animationType="slide" onRequestClose={() => setSelectedBazar(null)}>
      <View style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setSelectedBazar(null)}>
            <Text style={styles.chatBack}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.detailTitle}>{selectedBazar?.name}</Text>
          <TouchableOpacity onPress={() => { setChatBazar(selectedBazar); setSelectedBazar(null); setActiveTab('chat'); }}>
            <Text style={styles.joinChatBtn}>💬 Chat</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={traders}
          renderItem={({ item }) => renderTraderCard(item)}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadTraders(selectedBazar.id)} colors={[COLORS.primary]} />}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={!loading && <View style={styles.empty}><Text style={styles.emptyIcon}>🏪</Text><Text style={styles.emptyText}>No traders registered yet</Text></View>}
        />
      </View>
    </Modal>
  );

  // ====== TRADER DETAIL MODAL ======
  const renderTraderDetail = () => (
    <Modal visible={!!detailTrader} transparent animationType="slide" onRequestClose={() => setDetailTrader(null)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '70%' }]}>
          <ScrollView>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              {detailTrader?.photoUrl ? <Image source={{ uri: detailTrader.photoUrl }} style={styles.detailPhoto} /> : <View style={[styles.detailPhoto, styles.traderPhotoPlaceholder]}><Text style={{ fontSize: 40 }}>🏪</Text></View>}
              <Text style={[styles.traderName, { fontSize: 20, marginTop: 10 }]}>{detailTrader?.fullName}</Text>
              <Text style={styles.traderShop}>{detailTrader?.shopName}</Text>
            </View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Bazar</Text><Text style={styles.detailValue}>{detailTrader?.bazar?.name}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Phone</Text><Text style={styles.detailValue}>{detailTrader?.phone}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Status</Text><Text style={[styles.detailValue, { color: detailTrader?.status === 'APPROVED' ? COLORS.success : COLORS.warning }]}>{detailTrader?.status}</Text></View>
            <TouchableOpacity style={styles.callTraderBtn} onPress={() => Linking.openURL(`tel:${detailTrader?.phone}`)}>
              <Text style={styles.callTraderText}>📞 Call Trader</Text>
            </TouchableOpacity>
          </ScrollView>
          <TouchableOpacity onPress={() => setDetailTrader(null)} style={styles.closeDetailBtn}>
            <Text style={styles.closeDetailText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shahkot Bazar</Text>
        <Text style={styles.headerSub}>Trader Community & Market</Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { key: 'bazars', label: '🏪 Bazars' },
          { key: 'chat', label: '💬 Chat' },
          { key: 'search', label: '🔍 Search' },
          { key: 'register', label: '📝 Register' },
          { key: 'president', label: '👔 President' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'bazars' && renderBazarsTab()}
      {activeTab === 'chat' && renderChatTab()}
      {activeTab === 'search' && renderSearchTab()}
      {activeTab === 'register' && renderRegisterTab()}
      {activeTab === 'president' && renderPresidentTab()}

      {/* Modals */}
      {renderBazarDetail()}
      {renderTraderDetail()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, padding: 16, paddingTop: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Tab Bar
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary },

  // Section
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 8, paddingHorizontal: 16 },
  sectionSub: { fontSize: 13, color: COLORS.textSecondary, paddingHorizontal: 16, marginBottom: 12 },

  // Bazar Card
  bazarCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 12, elevation: 1 },
  bazarIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primary + '12', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  bazarName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  bazarCount: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  // Trader Card
  traderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, padding: 12, borderRadius: 12, marginBottom: 8, elevation: 1 },
  traderPhoto: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  traderPhotoPlaceholder: { backgroundColor: COLORS.gray, justifyContent: 'center', alignItems: 'center' },
  traderName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  traderShop: { fontSize: 13, color: COLORS.textSecondary },
  traderBazar: { fontSize: 12, color: COLORS.primary, marginTop: 2 },

  // Status Badge
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusApproved: { backgroundColor: COLORS.success + '20' },
  statusPending: { backgroundColor: COLORS.warning + '20' },
  statusRejected: { backgroundColor: COLORS.error + '20' },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  // My Status
  myStatusCard: { backgroundColor: COLORS.surface, margin: 16, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: COLORS.primary + '30', elevation: 1 },
  myStatusTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  myStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  myStatusLabel: { fontSize: 13, color: COLORS.textSecondary },
  myStatusInfo: { fontSize: 14, color: COLORS.text, marginTop: 6 },
  pendingNote: { fontSize: 12, color: COLORS.warning, marginTop: 6, fontStyle: 'italic' },
  approvedNote: { fontSize: 12, color: COLORS.success, marginTop: 6 },

  // Register CTA
  registerCta: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '10', marginHorizontal: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary + '30', marginTop: 8 },
  registerCtaIcon: { fontSize: 28, marginRight: 12 },
  registerCtaTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  registerCtaSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  // Chat
  chatHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, padding: 12, gap: 12 },
  chatBack: { fontSize: 18, color: COLORS.white, fontWeight: '700' },
  chatHeaderTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white, flex: 1 },
  chatBubble: { maxWidth: '80%', padding: 10, borderRadius: 12, marginBottom: 6 },
  chatBubbleOwn: { backgroundColor: COLORS.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  chatBubbleOther: { backgroundColor: COLORS.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  chatSender: { fontSize: 11, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
  chatText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  chatTime: { fontSize: 10, color: COLORS.textLight, marginTop: 4, textAlign: 'right' },
  chatImage: { width: 160, height: 120, borderRadius: 8, marginRight: 6 },
  chatInputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  chatIconBtn: { padding: 8 },
  chatInput: { flex: 1, backgroundColor: COLORS.background, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: COLORS.text, maxHeight: 100 },
  chatSendBtn: { backgroundColor: COLORS.primary, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  chatDisabled: { padding: 16, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center' },
  chatDisabledText: { fontSize: 13, color: COLORS.textLight, fontStyle: 'italic' },

  // Poll
  pollBubble: { backgroundColor: COLORS.surface, alignSelf: 'stretch', maxWidth: '100%', borderWidth: 1, borderColor: COLORS.primary + '30' },
  pollSender: { fontSize: 11, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  pollQuestion: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  pollOption: { backgroundColor: COLORS.background, padding: 12, borderRadius: 8, marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pollOptionVoted: { backgroundColor: COLORS.primary + '15', borderWidth: 1, borderColor: COLORS.primary + '30' },
  pollOptionText: { fontSize: 14, color: COLORS.text },
  pollPct: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  pollTotal: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },

  // Image preview
  imagePreviewRow: { padding: 8, backgroundColor: COLORS.surface },
  previewItem: { position: 'relative', marginRight: 8 },
  previewImage: { width: 60, height: 60, borderRadius: 8 },
  previewRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: COLORS.error, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  // Search
  searchBar: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  searchInput: { flex: 1, padding: 14, fontSize: 15, color: COLORS.text },
  searchButton: { backgroundColor: COLORS.primary, paddingHorizontal: 16, justifyContent: 'center' },
  searchBtnText: { color: COLORS.white, fontWeight: '600' },

  // Registration
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 12 },
  formInput: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  bazarPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  bazarPickerItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  bazarPickerSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  bazarPickerText: { fontSize: 13, color: COLORS.text },
  photoPicker: { width: 100, height: 100, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  photoPreview: { width: 100, height: 100, borderRadius: 12 },
  photoPickerText: { fontSize: 12, color: COLORS.textLight, textAlign: 'center' },
  regAvatar: { width: 60, height: 60, borderRadius: 30 },
  submitBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },

  // President
  presidentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, padding: 16, borderRadius: 12, marginBottom: 12 },
  presidentName: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  presidentEmail: { fontSize: 12, color: COLORS.textSecondary },
  logoutBtn: { backgroundColor: COLORS.error + '15', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  logoutText: { color: COLORS.error, fontWeight: '600', fontSize: 13 },
  pendingCard: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 12, marginHorizontal: 16, marginBottom: 10, elevation: 1 },
  pendingPhoto: { width: 45, height: 45, borderRadius: 22 },
  approveBtn: { flex: 1, backgroundColor: COLORS.success + '15', padding: 10, borderRadius: 8, alignItems: 'center' },
  approveBtnText: { color: COLORS.success, fontWeight: '700', fontSize: 13 },
  rejectBtn: { flex: 1, backgroundColor: COLORS.error + '15', padding: 10, borderRadius: 8, alignItems: 'center' },
  rejectBtnText: { color: COLORS.error, fontWeight: '700', fontSize: 13 },
  deleteBtn: { backgroundColor: COLORS.error + '10', padding: 10, borderRadius: 8 },
  deleteBtnText: { fontSize: 16 },

  // Detail modal
  detailHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, padding: 12, gap: 12 },
  detailTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white, flex: 1 },
  joinChatBtn: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
  detailPhoto: { width: 100, height: 100, borderRadius: 50 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailLabel: { fontSize: 14, color: COLORS.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  callTraderBtn: { backgroundColor: COLORS.success + '15', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: COLORS.success + '30' },
  callTraderText: { color: COLORS.success, fontWeight: '700', fontSize: 15 },
  closeDetailBtn: { padding: 14, alignItems: 'center', marginTop: 10 },
  closeDetailText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 15 },

  // Poll modal
  addOptionBtn: { padding: 10, alignItems: 'center', marginTop: 8 },
  addOptionText: { color: COLORS.primary, fontWeight: '600' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.background },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 15 },
  saveBtn: { flex: 2, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.primary },
  saveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '600' },
});
