import React, { useState } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    StyleSheet, Linking, Alert,
} from 'react-native';
import { COLORS } from '../config/constants';

const HELPLINES = [
    { name: 'Rescue 1122', number: '1122', icon: '🚑', desc: 'Emergency Health & Rescue', color: '#E53935', category: 'Emergency' },
    { name: 'Police', number: '15', icon: '🚔', desc: 'Police Emergency', color: '#1565C0', category: 'Emergency' },
    { name: 'Fire Brigade', number: '16', icon: '🚒', desc: 'Fire Emergency', color: '#FF6F00', category: 'Emergency' },
    { name: 'Edhi Foundation', number: '115', icon: '🏥', desc: 'Ambulance & Social Services', color: '#2E7D32', category: 'Emergency' },
    { name: 'Motorway Police', number: '130', icon: '🛣️', desc: 'Motorway Assistance', color: '#00695C', category: 'Police' },
    { name: 'Bomb Disposal', number: '15', icon: '💣', desc: 'Bomb Threat & Disposal', color: '#4E342E', category: 'Emergency' },
    { name: 'CPLC', number: '1166', icon: '📞', desc: 'Citizens-Police Liaison Committee', color: '#283593', category: 'Police' },
    { name: 'Women Protection', number: '8787', icon: '👩', desc: 'Women Safety Helpline', color: '#AD1457', category: 'Protection' },
    { name: 'Child Protection', number: '1121', icon: '👶', desc: 'Child Abuse & Protection', color: '#F57C00', category: 'Protection' },
    { name: 'WASA', number: '1199', icon: '💧', desc: 'Water & Sanitation', color: '#0277BD', category: 'Utility' },
    { name: 'Sui Gas', number: '1199', icon: '🔥', desc: 'Gas Emergency', color: '#E65100', category: 'Utility' },
    { name: 'LESCO', number: '132', icon: '⚡', desc: 'Electricity Complaints', color: '#F9A825', category: 'Utility' },
    { name: 'NADRA', number: '9211', icon: '🪪', desc: 'ID Card & Registration', color: '#1B5E20', category: 'Government' },
    { name: 'Railways', number: '1300', icon: '🚂', desc: 'Pakistan Railways Info', color: '#37474F', category: 'Transport' },
    { name: 'PIA', number: '111-786-786', icon: '✈️', desc: 'Pakistan International Airlines', color: '#006064', category: 'Transport' },
    { name: 'Revenue', number: '042-99210012', icon: '🏛️', desc: 'Revenue & Tax', color: '#4A148C', category: 'Government' },
    { name: 'Anti-Corruption', number: '1020', icon: '⚖️', desc: 'Anti-Corruption Hotline', color: '#D50000', category: 'Government' },
    { name: 'PM Complaint Cell', number: '1389', icon: '📋', desc: 'Citizen Complaint Portal', color: '#1A237E', category: 'Government' },
    { name: 'Drug Abuse', number: '0800-12345', icon: '💊', desc: 'Drug Abuse Helpline', color: '#880E4F', category: 'Health' },
    { name: 'Mental Health', number: '0311-7786264', icon: '🧠', desc: 'Mental Health Support', color: '#6A1B9A', category: 'Health' },
    { name: 'Blood Donors', number: '0800-22444', icon: '🩸', desc: 'Blood Donation Info', color: '#B71C1C', category: 'Health' },
    { name: 'Airport Info', number: '114', icon: '🛬', desc: 'Airport Information', color: '#0D47A1', category: 'Transport' },
    { name: 'Postal Service', number: '111-172-172', icon: '📮', desc: 'Pakistan Post', color: '#E64A19', category: 'Government' },
];

const CATEGORIES = ['All', 'Emergency', 'Police', 'Protection', 'Utility', 'Government', 'Transport', 'Health'];

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
                    <Text style={styles.backBtn}>← Back</Text>
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
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
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
