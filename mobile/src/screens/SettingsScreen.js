import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import colors from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import Card from '../components/Card';
import Button from '../components/Button';
import { API_BASE_URL } from '../services/api';
import { checkHealth } from '../services/complaintService';
import {
  Globe,
  Server,
  User,
  LogOut,
  Info,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react-native';

export const SettingsScreen = ({ navigation }) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();

  const [pingStatus, setPingStatus] = useState(null); // 'checking' | 'online' | 'offline'
  const [pingLatency, setPingLatency] = useState(null);

  const testConnection = async () => {
    setPingStatus('checking');
    const start = Date.now();
    const result = await checkHealth();
    const elapsed = Date.now() - start;

    if (result.ok) {
      setPingStatus('online');
      setPingLatency(elapsed);
    } else {
      setPingStatus('offline');
      setPingLatency(null);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      language === 'ta' ? 'வெளியேறு' : 'Sign Out',
      language === 'ta'
        ? 'நிச்சயமாக அதிகாரி கணக்கிலிருந்து வெளியேற விரும்புகிறீர்களா?'
        : 'Are you sure you want to sign out from the officer portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            Alert.alert(
              language === 'ta' ? 'வெளியேறியாச்சு' : 'Signed Out',
              language === 'ta' ? 'அமர்வு முடிந்தது.' : 'Session concluded successfully.'
            );
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title={t('settings')}
        subtitle={language === 'ta' ? 'பயன்பாட்டு அமைப்புகள்' : 'Preferences & Diagnostics'}
        showLanguageToggle={false}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Language Selection Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Globe size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>
              {language === 'ta' ? 'மொழி தேர்வு' : 'Language Selection'}
            </Text>
          </View>

          <View style={styles.langButtonsRow}>
            <TouchableOpacity
              onPress={() => setLanguage('en')}
              style={[
                styles.langBtn,
                language === 'en' && styles.langBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.langBtnText,
                  language === 'en' && styles.langBtnTextActive,
                ]}
              >
                English
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setLanguage('ta')}
              style={[
                styles.langBtn,
                language === 'ta' && styles.langBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.langBtnText,
                  language === 'ta' && styles.langBtnTextActive,
                ]}
              >
                தமிழ் (Tamil)
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Server & API Diagnostics */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Server size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Backend Telemetry Link</Text>
          </View>

          <View style={styles.apiInfoBox}>
            <Text style={styles.apiLabel}>ACTIVE FASTAPI BASE URL</Text>
            <Text style={styles.apiUrlText}>{API_BASE_URL}</Text>
          </View>

          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              {pingStatus === 'checking' && (
                <ActivityIndicator size="small" color={colors.teal} style={{ marginRight: 8 }} />
              )}
              {pingStatus === 'online' && (
                <CheckCircle2 size={18} color={colors.success} style={{ marginRight: 8 }} />
              )}
              {pingStatus === 'offline' && (
                <XCircle size={18} color={colors.danger} style={{ marginRight: 8 }} />
              )}
              <Text style={styles.statusLabel}>
                {pingStatus === 'checking'
                  ? 'Testing endpoint ping...'
                  : pingStatus === 'online'
                  ? `Connected (${pingLatency} ms)`
                  : 'Cannot reach server'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={testConnection}
              style={styles.refreshPill}
              disabled={pingStatus === 'checking'}
            >
              <RefreshCw size={14} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.refreshPillText}>Ping</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Officer Session Card (if logged in) */}
        {isAuthenticated && user && (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <User size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>Active Officer Session</Text>
            </View>

            <View style={styles.userBox}>
              <Text style={styles.userName}>{user.name || 'Municipal Officer'}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleText}>
                  {user.role} • {user.department || 'Administration'}
                </Text>
              </View>
            </View>

            <Button
              title={language === 'ta' ? 'அமர்விலிருந்து வெளியேறு' : 'Sign Out of Officer Console'}
              onPress={handleLogout}
              variant="outline"
              icon={<LogOut size={16} color={colors.danger} />}
              textStyle={{ color: colors.danger }}
              style={{ borderColor: '#FCA5A5', marginTop: 10 }}
            />
          </Card>
        )}

        {/* If not logged in, prompt to log in as officer */}
        {!isAuthenticated && (
          <Card style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <User size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.sectionTitle}>{t('officerPortal')}</Text>
            </View>
            <Text style={styles.infoText}>
              Are you a municipal ward engineer or field supervisor? Access your assigned task
              queue with verification controls.
            </Text>
            <Button
              title={t('officerLoginBtn')}
              onPress={() => navigation.navigate('OfficerLogin')}
              variant="outline"
              style={{ marginTop: 12 }}
            />
          </Card>
        )}

        {/* Application Metadata */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Info size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Platform Metadata</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Application</Text>
            <Text style={styles.metaVal}>CivicPulse AI Android</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Release Version</Text>
            <Text style={styles.metaVal}>1.0.0 (Phase 3 Foundation)</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Target Region</Text>
            <Text style={styles.metaVal}>Tamil Nadu, India</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>AI Triage Core</Text>
            <Text style={styles.metaVal}>Gemini 1.5 Flash + Spatial Clustering</Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  langButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  langBtnActive: {
    borderColor: colors.teal,
    backgroundColor: colors.tealLight,
  },
  langBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate700,
  },
  langBtnTextActive: {
    color: colors.tealDark,
    fontWeight: '700',
  },
  apiInfoBox: {
    backgroundColor: colors.slate100,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  apiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.slate500,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  apiUrlText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate700,
  },
  refreshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  userBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate900,
  },
  userEmail: {
    fontSize: 13,
    color: colors.slate500,
    marginTop: 2,
  },
  roleTag: {
    backgroundColor: colors.tealLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.tealDark,
    textTransform: 'uppercase',
  },
  infoText: {
    fontSize: 13,
    color: colors.slate600,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  metaKey: {
    fontSize: 12,
    color: colors.slate500,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate800,
  },
});

export default SettingsScreen;

