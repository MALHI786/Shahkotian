import React, { useState } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    StyleSheet, Linking, Alert,
} from 'react-native';
import { COLORS } from '../config/constants';

const HELPLINES = [
    // === EMERGENCY ===
    { name: 'Rescue 1122', number: '1122', icon: '🚑', desc: 'Emergency Health & Rescue Punjab', color: '#E53935', category: 'Emergency' },
    { name: 'Police Emergency', number: '15', icon: '🚔', desc: 'Police Emergency Helpline', color: '#1565C0', category: 'Emergency' },
    { name: 'Fire Brigade', number: '16', icon: '🚒', desc: 'Fire Emergency', color: '#FF6F00', category: 'Emergency' },
    { name: 'Edhi Foundation', number: '115', icon: '🏥', desc: 'Ambulance & Social Services', color: '#2E7D32', category: 'Emergency' },

    // === CM PUNJAB / GOVERNMENT COMPLAINTS ===
    { name: 'CM Complaint Center', number: '0800-02345', icon: '📋', desc: 'Chief Minister Punjab Complaint Center (Toll Free)', color: '#1A237E', category: 'CM Punjab' },
    { name: 'CM Punjab (1000)', number: '1000', icon: '📞', desc: 'CM Complaint Center Short Code', color: '#283593', category: 'CM Punjab' },
    { name: 'Suthra Punjab', number: '0800-02345', icon: '🧹', desc: 'Clean Punjab Complaints (CM Office)', color: '#00897B', category: 'CM Punjab' },
    { name: 'Citizen Facilitation', number: '0800-09100', icon: '🏠', desc: 'CFC, Apni Chat Apna Ghar, e-Construction', color: '#4527A0', category: 'CM Punjab' },
    { name: 'Dastak - Doorstep', number: '1202', icon: '🚪', desc: 'Doorstep Service Delivery Punjab', color: '#00695C', category: 'CM Punjab' },
    { name: 'PM Complaint Portal', number: '1389', icon: '📋', desc: 'Prime Minister Citizen Portal', color: '#1A237E', category: 'Government' },
    { name: 'Anti-Corruption', number: '1020', icon: '⚖️', desc: 'Anti-Corruption Hotline Punjab', color: '#D50000', category: 'Government' },
    { name: 'Human Rights & Minorities', number: '1040', icon: '🤝', desc: 'Human Rights & Minority Affairs', color: '#6A1B9A', category: 'CM Punjab' },
    { name: 'Social Welfare', number: '1312', icon: '💝', desc: 'Social Welfare & Bait-ul-Maal', color: '#AD1457', category: 'CM Punjab' },

    // === POLICE ===
    { name: 'Motorway Police', number: '130', icon: '🛣️', desc: 'Motorway Assistance & Safety', color: '#00695C', category: 'Police' },
    { name: 'Punjab Police Women', number: '8787', icon: '👩', desc: 'Women Safety Helpline Punjab Police', color: '#AD1457', category: 'Police' },
    { name: 'Counter Narcotics', number: '1012', icon: '🚫', desc: 'Punjab Counter Narcotics Force', color: '#4E342E', category: 'Police' },

    // === PROTECTION ===
    { name: 'Child Protection', number: '1121', icon: '👶', desc: 'Child Abuse Helpline Punjab', color: '#F57C00', category: 'Protection' },

    // === UTILITIES ===
    { name: 'LESCO (Electricity)', number: '132', icon: '⚡', desc: 'LESCO Complaints & Outages', color: '#F9A825', category: 'Utility' },
    { name: 'WASA (Water)', number: '1199', icon: '💧', desc: 'Water Supply & Sewerage', color: '#0277BD', category: 'Utility' },
    { name: 'Sui Gas (SNGPL)', number: '1223', icon: '🔥', desc: 'SNGPL Gas Emergency & Complaints', color: '#E65100', category: 'Utility' },
    { name: 'Excise & Taxation', number: '0800-08786', icon: '🧾', desc: 'Tax & Vehicle Registration', color: '#5D4037', category: 'Utility' },

    // === HEALTH ===
    { name: 'Drug Abuse Helpline', number: '0800-12345', icon: '💊', desc: 'National Drug Abuse Helpline', color: '#880E4F', category: 'Health' },
    { name: 'Mental Health', number: '0311-7786264', icon: '🧠', desc: 'Umang Mental Health Helpline', color: '#6A1B9A', category: 'Health' },
    { name: 'Blood Donors', number: '0800-22444', icon: '🩸', desc: 'Sundas Foundation Blood Info', color: '#B71C1C', category: 'Health' },

    // === GOVERNMENT ===
    { name: 'NADRA', number: '9211', icon: '🪪', desc: 'CNIC & Registration', color: '#1B5E20', category: 'Government' },
    { name: 'Postal Service', number: '111-172-172', icon: '📮', desc: 'Pakistan Post Complaints', color: '#E64A19', category: 'Government' },
    { name: 'Agriculture Dept', number: '1063', icon: '🌾', desc: 'Agriculture Punjab Helpline', color: '#33691E', category: 'Government' },
    { name: 'Livestock & Dairy', number: '0800-09211', icon: '🐄', desc: 'Livestock Department Punjab', color: '#795548', category: 'Government' },
    { name: 'School Education', number: '111-112-020', icon: '🏫', desc: 'Education Department Punjab', color: '#1565C0', category: 'Government' },
    { name: 'Labour Department', number: '1314', icon: '👷', desc: 'Labour & HR Punjab', color: '#37474F', category: 'Government' },
    { name: 'Tourism Punjab', number: '1421', icon: '🏔️', desc: 'Tourism Department Helpline', color: '#00838F', category: 'Government' },
    { name: 'eBiz Punjab', number: '1284', icon: '💼', desc: 'Business Registration Online', color: '#2E7D32', category: 'Government' },
    { name: 'Overseas Pakistanis', number: '111-672-672', icon: '🌍', desc: 'Overseas Pakistani Commission', color: '#0D47A1', category: 'Government' },

    // === TRANSPORT ===
    { name: 'Railways', number: '117', icon: '🚂', desc: 'Pakistan Railways Information', color: '#37474F', category: 'Transport' },
    { name: 'Airport Info', number: '114', icon: '🛬', desc: 'Airport Information Lahore', color: '#0D47A1', category: 'Transport' },
    { name: 'Punjab Masstransit', number: '1762', icon: '🚌', desc: 'Metro Bus / Orange Line', color: '#E65100', category: 'Transport' },
    { name: 'PIA', number: '111-786-786', icon: '✈️', desc: 'Pakistan International Airlines', color: '#006064', category: 'Transport' },
];

