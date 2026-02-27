import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Linking, Alert,
} from 'react-native';
import { COLORS } from '../config/constants';

// Complete Punjab Government Helplines
const PUNJAB_HELPLINES = [
  // Emergency Services
  { name: 'Rescue 1122', number: '1122', icon: '🚑', desc: 'Emergency Health & Rescue Punjab', color: '#E53935', category: 'Emergency', priority: 1 },
  { name: 'Police Emergency', number: '15', icon: '🚔', desc: 'Punjab Police Emergency', color: '#1565C0', category: 'Emergency', priority: 1 },
  { name: 'Fire Brigade', number: '16', icon: '🚒', desc: 'Fire Emergency Service', color: '#FF6F00', category: 'Emergency', priority: 1 },
  { name: 'Edhi Foundation', number: '115', icon: '🏥', desc: 'Ambulance & Social Services', color: '#2E7D32', category: 'Emergency', priority: 1 },
  
  // Punjab Specific
  { name: 'CM Punjab Complaint', number: '8300', icon: '📋', desc: 'Chief Minister Punjab Complaint Cell', color: '#1A237E', category: 'Government', priority: 2 },
  { name: 'Punjab Safe Cities', number: '0800-11-11-5', icon: '📹', desc: 'PSCA - Safe Cities Authority', color: '#283593', category: 'Police', priority: 2 },
  { name: 'Punjab IT Helpline', number: '0800-22-500', icon: '💻', desc: 'Punjab Information Technology Board', color: '#00695C', category: 'Government', priority: 3 },
  { name: 'Punjab Healthcare', number: '0800-00-440', icon: '🏥', desc: 'Punjab Health Department', color: '#C62828', category: 'Health', priority: 2 },
  { name: 'Punjab Revenue', number: '042-99210012', icon: '🏛️', desc: 'Board of Revenue Punjab', color: '#4A148C', category: 'Government', priority: 3 },
  { name: 'Punjab Food Authority', number: '0800-04786', icon: '🍽️', desc: 'PFA Food Safety Complaints', color: '#E65100', category: 'Government', priority: 3 },
  
  // Utilities
  { name: 'LESCO', number: '132', icon: '⚡', desc: 'Lahore Electric Supply Company', color: '#F9A825', category: 'Utility', priority: 2 },
  { name: 'FESCO', number: '132', icon: '⚡', desc: 'Faisalabad Electric Supply', color: '#F57C00', category: 'Utility', priority: 2 },
  { name: 'GEPCO', number: '132', icon: '⚡', desc: 'Gujranwala Electric Supply', color: '#FFA000', category: 'Utility', priority: 2 },
  { name: 'WASA Lahore', number: '1334', icon: '💧', desc: 'Water & Sanitation Agency', color: '#0277BD', category: 'Utility', priority: 2 },
  { name: 'Sui Gas (SNGPL)', number: '1199', icon: '🔥', desc: 'Sui Northern Gas Pipelines', color: '#E65100', category: 'Utility', priority: 2 },
  { name: 'PTCL', number: '1218', icon: '📞', desc: 'Pakistan Telecommunication Company', color: '#00695C', category: 'Utility', priority: 3 },
  
  // Police & Safety
  { name: 'Motorway Police', number: '130', icon: '🛣️', desc: 'National Highways & Motorway Police', color: '#00695C', category: 'Police', priority: 2 },
  { name: 'CPLC Punjab', number: '1166', icon: '📞', desc: 'Citizens-Police Liaison Committee', color: '#283593', category: 'Police', priority: 2 },
  { name: 'Anti-Corruption', number: '1020', icon: '⚖️', desc: 'Anti-Corruption Establishment Punjab', color: '#D50000', category: 'Government', priority: 2 },
  { name: 'Cyber Crime', number: '9911', icon: '🖥️', desc: 'FIA Cyber Crime Wing', color: '#1565C0', category: 'Police', priority: 2 },
  
  // Protection
  { name: 'Women Protection', number: '8787', icon: '👩', desc: 'Punjab Women Protection Authority', color: '#AD1457', category: 'Protection', priority: 1 },
  { name: 'Child Protection', number: '1121', icon: '👶', desc: 'Child Protection Bureau Punjab', color: '#F57C00', category: 'Protection', priority: 1 },
  { name: 'Human Rights', number: '042-99210909', icon: '✊', desc: 'Punjab Human Rights Commission', color: '#5D4037', category: 'Protection', priority: 2 },
  
  // Health
  { name: 'Mental Health', number: '0311-7786264', icon: '🧠', desc: 'Mental Health Support Line', color: '#6A1B9A', category: 'Health', priority: 2 },
  { name: 'Drug Abuse', number: '0800-12345', icon: '💊', desc: 'Anti-Narcotics Helpline', color: '#880E4F', category: 'Health', priority: 2 },
  { name: 'Blood Donors', number: '0800-22444', icon: '🩸', desc: 'Blood Donation Info', color: '#B71C1C', category: 'Health', priority: 2 },
  
  // Transport
  { name: 'Punjab Metrobus', number: '0800-00-786', icon: '🚌', desc: 'Lahore Metrobus & Orange Line', color: '#E65100', category: 'Transport', priority: 3 },
  { name: 'Railways', number: '117', icon: '🚂', desc: 'Pakistan Railways Inquiry', color: '#37474F', category: 'Transport', priority: 3 },
  { name: 'Airport Lahore', number: '114', icon: '✈️', desc: 'Allama Iqbal Int\'l Airport', color: '#0D47A1', category: 'Transport', priority: 3 },
  
  // Government Services
  { name: 'NADRA', number: '9211', icon: '🪪', desc: 'National Database & Registration', color: '#1B5E20', category: 'Government', priority: 2 },
  { name: 'Passport Office', number: '042-99200150', icon: '📕', desc: 'Directorate General Immigration', color: '#1565C0', category: 'Government', priority: 3 },
  { name: 'Excise Punjab', number: '042-99210501', icon: '🚗', desc: 'Vehicle & Driving License', color: '#4E342E', category: 'Government', priority: 3 },
  { name: 'FBR', number: '0800-00-227', icon: '💰', desc: 'Federal Board of Revenue', color: '#2E7D32', category: 'Government', priority: 3 },
  { name: 'PM Complaint Cell', number: '1389', icon: '📋', desc: 'Prime Minister Citizen Portal', color: '#1A237E', category: 'Government', priority: 2 },
  { name: 'Post Office', number: '111-172-172', icon: '📮', desc: 'Pakistan Post', color: '#E64A19', category: 'Government', priority: 3 },
];

