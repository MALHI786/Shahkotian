import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Modal, ScrollView,
  RefreshControl, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, JOB_CATEGORIES, JOB_TYPES } from '../config/constants';
import { jobsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SkeletonLoader from '../components/SkeletonLoader';

const getCategoryInfo = (key) => JOB_CATEGORIES.find(c => c.key === key) || { label: key, icon: '📦' };
const getTypeLabel = (key) => JOB_TYPES.find(t => t.key === key)?.label || key;

export default function JobsScreen({ navigation }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showMyJobs, setShowMyJobs] = useState(false);
  const [myJobs, setMyJobs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyPhone, setApplyPhone] = useState('');
  const [applyMessage, setApplyMessage] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  const [form, setForm] = useState({
    title: '', company: '', description: '', category: 'OTHER',
    type: 'FULL_TIME', salary: '', location: 'Shahkot', phone: '',
    whatsapp: '', requirements: '',
  });

  useEffect(() => { loadJobs(); }, []);

  const loadJobs = async () => {
    try {
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;
      const res = await jobsAPI.getAll(params);
      setJobs(res.data.jobs || []);
    } catch (error) {
      console.error('Load jobs error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMyJobs = async () => {
    try {
      const res = await jobsAPI.getMine();
      setMyJobs(res.data.jobs || []);
    } catch (error) {
      console.error('My jobs error:', error);
    }
  };

  const loadApplicants = async (jobId) => {
    setLoadingApplicants(true);
    try {
      const res = await jobsAPI.getApplications(jobId);
      setApplicants(res.data.applications || []);
    } catch (error) {
      console.error('Load applicants error:', error);
      setApplicants([]);
    } finally {
      setLoadingApplicants(false);
    }
  };

  useEffect(() => { loadJobs(); }, [selectedCategory]);

  const resetForm = () => {
    setForm({ title: '', company: '', description: '', category: 'OTHER', type: 'FULL_TIME', salary: '', location: 'Shahkot', phone: '', whatsapp: '', requirements: '' });
  };

  const postJob = async () => {
    if (!form.title || !form.company || !form.description || !form.phone) {
      Alert.alert('Required', 'Please fill title, company, description, and phone.');
      return;
    }
    setSaving(true);
    try {
      await jobsAPI.create(form);
      Alert.alert('Posted!', 'Your job has been posted successfully.');
      setShowPostModal(false);
      resetForm();
      loadJobs();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to post job.');
    } finally {
      setSaving(false);
    }
  };

  const deleteJob = (id) => {
    Alert.alert('Delete Job', 'Remove this job posting?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await jobsAPI.delete(id);
            Alert.alert('Deleted');
            setSelectedJob(null);
            setShowDetailModal(false);
            loadJobs();
            if (showMyJobs) loadMyJobs();
          } catch (e) { Alert.alert('Error', 'Failed to delete.'); }
        },
      },
    ]);
  };

  const applyToJob = async () => {
    if (!applyPhone) {
      Alert.alert('Required', 'Phone number is required.');
      return;
    }
    setApplying(true);
    try {
      await jobsAPI.apply(selectedJob.id, { phone: applyPhone, message: applyMessage });
      Alert.alert('Applied! ✅', 'Your application has been submitted.');
      setShowApplyModal(false);
      setApplyPhone('');
      setApplyMessage('');
    } catch (error) {
      Alert.alert('Info', error.response?.data?.error || 'Could not apply.');
    } finally {
      setApplying(false);
    }
  };

  const callNumber = (phone) => { Linking.openURL(`tel:${phone}`); };
  const whatsappNumber = (phone, title) => {
    const msg = encodeURIComponent(`Hi, I'm interested in the job: ${title}`);
    Linking.openURL(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${msg}`);
  };

  const renderJob = ({ item }) => {
    const cat = getCategoryInfo(item.category);
    return (
      <TouchableOpacity
        style={styles.jobCard}
        activeOpacity={0.8}
        onPress={() => {
          setSelectedJob(item);
          setShowDetailModal(true);
          const owns = item.userId === user?.id || item.user?.id === user?.id;
          if (owns) loadApplicants(item.id);
        }}
      >
        <View style={styles.jobHeader}>
          <View style={styles.jobIcon}>
            <Text style={{ fontSize: 24 }}>{cat.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.jobTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.jobCompany}>{item.company}</Text>
          </View>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{getTypeLabel(item.type)}</Text>
          </View>
        </View>
        <View style={styles.jobMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={14} color={COLORS.textLight} />
            <Text style={styles.metaText}>{item.location}</Text>
          </View>
          {item.salary && (
            <View style={styles.metaItem}>
              <Ionicons name="cash-outline" size={14} color={COLORS.primary} />
              <Text style={[styles.metaText, { color: COLORS.primary, fontWeight: '600' }]}>{item.salary}</Text>
            </View>
          )}
        </View>
        <Text style={styles.jobDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.jobFooter}>
          <Text style={styles.jobDate}>
            {new Date(item.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
          </Text>
          <Text style={styles.applicantCount}>
            {item._count?.applications || 0} applicants
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailModal = () => {
    if (!selectedJob) return null;
    const cat = getCategoryInfo(selectedJob.category);
    const isOwner = selectedJob.userId === user?.id || selectedJob.user?.id === user?.id;

    return (
      <Modal visible={showDetailModal} animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDetailModal(false)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chevron-back" size={22} color={COLORS.white} />
              <Text style={styles.backBtn}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Job Details</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView style={{ flex: 1, padding: 20 }}>
            <View style={styles.detailIconWrap}>
              <Text style={{ fontSize: 40 }}>{cat.icon}</Text>
            </View>
            <Text style={styles.detailTitle}>{selectedJob.title}</Text>
            <Text style={styles.detailCompany}>{selectedJob.company}</Text>
            <View style={styles.detailBadges}>
              <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{getTypeLabel(selectedJob.type)}</Text></View>
              <View style={[styles.typeBadge, { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary + '30' }]}>
                <Text style={[styles.typeBadgeText, { color: COLORS.primary }]}>{cat.label}</Text>
              </View>
            </View>

            {selectedJob.salary && (
              <View style={styles.detailRow}>
                <Ionicons name="cash-outline" size={18} color={COLORS.primary} />
                <Text style={styles.detailRowText}>Salary: {selectedJob.salary}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.detailRowText}>{selectedJob.location}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.detailRowText}>{selectedJob.phone}</Text>
            </View>

            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>Description</Text>
            <Text style={styles.descText}>{selectedJob.description}</Text>

            {selectedJob.requirements && (
              <>
                <Text style={styles.sectionLabel}>Requirements</Text>
                <Text style={styles.descText}>{selectedJob.requirements}</Text>
              </>
            )}

            <Text style={styles.postedBy}>
              Posted by {selectedJob.user?.name || 'Unknown'} • {new Date(selectedJob.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>

            {isOwner && (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>Applicants ({applicants.length})</Text>
                {loadingApplicants ? (
                  <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 12 }} />
                ) : applicants.length === 0 ? (
                  <Text style={[styles.descText, { color: COLORS.textLight, textAlign: 'center', marginVertical: 12 }]}>No applicants yet</Text>
                ) : (
                  applicants.map((app) => (
                    <View key={app.id} style={styles.applicantCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.applicantName}>{app.user?.name || 'Unknown'}</Text>
                        <Text style={styles.applicantPhone}>{app.phone}</Text>
                        {app.message ? <Text style={styles.applicantMsg}>{app.message}</Text> : null}
                        <Text style={styles.applicantDate}>
                          {new Date(app.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.applicantCallBtn} onPress={() => callNumber(app.phone)}>
                        <Ionicons name="call" size={16} color={COLORS.white} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </>
            )}

            {isOwner && (
              <TouchableOpacity style={styles.deleteJobBtn} onPress={() => deleteJob(selectedJob.id)}>
                <Ionicons name="trash-outline" size={18} color="#F44336" />
                <Text style={styles.deleteJobText}>Delete Job</Text>
              </TouchableOpacity>
            )}
            <View style={{ height: 30 }} />
          </ScrollView>

          {!isOwner && (
            <View style={styles.detailCTA}>
              <TouchableOpacity style={styles.callCTABtn} onPress={() => callNumber(selectedJob.phone)}>
                <Ionicons name="call" size={18} color={COLORS.white} />
                <Text style={styles.ctaText}>Call</Text>
              </TouchableOpacity>
              {selectedJob.whatsapp && (
                <TouchableOpacity style={styles.waCTABtn} onPress={() => whatsappNumber(selectedJob.whatsapp || selectedJob.phone, selectedJob.title)}>
                  <Ionicons name="logo-whatsapp" size={18} color={COLORS.white} />
                  <Text style={styles.ctaText}>WhatsApp</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.applyCTABtn} onPress={() => { setApplyPhone(user?.phone || ''); setShowApplyModal(true); }}>
                <Ionicons name="paper-plane" size={18} color={COLORS.white} />
                <Text style={styles.ctaText}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Apply Modal */}
        <Modal visible={showApplyModal} transparent animationType="slide">
          <View style={styles.overlayBg}>
            <View style={styles.applySheet}>
              <Text style={styles.applyTitle}>Apply for this Job</Text>
              <Text style={styles.fieldLabel}>Your Phone *</Text>
              <TextInput style={styles.input} placeholder="Phone number" value={applyPhone} onChangeText={setApplyPhone} keyboardType="phone-pad" placeholderTextColor={COLORS.textLight} />
              <Text style={styles.fieldLabel}>Message (optional)</Text>
              <TextInput style={[styles.input, { height: 80 }]} placeholder="Tell them about yourself..." value={applyMessage} onChangeText={setApplyMessage} multiline placeholderTextColor={COLORS.textLight} />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowApplyModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.submitBtn, applying && { opacity: 0.6 }]} onPress={applyToJob} disabled={applying}>
                  {applying ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitBtnText}>Submit Application</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </Modal>
    );
  };

  const renderPostModal = () => (
    <Modal visible={showPostModal} animationType="slide" onRequestClose={() => setShowPostModal(false)}>
      <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowPostModal(false)}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Post a Job</Text>
          <View style={{ width: 30 }} />
        </View>
        <ScrollView style={{ flex: 1, padding: 20 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Job Title *</Text>
          <TextInput style={styles.input} placeholder="e.g. Accountant, Driver" value={form.title} onChangeText={v => setForm({ ...form, title: v })} placeholderTextColor={COLORS.textLight} />

          <Text style={styles.fieldLabel}>Company / Business Name *</Text>
          <TextInput style={styles.input} placeholder="e.g. Ali Traders" value={form.company} onChangeText={v => setForm({ ...form, company: v })} placeholderTextColor={COLORS.textLight} />

          <Text style={styles.fieldLabel}>Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {JOB_CATEGORIES.map(cat => (
              <TouchableOpacity key={cat.key} style={[styles.chipBtn, form.category === cat.key && styles.chipActive]} onPress={() => setForm({ ...form, category: cat.key })}>
                <Text style={{ marginRight: 4 }}>{cat.icon}</Text>
                <Text style={[styles.chipText, form.category === cat.key && styles.chipTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Job Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {JOB_TYPES.map(t => (
              <TouchableOpacity key={t.key} style={[styles.chipBtn, form.type === t.key && styles.chipActive]} onPress={() => setForm({ ...form, type: t.key })}>
                <Text style={[styles.chipText, form.type === t.key && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Description *</Text>
          <TextInput style={[styles.input, { height: 100 }]} placeholder="Job details, responsibilities..." value={form.description} onChangeText={v => setForm({ ...form, description: v })} multiline placeholderTextColor={COLORS.textLight} />

          <Text style={styles.fieldLabel}>Salary</Text>
          <TextInput style={styles.input} placeholder="e.g. 20,000 - 30,000 PKR or Negotiable" value={form.salary} onChangeText={v => setForm({ ...form, salary: v })} placeholderTextColor={COLORS.textLight} />

          <Text style={styles.fieldLabel}>Location</Text>
          <TextInput style={styles.input} placeholder="e.g. Shahkot" value={form.location} onChangeText={v => setForm({ ...form, location: v })} placeholderTextColor={COLORS.textLight} />

          <Text style={styles.fieldLabel}>Contact Phone *</Text>
          <TextInput style={styles.input} placeholder="Phone number" value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} keyboardType="phone-pad" placeholderTextColor={COLORS.textLight} />

          <Text style={styles.fieldLabel}>WhatsApp</Text>
          <TextInput style={styles.input} placeholder="WhatsApp number (if different)" value={form.whatsapp} onChangeText={v => setForm({ ...form, whatsapp: v })} keyboardType="phone-pad" placeholderTextColor={COLORS.textLight} />

          <Text style={styles.fieldLabel}>Requirements</Text>
          <TextInput style={[styles.input, { height: 80 }]} placeholder="Education, experience, skills..." value={form.requirements} onChangeText={v => setForm({ ...form, requirements: v })} multiline placeholderTextColor={COLORS.textLight} />

          <TouchableOpacity style={[styles.postBtn, saving && { opacity: 0.6 }]} onPress={postJob} disabled={saving}>
            {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.postBtnText}>Post Job</Text>}
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
          <Text style={styles.headerBack}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Jobs</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={() => { setShowMyJobs(!showMyJobs); if (!showMyJobs) loadMyJobs(); }}>
            <Text style={styles.headerBtn}>{showMyJobs ? 'Browse' : 'My Jobs'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowPostModal(true)}>
            <Text style={styles.headerBtn}>+ Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search jobs..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={loadJobs}
          returnKeyType="search"
          placeholderTextColor={COLORS.textLight}
        />
      </View>

      {/* Category Filter */}
      {!showMyJobs && (
        <FlatList
          horizontal
          data={[{ key: null, label: 'All', icon: '🔥' }, ...JOB_CATEGORIES]}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key || 'all'}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, selectedCategory === item.key && styles.filterChipActive]}
              onPress={() => setSelectedCategory(item.key)}
            >
              <Text style={styles.filterIcon}>{item.icon}</Text>
              <Text style={[styles.filterLabel, selectedCategory === item.key && styles.filterLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Jobs List */}
      {loading ? (
        <SkeletonLoader type="list" count={4} />
      ) : (
        <FlatList
          data={showMyJobs ? myJobs : jobs}
          renderItem={renderJob}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadJobs(); }} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="briefcase-outline" size={56} color={COLORS.textLight} />
              <Text style={styles.emptyText}>{showMyJobs ? 'No jobs posted yet' : 'No jobs found'}</Text>
              <Text style={styles.emptySubtext}>{showMyJobs ? 'Post your first job using the + Post button' : 'Try a different search or category'}</Text>
            </View>
          }
        />
      )}

      {renderDetailModal()}
      {renderPostModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 14, backgroundColor: COLORS.primary,
  },
  headerBack: { color: COLORS.white, fontSize: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
  headerBtn: {
    color: COLORS.white, fontSize: 13, fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', margin: 12,
    backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 14, elevation: 2,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  filterRow: { paddingHorizontal: 12, marginBottom: 8, paddingRight: 20 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    paddingHorizontal: 14, height: 38, borderRadius: 20, marginRight: 8,
    borderWidth: 1, borderColor: COLORS.border, flexShrink: 0,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterIcon: { marginRight: 4, fontSize: 14 },
  filterLabel: { fontSize: 12, color: COLORS.text },
  filterLabelActive: { color: COLORS.white },
  // Job Card
  jobCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 12,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6,
  },
  jobHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  jobIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.primary + '12',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  jobTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  jobCompany: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  typeBadge: {
    backgroundColor: COLORS.accent + '20', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.accent + '40',
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.accentDark },
  jobMeta: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: COLORS.textLight },
  jobDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 10 },
  jobFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobDate: { fontSize: 11, color: COLORS.textLight },
  applicantCount: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: COLORS.primary,
  },
  backBtn: { color: COLORS.white, fontSize: 16 },
  closeBtn: { color: COLORS.white, fontSize: 22 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  // Detail
  detailIconWrap: {
    width: 80, height: 80, borderRadius: 20, backgroundColor: COLORS.primary + '12',
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16,
  },
  detailTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  detailCompany: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 12 },
  detailBadges: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  detailRowText: { fontSize: 15, color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  descText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 16 },
  postedBy: { fontSize: 12, color: COLORS.textLight, marginTop: 8 },
  deleteJobBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFEBEE', padding: 14, borderRadius: 12, marginTop: 20,
  },
  deleteJobText: { color: '#F44336', fontWeight: '700' },
  // Applicant cards
  applicantCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  applicantName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  applicantPhone: { fontSize: 13, color: COLORS.primary, marginTop: 2 },
  applicantMsg: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, fontStyle: 'italic' },
  applicantDate: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
  applicantCallBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginLeft: 10,
  },
  detailCTA: {
    flexDirection: 'row', padding: 16, paddingBottom: 30, backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border, gap: 10,
  },
  callCTABtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12,
  },
  waCTABtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#25D366', paddingVertical: 14, borderRadius: 12,
  },
  applyCTABtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#8B5CF6', paddingVertical: 14, borderRadius: 12,
  },
  ctaText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  // Apply modal
  overlayBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  applySheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  applyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  // Form
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, fontSize: 15,
    borderWidth: 1, borderColor: COLORS.border, color: COLORS.text, marginBottom: 4,
  },
  chipBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.text },
  chipTextActive: { color: COLORS.white },
  postBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  postBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.background },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  submitBtn: { flex: 2, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.primary },
  submitBtnText: { color: COLORS.white, fontWeight: '700' },
  // Empty
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, color: COLORS.textSecondary, fontWeight: '600', marginTop: 12 },
  emptySubtext: { fontSize: 14, color: COLORS.textLight, marginTop: 4, textAlign: 'center' },
});
