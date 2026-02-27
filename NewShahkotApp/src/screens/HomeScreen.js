import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
  Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, APP_NAME } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { postsAPI, listingsAPI, newsAPI, tournamentsAPI, jobsAPI, notificationsAPI } from '../services/api';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;
const HOME_CACHE_KEY = '@home_cache';

export default function HomeScreen({ navigation }) {
  const { user, isAdmin } = useAuth();
  const [trendingListings, setTrendingListings] = useState([]);
  const [latestNews, setLatestNews] = useState([]);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [latestJobs, setLatestJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  useEffect(() => {
    loadCachedData();
    loadHomeData();
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 15000);
    return () => clearInterval(interval);
  }, []);

  // Load cached data first for instant display
  const loadCachedData = async () => {
    try {
      const cached = await AsyncStorage.getItem(HOME_CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.listings) setTrendingListings(data.listings);
        if (data.news) setLatestNews(data.news);
        if (data.tournaments) setUpcomingMatches(data.tournaments);
        if (data.posts) setRecentPosts(data.posts);
        if (data.jobs) setLatestJobs(data.jobs);
        setLoading(false); // show cached content immediately
      }
    } catch {}
  };

  const loadUnreadCount = async () => {
    try {
      const res = await notificationsAPI.getAll(1);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {}
  };

  const loadHomeData = async () => {
    try {
      const [listingsRes, newsRes, tournamentsRes, postsRes, jobsRes] = await Promise.allSettled([
        listingsAPI.getAll({ limit: 6 }),
        newsAPI.getAll({ limit: 4 }),
        tournamentsAPI.getAll(),
        postsAPI.getFeed(1),
        jobsAPI.getAll({ limit: 4 }),
      ]);
      const listings = listingsRes.status === 'fulfilled' ? listingsRes.value.data.listings?.slice(0, 6) || [] : trendingListings;
      const news = newsRes.status === 'fulfilled' ? newsRes.value.data.news?.slice(0, 4) || [] : latestNews;
      const tournaments = tournamentsRes.status === 'fulfilled' ? tournamentsRes.value.data.tournaments?.slice(0, 3) || [] : upcomingMatches;
      const posts = postsRes.status === 'fulfilled' ? postsRes.value.data.posts?.slice(0, 4) || [] : recentPosts;
      const jobs = jobsRes.status === 'fulfilled' ? jobsRes.value.data.jobs?.slice(0, 4) || [] : latestJobs;

      setTrendingListings(listings);
      setLatestNews(news);
      setUpcomingMatches(tournaments);
      setRecentPosts(posts);
      setLatestJobs(jobs);

      // Cache for next launch
      AsyncStorage.setItem(HOME_CACHE_KEY, JSON.stringify({ listings, news, tournaments, posts, jobs })).catch(() => {});
    } catch (error) {
      console.error('Home data error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadHomeData();
    loadUnreadCount();
  }, []);

  const QUICK_ACCESS = [
    { key: 'Market', label: 'Buy & Sell', icon: 'cart', color: '#FF6584' },
    { key: 'Jobs', label: 'Jobs', icon: 'briefcase', color: '#2563EB' },
    { key: 'News & Articles', label: 'News', icon: 'newspaper', color: '#8B5CF6' },
    { key: 'Tournaments', label: 'Sports', icon: 'trophy', color: '#10B981' },
    { key: 'Bazar', label: 'Bazar', icon: 'storefront', color: '#3B82F6' },
    { key: 'RestaurantDeals', label: 'Food Deals', icon: 'restaurant', color: '#F97316' },
    { key: 'BloodDonation', label: 'Blood', icon: 'water', color: '#B91C1C' },
    { key: 'Doctors', label: 'Doctors', icon: 'medkit', color: '#E11D48' },
    { key: 'Weather', label: 'Weather', icon: 'partly-sunny', color: '#0EA5E9' },
  ];

  const SERVICES_ROW = [
    { key: 'Explore', label: 'Explore All', icon: 'compass', color: COLORS.primary },
    { key: 'Feed', label: 'Feed', icon: 'chatbubbles', color: '#6366F1' },
    { key: 'Community', label: 'Community', icon: 'people', color: '#14B8A6' },
    { key: 'Helpline', label: 'Helplines', icon: 'call', color: '#EF4444' },
  ];

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <Image source={require('../../assets/logo.png')} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 16 }} resizeMode="contain" />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: COLORS.textLight, marginTop: 12, fontSize: 14 }}>Loading your city...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Image source={require('../../assets/logo.png')} style={styles.headerLogo} resizeMode="contain" />
              <View>
                <Text style={styles.brandName}>APNA SHAHKOT</Text>
                <Text style={styles.greeting}>{getGreeting()}, {user?.name?.split(' ')[0] || 'User'} 👋</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.notifBtn} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications" size={22} color={COLORS.white} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <TouchableOpacity style={styles.searchBar} onPress={() => navigation.navigate('Explore')} activeOpacity={0.8}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.6)" />
            <Text style={styles.searchPlaceholder}>Search Shahkot services...</Text>
          </TouchableOpacity>
        </View>

        {/* Location Badge */}
        <View style={styles.locationBanner}>
          <View style={styles.locationLeft}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.locationTitle}>Shahkot, Punjab</Text>
              <Text style={styles.locationSub}>Your community is active</Text>
            </View>
          </View>
          <View style={styles.livePulse}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Quick Access Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickGrid}>
            {QUICK_ACCESS.map((item) => (
              <TouchableOpacity key={item.key} style={styles.quickItem} onPress={() => navigation.navigate(item.key)} activeOpacity={0.7}>
                <View style={[styles.quickIcon, { backgroundColor: item.color + '12' }]}>
                  <Ionicons name={item.icon} size={24} color={item.color} />
                </View>
                <Text style={styles.quickLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Services Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.servicesRow}>
          {SERVICES_ROW.map((s) => (
            <TouchableOpacity key={s.key} style={[styles.serviceChip, { borderColor: s.color + '40' }]} onPress={() => navigation.navigate(s.key)}>
              <Ionicons name={s.icon} size={16} color={s.color} />
              <Text style={[styles.serviceChipText, { color: s.color }]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Trending Listings */}
        {trendingListings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="flame" size={20} color="#FF6584" />
                <Text style={styles.sectionTitle}>Trending Listings</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Market')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
              {trendingListings.map((item) => (
                <TouchableOpacity key={item.id} style={styles.listingCard} onPress={() => navigation.navigate('Market')}>
                  {item.images?.[0] ? (
                    <Image source={{ uri: item.images[0] }} style={styles.listingImage} />
                  ) : (
                    <View style={styles.listingImagePlaceholder}>
                      <Ionicons name="cube-outline" size={32} color={COLORS.textLight} />
                    </View>
                  )}
                  <View style={styles.listingInfo}>
                    <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.listingPrice}>Rs. {Number(item.price || 0).toLocaleString()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Latest Jobs */}
        {latestJobs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="briefcase" size={20} color="#2563EB" />
                <Text style={styles.sectionTitle}>Latest Jobs</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Jobs')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            {latestJobs.map((item) => (
              <TouchableOpacity key={item.id} style={styles.jobCard} onPress={() => navigation.navigate('Jobs')}>
                <View style={styles.jobIconWrap}>
                  <Ionicons name="briefcase" size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.jobCompany}>{item.company || 'Local Business'}</Text>
                </View>
                {item.salary ? (
                  <View style={styles.salaryBadge}>
                    <Text style={styles.salaryText}>Rs.{Number(item.salary).toLocaleString()}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Latest News */}
        {latestNews.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="newspaper" size={20} color="#8B5CF6" />
                <Text style={styles.sectionTitle}>Latest News</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('News & Articles')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
              {latestNews.map((item) => (
                <TouchableOpacity key={item.id} style={styles.newsCard} onPress={() => navigation.navigate('News & Articles')}>
                  <View style={styles.newsCatBadge}>
                    <Text style={styles.newsCatText}>{item.category}</Text>
                  </View>
                  <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.newsFooter}>
                    <Ionicons name="time-outline" size={12} color={COLORS.textLight} />
                    <Text style={styles.newsDate}>
                      {new Date(item.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Upcoming Tournaments */}
        {upcomingMatches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="trophy" size={20} color="#10B981" />
                <Text style={styles.sectionTitle}>Tournaments</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Tournaments')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            {upcomingMatches.map((item) => (
              <TouchableOpacity key={item.id} style={styles.tournamentCard}
                onPress={() => navigation.navigate('TournamentDetail', { id: item.id })}>
                <View style={styles.tournamentIconWrap}>
                  <Ionicons name="trophy" size={22} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tournamentName}>{item.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                    <Ionicons name="location-outline" size={13} color={COLORS.textLight} />
                    <Text style={styles.tournamentVenue}> {item.venue}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Posts */}
        {recentPosts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="chatbubble-ellipses" size={20} color="#6366F1" />
                <Text style={styles.sectionTitle}>Community Posts</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Feed')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            {recentPosts.slice(0, 3).map((item) => (
              <TouchableOpacity key={item.id} style={styles.postCard} onPress={() => navigation.navigate('Feed')}>
                <View style={styles.postHeader}>
                  {item.user?.photoUrl ? (
                    <Image source={{ uri: item.user.photoUrl }} style={styles.postAvatar} />
                  ) : (
                    <View style={[styles.postAvatar, { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{item.user?.name?.[0] || '?'}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.postUser}>{item.user?.name}</Text>
                    <Text style={styles.postTime}>{new Date(item.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}</Text>
                  </View>
                </View>
                {item.text && <Text style={styles.postText} numberOfLines={2}>{item.text}</Text>}
                <View style={styles.postStats}>
                  <View style={styles.postStatItem}>
                    <Ionicons name="heart" size={14} color="#FF6584" />
                    <Text style={styles.postStatText}>{item.likesCount || 0}</Text>
                  </View>
                  <View style={styles.postStatItem}>
                    <Ionicons name="chatbubble" size={14} color="#6366F1" />
                    <Text style={styles.postStatText}>{item.commentsCount || 0}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Image source={require('../../assets/logo.png')} style={{ width: 40, height: 40, borderRadius: 20, marginBottom: 8, opacity: 0.8 }} resizeMode="contain" />
          <Text style={styles.footerText}>{APP_NAME} v1.0</Text>
          <Text style={styles.footerSub}>Made with ❤️ for Shahkot 🇵🇰</Text>
        </View>
      </ScrollView>

      {/* Floating AI Button */}
      <TouchableOpacity style={styles.aiBtn} onPress={() => navigation.navigate('AIChatbot')} activeOpacity={0.85}>
        <Ionicons name="sparkles" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  brandName: { fontSize: 11, fontWeight: '900', color: '#FFD700', letterSpacing: 2 },
  greeting: { fontSize: 16, fontWeight: '600', color: COLORS.white, marginTop: 1 },
  notifBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  notifBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#FF3B30', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: COLORS.primary },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, gap: 10 },
  searchPlaceholder: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },

  // Location
  locationBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surface, marginHorizontal: 16, marginTop: -12, padding: 14, borderRadius: 14, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8 },
  locationLeft: { flexDirection: 'row', alignItems: 'center' },
  locationTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  locationSub: { fontSize: 12, color: COLORS.textLight, marginTop: 1 },
  livePulse: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B98112', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 5 },
  liveText: { fontSize: 10, fontWeight: '800', color: '#10B981', letterSpacing: 1 },

  // Quick Access
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  seeAll: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  quickItem: { width: '25%', alignItems: 'center', marginBottom: 14 },
  quickIcon: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  quickLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },

  // Services Row
  servicesRow: { paddingHorizontal: 16, paddingBottom: 4, gap: 8 },
  serviceChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, height: 36, gap: 6 },
  serviceChipText: { fontSize: 12, fontWeight: '700' },

  // Listings
  listingCard: { width: 150, backgroundColor: COLORS.surface, borderRadius: 14, marginRight: 12, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  listingImage: { width: '100%', height: 100, backgroundColor: COLORS.gray },
  listingImagePlaceholder: { width: '100%', height: 100, backgroundColor: COLORS.gray + '30', justifyContent: 'center', alignItems: 'center' },
  listingInfo: { padding: 10 },
  listingTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  listingPrice: { fontSize: 15, fontWeight: '800', color: COLORS.primary, marginTop: 3 },

  // Jobs
  jobCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  jobIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#2563EB12', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  jobTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  jobCompany: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  salaryBadge: { backgroundColor: COLORS.primary + '12', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  salaryText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  // News
  newsCard: { width: 200, backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginRight: 12, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  newsCatBadge: { alignSelf: 'flex-start', backgroundColor: '#8B5CF612', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8 },
  newsCatText: { fontSize: 10, fontWeight: '700', color: '#8B5CF6' },
  newsTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, lineHeight: 19 },
  newsFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  newsDate: { fontSize: 11, color: COLORS.textLight },

  // Tournaments
  tournamentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  tournamentIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#10B98112', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  tournamentName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  tournamentVenue: { fontSize: 12, color: COLORS.textLight },

  // Posts
  postCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  postAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  postUser: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  postTime: { fontSize: 11, color: COLORS.textLight },
  postText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 8 },
  postStats: { flexDirection: 'row', gap: 16 },
  postStatItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { fontSize: 12, color: COLORS.textLight },

  // Footer
  footer: { alignItems: 'center', paddingVertical: 30, backgroundColor: COLORS.primary, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: 24 },
  footerText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  footerSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },

  // AI FAB
  aiBtn: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 },
});
