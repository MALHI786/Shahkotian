import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/constants';
import { adminAPI, newsAPI, listingsAPI, reportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');
const TABS = ['Overview', 'Users', 'Rishta', 'Reports', 'News', 'Storage'];

export default function AdminDashboardScreen({ navigation }) {
  const { loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [rishtaProfiles, setRishtaProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allNews, setAllNews] = useState([]);
  const [allListings, setAllListings] = useState([]);
  const [dbStatus, setDbStatus] = useState([]);
  const [storageInfo, setStorageInfo] = useState(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState({});
  const [reports, setReports] = useState([]);
  const [reportFilter, setReportFilter] = useState('PENDING');

  // Wait for auth token to load before fetching
  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [activeTab, reportFilter, authLoading]);

  // Reset loaded state when pull-to-refresh triggers
  useEffect(() => {
    if (refreshing) {
      setDataLoaded({});
    }
  }, [refreshing]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'Overview') {
        const res = await adminAPI.getDashboard();
        console.log('Dashboard data:', res.data);
        setStats(res.data);
      } else if (activeTab === 'Users') {
        const res = await adminAPI.getUsers({ search: searchQuery || undefined });
        console.log('Users data:', res.data);
        setUsers(res.data.users || []);
      } else if (activeTab === 'Rishta') {
        const res = await adminAPI.getPendingRishta();
        setRishtaProfiles(res.data.profiles || []);
      } else if (activeTab === 'News') {
        const res = await newsAPI.getAll({});
        setAllNews(res.data.news || []);
      } else if (activeTab === 'Reports') {
        const res = await reportsAPI.getAll({ status: reportFilter });
        setReports(res.data.reports || []);
      } else if (activeTab === 'Storage') {
        try {
          const [dbRes, storRes] = await Promise.all([
            adminAPI.getDbStatus(),
            adminAPI.getStorage(),
          ]);
          console.log('DB Status:', dbRes.data);
          console.log('Storage:', storRes.data);
          setDbStatus(Array.isArray(dbRes.data?.databases) ? dbRes.data.databases : []);
          setStorageInfo(storRes.data || null);
        } catch (storageError) {
          console.log('Storage load error:', storageError);
          // Try to load storage info even if db status fails
          try {
            const storRes = await adminAPI.getStorage();
            setStorageInfo(storRes.data || null);
          } catch (e) {
            console.log('Could not load storage info:', e);
          }
        }
      }
    } catch (err) {
      console.log('Admin data load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleUser = async (id) => {
    try {
      const res = await adminAPI.toggleUser(id);
      Alert.alert('Done', res.data.message);
      loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to update user.');
    }
  };

  const handleRishtaAction = async (id, action) => {
    const verb = action === 'approve' ? 'Approve' : 'Reject';
    Alert.alert(verb, `${verb} this rishta profile?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: verb,
        style: action === 'reject' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            if (action === 'approve') {
              await adminAPI.approveRishta(id);
            } else {
              await adminAPI.rejectRishta(id, 'Profile does not meet guidelines');
            }
            Alert.alert('Done', `Rishta profile ${verb.toLowerCase()}d`);
            loadData();
          } catch (err) {
            Alert.alert('Error', 'Action failed');
          }
        },
      },
    ]);
  };

  const handleDeleteListing = (id) => {
    Alert.alert('Delete Listing', 'Remove this listing?', [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await adminAPI.deleteListing(id);
            setAllListings(prev => prev.filter(l => l.id !== id));
          } catch (e) { Alert.alert('Error', 'Failed to delete.'); }
        },
      },
    ]);
  };

  const handleDeleteNews = (id) => {
    Alert.alert('Delete Article', 'Remove this article?', [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await newsAPI.delete(id);
            setAllNews(prev => prev.filter(n => n.id !== id));
          } catch (e) { Alert.alert('Error', 'Failed to delete.'); }
        },
      },
    ]);
  };

  const handleDeletePost = (id) => {
    Alert.alert('Delete Post', 'Remove this post?', [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await adminAPI.deletePost(id);
            Alert.alert('Deleted', 'Post removed.');
          } catch (e) { Alert.alert('Error', 'Failed.'); }
        },
      },
    ]);
  };

  const handleCleanup = (target, label, olderThanDays = 30) => {
    Alert.alert(
      'Confirm Cleanup',
      `Delete all ${label} older than ${olderThanDays} days?\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              setCleanupLoading(true);
              const res = await adminAPI.cleanup(target, olderThanDays);
              Alert.alert('Done', `Deleted ${res.data.deletedCount || 0} records.`);
              loadData();
            } catch (e) {
              Alert.alert('Error', 'Cleanup failed.');
            } finally {
              setCleanupLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderOverview = () => (
    <ScrollView style={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>
      {/* Welcome Card */}
      <View style={styles.welcomeCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeTitle}>Welcome, Admin</Text>
          <Text style={styles.welcomeSub}>Here's your app at a glance</Text>
        </View>
        <Ionicons name="shield-checkmark" size={40} color={COLORS.white} style={{ opacity: 0.7 }} />
      </View>

      <Text style={styles.sectionTitle}>App Statistics</Text>
      <View style={styles.statsGrid}>
        <StatCard icon="people" label="Users" value={stats?.stats?.totalUsers ?? 0} color="#4CAF50" />
        <StatCard icon="document-text" label="Posts" value={stats?.stats?.totalPosts ?? 0} color="#2196F3" />
        <StatCard icon="cart" label="Listings" value={stats?.stats?.totalListings ?? 0} color="#FF9800" />
        <StatCard icon="heart" label="Pending Rishta" value={stats?.stats?.pendingRishta ?? 0} color="#E91E63" />
        <StatCard icon="trophy" label="Tournaments" value={stats?.stats?.totalTournaments ?? 0} color="#9C27B0" />
        <StatCard icon="newspaper" label="News" value={stats?.stats?.totalNews ?? 0} color="#00BCD4" />
        <StatCard icon="storefront" label="Shops" value={stats?.stats?.totalShops ?? 0} color="#795548" />
        <StatCard icon="business" label="Offices" value={stats?.stats?.totalOffices ?? 0} color="#607D8B" />
        <StatCard icon="medkit" label="Doctors" value={stats?.stats?.totalDoctors ?? 0} color="#E11D48" />
      </View>

      {stats?.stats?.pendingRishta > 0 && (
        <TouchableOpacity style={styles.alertCard} onPress={() => setActiveTab('Rishta')}>
          <Ionicons name="warning" size={22} color="#E65100" />
          <Text style={styles.alertText}>{stats.stats.pendingRishta} pending rishta approvals</Text>
          <Ionicons name="chevron-forward" size={18} color="#E65100" />
        </TouchableOpacity>
      )}

      {/* Quick Actions */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('News & Articles')}>
          <Ionicons name="newspaper-outline" size={28} color={COLORS.primary} />
          <Text style={styles.quickBtnText}>Publish News</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Tournaments')}>
          <Ionicons name="trophy-outline" size={28} color={COLORS.primary} />
          <Text style={styles.quickBtnText}>Tournaments</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('GovtOffices')}>
          <Ionicons name="business-outline" size={28} color={COLORS.primary} />
          <Text style={styles.quickBtnText}>Govt Offices</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Doctors')}>
          <Ionicons name="medkit-outline" size={28} color={COLORS.primary} />
          <Text style={styles.quickBtnText}>Doctors</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderUsers = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users by name, phone, email..."
          placeholderTextColor={COLORS.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={loadData}
          returnKeyType="search"
        />
      </View>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{item.name[0]}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.name}</Text>
              <Text style={styles.userPhone}>{item.phone} {item.email ? `• ${item.email}` : ''}</Text>
              <Text style={styles.userStats}>
                {item._count?.posts || 0} posts • {item._count?.listings || 0} listings
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <View style={[styles.badge, { backgroundColor: item.role === 'ADMIN' ? COLORS.error : COLORS.primary }]}>
                <Text style={styles.badgeText}>{item.role}</Text>
              </View>
              {item.role !== 'ADMIN' && (
                <TouchableOpacity
                  style={[styles.toggleBtn, { backgroundColor: item.isActive ? '#F44336' : '#4CAF50' }]}
                  onPress={() => handleToggleUser(item.id)}
                >
                  <Text style={styles.toggleBtnText}>{item.isActive ? 'Disable' : 'Enable'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="👥" text="No users found" />}
      />
    </View>
  );

  const renderRishta = () => (
    <FlatList
      data={rishtaProfiles}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <View style={styles.rishtaCard}>
          <View style={styles.rishtaHeader}>
            <Text style={styles.rishtaName}>{item.user?.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: '#FFF3E0' }]}>
              <Text style={{ color: '#E65100', fontSize: 12 }}>PENDING</Text>
            </View>
          </View>
          <Text style={styles.rishtaDetail}>Age: {item.age} | Gender: {item.gender}</Text>
          <Text style={styles.rishtaDetail}>Education: {item.education}</Text>
          <Text style={styles.rishtaDetail}>Occupation: {item.occupation}</Text>
          <Text style={styles.rishtaDetail}>Phone: {item.user?.phone}</Text>
          
          <Text style={styles.cnicLabel}>📋 CNIC Verification Images</Text>
          <View style={styles.cnicImagesRow}>
            {item.cnicFront && (
              <View style={styles.cnicImageContainer}>
                <Text style={styles.cnicImageLabel}>Front</Text>
                <Image source={{ uri: item.cnicFront }} style={styles.cnicImage} resizeMode="cover" />
              </View>
            )}
            {item.cnicBack && (
              <View style={styles.cnicImageContainer}>
                <Text style={styles.cnicImageLabel}>Back</Text>
                <Image source={{ uri: item.cnicBack }} style={styles.cnicImage} resizeMode="cover" />
              </View>
            )}
          </View>
          
          <View style={styles.rishtaActions}>
            <TouchableOpacity
              style={[styles.rishtaBtn, { backgroundColor: '#4CAF50' }]}
              onPress={() => handleRishtaAction(item.id, 'approve')}
            >
              <Text style={styles.rishtaBtnText}>✅ Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rishtaBtn, { backgroundColor: COLORS.error }]}
              onPress={() => handleRishtaAction(item.id, 'reject')}
            >
              <Text style={styles.rishtaBtnText}>❌ Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      ListEmptyComponent={<EmptyState icon="✅" text="No pending approvals" />}
    />
  );

  const renderContent = () => (
    <FlatList
      data={allListings}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <Text style={styles.sectionTitle}>Marketplace Listings ({allListings.length})</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.contentCard}>
          <View style={{ flexDirection: 'row', flex: 1 }}>
            {item.images?.[0] && (
              <Image source={{ uri: item.images[0] }} style={styles.contentThumb} />
            )}
            <View style={{ flex: 1, marginLeft: item.images?.[0] ? 12 : 0 }}>
              <Text style={styles.contentTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.contentSub}>Rs. {item.price} • {item.category}</Text>
              <Text style={styles.contentSub}>By: {item.user?.name || 'Unknown'}</Text>
              {item.isSold && <Text style={{ color: '#FF9800', fontSize: 12, fontWeight: '700' }}>SOLD</Text>}
            </View>
          </View>
          <TouchableOpacity style={styles.deleteSmallBtn} onPress={() => handleDeleteListing(item.id)}>
            <Text style={styles.deleteSmallText}>🗑</Text>
          </TouchableOpacity>
        </View>
      )}
      ListEmptyComponent={<EmptyState icon="🛒" text="No listings" />}
    />
  );

  const renderStorage = () => (
    <ScrollView style={styles.tabContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>
      {/* DB Rotation Status */}
      <Text style={styles.sectionTitle}>Database Rotation</Text>
      <Text style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 10 }}>Auto-switches when a DB reaches 450 MB. Total capacity ~5 GB.</Text>
      {dbStatus.length === 0 && <Text style={{ color: COLORS.textLight, marginBottom: 12 }}>Loading...</Text>}
      {dbStatus.map(d => (
        <View key={d.index} style={[styles.dbRow, d.isActive && styles.dbRowActive]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dbTitle}>DB #{d.index + 1} {d.isActive ? '⚡ ACTIVE' : ''}</Text>
            <View style={styles.dbBarBg}>
              <View style={[styles.dbBarFill, { width: `${Math.min(100, (d.sizeMB / 512) * 100)}%`, backgroundColor: d.sizeMB > 400 ? '#F44336' : d.sizeMB > 300 ? '#FF9800' : '#4CAF50' }]} />
            </View>
            <Text style={styles.dbSizeText}>{d.sizeMB.toFixed(1)} MB / 512 MB</Text>
          </View>
          <View style={[styles.dbDot, { backgroundColor: d.isAvailable ? '#4CAF50' : '#F44336' }]} />
        </View>
      ))}

      {/* Record Counts */}
      {storageInfo?.totals && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Record Counts</Text>
          <View style={styles.statsGrid}>
            <StatCard icon="👥" label="Users" value={storageInfo.totals.users ?? 0} color="#4CAF50" />
            <StatCard icon="📝" label="Posts" value={storageInfo.totals.posts ?? 0} color="#2196F3" />
            <StatCard icon="🛒" label="Listings" value={storageInfo.totals.listings ?? 0} color="#FF9800" />
            <StatCard icon="💬" label="Comments" value={storageInfo.totals.comments ?? 0} color="#9C27B0" />
            <StatCard icon="🔔" label="Notifications" value={storageInfo.totals.notifications ?? 0} color="#00BCD4" />
            <StatCard icon="💬" label="Chat Msgs" value={storageInfo.totals.chatMessages ?? 0} color="#795548" />
            <StatCard icon="📰" label="News" value={storageInfo.totals.news ?? 0} color="#E91E63" />
            <StatCard icon="🏆" label="Tournaments" value={storageInfo.totals.tournaments ?? 0} color="#607D8B" />
            <StatCard icon="🏥" label="Doctors" value={storageInfo.totals.doctors ?? 0} color="#E11D48" />
          </View>
        </>
      )}

      {/* Cleanup Actions */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Free Up Space</Text>
      <Text style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 12 }}>Permanently deletes old records. Images/videos on Cloudinary are NOT affected.</Text>
      {cleanupLoading && <ActivityIndicator color={COLORS.primary} style={{ marginBottom: 10 }} />}

      <CleanupBtn
        icon="💬" title="Chat Messages" subtitle="Delete messages older than 30 days"
        onPress={() => handleCleanup('chatMessages', 'chat messages', 30)} />
      <CleanupBtn
        icon="🔔" title="Notifications" subtitle="Delete notifications older than 30 days"
        onPress={() => handleCleanup('notifications', 'notifications', 30)} />
      <CleanupBtn
        icon="🔔" title="Notifications (7 days)" subtitle="More aggressive — delete older than 7 days"
        onPress={() => handleCleanup('notifications', 'notifications', 7)} />
      <CleanupBtn
        icon="💬" title="Chat Messages (7 days)" subtitle="More aggressive — delete older than 7 days"
        onPress={() => handleCleanup('chatMessages', 'chat messages', 7)} />
    </ScrollView>
  );

  const renderNews = () => (
    <FlatList
      data={allNews}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <View>
          <Text style={styles.sectionTitle}>Published Articles ({allNews.length})</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('News & Articles')}>
            <Text style={styles.addBtnText}>+ Publish New Article</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.contentCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.contentTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.contentSub}>{item.category} • {item.reporter?.name || 'Admin'}</Text>
            <Text style={styles.contentSub}>
              {new Date(item.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
          <TouchableOpacity style={styles.deleteSmallBtn} onPress={() => handleDeleteNews(item.id)}>
            <Text style={styles.deleteSmallText}>🗑</Text>
          </TouchableOpacity>
        </View>
      )}
      ListEmptyComponent={<EmptyState icon="📰" text="No articles" />}
    />
  );

  const handleReportAction = async (id, action) => {
    try {
      await reportsAPI.takeAction(id, action);
      Alert.alert('Done', action === 'BLOCK' ? 'User blocked' : 'Report dismissed');
      setReports(prev => prev.filter(r => r.id !== id));
    } catch { Alert.alert('Error', 'Action failed'); }
  };

  const renderReports = () => (
    <FlatList
      data={reports}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <View>
          <Text style={styles.sectionTitle}>Reports ({reports.length})</Text>
          <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8 }}>
            {['PENDING', 'RESOLVED', 'DISMISSED'].map(s => (
              <TouchableOpacity key={s} onPress={() => { setReportFilter(s); setDataLoaded(prev => ({ ...prev, Reports: false })); }}
                style={[styles.filterChip, reportFilter === s && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, reportFilter === s && styles.filterChipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.contentCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.contentTitle}>Report #{item.id.slice(-6)}</Text>
            <Text style={styles.contentSub}>By: {item.reporter?.name || 'Unknown'}</Text>
            <Text style={styles.contentSub}>Type: {item.targetType} • Target: {item.targetId?.slice(-6)}</Text>
            <Text style={[styles.contentSub, { marginTop: 4 }]}>Reason: {item.reason}</Text>
            {item.description ? <Text style={styles.contentSub}>Details: {item.description}</Text> : null}
            <Text style={styles.contentSub}>
              {new Date(item.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>

            {/* Context: Last 5 messages */}
            {item.contextMessages && item.contextMessages.length > 0 && (
              <View style={{ marginTop: 10, backgroundColor: '#f0f0f0', borderRadius: 8, padding: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 6 }}>
                  💬 Last {item.contextMessages.length} Messages:
                </Text>
                {item.contextMessages.map((msg, idx) => {
                  const isTarget = msg.id === item.targetId;
                  return (
                    <View key={msg.id || idx} style={{
                      marginBottom: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6,
                      backgroundColor: isTarget ? '#FECACA' : '#fff',
                      borderLeftWidth: isTarget ? 3 : 0, borderLeftColor: '#EF4444',
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isTarget ? '#EF4444' : '#333' }}>
                        {msg.user?.name || msg.sender?.name || 'User'}{isTarget ? ' ⚠️ REPORTED' : ''}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#444' }} numberOfLines={3}>
                        {msg.text || (msg.images?.length > 0 ? '📷 Photo' : (msg.voiceUrl ? '🎤 Voice' : '—'))}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
          {reportFilter === 'PENDING' && (
            <View style={{ justifyContent: 'center', gap: 6 }}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#dc3545' }]} onPress={() => handleReportAction(item.id, 'BLOCK')}>
                <Text style={styles.actionBtnText}>Block</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#6c757d' }]} onPress={() => handleReportAction(item.id, 'DISMISS')}>
                <Text style={styles.actionBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      ListEmptyComponent={<EmptyState icon="📋" text={`No ${reportFilter.toLowerCase()} reports`} />}
    />
  );

  const renderTab = () => {
    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    switch (activeTab) {
      case 'Overview': return renderOverview();
      case 'Users': return renderUsers();
      case 'Rishta': return renderRishta();
      case 'Reports': return renderReports();
      case 'News': return renderNews();
      case 'Storage': return renderStorage();
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
          <Text style={styles.backBtn}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {renderTab()}
    </View>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ icon, text }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function CleanupBtn({ icon, title, subtitle, onPress }) {
  return (
    <TouchableOpacity style={styles.cleanupBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.cleanupBtnIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.cleanupBtnTitle}>{title}</Text>
        <Text style={styles.cleanupBtnSub}>{subtitle}</Text>
      </View>
      <Text style={{ fontSize: 18, color: '#C62828' }}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backBtn: { color: COLORS.white, fontSize: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
  tabBar: {
    backgroundColor: COLORS.surface,
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: { paddingHorizontal: 20, paddingVertical: 14 },
  activeTab: { borderBottomWidth: 3, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, color: COLORS.textLight, fontWeight: '600' },
  activeTabText: { color: COLORS.primary },
  tabContent: { flex: 1, padding: 16 },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
  },
  welcomeTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  welcomeSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    elevation: 3,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  statValue: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginTop: 6 },
  statLabel: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    gap: 10,
  },
  alertText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#E65100' },
  alertArrow: { fontSize: 18, color: '#E65100' },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  quickBtn: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  quickBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  searchBar: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.surface },
  searchInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  userPhone: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  userStats: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  toggleBtnText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  rishtaCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
  },
  rishtaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rishtaName: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  rishtaDetail: { fontSize: 13, color: COLORS.textLight, marginBottom: 4 },
  cnicLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 12, marginBottom: 8 },
  cnicImagesRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  cnicImageContainer: { flex: 1 },
  cnicImageLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4, textAlign: 'center' },
  cnicImage: { width: '100%', height: 100, borderRadius: 8, backgroundColor: '#E0E0E0' },
  rishtaActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rishtaBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  rishtaBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  contentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
  },
  contentThumb: { width: 50, height: 50, borderRadius: 8 },
  contentTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  contentSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  deleteSmallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteSmallText: { fontSize: 16 },  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 11, fontWeight: '600', color: '#666' },
  filterChipTextActive: { color: '#fff' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },  addBtn: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  addBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, color: COLORS.textLight },
  // Storage tab styles
  dbRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dbRowActive: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  dbTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  dbBarBg: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginBottom: 4 },
  dbBarFill: { height: 8, borderRadius: 4 },
  dbSizeText: { fontSize: 11, color: COLORS.textLight },
  dbDot: { width: 12, height: 12, borderRadius: 6, marginLeft: 12 },
  cleanupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  cleanupBtnIcon: { fontSize: 22, marginRight: 12 },
  cleanupBtnTitle: { fontSize: 14, fontWeight: '700', color: '#C62828' },
  cleanupBtnSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
});
