import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  ScrollView, Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS, SPORT_TYPES } from '../config/constants';
import { tournamentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function TournamentsScreen({ navigation }) {
  const { user, isAdmin } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Create Tournament state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '', sport: 'CRICKET', description: '', venue: '',
    startDate: '', endDate: '', prize: '', entryFee: '', contactNumber: '',
  });
  const [teamInput, setTeamInput] = useState('');
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    loadTournaments();
  }, [selectedSport]);

  const loadTournaments = async () => {
    try {
      setLoading(true);
      const response = await tournamentsAPI.getAll(selectedSport);
      setTournaments(response.data.tournaments);
    } catch (error) {
      console.error('Tournaments error:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteTournament = async (id, name) => {
    Alert.alert('Delete Tournament', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await tournamentsAPI.delete(id);
            loadTournaments();
            Alert.alert('Deleted', 'Tournament removed.');
          } catch (error) {
            Alert.alert('Error', 'Failed to delete tournament.');
          }
        },
      },
    ]);
  };

  const addTeam = () => {
    const name = teamInput.trim();
    if (name && !teams.includes(name)) {
      setTeams([...teams, name]);
      setTeamInput('');
    }
  };

  const removeTeam = (index) => {
    setTeams(teams.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!form.name || !form.description || !form.venue || !form.startDate) {
      Alert.alert('Missing Fields', 'Please fill all required fields.');
      return;
    }
    try {
      setCreating(true);
      await tournamentsAPI.createJSON({
        ...form,
        entryFee: form.entryFee ? parseFloat(form.entryFee) : 0,
        teams,
      });
      setShowCreate(false);
      setForm({ name: '', sport: 'CRICKET', description: '', venue: '', startDate: '', endDate: '', prize: '', entryFee: '', contactNumber: '' });
      setTeams([]);
      setTeamInput('');
      loadTournaments();
      Alert.alert('Success', 'Tournament created!');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create tournament.');
    } finally {
      setCreating(false);
    }
  };

  const renderTournament = ({ item }) => {
    const isExpanded = expandedId === item.id;
    const sportInfo = SPORT_TYPES.find(s => s.key === item.sport) || { icon: '🏆', label: item.sport };
    const canDelete = user && (isAdmin || item.createdById === user.id);

    return (
      <TouchableOpacity
        style={[styles.card, isExpanded && styles.cardExpanded]}
        activeOpacity={0.8}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.sportBadge}>
            <Text style={styles.sportIcon}>{sportInfo.icon}</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardSport}>{sportInfo.label}</Text>
            <Text style={styles.cardDate}>
              📅 {new Date(item.startDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
          <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>📍 Venue</Text>
              <Text style={styles.infoValue}>{item.venue}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>📅 Start</Text>
              <Text style={styles.infoValue}>
                {new Date(item.startDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            {item.endDate && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📅 End</Text>
                <Text style={styles.infoValue}>
                  {new Date(item.endDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>🏏 Matches</Text>
              <Text style={styles.infoValue}>{item._count?.matches || 0}</Text>
            </View>
            {item.description && (
              <Text style={styles.descText}>{item.description}</Text>
            )}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.detailBtn}
                onPress={() => navigation.navigate('TournamentDetail', { id: item.id })}
              >
                <Text style={styles.detailBtnText}>View Matches</Text>
              </TouchableOpacity>
              {canDelete && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteTournament(item.id, item.name)}
                >
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>🏆 Tournaments</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.createBtnText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {/* Sport Filter - Circles */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportList}>
        {[{ key: null, label: 'All', icon: '🏆' }, ...SPORT_TYPES].map((item) => (
          <TouchableOpacity
            key={item.key || 'all'}
            style={styles.sportCircleWrap}
            onPress={() => setSelectedSport(item.key)}
          >
            <View style={[styles.sportCircle, selectedSport === item.key && styles.sportCircleActive]}>
              <Text style={styles.sportCircleIcon}>{item.icon}</Text>
            </View>
            <Text style={[styles.sportCircleLabel, selectedSport === item.key && styles.sportLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tournament List */}
      <FlatList
        data={tournaments}
        renderItem={renderTournament}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTournaments} colors={[COLORS.primary]} />}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🏆</Text>
              <Text style={styles.emptyText}>No tournaments scheduled yet</Text>
              <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
                <Text style={styles.createBtnText}>+ Create First Tournament</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {/* Create Tournament Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>🏆 Create Tournament</Text>

              <Text style={styles.label}>Name *</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={t => setForm({ ...form, name: t })} placeholder="Tournament name" />

              <Text style={styles.label}>Sport *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {SPORT_TYPES.map(s => (
                  <TouchableOpacity key={s.key} onPress={() => setForm({ ...form, sport: s.key })}
                    style={[styles.sportChip, form.sport === s.key && styles.sportChipActive]}>
                    <Text style={[styles.sportChipText, form.sport === s.key && styles.sportChipTextActive]}>{s.icon} {s.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Description *</Text>
              <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} value={form.description}
                onChangeText={t => setForm({ ...form, description: t })} placeholder="About the tournament" multiline />

              <Text style={styles.label}>Venue / Location *</Text>
              <TextInput style={styles.input} value={form.venue} onChangeText={t => setForm({ ...form, venue: t })} placeholder="e.g. Shahkot Cricket Ground" />

              <Text style={styles.label}>Start Date * (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={form.startDate} onChangeText={t => setForm({ ...form, startDate: t })} placeholder="2026-03-15" keyboardType="numbers-and-punctuation" />

              <Text style={styles.label}>End Date (optional)</Text>
              <TextInput style={styles.input} value={form.endDate} onChangeText={t => setForm({ ...form, endDate: t })} placeholder="2026-04-01" keyboardType="numbers-and-punctuation" />

              <Text style={styles.label}>Prize (optional)</Text>
              <TextInput style={styles.input} value={form.prize} onChangeText={t => setForm({ ...form, prize: t })} placeholder="e.g. PKR 50,000 trophy" />

              <Text style={styles.label}>Entry Fee PKR (optional)</Text>
              <TextInput style={styles.input} value={form.entryFee} onChangeText={t => setForm({ ...form, entryFee: t })} placeholder="0 for free" keyboardType="numeric" />

              <Text style={styles.label}>Contact Number (optional)</Text>
              <TextInput style={styles.input} value={form.contactNumber} onChangeText={t => setForm({ ...form, contactNumber: t })} placeholder="+923001234567" keyboardType="phone-pad" />

              {/* Teams */}
              <Text style={styles.label}>Team Names (optional)</Text>
              <View style={styles.teamInputRow}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={teamInput}
                  onChangeText={setTeamInput} placeholder="Add team name" />
                <TouchableOpacity style={styles.addTeamBtn} onPress={addTeam}>
                  <Text style={styles.addTeamBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {teams.map((t, i) => (
                <View key={i} style={styles.teamTag}>
                  <Text style={styles.teamTagText}>👥 {t}</Text>
                  <TouchableOpacity onPress={() => removeTeam(i)}>
                    <Text style={styles.teamTagRemove}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={creating}>
                  <Text style={styles.submitText}>{creating ? 'Creating...' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6,
  },
  pageTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  createBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  // Sport Filter - Circles
  sportList: { paddingHorizontal: 12, paddingVertical: 12, gap: 16 },
  sportCircleWrap: { alignItems: 'center' },
  sportCircle: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.surface,
    borderWidth: 2, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3,
  },
  sportCircleActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  sportCircleIcon: { fontSize: 22 },
  sportCircleLabel: { fontSize: 10, fontWeight: '500', color: COLORS.textSecondary, marginTop: 4 },
  sportLabelActive: { color: COLORS.accent, fontWeight: '700' },
  // Tournament Card
  card: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, marginBottom: 10, elevation: 2 },
  cardExpanded: { borderWidth: 1, borderColor: COLORS.accent + '40' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  sportBadge: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.accent + '15',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  sportIcon: { fontSize: 24 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  cardSport: { fontSize: 12, color: COLORS.accent, fontWeight: '600', marginBottom: 2 },
  cardDate: { fontSize: 11, color: COLORS.textSecondary },
  expandIcon: { fontSize: 14, color: COLORS.textLight, paddingHorizontal: 8 },
  // Expanded Content
  expandedContent: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  infoLabel: { fontSize: 12, color: COLORS.textSecondary },
  infoValue: { fontSize: 12, fontWeight: '600', color: COLORS.text, flex: 1, textAlign: 'right', marginLeft: 8 },
  descText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6, lineHeight: 18 },
  actionRow: { flexDirection: 'row', marginTop: 12, gap: 10 },
  detailBtn: { flex: 1, backgroundColor: COLORS.accent, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  detailBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  deleteBtn: { width: 44, height: 40, borderRadius: 8, backgroundColor: '#EF4444' + '15', justifyContent: 'center', alignItems: 'center' },
  deleteBtnText: { fontSize: 18 },
  // Empty
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, marginBottom: 8 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: COLORS.background, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, marginBottom: 4 },
  sportChip: { paddingHorizontal: 12, height: 34, justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, marginRight: 8, backgroundColor: COLORS.surface },
  sportChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sportChipText: { fontSize: 13, color: COLORS.textSecondary },
  sportChipTextActive: { color: '#fff', fontWeight: '700' },
  teamInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  addTeamBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center' },
  addTeamBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  teamTag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.primary + '15', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6 },
  teamTagText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  teamTagRemove: { fontSize: 16, color: COLORS.error },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 10 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.background },
  cancelText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 15 },
  submitBtn: { flex: 2, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.primary },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
