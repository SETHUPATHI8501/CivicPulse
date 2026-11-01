import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import colors from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Header from '../components/Header';
import Input from '../components/Input';
import Button from '../components/Button';
import Card from '../components/Card';
import { ShieldCheck, Mail, Lock, KeyRound, AlertCircle, Sparkles } from 'lucide-react-native';

export const OfficerLoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const { t, language } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError(
        language === 'ta'
          ? 'மின்னஞ்சல் மற்றும் கடவுச்சொல்லை உள்ளிடவும்'
          : 'Please enter both municipal email and password.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await login(email.trim(), password);
      Alert.alert(
        language === 'ta' ? 'உள்நுழைவு வெற்றி' : 'Authentication Successful',
        language === 'ta'
          ? `வணக்கம் ${res.name || 'அதிகாரி'} (${res.role}). அதிகாரி பணித்தளம் இயக்கப்பட்டது.`
          : `Welcome, ${res.name || 'Officer'} (${res.role}). Session authenticated.`,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.replace('MainTabs', { screen: 'OfficerQueue' });
            },
          },
        ]
      );
    } catch (err) {
      console.warn('Login failure:', err);
      setError(
        err.userMessage ||
          (language === 'ta'
            ? 'தவறான மின்னஞ்சல் அல்லது கடவுச்சொல்.'
            : 'Invalid credentials. Please verify your officer credentials.')
      );
    } finally {
      setLoading(false);
    }
  };

  const fillOfficerCredentials = () => {
    setEmail('anitha.roads@civicpulse.gov');
    setPassword('AnithaSecurePass2026!');
    setError(null);
  };

  const fillAdminCredentials = () => {
    setEmail('admin@civicpulse.gov');
    setPassword('AdminPassword2026!');
    setError(null);
  };

  const fillWorkerCredentials = () => {
    setEmail('raju.worker@civicpulse.gov');
    setPassword('RajuWorkerPass2026!');
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Header
        title={t('officerPortal')}
        subtitle={language === 'ta' ? 'அதிகாரிகள் உள்நுழைவு' : 'Authorized Personnel Only'}
        showBack={true}
        onBack={() => navigation.goBack()}
        showLanguageToggle={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Crest / Emblem */}
        <View style={styles.crestContainer}>
          <View style={styles.crestCircle}>
            <ShieldCheck size={36} color={colors.white} />
          </View>
          <Text style={styles.portalTitle}>Municipal Officer Portal</Text>
          <Text style={styles.portalSubtitle}>
            Government of Tamil Nadu • Municipal Administration & Water Supply
          </Text>
        </View>

        {/* Error Box */}
        {error && (
          <View style={styles.errorBox}>
            <AlertCircle size={18} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Credentials Form */}
        <Card style={styles.formCard}>
          <Input
            label="OFFICIAL EMAIL ADDRESS"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError(null);
            }}
            placeholder="officer.name@civicpulse.gov"
            keyboardType="email-address"
            autoCapitalize="none"
            icon={<Mail size={18} color={colors.slate400} />}
          />

          <Input
            label="PASSWORD"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (error) setError(null);
            }}
            placeholder="••••••••••••"
            secureTextEntry={true}
            icon={<Lock size={18} color={colors.slate400} />}
          />

          <Button
            title={loading ? t('loading') : 'Sign In to Officer Console'}
            onPress={handleLogin}
            variant="primary"
            loading={loading}
            icon={!loading ? <KeyRound size={16} color={colors.white} /> : null}
            style={styles.signInBtn}
          />
        </Card>

        {/* Quick Demo Credentials Box for Testing */}
        <Card style={styles.demoCard}>
          <View style={styles.demoHeader}>
            <Sparkles size={16} color={colors.teal} style={{ marginRight: 6 }} />
            <Text style={styles.demoTitle}>Development Demo Credentials</Text>
          </View>
          <Text style={styles.demoDesc}>
            Tap to pre-fill test credentials from the verified municipal database:
          </Text>

          <View style={styles.demoButtonsRow}>
            <TouchableOpacity
              onPress={fillOfficerCredentials}
              style={styles.demoPill}
            >
              <Text style={styles.demoPillText}>Officer (Anitha)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={fillWorkerCredentials}
              style={[styles.demoPill, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}
            >
              <Text style={[styles.demoPillText, { color: '#92400E' }]}>Worker (Raju)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={fillAdminCredentials}
              style={[styles.demoPill, styles.demoPillAdmin]}
            >
              <Text style={styles.demoPillAdminText}>Admin</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  crestContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  crestCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.teal,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  portalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  portalSubtitle: {
    fontSize: 12,
    color: colors.slate500,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
  },
  formCard: {
    marginBottom: 16,
  },
  signInBtn: {
    marginTop: 8,
  },
  demoCard: {
    backgroundColor: '#F8FAFC',
    borderStyle: 'dashed',
    borderColor: colors.slate300,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  demoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate800,
  },
  demoDesc: {
    fontSize: 12,
    color: colors.slate500,
    marginBottom: 12,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoPill: {
    flex: 1,
    backgroundColor: colors.tealLight,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  demoPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.tealDark,
  },
  demoPillAdmin: {
    backgroundColor: '#EDE9FE',
    borderColor: '#DDD6FE',
  },
  demoPillAdminText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6D28D9',
  },
});

export default OfficerLoginScreen;

