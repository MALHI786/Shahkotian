import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, FlatList, Modal, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { rishtaAPI, dmAPI } from '../services/api';

export default function RishtaScreen({ navigation }) {
  const { user, isVerified } = useAuth();
  const [myProfile, setMyProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [agreement, setAgreement] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [activeTab, setActiveTab] = useState('browse'); // browse, interests, shortlist
  const [interests, setInterests] = useState([]);
  const [sentInterests, setSentInterests] = useState([]);
  const [interestSubTab, setInterestSubTab] = useState('received'); // received, sent
  const [shortlisted, setShortlisted] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ gender: '', minAge: '', maxAge: '' });
  const [refreshingInterests, setRefreshingInterests] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);

  // Application form
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [education, setEducation] = useState('');
  const [occupation, setOccupation] = useState('');
  const [familyDetails, setFamilyDetails] = useState('');
  const [preferences, setPreferences] = useState('');
  const [cnicFront, setCnicFront] = useState(null);
  const [cnicBack, setCnicBack] = useState(null);
  const [personalPhotos, setPersonalPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkProfile();
  }, []);

  const checkProfile = async () => {
    try {
      setLoading(true);
      const response = await rishtaAPI.getMyProfile();
      setMyProfile(response.data);

      if (response.data.hasProfile && response.data.profile.status === 'APPROVED') {
        loadProfiles();
      }

      const agreementRes = await rishtaAPI.getAgreement();
      setAgreement(agreementRes.data.agreement);
    } catch (error) {
      console.error('Rishta check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    try {
      const params = {};
      if (filters.gender) params.gender = filters.gender;
      if (filters.minAge) params.minAge = filters.minAge;
      if (filters.maxAge) params.maxAge = filters.maxAge;
      const [profilesRes] = await Promise.all([
        rishtaAPI.getProfiles(params),
        rishtaAPI.getSentInterests().then(r => setSentInterests(r.data.sentInterests || [])).catch(() => {}),
      ]);
      setProfiles(profilesRes.data.profiles);
    } catch (error) {
      console.error('Rishta profiles error:', error);
    }
  };

  const loadInterests = async () => {
    try {
      const response = await rishtaAPI.getInterests();
      setInterests(response.data.interests || []);
    } catch (error) {
      console.error('Load interests error:', error);
    }
  };

  const loadSentInterests = async () => {
    try {
      const response = await rishtaAPI.getSentInterests();
      setSentInterests(response.data.sentInterests || []);
    } catch (error) {
      console.error('Load sent interests error:', error);
    }
  };

  const loadShortlisted = async () => {
    try {
      const response = await rishtaAPI.getShortlisted();
      setShortlisted(response.data.shortlisted || []);
    } catch (error) {
      console.error('Load shortlisted error:', error);
    }
  };

  const sendInterest = async (profileId) => {
    try {
      await rishtaAPI.sendInterest(profileId);
      Alert.alert('Interest Sent! 💝', 'They will be notified of your interest.');
    } catch (error) {
      Alert.alert('Info', error.response?.data?.error || 'Could not send interest');
    }
  };

  const addToShortlist = async (profileId) => {
    try {
      await rishtaAPI.shortlist(profileId);
      Alert.alert('Shortlisted! ⭐', 'Profile added to your shortlist.');
      loadShortlisted();
    } catch (error) {
      Alert.alert('Info', error.response?.data?.error || 'Could not shortlist');
    }
  };

  const respondToInterest = async (interestId, accept) => {
    try {
      if (accept) {
        const res = await rishtaAPI.acceptInterest(interestId);
        const chatId = res.data?.chatId;
        Alert.alert('Accepted! 🎉', 'A private chat has been created. You can now message each other.', [
          {
            text: 'Open Chat',
            onPress: () => {
              if (chatId) {
                const interest = interests.find(i => i.id === interestId);
                navigation.navigate('DMChat', {
                  chatId,
                  otherUser: interest?.fromUser,
                  source: 'RISHTA',
                });
              }
            },
          },
          { text: 'Later', style: 'cancel' },
        ]);
      } else {
        await rishtaAPI.rejectInterest(interestId);
        Alert.alert('Declined', 'Interest has been declined.');
      }
      loadInterests();
    } catch (error) {
      Alert.alert('Error', 'Could not respond to interest');
    }
  };

  const applyFilters = () => {
    setShowFilters(false);
    loadProfiles();
  };

  const handleRefreshInterests = async () => {
    setRefreshingInterests(true);
    await Promise.all([loadInterests(), loadSentInterests()]);
    setRefreshingInterests(false);
  };

  const confirmDeleteProfile = () => {
    Alert.alert(
      '🗑️ Delete Rishta Profile',
      'Are you sure you want to delete your Rishta profile? This will remove all your interests and shortlists permanently.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: deleteProfile,
        },
      ]
    );
  };

  const deleteProfile = async () => {
    setDeletingProfile(true);
    try {
      await rishtaAPI.deleteProfile();
      Alert.alert('Deleted', 'Your Rishta profile has been deleted.');
      setMyProfile(null);
      checkProfile();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to delete profile.');
    } finally {
      setDeletingProfile(false);
    }
  };

  const pickCNIC = async (side) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      if (side === 'front') setCnicFront(result.assets[0]);
      else setCnicBack(result.assets[0]);
    }
  };

  const pickPersonalPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 3,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPersonalPhotos(prev => [...prev, ...result.assets].slice(0, 3));
    }
  };

  const submitApplication = async () => {
    if (!agreed) {
      Alert.alert('Agreement Required', 'You must agree to the terms and conditions.');
      return;
    }
    if (!age || !gender || !education || !occupation) {
      Alert.alert('Required Fields', 'Please fill in all required fields.');
      return;
    }
    if (!cnicFront || !cnicBack) {
      Alert.alert('CNIC Required', 'Please upload both CNIC front and back images.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('age', age);
      formData.append('gender', gender);
      formData.append('education', education);
      formData.append('occupation', occupation);
      formData.append('familyDetails', familyDetails);
      formData.append('preferences', preferences);
      formData.append('signatureAgreed', true);

      formData.append('cnicFront', {
        uri: cnicFront.uri,
        type: 'image/jpeg',
        name: 'cnic_front.jpg',
      });
      formData.append('cnicBack', {
        uri: cnicBack.uri,
        type: 'image/jpeg',
        name: 'cnic_back.jpg',
      });

      personalPhotos.forEach((photo, i) => {
        formData.append('photos', {
          uri: photo.uri,
          type: 'image/jpeg',
          name: `photo_${i}.jpg`,
        });
      });

      await rishtaAPI.apply(formData);
      Alert.alert('Submitted!', 'Your profile has been submitted for admin review. You will receive an email when approved.');
      checkProfile();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Not yet applied
  if (!myProfile?.hasProfile && !showApply) {
    return (
      <View style={styles.center}>
        <Text style={styles.bigIcon}>💑</Text>
        <Text style={styles.title}>Rishta Service</Text>
        <Text style={styles.description}>
          Find verified rishta from Shahkot and nearby areas. Your profile will be verified with CNIC before approval.
        </Text>

        <View style={styles.requirementsList}>
          <Text style={styles.reqItem}>✅ Phone verification (done)</Text>
          <Text style={styles.reqItem}>📋 CNIC photo (front & back)</Text>
          <Text style={styles.reqItem}>✍️ Digital agreement signature</Text>
          <Text style={styles.reqItem}>👨‍💼 Admin approval required</Text>
          <Text style={styles.reqItem}>📧 Email notification on approval</Text>
          <Text style={styles.reqItem}>🚫 No videos allowed</Text>
        </View>

        <TouchableOpacity style={styles.applyButton} onPress={() => setShowApply(true)}>
          <Text style={styles.applyButtonText}>Apply for Rishta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Applied but pending
  if (myProfile?.hasProfile && myProfile.profile.status === 'PENDING') {
    return (
      <View style={styles.center}>
        <Text style={styles.bigIcon}>⏳</Text>
        <Text style={styles.title}>Application Under Review</Text>
        <Text style={styles.description}>
          Your Rishta profile is being reviewed by our admin team. You will receive an email notification when approved.
        </Text>
        <TouchableOpacity
          style={styles.withdrawBtn}
          onPress={confirmDeleteProfile}
          disabled={deletingProfile}
        >
          {deletingProfile ? (
            <ActivityIndicator color="#F44336" />
          ) : (
            <Text style={styles.withdrawBtnText}>🗑️ Withdraw Application</Text>
          )}
        </TouchableOpacity>
        <View style={styles.statusTracker}>
          <View style={styles.statusStep}>
            <View style={[styles.statusDot, styles.statusDotDone]} />
            <Text style={styles.statusLabel}>Applied</Text>
          </View>
          <View style={[styles.statusLine, styles.statusLineActive]} />
          <View style={styles.statusStep}>
            <View style={[styles.statusDot, styles.statusDotActive]} />
            <Text style={[styles.statusLabel, { color: COLORS.primary, fontWeight: '700' }]}>Under Review</Text>
          </View>
          <View style={styles.statusLine} />
          <View style={styles.statusStep}>
            <View style={styles.statusDot} />
            <Text style={styles.statusLabel}>Approved</Text>
          </View>
        </View>
        <Text style={styles.statusDate}>
          Submitted on {new Date(myProfile.profile.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      </View>
    );
  }

  // Rejected
  if (myProfile?.hasProfile && myProfile.profile.status === 'REJECTED') {
    return (
      <View style={styles.center}>
        <Text style={styles.bigIcon}>❌</Text>
        <Text style={styles.title}>Application Not Approved</Text>
        <Text style={styles.description}>
          {myProfile.profile.adminNote || 'Your profile did not meet the verification requirements. Please contact admin.'}
        </Text>
        <View style={styles.statusTracker}>
          <View style={styles.statusStep}>
            <View style={[styles.statusDot, styles.statusDotDone]} />
            <Text style={styles.statusLabel}>Applied</Text>
          </View>
          <View style={[styles.statusLine, styles.statusLineActive]} />
          <View style={styles.statusStep}>
            <View style={[styles.statusDot, styles.statusDotDone]} />
            <Text style={styles.statusLabel}>Reviewed</Text>
          </View>
          <View style={[styles.statusLine, { backgroundColor: '#F44336' }]} />
          <View style={styles.statusStep}>
            <View style={[styles.statusDot, { backgroundColor: '#F44336' }]} />
            <Text style={[styles.statusLabel, { color: '#F44336', fontWeight: '700' }]}>Rejected</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.withdrawBtn}
          onPress={confirmDeleteProfile}
          disabled={deletingProfile}
        >
          {deletingProfile ? (
            <ActivityIndicator color="#F44336" />
          ) : (
            <Text style={styles.withdrawBtnText}>🗑️ Delete & Re-apply</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Application Form
  if (showApply) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.formTitle}>Rishta Application</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Age *</Text>
            <TextInput style={styles.input} placeholder="Enter age" value={age} onChangeText={setAge} keyboardType="numeric" placeholderTextColor={COLORS.textLight} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender *</Text>
            <View style={styles.genderRow}>
              {['Male', 'Female'].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderChip, gender === g && styles.genderChipActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>
                    {g === 'Male' ? '👨' : '👩'} {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Education *</Text>
            <TextInput style={styles.input} placeholder="e.g. Bachelor's, Master's" value={education} onChangeText={setEducation} placeholderTextColor={COLORS.textLight} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Occupation *</Text>
            <TextInput style={styles.input} placeholder="e.g. Engineer, Teacher" value={occupation} onChangeText={setOccupation} placeholderTextColor={COLORS.textLight} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Family Details</Text>
            <TextInput style={[styles.input, { height: 80 }]} placeholder="Describe your family" value={familyDetails} onChangeText={setFamilyDetails} multiline placeholderTextColor={COLORS.textLight} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Preferences</Text>
            <TextInput style={[styles.input, { height: 80 }]} placeholder="What are you looking for?" value={preferences} onChangeText={setPreferences} multiline placeholderTextColor={COLORS.textLight} />
          </View>

          {/* CNIC Upload */}
          <Text style={styles.sectionLabel}>📋 CNIC Verification</Text>
          <View style={styles.cnicRow}>
            <TouchableOpacity style={styles.cnicButton} onPress={() => pickCNIC('front')}>
              <Text style={styles.cnicButtonIcon}>{cnicFront ? '✅' : '📷'}</Text>
              <Text style={styles.cnicButtonText}>{cnicFront ? 'Front Added' : 'CNIC Front'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cnicButton} onPress={() => pickCNIC('back')}>
              <Text style={styles.cnicButtonIcon}>{cnicBack ? '✅' : '📷'}</Text>
              <Text style={styles.cnicButtonText}>{cnicBack ? 'Back Added' : 'CNIC Back'}</Text>
            </TouchableOpacity>
          </View>

          {/* Personal Photos */}
          <Text style={styles.sectionLabel}>📸 Personal Photos (Optional)</Text>
          <TouchableOpacity style={[styles.cnicButton, { marginBottom: 8 }]} onPress={pickPersonalPhotos}>
            <Text style={styles.cnicButtonIcon}>{personalPhotos.length > 0 ? '✅' : '📷'}</Text>
            <Text style={styles.cnicButtonText}>{personalPhotos.length > 0 ? `${personalPhotos.length} photo(s) added` : 'Add Photos (max 3)'}</Text>
          </TouchableOpacity>
          {personalPhotos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {personalPhotos.map((p, i) => (
                <Image key={i} source={{ uri: p.uri }} style={{ width: 80, height: 80, borderRadius: 8, marginRight: 8 }} />
              ))}
            </ScrollView>
          )}

          {/* Agreement */}
          <Text style={styles.sectionLabel}>✍️ Digital Agreement</Text>
          <View style={styles.agreementBox}>
            <Text style={styles.agreementText}>{agreement}</Text>
          </View>

          <TouchableOpacity
            style={styles.agreeRow}
            onPress={() => setAgreed(!agreed)}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.agreeText}>
              I have read and agree to all terms above. I sign this agreement digitally.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, (!agreed || submitting) && styles.submitDisabled]}
            onPress={submitApplication}
            disabled={!agreed || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.submitText}>Submit Application</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Approved - Show profiles with tabs
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.rishtaHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.rishtaBackBtn}>
          <Text style={styles.rishtaBackIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.rishtaHeaderTitle}>💍 Rishta</Text>
        <TouchableOpacity onPress={confirmDeleteProfile} style={styles.rishtaBackBtn} disabled={deletingProfile}>
          <Text style={{ fontSize: 20, color: COLORS.white }}>🗑️</Text>
        </TouchableOpacity>
      </View>
      {/* Tabs */}
      <View style={styles.tabsRow}>
        {[
          { key: 'browse', label: '💑 Browse', count: profiles.length },
          { key: 'interests', label: '💝 Interests', count: interests.length },
          { key: 'shortlist', label: '⭐ Shortlist', count: shortlisted.length },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => {
              setActiveTab(tab.key);
              if (tab.key === 'interests') { loadInterests(); loadSentInterests(); }
              if (tab.key === 'shortlist') loadShortlisted();
            }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Filter Button for Browse */}
      {activeTab === 'browse' && (
        <TouchableOpacity style={styles.filterBar} onPress={() => setShowFilters(true)}>
          <Text style={styles.filterText}>🔍 Filter by Gender & Age</Text>
          {(filters.gender || filters.minAge || filters.maxAge) && (
            <View style={styles.activeFilterBadge}>
              <Text style={styles.activeFilterText}>Active</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Filter Modal */}
      <Modal visible={showFilters} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔍 Filter Profiles</Text>
            
            <Text style={styles.filterLabel}>Gender</Text>
            <View style={styles.genderRow}>
              {['', 'Male', 'Female'].map((g) => (
                <TouchableOpacity
                  key={g || 'all'}
                  style={[styles.genderChip, filters.gender === g && styles.genderChipActive]}
                  onPress={() => setFilters({ ...filters, gender: g })}
                >
                  <Text style={[styles.genderText, filters.gender === g && styles.genderTextActive]}>
                    {g || 'All'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.filterLabel}>Age Range</Text>
            <View style={styles.ageRow}>
              <TextInput
                style={styles.ageInput}
                placeholder="Min"
                value={filters.minAge}
                onChangeText={(t) => setFilters({ ...filters, minAge: t })}
                keyboardType="numeric"
                placeholderTextColor={COLORS.textLight}
              />
              <Text style={styles.ageDash}>-</Text>
              <TextInput
                style={styles.ageInput}
                placeholder="Max"
                value={filters.maxAge}
                onChangeText={(t) => setFilters({ ...filters, maxAge: t })}
                keyboardType="numeric"
                placeholderTextColor={COLORS.textLight}
              />
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.clearBtn} onPress={() => setFilters({ gender: '', minAge: '', maxAge: '' })}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Browse Profiles */}
      {activeTab === 'browse' && (
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <View style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <View style={[styles.profileAvatar, item.gender === 'Female' ? styles.avatarFemale : styles.avatarMale]}>
                  <Text style={styles.profileAvatarText}>{item.gender === 'Female' ? '👩' : '👨'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.profileName}>{item.user?.name}</Text>
                    <Text style={styles.verifiedBadge}>✅ Verified</Text>
                  </View>
                  <Text style={styles.profileAge}>{item.age} years • {item.gender}</Text>
                </View>
              </View>
              <View style={styles.profileDetails}>
                <Text style={styles.detailItem}>🎓 {item.education}</Text>
                <Text style={styles.detailItem}>💼 {item.occupation}</Text>
                {item.familyDetails && <Text style={styles.detailItem}>👨‍👩‍👧 {item.familyDetails}</Text>}
                {item.preferences && <Text style={styles.detailItem}>💝 Looking for: {item.preferences}</Text>}
              </View>
              {item.images && item.images.length > 0 && (() => {
                const interestAccepted = sentInterests.some(
                  si => si.profile?.id === item.id && si.status === 'ACCEPTED'
                );
                return (
                  <View style={{ marginBottom: 8 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {item.images.map((uri, i) => (
                        <View key={i} style={{ marginRight: 6, borderRadius: 8, overflow: 'hidden' }}>
                          <Image
                            source={{ uri }}
                            style={{ width: 70, height: 70 }}
                            blurRadius={interestAccepted ? 0 : 20}
                          />
                        </View>
                      ))}
                    </ScrollView>
                    {!interestAccepted && (
                      <Text style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4, fontStyle: 'italic' }}>
                        🔒 Photos visible after interest accepted
                      </Text>
                    )}
                  </View>
                );
              })()}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.shortlistBtn} onPress={() => addToShortlist(item.id)}>
                  <Text style={styles.shortlistText}>⭐ Shortlist</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.interestBtn} onPress={() => sendInterest(item.id)}>
                  <Text style={styles.interestText}>💝 Send Interest</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💑</Text>
              <Text style={styles.emptyText}>No profiles found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your filters</Text>
            </View>
          }
        />
      )}

      {/* Interests Tab */}
      {activeTab === 'interests' && (
        <View style={{ flex: 1 }}>
          {/* Sub-tabs: Received / Sent */}
          <View style={styles.subTabRow}>
            <TouchableOpacity
              style={[styles.subTab, interestSubTab === 'received' && styles.subTabActive]}
              onPress={() => { setInterestSubTab('received'); loadInterests(); }}
            >
              <Text style={[styles.subTabText, interestSubTab === 'received' && styles.subTabTextActive]}>
                Received ({interests.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subTab, interestSubTab === 'sent' && styles.subTabActive]}
              onPress={() => { setInterestSubTab('sent'); loadSentInterests(); }}
            >
              <Text style={[styles.subTabText, interestSubTab === 'sent' && styles.subTabTextActive]}>
                Sent ({sentInterests.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Received Interests */}
          {interestSubTab === 'received' && (
            <FlatList
              data={interests}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 12 }}
              refreshing={refreshingInterests}
              onRefresh={handleRefreshInterests}
              renderItem={({ item }) => (
                <View style={styles.interestCard}>
                  <View style={styles.profileHeader}>
                    <View style={styles.profileAvatar}>
                      <Text style={styles.profileAvatarText}>{item.fromUser?.name?.[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.profileName}>{item.fromUser?.name}</Text>
                      <Text style={styles.interestStatus}>
                        {item.status === 'PENDING' ? '⏳ Pending' : item.status === 'ACCEPTED' ? '✅ Accepted' : '❌ Declined'}
                      </Text>
                    </View>
                  </View>
                  {item.status === 'PENDING' && (
                    <View style={styles.responseRow}>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => respondToInterest(item.id, false)}>
                        <Text style={styles.rejectText}>✗ Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => respondToInterest(item.id, true)}>
                        <Text style={styles.acceptText}>✓ Accept</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {item.status === 'ACCEPTED' && (
                    <TouchableOpacity
                      style={styles.chatBtn}
                      onPress={async () => {
                        try {
                          const res = await dmAPI.startChat(item.fromUser.id, 'RISHTA');
                          navigation.navigate('DMChat', {
                            chatId: res.data.id,
                            otherUser: item.fromUser,
                            source: 'RISHTA',
                          });
                        } catch (err) {
                          Alert.alert('Error', 'Could not open chat');
                        }
                      }}
                    >
                      <Text style={styles.chatBtnText}>💬 Open Private Chat</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>💝</Text>
                  <Text style={styles.emptyText}>No interests received yet</Text>
                </View>
              }
            />
          )}

          {/* Sent Interests */}
          {interestSubTab === 'sent' && (
            <FlatList
              data={sentInterests}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 12 }}
              refreshing={refreshingInterests}
              onRefresh={handleRefreshInterests}
              renderItem={({ item }) => {
                const profileUser = item.profile?.user;
                return (
                  <View style={styles.interestCard}>
                    <View style={styles.profileHeader}>
                      <View style={[styles.profileAvatar, { backgroundColor: '#8B5CF6' }]}>
                        <Text style={styles.profileAvatarText}>{profileUser?.name?.[0] || '?'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.profileName}>{profileUser?.name || 'User'}</Text>
                        <Text style={styles.interestStatus}>
                          {item.status === 'PENDING' ? '⏳ Waiting for response' : item.status === 'ACCEPTED' ? '✅ Accepted!' : '❌ Declined'}
                        </Text>
                      </View>
                    </View>
                    {item.status === 'ACCEPTED' && profileUser && (
                      <TouchableOpacity
                        style={styles.chatBtn}
                        onPress={async () => {
                          try {
                            const res = await dmAPI.startChat(profileUser.id, 'RISHTA');
                            navigation.navigate('DMChat', {
                              chatId: res.data.id,
                              otherUser: profileUser,
                              source: 'RISHTA',
                            });
                          } catch (err) {
                            Alert.alert('Error', 'Could not open chat');
                          }
                        }}
                      >
                        <Text style={styles.chatBtnText}>💬 Open Private Chat</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>💌</Text>
                  <Text style={styles.emptyText}>No interests sent yet</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Shortlist Tab */}
      {activeTab === 'shortlist' && (
        <FlatList
          data={shortlisted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <View style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>{item.profile?.user?.name?.[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{item.profile?.user?.name}</Text>
                  <Text style={styles.profileAge}>{item.profile?.age} years • {item.profile?.gender}</Text>
                </View>
                <Text style={styles.shortlistStar}>⭐</Text>
              </View>
              <TouchableOpacity style={styles.sendInterestFullBtn} onPress={() => sendInterest(item.profileId)}>
                <Text style={styles.sendInterestFullText}>💝 Send Interest</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>⭐</Text>
              <Text style={styles.emptyText}>No shortlisted profiles</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  rishtaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  rishtaBackBtn: { padding: 4 },
  rishtaBackIcon: { fontSize: 32, color: COLORS.white, lineHeight: 36 },
  rishtaHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: COLORS.background },
  bigIcon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  description: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  requirementsList: { alignSelf: 'stretch', backgroundColor: COLORS.surface, padding: 20, borderRadius: 14, marginBottom: 20 },
  reqItem: { fontSize: 14, color: COLORS.text, marginBottom: 8, lineHeight: 20 },
  applyButton: { backgroundColor: COLORS.secondary, paddingHorizontal: 40, paddingVertical: 14, borderRadius: 12 },
  applyButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  formContainer: { flex: 1, backgroundColor: COLORS.background, padding: 20 },
  formTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, borderRadius: 10, padding: 14, fontSize: 15, borderWidth: 1, borderColor: COLORS.border, color: COLORS.text },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  genderChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  genderText: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  genderTextActive: { color: COLORS.white },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 10 },
  cnicRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  cnicButton: { flex: 1, backgroundColor: COLORS.surface, padding: 20, borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed' },
  cnicButtonIcon: { fontSize: 28, marginBottom: 6 },
  cnicButtonText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  agreementBox: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  agreementText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  checkmark: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  agreeText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 20 },
  submitButton: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  approvedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  approvedIcon: { fontSize: 18, marginRight: 6 },
  approvedText: { fontSize: 14, color: COLORS.success, fontWeight: '700' },
  profileCard: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 10, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  profileAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  profileAvatarText: { color: COLORS.white, fontSize: 22, fontWeight: 'bold' },
  profileName: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  profileAge: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  profileDetails: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, gap: 6 },
  detailItem: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  // Status tracker
  statusTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  statusStep: { alignItems: 'center' },
  statusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.border,
    marginBottom: 6,
  },
  statusDotDone: { backgroundColor: COLORS.primary },
  statusDotActive: {
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: COLORS.primary + '40',
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  statusLine: {
    width: 40,
    height: 3,
    backgroundColor: COLORS.border,
    marginBottom: 18,
    marginHorizontal: 4,
  },
  statusLineActive: { backgroundColor: COLORS.primary },
  statusLabel: { fontSize: 11, color: COLORS.textLight },
  statusDate: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },
  withdrawBtn: {
    marginTop: 20,
    borderWidth: 1.5,
    borderColor: '#F44336',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  withdrawBtnText: { color: '#F44336', fontWeight: '700', fontSize: 14 },
  // New Dil Ka Rishta-like styles
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.secondary },
  tabText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: COLORS.secondary },
  tabBadge: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  filterText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  activeFilterBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeFilterText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  filterLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginTop: 12 },
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ageInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: 'center',
  },
  ageDash: { fontSize: 18, color: COLORS.textSecondary },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  clearBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  clearBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  applyBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
  },
  applyBtnText: { color: COLORS.white, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verifiedBadge: { fontSize: 10, color: COLORS.success, fontWeight: '600' },
  avatarMale: { backgroundColor: '#2196F3' + '20' },
  avatarFemale: { backgroundColor: '#E91E63' + '20' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  shortlistBtn: {
    flex: 1,
    backgroundColor: '#FFB300' + '15',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFB300' + '30',
  },
  shortlistText: { color: '#FFB300', fontWeight: '600', fontSize: 13 },
  interestBtn: {
    flex: 1,
    backgroundColor: COLORS.secondary + '15',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.secondary + '30',
  },
  interestText: { color: COLORS.secondary, fontWeight: '600', fontSize: 13 },
  interestCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  interestStatus: { fontSize: 12, marginTop: 2 },
  responseRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rejectBtn: {
    flex: 1,
    backgroundColor: COLORS.error + '15',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  rejectText: { color: COLORS.error, fontWeight: '600' },
  acceptBtn: {
    flex: 1,
    backgroundColor: COLORS.success + '15',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptText: { color: COLORS.success, fontWeight: '600' },
  contactInfo: {
    marginTop: 10,
    padding: 10,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 8,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  chatBtn: {
    marginTop: 10,
    padding: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  chatBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  shortlistStar: { fontSize: 24 },
  sendInterestFullBtn: {
    backgroundColor: COLORS.secondary,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  sendInterestFullText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptySubtext: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  subTabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  subTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  subTabActive: {
    borderBottomWidth: 3,
    borderBottomColor: COLORS.secondary,
  },
  subTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  subTabTextActive: {
    color: COLORS.secondary,
  },
});