const CATEGORIES = ['All', 'Emergency', 'Police', 'Protection', 'Health', 'Utility', 'Government', 'Transport'];

export default function GovtOfficesScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');

  const filtered = PUNJAB_HELPLINES
    .filter(h => {
      const matchSearch = h.name.toLowerCase().includes(search.toLowerCase()) ||
        h.desc.toLowerCase().includes(search.toLowerCase()) ||
        h.number.includes(search);
      const matchCat = selectedCat === 'All' || h.category === selectedCat;
      return matchSearch && matchCat;
    })
    .sort((a, b) => a.priority - b.priority);

  const callNumber = (number) => {
    Linking.openURL(`tel:${number}`).catch(() =>
      Alert.alert('Error', 'Unable to make a call from this device')
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📞 Punjab Helplines</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Emergency banner */}
      <TouchableOpacity style={styles.emergencyBanner} onPress={() => callNumber('1122')}>
        <Text style={styles.emergencyIcon}>🚨</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.emergencyTitle}>Emergency? Call 1122</Text>
          <Text style={styles.emergencyDesc}>Rescue Punjab • Ambulance • Fire • Rescue</Text>
        </View>
        <View style={styles.callIconContainer}>
          <Text style={styles.callIcon}>📞</Text>
        </View>
      </TouchableOpacity>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search helpline by name or number..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={COLORS.textLight}
        />
      </View>

      {/* Category filters */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        style={styles.catList}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.catChip, selectedCat === item && styles.catChipActive]}
            onPress={() => setSelectedCat(item)}
          >
            <Text style={[styles.catChipText, selectedCat === item && styles.catChipTextActive]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Count badge */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>{filtered.length} helplines available</Text>
      </View>

      {/* Helplines list - Compact 2-column grid */}
      <FlatList
        data={filtered}
        keyExtractor={(item, i) => `${item.number}-${i}`}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.helplineCard, item.priority === 1 && styles.helplineCardUrgent]} 
            onPress={() => callNumber(item.number)}
          >
            <View style={[styles.helplineIcon, { backgroundColor: item.color + '18' }]}>
              <Text style={{ fontSize: 20 }}>{item.icon}</Text>
            </View>
            <Text style={styles.helplineName} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.helplineNumText, { color: item.color }]}>{item.number}</Text>
            <Text style={styles.helplineDesc} numberOfLines={1}>{item.desc}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>🔍</Text>
            <Text style={{ color: COLORS.textLight }}>No helplines found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primary, paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16,
  },
  backBtn: { color: COLORS.white, fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
  emergencyBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF0F0',
    margin: 12, padding: 14, borderRadius: 14, borderLeftWidth: 4, borderLeftColor: '#E53935',
    elevation: 2,
  },
  emergencyIcon: { fontSize: 32, marginRight: 12 },
  emergencyTitle: { fontSize: 16, fontWeight: '700', color: '#C62828' },
  emergencyDesc: { fontSize: 12, color: '#EF5350', marginTop: 2 },
  callIconContainer: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#E53935',
    justifyContent: 'center', alignItems: 'center',
  },
  callIcon: { fontSize: 20 },
  searchRow: { paddingHorizontal: 12, marginBottom: 8 },
  searchInput: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, fontSize: 14,
    color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
  },
  catList: { maxHeight: 44, marginBottom: 6 },
  catChip: {
    paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 20, marginRight: 8,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  catChipTextActive: { color: COLORS.white },
  countRow: { paddingHorizontal: 16, paddingVertical: 6 },
  countText: { fontSize: 12, color: COLORS.textLight },
  helplineCard: {
    flex: 1, alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 12, padding: 12, marginBottom: 10, elevation: 1,
  },
  helplineCardUrgent: { borderWidth: 1, borderColor: '#E53935' + '40' },
  helplineIcon: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  helplineName: { fontSize: 13, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  helplineNumText: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  helplineDesc: { fontSize: 10, color: COLORS.textLight, marginTop: 4, textAlign: 'center' },
});
