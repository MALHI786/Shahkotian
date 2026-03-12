import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ScrollView, Animated, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, APP_NAME } from '../config/constants';
import { useAuth } from '../context/AuthContext';
import { bloodAPI } from '../services/api';

const { width, height } = Dimensions.get('window');
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function OnboardingScreen({ navigation }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState(null);
  const [age, setAge] = useState(null);
  const [bloodGroup, setBloodGroup] = useState(null);
  const [registering, setRegistering] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const userName = user?.name?.split(' ')[0] || '';

  // Determine if blood group step is needed (male, 18-30)
  const needsBloodStep = gender === 'male' && age && age >= 18 && age <= 30;

  const animateTransition = (nextStep) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
  };

  const finishOnboarding = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  const handleBloodRegister = async () => {
    if (!bloodGroup) return Alert.alert('Required', 'Please select your blood group.');
    setRegistering(true);
    try {
      await bloodAPI.register({
        name: user?.name,
        phone: user?.phone || user?.whatsapp || '',
        whatsapp: user?.whatsapp || user?.phone || '',
        bloodGroup,
        isEmergency: false,
      });
    } catch (err) {
      // Silently continue — may already be registered or other issue
      console.warn('Blood registration:', err?.response?.data?.error || err.message);
    } finally {
      setRegistering(false);
      animateTransition(step + 1);
    }
  };

  // ── Step 0: Alhumdulillah ─────────────────────────────────────────────
  const renderAlhumdulillah = () => (
    <View style={styles.centered}>
      <Text style={styles.emoji}>🤲</Text>
      <Text style={styles.bigTitle}>Welcome!</Text>
      <Text style={styles.bigTitle}>خوش آمدید</Text>
      <View style={styles.divider} />
      <Text style={styles.alhumdulillahText}>Say one time</Text>
      <Text style={styles.alhumdulillah}>الحمدللہ</Text>
      <Text style={styles.alhumdulillahText}>Alhumdulillah</Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => animateTransition(1)}>
        <Text style={styles.primaryBtnText}>Next →</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Step 1: Gender & Age ──────────────────────────────────────────────
  const renderGenderAge = () => (
    <ScrollView contentContainerStyle={styles.centered} showsVerticalScrollIndicator={false}>
      <Text style={styles.emoji}>👤</Text>
      <Text style={styles.stepTitle}>Tell us about yourself</Text>
      <Text style={styles.stepSubtitle}>اپنے بارے میں بتائیں</Text>

      <Text style={styles.sectionLabel}>Gender / جنس</Text>
      <View style={styles.genderRow}>
        <TouchableOpacity
          style={[styles.genderCard, gender === 'male' && styles.genderSelected]}
          onPress={() => setGender('male')}
        >
          <Text style={styles.genderEmoji}>👨</Text>
          <Text style={[styles.genderText, gender === 'male' && styles.genderTextSelected]}>Male</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.genderCard, gender === 'female' && styles.genderSelected]}
          onPress={() => setGender('female')}
        >
          <Text style={styles.genderEmoji}>👩</Text>
          <Text style={[styles.genderText, gender === 'female' && styles.genderTextSelected]}>Female</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>Age / عمر</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ageScroll}>
        {Array.from({ length: 73 }, (_, i) => i + 18).map((a) => (
          <TouchableOpacity
            key={a}
            style={[styles.ageChip, age === a && styles.ageChipSelected]}
            onPress={() => setAge(a)}
          >
            <Text style={[styles.ageChipText, age === a && styles.ageChipTextSelected]}>{a}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.primaryBtn, (!gender || !age) && styles.btnDisabled]}
        disabled={!gender || !age}
        onPress={() => {
          if (needsBloodStep) {
            animateTransition(2);
          } else {
            animateTransition(3);
          }
        }}
      >
        <Text style={styles.primaryBtnText}>Next →</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── Step 2: Blood Group (only for male 18-30) ────────────────────────
  const renderBloodGroup = () => (
    <View style={styles.centered}>
      <Text style={styles.emoji}>🩸</Text>
      <Text style={styles.stepTitle}>Your Blood Group</Text>
      <Text style={styles.stepSubtitle}>آپ کا بلڈ گروپ کیا ہے؟</Text>
      <Text style={styles.bloodNote}>
        You will be registered as a blood donor to help people in need.{'\n'}
        آپ کو بلڈ ڈونر کے طور پر رجسٹر کیا جائے گا۔
      </Text>

      <View style={styles.bloodGrid}>
        {BLOOD_GROUPS.map((bg) => (
          <TouchableOpacity
            key={bg}
            style={[styles.bloodChip, bloodGroup === bg && styles.bloodChipSelected]}
            onPress={() => setBloodGroup(bg)}
          >
            <Text style={[styles.bloodChipText, bloodGroup === bg && styles.bloodChipTextSelected]}>{bg}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, (!bloodGroup || registering) && styles.btnDisabled]}
        disabled={!bloodGroup || registering}
        onPress={handleBloodRegister}
      >
        <Text style={styles.primaryBtnText}>{registering ? 'Registering...' : 'Next →'}</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Step 3: Features Overview ─────────────────────────────────────────
  const renderFeaturesOverview = () => {
    const features = [
      { icon: 'newspaper', label: 'News & Articles / خبریں' },
      { icon: 'cart', label: 'Buy & Sell / خرید و فروخت' },
      { icon: 'chatbubbles', label: 'Community Chat / کمیونٹی چیٹ' },
      { icon: 'trophy', label: 'Tournaments / ٹورنامنٹس' },
      { icon: 'business', label: 'Govt Offices / سرکاری دفاتر' },
      { icon: 'storefront', label: 'Bazar / Shop Finder / بازار' },
      { icon: 'water', label: 'Blood Donation / بلڈ ڈونیشن' },
      { icon: 'briefcase', label: 'Jobs / نوکریاں' },
      { icon: 'medkit', label: 'Doctors / ڈاکٹرز' },
      { icon: 'chatbox-ellipses', label: 'AI Chatbot / اے آئی چیٹ بوٹ' },
    ];

    return (
      <ScrollView contentContainerStyle={styles.featureContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.helloName}>Hello {userName}!</Text>
        <Text style={styles.welcomeMsg}>
          یہ ایپ تمہاری سٹی شاہکوٹ کے لیے ڈیزائن کی گئی ہے۔{'\n'}
          امید ہے تم اسے پسند کرو گے!
        </Text>
        <Text style={styles.welcomeMsgEn}>
          This app is designed for your city Shahkot.{'\n'}
          We hope you'll love it!
        </Text>

        <View style={styles.divider} />
        <Text style={styles.featuresTitle}>What you can do / کیا کیا کر سکتے ہو</Text>

        {features.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={styles.featureIconWrap}>
              <Ionicons name={f.icon} size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.featureLabel}>{f.label}</Text>
          </View>
        ))}

        <View style={styles.flagSection}>
          <Text style={styles.flagEmoji}>🇵🇰</Text>
          <Text style={styles.zindabad}>Pakistan Zindabad!</Text>
          <Text style={styles.zindabad}>Shahkot Zindabad!</Text>
          <Text style={styles.zindabadUrdu}>پاکستان زندہ باد! شاہکوٹ زندہ باد!</Text>
        </View>

        <TouchableOpacity style={styles.startBtn} onPress={finishOnboarding}>
          <Text style={styles.startBtnText}>Let's Go! 🚀</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const steps = [renderAlhumdulillah, renderGenderAge, renderBloodGroup, renderFeaturesOverview];

  return (
    <View style={styles.container}>
      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {[0, 1, needsBloodStep ? 2 : null, 3].filter(Boolean).map((_, i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
        ))}
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {steps[step]()}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 28,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
    alignSelf: 'center',
  },
  bigTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center',
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginVertical: 20,
    alignSelf: 'center',
  },
  alhumdulillahText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  alhumdulillah: {
    fontSize: 42,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginVertical: 12,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    marginTop: 32,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 18,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginTop: 8,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  genderCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    elevation: 2,
  },
  genderSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  genderEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  genderText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  genderTextSelected: {
    color: COLORS.primary,
  },
  ageScroll: {
    maxHeight: 50,
    marginBottom: 8,
  },
  ageChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  ageChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  ageChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  ageChipTextSelected: {
    color: COLORS.white,
  },
  bloodNote: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  bloodChip: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  bloodChipSelected: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  bloodChipText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  bloodChipTextSelected: {
    color: COLORS.white,
  },
  featureContainer: {
    paddingBottom: 60,
    alignItems: 'center',
  },
  helloName: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeMsg: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 4,
  },
  welcomeMsgEn: {
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    width: '100%',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  featureLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  flagSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  flagEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  zindabad: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center',
  },
  zindabadUrdu: {
    fontSize: 18,
    color: COLORS.primaryDark,
    textAlign: 'center',
    marginTop: 4,
  },
  startBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    paddingHorizontal: 60,
    borderRadius: 30,
    marginTop: 24,
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  startBtnText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
});
