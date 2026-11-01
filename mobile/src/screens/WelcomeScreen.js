import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import colors from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import Button from '../components/Button';
import { ShieldCheck, MapPin, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react-native';

export const WelcomeScreen = ({ navigation }) => {
  const { t, language, setLanguage } = useLanguage();

  const handleStartCitizen = () => {
    navigation.replace('MainTabs');
  };

  const handleOfficerLogin = () => {
    navigation.navigate('OfficerLogin');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ta' : 'en');
  };

  return (
    <View style={styles.container}>
      {/* Top Bar with Language Toggle */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <ShieldCheck size={20} color={colors.teal} />
          <Text style={styles.brandName}>CivicPulse AI</Text>
        </View>
        <TouchableOpacity onPress={toggleLanguage} style={styles.langPill}>
          <Text style={styles.langPillText}>
            {language === 'en' ? 'தமிழ்' : 'English'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Region Badge */}
        <View style={styles.regionBadge}>
          <MapPin size={12} color={colors.tealDark} style={{ marginRight: 4 }} />
          <Text style={styles.regionText}>TAMIL NADU MUNICIPAL ADMINISTRATION</Text>
        </View>

        {/* Hero Section */}
        <Text style={styles.heroTitle}>{t('welcomeTitle')}</Text>
        <Text style={styles.heroSubtitle}>{t('welcomeSubtitle')}</Text>

        {/* Feature Highlights Cards */}
        <View style={styles.highlightsContainer}>
          <View style={styles.featureItem}>
            <View style={styles.featureIconBox}>
              <Sparkles size={20} color={colors.teal} />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>
                {language === 'ta' ? 'செயற்கை நுண்ணறிவு வகைப்படுத்தல்' : 'AI-Powered Triage'}
              </Text>
              <Text style={styles.featureDesc}>
                {language === 'ta'
                  ? 'புகார்கள் தானாகவே துறை மற்றும் முன்னுரிமையுடன் பிரிக்கப்படுகின்றன.'
                  : 'Instant category tagging & priority routing via Gemini AI engine.'}
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIconBox}>
              <MapPin size={20} color="#0284C7" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>
                {language === 'ta' ? 'ஜிபிஎஸ் துல்லிய இருப்பிடம்' : 'Geospatial Precision'}
              </Text>
              <Text style={styles.featureDesc}>
                {language === 'ta'
                  ? 'துல்லியமான வரைபடக் குறியீட்டுடன் நகராட்சி பொறியாளர்களுக்கு நேரடியாகச் செல்கிறது.'
                  : 'Coordinates prevent duplicate filings and pinpoint exact ward locations.'}
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIconBox}>
              <CheckCircle2 size={20} color={colors.success} />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>
                {language === 'ta' ? 'வெளிப்படையான தீர்வு' : 'Verified Resolution'}
              </Text>
              <Text style={styles.featureDesc}>
                {language === 'ta'
                  ? 'ஒவ்வொரு புகார் தீர்வுக்கும் புகைப்படச் சான்றுடன் வெளிப்படைத்தன்மை.'
                  : 'Field officers verify redressal with mandatory completion photo evidence.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Primary CTA */}
        <View style={styles.ctaBox}>
          <Button
            title={t('getStarted')}
            onPress={handleStartCitizen}
            variant="teal"
            icon={<ArrowRight size={18} color={colors.white} />}
            style={styles.primaryBtn}
          />

          <View style={styles.officerRow}>
            <Text style={styles.officerPrompt}>{t('officerLoginPrompt')}</Text>
            <TouchableOpacity onPress={handleOfficerLogin}>
              <Text style={styles.officerLink}>{t('officerLoginBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 45,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  langPill: {
    backgroundColor: colors.tealLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.tealDark,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tealLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  regionText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.tealDark,
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.slate600,
    lineHeight: 22,
    marginBottom: 24,
  },
  highlightsContainer: {
    gap: 14,
    marginBottom: 28,
  },
  featureItem: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  featureIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.slate900,
    marginBottom: 3,
  },
  featureDesc: {
    fontSize: 12,
    color: colors.slate500,
    lineHeight: 17,
  },
  ctaBox: {
    marginTop: 8,
  },
  primaryBtn: {
    marginBottom: 16,
    shadowColor: colors.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  officerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  officerPrompt: {
    fontSize: 13,
    color: colors.slate500,
  },
  officerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});

export default WelcomeScreen;