const CATEGORIES = ['All', 'Emergency', 'CM Punjab', 'Police', 'Protection', 'Utility', 'Government', 'Transport', 'Health'];

export default function HelplineScreen({ navigation }) {
    const [search, setSearch] = useState('');
    const [selectedCat, setSelectedCat] = useState('All');

    const filtered = HELPLINES.filter(h => {
        const matchSearch = h.name.toLowerCase().includes(search.toLowerCase()) ||
            h.desc.toLowerCase().includes(search.toLowerCase()) ||
            h.number.includes(search);
        const matchCat = selectedCat === 'All' || h.category === selectedCat;
        return matchSearch && matchCat;
    });

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
                <Text style={styles.headerTitle}>📞 Helplines</Text>
                <View style={{ width: 50 }} />
            </View>

            {/* Emergency banner */}
            <TouchableOpacity style={styles.emergencyBanner} onPress={() => callNumber('1122')}>
                <Text style={styles.emergencyIcon}>🚨</Text>
                <View style={{ flex: 1 }}>
                    <Text style={styles.emergencyTitle}>Emergency? Call 1122</Text>
                    <Text style={styles.emergencyDesc}>Rescue Punjab • Health & Rescue</Text>
                </View>
                <Text style={styles.callIcon}>📞</Text>
            </TouchableOpacity>

            {/* Search */}
            <View style={styles.searchRow}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search helplines..."
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
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.catChip, selectedCat === item && styles.catChipActive]}
                        onPress={() => setSelectedCat(item)}
                    >
                        <Text style={[styles.catChipText, selectedCat === item && styles.catChipTextActive]}>{item}</Text>
                    </TouchableOpacity>
                )}
            />

            {/* Helplines list */}
            <FlatList
                data={filtered}
                keyExtractor={(item, i) => `${item.number}-${i}`}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.helplineCard} onPress={() => callNumber(item.number)}>
                        <View style={[styles.helplineIcon, { backgroundColor: item.color + '18' }]}>
                            <Text style={{ fontSize: 24 }}>{item.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.helplineName}>{item.name}</Text>
                            <Text style={styles.helplineDesc}>{item.desc}</Text>
                        </View>
                        <View style={styles.helplineNumber}>
                            <Text style={[styles.helplineNumText, { color: item.color }]}>{item.number}</Text>
                            <Text style={styles.tapCall}>Tap to call</Text>
                        </View>
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
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
    emergencyBanner: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF0F0',
        margin: 12, padding: 12, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#E53935',
    },
    emergencyIcon: { fontSize: 28, marginRight: 10 },
    emergencyTitle: { fontSize: 15, fontWeight: '700', color: '#C62828' },
    emergencyDesc: { fontSize: 12, color: '#EF5350', marginTop: 1 },
    callIcon: { fontSize: 24 },
    searchRow: { paddingHorizontal: 12, marginBottom: 6 },
    searchInput: {
        backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, fontSize: 14,
        color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
    },
    catList: { maxHeight: 44, paddingHorizontal: 12, marginBottom: 8 },
    catChip: {
        paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 20, marginRight: 8,
        backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    },
    catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    catChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
    catChipTextActive: { color: COLORS.white },
    helplineCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
        borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1,
    },
    helplineIcon: {
        width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    helplineName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    helplineDesc: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    helplineNumber: { alignItems: 'flex-end' },
    helplineNumText: { fontSize: 16, fontWeight: '800' },
    tapCall: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
});
