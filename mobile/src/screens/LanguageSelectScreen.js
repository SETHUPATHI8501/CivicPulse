import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import colors from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import Button from '../components/Button';
import { Check, Globe } from 'lucide-react-native';

export const LanguageSelectScreen = ({ navigation }) => {
  const { language, setLanguage, t } = useLanguage();
  const [selected, setSelected] = useState(language);

  const handleSelect = (lang) => {
    setSelected(lang);
  };

  const handleContinue = async () => {
    await setLanguage(selected);
    navigation.replace('Welcome');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Globe size={32} color={colors.teal} />
          </View>
          <Text style={styles.title}>Choose Your Language</Text>
          <Text style={styles.tamilTitle}>உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்</Text>
          <Text style={styles.subtitle}>
            CivicPulse AI supports English and தமிழ் for seamless civic engagement.
          </Text>
        </View>

        <View style={styles.optionsList}>
          {/* English Option */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSelect('en')}
            style={[
              styles.optionCard,
              selected === 'en' && styles.optionCardActive,
            ]}
          >
            <View style={styles.optionLeft}>
              <Text style={styles.optionNative}>English</Text>
              <Text style={styles.optionDesc}>Official English Interface</Text>
              <Text style={styles.sampleText}>"Report civic issues with geotagging"</Text>
            </View>
            <View
              style={[
                styles.radioCircle,
                selected === 'en' && styles.radioCircleActive,
              ]}
            >
              {selected === 'en' && <Check size={14} color={colors.white} />}
            </View>
          </TouchableOpacity>

          {/* Tamil Option */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSelect('ta')}
            style={[
              styles.optionCard,
              selected === 'ta' && styles.optionCardActive,
            ]}
          >
            <View style={styles.optionLeft}>
              <Text style={styles.optionNative}>தமிழ் (Tamil)</Text>
              <Text style={styles.optionDesc}>தமிழ் இடைமுகம்</Text>
              <Text style={styles.sampleText}>"நகராட்சிப் புகார்களை எளிதாகப் பதிவு செய்க"</Text>
            </View>
            <View
              style={[
                styles.radioCircle,
                selected === 'ta' && styles.radioCircleActive,
              ]}
            >
              {selected === 'ta' && <Check size={14} color={colors.white} />}
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={selected === 'ta' ? 'தொடரவும் (Continue)' : 'Continue (தொடரவும்)'}
          onPress={handleContinue}
          variant="teal"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
  },
  content: {
    padding: 24,
    paddingTop: 50,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.tealLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
  },
  tamilTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.tealDark,
    marginTop: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.slate500,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  optionsList: {
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  optionCardActive: {
    borderColor: colors.teal,
    backgroundColor: '#F0FDFA',
  },
  optionLeft: {
    flex: 1,
    paddingRight: 12,
  },
  optionNative: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate900,
  },
  optionDesc: {
    fontSize: 13,
    color: colors.slate600,
    marginTop: 2,
  },
  sampleText: {
    fontSize: 12,
    color: colors.slate400,
    fontStyle: 'italic',
    marginTop: 6,
  },
  radioCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.slate300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  footer: {
    padding: 20,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

export default LanguageSelectScreen;

