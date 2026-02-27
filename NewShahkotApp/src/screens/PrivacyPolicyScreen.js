import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { COLORS, APP_NAME } from '../config/constants';

export default function PrivacyPolicyScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.appName}>{APP_NAME}</Text>
        <Text style={styles.date}>Last updated: February 2026</Text>

        <Section title="1. Introduction">
          Apna Shahkot ("the App") is a community platform exclusively for residents and people
          connected to Shahkot city, Pakistan. We are committed to protecting your personal
          information and your right to privacy. This policy explains what data we collect, how
          we use it, and your rights.
        </Section>

        <Section title="2. Information We Collect">
          <BulletList items={[
            'Full name, email address, phone / WhatsApp number (provided by you at registration)',
            'Profile photo (optional, uploaded by you)',
            'GPS location — used only to verify you are within the Shahkot 50 km geofence',
            'Posts, comments, listings, news articles, and other content you create',
            'Blood group and donor availability (if you register as a blood donor)',
            'Rishta profile details (only if you voluntarily submit a matrimonial profile)',
            'Job postings and applications (only if you use the Jobs feature)',
            'Device push-notification token (for delivering notifications)',
          ]} />
        </Section>

        <Section title="3. How We Use Your Information">
          <BulletList items={[
            'To create and manage your account',
            'To verify your location is within Shahkot (geofence enforcement)',
            'To show your posts, listings, and profile to other community members',
            'To send OTP codes for email verification and password reset',
            'To send notification emails for rishta approvals / rejections',
            'To send in-app push notifications about community activity',
            'To display blood-donor contact details to people seeking blood',
            'To enforce community rules and remove harmful content',
          ]} />
        </Section>

        <Section title="4. Location Data">
          Your GPS coordinates are used solely to verify that you are within 50 km of Shahkot.
          We store your last known latitude and longitude to keep your profile up to date.
          We do not sell or share location data with third parties.
        </Section>

        <Section title="5. Media Uploads">
          Photos and videos you upload are stored securely on Cloudinary (cloudinary.com).
          CNIC images submitted for Rishta verification are stored securely and are visible
          only to the Admin for verification purposes.
        </Section>

        <Section title="6. Data Retention & Account Deletion">
          {'Your account and all associated data (posts, listings, messages, media) are\n' +
            'automatically deleted if your account remains inactive for 3 consecutive months.\n\n' +
            'You may request manual deletion at any time by contacting us at the email below.\n' +
            'Deletion is permanent and cannot be undone.'}
        </Section>

        <Section title="7. Data Sharing">
          We do not sell your data. Your public profile information (name, photo, posts,
          listings) is visible to other authenticated Shahkot community members inside the App.
          We do not share your data with advertisers or external marketing companies.
        </Section>

        <Section title="8. Third-Party Services">
          <BulletList items={[
            'Cloudinary — media storage (cloudinary.com/privacy)',
            'Render — backend hosting (render.com/privacy)',
            'Google / Gmail — OTP and notification emails',
            'Firebase (optional) — push notifications (firebase.google.com/support/privacy)',
          ]} />
        </Section>

        <Section title="9. Security">
          Passwords are stored as bcrypt hashes and are never stored in plain text.
          All API communication uses HTTPS. JWT tokens are used for session management
          and are stored securely on your device.
        </Section>

        <Section title="10. Children's Privacy">
          This App is intended for users aged 13 and above. We do not knowingly collect
          personal information from children under 13. If you believe a child has provided
          us with personal data, please contact us and we will delete it.
        </Section>

        <Section title="11. Your Rights">
          <BulletList items={[
            'Access — request a copy of the data we hold about you',
            'Correction — ask us to correct inaccurate data',
            'Deletion — request deletion of your account and all data',
            'Objection — object to specific uses of your data',
          ]} />
        </Section>

        <Section title="12. Contact Us">
          {`If you have any questions or requests, contact the Apna Shahkot admin:\n\nEmail: mypcjnaab@gmail.com\nWhatsApp: +92 342 5844921\nLocation: Shahkot, Nankana Sahib, Punjab, Pakistan`}
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using {APP_NAME} you agree to this Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {typeof children === 'string' ? (
        <Text style={styles.body}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

function BulletList({ items }) {
  return (
    <View>
      {items.map((item, i) => (
        <Text key={i} style={styles.bullet}>{'• ' + item}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    width: 60,
  },
  backText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
  bullet: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: 4,
  },
  footer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: COLORS.primary + '15',
    borderRadius: 12,
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
