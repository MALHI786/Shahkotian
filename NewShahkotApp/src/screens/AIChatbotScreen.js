import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
} from 'react-native';
import { COLORS } from '../config/constants';
import { chatbotAPI } from '../services/api';

const WELCOME_MESSAGE = {
    id: 'welcome',
    text: '🤖 Assalam-o-Alaikum! Main Apna Shahkot ka AI Helper hoon.\n\nAap mujhse app ke baare mein kuch bhi pooch sakte hain:\n\n• "Buy & Sell kaise kare?"\n• "Rishta feature kya hai?"\n• "Tournament kaise banaye?"\n• "Blood donor kaise dhundhe?"\n\nBas poochiye! 💬',
    isBot: true,
};

export default function AIChatbotScreen({ navigation }) {
    const [messages, setMessages] = useState([WELCOME_MESSAGE]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const flatListRef = useRef(null);

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || loading) return;

        Keyboard.dismiss();
        const userMsg = { id: Date.now().toString(), text, isBot: false };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await chatbotAPI.sendMessage(text);
            const botMsg = {
                id: (Date.now() + 1).toString(),
                text: res.data.reply || 'Sorry, kuch samajh nahi aaya. Dobara try karein.',
                isBot: true,
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (err) {
            const errorMsg = {
                id: (Date.now() + 1).toString(),
                text: '⚠️ Maazrat! AI abhi available nahi hai. Thodi der baad try karein.',
                isBot: true,
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (flatListRef.current && messages.length > 0) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
        }
    }, [messages]);

    const QUICK_SUGGESTIONS = [
        'App kaise use kare?',
        'Buy & Sell kya hai?',
        'Rishta kaise lagaye?',
        'Blood donor dhundhe',
    ];

    const renderMessage = ({ item }) => (
        <View style={[styles.msgRow, item.isBot ? styles.botRow : styles.userRow]}>
            {item.isBot && <View style={styles.botAvatar}><Text style={{ fontSize: 18 }}>🤖</Text></View>}
            <View style={[styles.msgBubble, item.isBot ? styles.botBubble : styles.userBubble]}>
                <Text style={[styles.msgText, item.isBot ? styles.botText : styles.userText]}>{item.text}</Text>
            </View>
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>{'<'} Back</Text>
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <View style={styles.headerAvatarWrap}>
                        <Text style={{ fontSize: 22 }}>🤖</Text>
                        <View style={styles.onlineDot} />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>Shahkot AI Helper</Text>
                        <Text style={styles.headerSub}>Always online • Ask anything about the app</Text>
                    </View>
                </View>
            </View>

            {/* Messages */}
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.messagesList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                    loading ? (
                        <View style={[styles.msgRow, styles.botRow]}>
                            <View style={styles.botAvatar}><Text style={{ fontSize: 18 }}>🤖</Text></View>
                            <View style={[styles.msgBubble, styles.botBubble, styles.typingBubble]}>
                                <ActivityIndicator size="small" color={COLORS.primary} />
                                <Text style={styles.typingText}>Soch raha hoon...</Text>
                            </View>
                        </View>
                    ) : null
                }
            />

            {/* Quick Suggestions (only show when few messages) */}
            {messages.length <= 1 && (
                <View style={styles.suggestionsRow}>
                    {QUICK_SUGGESTIONS.map((s, i) => (
                        <TouchableOpacity
                            key={i}
                            style={styles.suggestionChip}
                            onPress={() => { setInput(s); }}
                        >
                            <Text style={styles.suggestionText}>{s}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Input */}
            <View style={styles.inputBar}>
                <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Apna sawaal poochiye..."
                    placeholderTextColor={COLORS.textLight}
                    multiline
                    maxLength={500}
                    editable={!loading}
                    onSubmitEditing={sendMessage}
                    blurOnSubmit={false}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
                    onPress={sendMessage}
                    disabled={!input.trim() || loading}
                >
                    <Text style={styles.sendText}>➤</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0F2F5' },
    header: {
        backgroundColor: '#075E54',
        paddingTop: 50,
        paddingBottom: 14,
        paddingHorizontal: 16,
    },
    backBtn: { marginBottom: 8 },
    backText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    headerAvatarWrap: { position: 'relative' },
    onlineDot: {
        position: 'absolute', bottom: -2, right: -2,
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: '#25D366', borderWidth: 2, borderColor: '#075E54',
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
    headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
    messagesList: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 },
    msgRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end' },
    botRow: { justifyContent: 'flex-start' },
    userRow: { justifyContent: 'flex-end' },
    botAvatar: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center',
        marginRight: 8,
    },
    msgBubble: {
        maxWidth: '78%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    botBubble: {
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
        elevation: 1,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 2,
    },
    userBubble: {
        backgroundColor: '#DCF8C6',
        borderBottomRightRadius: 4,
    },
    msgText: { fontSize: 15, lineHeight: 22 },
    botText: { color: '#1A1A1A' },
    userText: { color: '#1A1A1A' },
    typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    typingText: { fontSize: 13, color: COLORS.textLight, fontStyle: 'italic' },
    suggestionsRow: {
        flexDirection: 'row', flexWrap: 'wrap',
        paddingHorizontal: 12, paddingBottom: 8, gap: 8,
    },
    suggestionChip: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: '#C8E6C9',
    },
    suggestionText: { fontSize: 13, color: '#075E54', fontWeight: '600' },
    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end',
        backgroundColor: '#fff',
        paddingHorizontal: 12, paddingVertical: 8,
        borderTopWidth: 1, borderTopColor: '#E0E0E0',
        gap: 8,
    },
    input: {
        flex: 1, backgroundColor: '#F0F2F5',
        borderRadius: 24, paddingHorizontal: 16,
        paddingVertical: 10, fontSize: 15,
        maxHeight: 100, color: '#1A1A1A',
    },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#075E54', justifyContent: 'center', alignItems: 'center',
    },
    sendBtnDisabled: { backgroundColor: '#B0BEC5' },
    sendText: { fontSize: 20, color: '#fff' },
});
