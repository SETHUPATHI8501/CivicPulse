import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import colors from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShieldCheck } from 'lucide-react-native';

export const SplashScreen = ({ navigation }) => {
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const lang = await AsyncStorage.getItem('civicpulse_mobile_lang');
        if (!lang) {
          navigation.replace('LanguageSelect');
        } else {
          navigation.replace('Welcome');
        }
      } catch {
        navigation.replace('Welcome');
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <ShieldCheck size={48} color={colors.teal} />
        </View>

        <Text style={styles.appName}>CivicPulse AI</Text>
        <Text style={styles.tagline}>Our Town, Reimagined</Text>
        <Text style={styles.subTagline}>Municipal Grievance Redressal Platform</Text>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>TAMIL NADU, INDIA</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.teal} />
        <Text style={styles.loadingText}>Connecting to municipal telemetry...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'space-between',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(20, 184, 166, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.teal,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  subTagline: {
    fontSize: 13,
    color: colors.slate400,
    marginTop: 4,
    textAlign: 'center',
  },
  badge: {
    marginTop: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate300,
    letterSpacing: 1,
  },
  footer: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: colors.slate400,
    marginTop: 10,
  },
});

export default SplashScreen;

