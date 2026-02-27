import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { COLORS, SPORT_TYPES } from '../config/constants';
import { tournamentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function TournamentDetailScreen({ route, navigation }) {
  // Accept either tournamentId or id from navigation params
  const { tournamentId, id } = route.params || {};
  const tid = tournamentId || id;
  const { user, isAdmin } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [matchForm, setMatchForm] = useState({ team1: '', team2: '', date: '', round: '' });

  const isCreator = user && tournament && (tournament.createdById === user.id || tournament.userId === user.id);
  const canManage = isAdmin || isCreator;

  useEffect(() => {
    loadTournament();
  }, []);

  const loadTournament = async () => {
    try {
      const res = await tournamentsAPI.getOne(tid);
      setTournament(res.data.tournament);
      setEditForm({
        title: res.data.tournament.title || '',
        description: res.data.tournament.description || '',
        location: res.data.tournament.location || '',
        prize: res.data.tournament.prize || '',
        entryFee: res.data.tournament.entryFee?.toString() || '',
        contactNumber: res.data.tournament.contactNumber || '',
      });
    } catch (err) {
      console.log('Failed to load tournament');
    } finally {
      setLoading(false);
    }
  };

  const updateTournament = async () => {
    try {
      setSaving(true);
      await tournamentsAPI.update(tid, {
        ...editForm,
        entryFee: editForm.entryFee ? parseInt(editForm.entryFee) : null,
      });
      Alert.alert('Success', 'Tournament updated successfully!');
      setShowEditModal(false);
      loadTournament();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update tournament');
    } finally {
      setSaving(false);
    }
  };

  const deleteTournament = () => {
    Alert.alert('Delete Tournament', 'Are you sure you want to delete this tournament?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await tournamentsAPI.delete(tid);
            Alert.alert('Deleted', 'Tournament removed successfully');
            navigation.goBack();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete tournament');
          }
        }
      }
    ]);
  };

  const addMatch = async () => {
    if (!matchForm.team1.trim() || !matchForm.team2.trim()) {
      Alert.alert('Required', 'Both team names are required');
      return;
    }
    try {
      await tournamentsAPI.addMatch(tid, matchForm);
      Alert.alert('Success', 'Match added!');
      setShowAddMatch(false);
      setMatchForm({ team1: '', team2: '', date: '', round: '' });
      loadTournament();
    } catch (error) {
      Alert.alert('Error', 'Failed to add match');
    }
  };

  const getSportEmoji = (sport) => {
    const map = {
      CRICKET: '🏏',
      FOOTBALL: '⚽',
      KABADDI: '🤼',
      VOLLEYBALL: '🏐',
      HOCKEY: '🏑',
      BADMINTON: '🏸',
      OTHER: '🏅',
    };
    return map[sport] || '🏅';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBA';
    return new Date(dateStr).toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Tournament not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tournament</Text>
        {canManage ? (
          <TouchableOpacity onPress={() => setShowEditModal(true)}>
            <Text style={styles.editHeaderBtn}>✏️ Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      {/* Management Actions for Creator */}
      {canManage && (
        <View style={styles.manageBar}>
          <TouchableOpacity style={styles.addMatchBtn} onPress={() => setShowAddMatch(true)}>
            <Text style={styles.addMatchText}>➕ Add Match</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={deleteTournament}>
            <Text style={styles.deleteText}>🗑️ Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Edit Tournament Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>✏️ Edit Tournament</Text>
              
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.title}
                onChangeText={(t) => setEditForm({ ...editForm, title: t })}
                placeholder="Tournament name"
              />
              
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, { height: 70, textAlignVertical: 'top' }]}
                value={editForm.description}
                onChangeText={(t) => setEditForm({ ...editForm, description: t })}
                multiline
                placeholder="About the tournament"
              />
              
              <Text style={styles.inputLabel}>Location</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.location}
                onChangeText={(t) => setEditForm({ ...editForm, location: t })}
                placeholder="Venue"
              />
              
              <Text style={styles.inputLabel}>Prize</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.prize}
                onChangeText={(t) => setEditForm({ ...editForm, prize: t })}
                placeholder="e.g. PKR 50,000"
              />
              
              <Text style={styles.inputLabel}>Entry Fee</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.entryFee}
                onChangeText={(t) => setEditForm({ ...editForm, entryFee: t })}
                keyboardType="numeric"
                placeholder="0 for free"
              />
              
              <Text style={styles.inputLabel}>Contact Number</Text>
              <TextInput
                style={styles.formInput}
                value={editForm.contactNumber}
                onChangeText={(t) => setEditForm({ ...editForm, contactNumber: t })}
                keyboardType="phone-pad"
                placeholder="Contact for inquiries"
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={updateTournament} disabled={saving}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Match Modal */}
      <Modal visible={showAddMatch} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>➕ Add Match</Text>
            
            <Text style={styles.inputLabel}>Team 1 *</Text>
            <TextInput
              style={styles.formInput}
              value={matchForm.team1}
              onChangeText={(t) => setMatchForm({ ...matchForm, team1: t })}
              placeholder="First team name"
            />
            
            <Text style={styles.inputLabel}>Team 2 *</Text>
            <TextInput
              style={styles.formInput}
              value={matchForm.team2}
              onChangeText={(t) => setMatchForm({ ...matchForm, team2: t })}
              placeholder="Second team name"
            />
            
            <Text style={styles.inputLabel}>Round</Text>
            <TextInput
              style={styles.formInput}
              value={matchForm.round}
              onChangeText={(t) => setMatchForm({ ...matchForm, round: t })}
              placeholder="e.g. Semi-Final, Final"
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddMatch(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={addMatch}>
                <Text style={styles.saveBtnText}>Add Match</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Sport Badge */}
        <View style={styles.sportBanner}>
          <Text style={styles.sportEmoji}>{getSportEmoji(tournament.sport)}</Text>
          <View style={styles.sportBadge}>
            <Text style={styles.sportText}>{tournament.sport}</Text>
          </View>
        </View>

        {/* Tournament Info */}
        <Text style={styles.title}>{tournament.title}</Text>
        <Text style={styles.description}>{tournament.description}</Text>

        {/* Details Grid */}
        <View style={styles.detailsGrid}>
          <DetailItem icon="📍" label="Location" value={tournament.location} />
          <DetailItem icon="📅" label="Start" value={formatDate(tournament.startDate)} />
          <DetailItem icon="🏁" label="End" value={formatDate(tournament.endDate)} />
          <DetailItem icon="👥" label="Teams" value={tournament.teams?.length || 0} />
          <DetailItem icon="💰" label="Entry Fee" value={tournament.entryFee ? `PKR ${tournament.entryFee}` : 'Free'} />
          <DetailItem icon="🏆" label="Prize" value={tournament.prize || 'TBA'} />
        </View>

        {/* Teams */}
        {tournament.teams && tournament.teams.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Participating Teams</Text>
            {tournament.teams.map((team, idx) => (
              <View key={idx} style={styles.teamItem}>
                <Text style={styles.teamNumber}>{idx + 1}</Text>
                <Text style={styles.teamName}>{team}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Matches */}
        {tournament.matches && tournament.matches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Matches</Text>
            {tournament.matches.map((match, idx) => (
              <View key={match.id || idx} style={styles.matchCard}>
                <View style={styles.matchHeader}>
                  <Text style={styles.matchRound}>{match.round || `Match ${idx + 1}`}</Text>
                  <Text style={styles.matchDate}>{formatDate(match.date)}</Text>
                </View>
                <View style={styles.matchTeams}>
                  <Text style={styles.matchTeam}>{match.team1}</Text>
                  <Text style={styles.vs}>VS</Text>
                  <Text style={styles.matchTeam}>{match.team2}</Text>
                </View>
                {match.score && (
                  <Text style={styles.matchScore}>Score: {match.score}</Text>
                )}
                {match.result && (
                  <View style={styles.resultBadge}>
                    <Text style={styles.resultText}>🏆 {match.result}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Contact */}
        {tournament.contactNumber && (
          <View style={styles.contactCard}>
            <Text style={styles.contactLabel}>📞 Contact</Text>
            <Text style={styles.contactValue}>{tournament.contactNumber}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailIcon}>{icon}</Text>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: COLORS.textLight },
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
  content: { padding: 20, paddingBottom: 40 },
  sportBanner: { alignItems: 'center', marginBottom: 16 },
  sportEmoji: { fontSize: 50 },
  sportBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  sportText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginBottom: 8 },
  description: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    elevation: 2,
    gap: 0,
  },
  detailItem: {
    width: '50%',
    padding: 12,
    alignItems: 'center',
  },
  detailIcon: { fontSize: 22 },
  detailLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
  detailValue: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 2, textAlign: 'center' },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 12 },
  teamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    elevation: 1,
  },
  teamNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '20',
    color: COLORS.primary,
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '800',
    marginRight: 12,
    fontSize: 13,
  },
  teamName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  matchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  matchRound: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  matchDate: { fontSize: 12, color: COLORS.textLight },
  matchTeams: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  matchTeam: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1, textAlign: 'center' },
  vs: { fontSize: 14, fontWeight: '800', color: COLORS.error },
  matchScore: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginTop: 10 },
  resultBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  resultText: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },
  contactCard: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  contactLabel: { fontSize: 13, color: COLORS.textLight },
  contactValue: { fontSize: 18, fontWeight: '700', color: COLORS.primary, marginTop: 4 },
  // Management styles
  editHeaderBtn: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  manageBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  addMatchBtn: {
    flex: 1,
    backgroundColor: COLORS.primary + '15',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addMatchText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  deleteBtn: {
    backgroundColor: COLORS.error + '15',
    padding: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteText: { color: COLORS.error, fontWeight: '600', fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 10 },
  formInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  saveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
