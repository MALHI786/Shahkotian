import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ScrollView, Alert, Linking,
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
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  // Sport Filter - Circles
  sportList: { paddingHorizontal: 12, paddingVertical: 12, gap: 16 },
  sportCircleWrap: { alignItems: 'center' },
  sportCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sportCircleActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  sportCircleIcon: { fontSize: 22 },
  sportCircleLabel: { fontSize: 10, fontWeight: '500', color: COLORS.textSecondary, marginTop: 4 },
  sportLabelActive: { color: COLORS.accent, fontWeight: '700' },
  // Tournament Card - Expandable
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
  },
  cardExpanded: { borderWidth: 1, borderColor: COLORS.accent + '40' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  sportBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sportIcon: { fontSize: 24 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  cardSport: { fontSize: 12, color: COLORS.accent, fontWeight: '600', marginBottom: 2 },
  cardDate: { fontSize: 11, color: COLORS.textSecondary },
  expandIcon: { fontSize: 14, color: COLORS.textLight, paddingHorizontal: 8 },
  // Expanded Content
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  infoLabel: { fontSize: 12, color: COLORS.textSecondary },
  infoValue: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  descText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6, lineHeight: 18 },
  actionRow: { flexDirection: 'row', marginTop: 12, gap: 10 },
  detailBtn: {
    flex: 1,
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  detailBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  deleteBtn: {
    width: 44,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#EF4444' + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 18 },
  // Empty
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
});
