import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import colors from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { getPublicStats, getComplaints } from '../services/complaintService';
import { connectLiveUpdates } from '../services/api';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import { Card } from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import LoadingView, { ErrorView } from '../components/LoadingView';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  Search,
  PhoneCall,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';

export const CitizenDashboardScreen = ({ navigation }) => {
  const { t, language } = useLanguage();
  const [stats, setStats] = useState(null);
  const [recentComplaints, setRecentComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [statsData, recentData] = await Promise.all([
        getPublicStats(),
        getComplaints({ limit: 5 }),
      ]);
      setStats(statsData);
      setRecentComplaints(recentData?.items || []);
    } catch (err) {
      console.warn('Failed to fetch public stats:', err);
      setError(err.userMessage || 'Could not fetch live telemetry from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const disconnect = connectLiveUpdates(() => {
      fetchStats(true);
    });
    return disconnect;
  }, [fetchStats]);

  const onRefresh = () => {
    fetchStats(true);
  };

  const handleReportPress = () => {
    navigation.navigate('Report');
  };

  const handleTrackPress = () => {
    navigation.navigate('Track');
  };

  if (loading && !refreshing) {
    return <LoadingView message={t('loading')} />;
  }

  if (error && !stats) {
    return <ErrorView message={error} onRetry={() => fetchStats()} />;
  }

  const categoryMap = {
    POTHOLE: { label: t('catPothole'), color: '#E11D48' },
    GARBAGE: { label: t('catGarbage'), color: '#D97706' },
    WATER: { label: t('catWater'), color: '#0284C7' },
    STREETLIGHT: { label: t('catStreetlight'), color: '#EAB308' },
    DRAINAGE: { label: t('catDrainage'), color: '#7C3AED' },
    OTHER: { label: t('catOther'), color: '#64748B' },
  };

  const total = stats?.total_complaints || 0;

  return (
    <View style={styles.container}>
      <Header
        title="CivicPulse AI"
        subtitle={language === 'ta' ? 'தமிழ்நாடு நகராட்சி மேலாண்மை' : 'Tamil Nadu Municipal Telemetry'}
        showLanguageToggle={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.teal]}
            tintColor={colors.teal}
          />
        }
      >
        {/* Telemetry Hero Banner */}
        <View style={styles.telemetryBanner}>
          <View style={styles.telemetryTop}>
            <View style={styles.liveIndicator}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveText}>{t('civicTelemetry')}</Text>
            </View>
            <View style={styles.resRateBadge}>
              <Text style={styles.resRateText}>
                {stats?.resolution_rate_pct !== undefined
                  ? `${stats.resolution_rate_pct}%`
                  : total > 0
                  ? `${Math.round(((stats?.resolved_complaints || 0) / total) * 100)}%`
                  : '0%'}{' '}
                {t('resolutionRate')}
              </Text>
            </View>
          </View>
          <Text style={styles.bannerHeading}>{t('overviewTitle')}</Text>
          <Text style={styles.bannerSubtitle}>{t('overviewSubtitle')}</Text>
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleReportPress}
            style={[styles.actionCard, { backgroundColor: colors.teal }]}
          >
            <View style={styles.actionIconCircle}>
              <FileText size={22} color={colors.tealDark} />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={styles.actionTitleWhite}>{t('reportAnIssue')}</Text>
              <Text style={styles.actionDescWhite}>
                {language === 'ta' ? 'ஜிபிஎஸ் & புகைப்படத்துடன்' : 'With AI GPS tagging'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleTrackPress}
            style={[styles.actionCard, { backgroundColor: colors.primary }]}
          >
            <View style={styles.actionIconCircle}>
              <Search size={22} color={colors.primary} />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={styles.actionTitleWhite}>{t('trackAnIssue')}</Text>
              <Text style={styles.actionDescWhite}>
                {language === 'ta' ? 'கண்காணிப்பு எண் மூலம்' : 'Search by Tracking ID'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricsSection}>
          <View style={styles.metricsRow}>
            <StatCard
              title={t('totalComplaints')}
              value={stats?.total_complaints}
              subtitle="All registered grievances"
              icon={<Layers size={18} color={colors.primary} />}
              accentColor={colors.primary}
            />
            <StatCard
              title={t('openComplaints')}
              value={stats?.open_complaints}
              subtitle="Pending assignment"
              icon={<Clock size={18} color={colors.warning} />}
              accentColor={colors.warning}
            />
          </View>

          <View style={styles.metricsRow}>
            <StatCard
              title={t('inProgressComplaints')}
              value={stats?.in_progress_complaints}
              subtitle="Field team mobilized"
              icon={<Activity size={18} color="#0284C7" />}
              accentColor="#0284C7"
            />
            <StatCard
              title={t('resolvedComplaints')}
              value={stats?.resolved_complaints}
              subtitle="Photo verified"
              icon={<CheckCircle2 size={18} color={colors.success} />}
              accentColor={colors.success}
            />
          </View>

          <View style={styles.metricsRow}>
            <StatCard
              title={t('highPriority')}
              value={stats?.high_priority_complaints}
              subtitle="Urgent civic matters"
              icon={<AlertTriangle size={18} color={colors.danger} />}
              accentColor={colors.danger}
            />
          </View>
        </View>

        {/* Category Breakdown Section */}
        <Card style={styles.categoryCard}>
          <View style={styles.sectionHeaderRow}>
            <Sparkles size={18} color={colors.tealDark} style={{ marginRight: 6 }} />
            <Text style={styles.sectionHeaderTitle}>{t('supportedCategories')}</Text>
          </View>
          <Text style={styles.sectionHeaderSub}>
            {language === 'ta'
              ? 'நகராட்சி வாரியான வகைப்படுத்தல்'
              : 'Distribution of verified complaints by department'}
          </Text>

          <View style={styles.categoryList}>
            {stats?.category_distribution &&
              Object.entries(stats.category_distribution).map(([catKey, count]) => {
                const normKey = String(catKey || '').toUpperCase();
                const conf = categoryMap[normKey] || { label: catKey, color: colors.teal };
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <View key={catKey} style={styles.catRow}>
                    <View style={styles.catTextRow}>
                      <Text style={styles.catLabel}>{conf.label}</Text>
                      <Text style={styles.catCount}>
                        {count} ({pct}%)
                      </Text>
                    </View>
                    <View style={styles.catTrack}>
                      <View
                        style={[
                          styles.catFill,
                          { width: `${pct}%`, backgroundColor: conf.color },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
          </View>
        </Card>

        {/* Latest Complaint Updates Section */}
        {recentComplaints.length > 0 && (
          <Card style={styles.recentCard}>
            <View style={styles.sectionHeaderRow}>
              <Layers size={18} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.sectionHeaderTitle}>{t('latestUpdates')}</Text>
            </View>
            <Text style={styles.sectionHeaderSub}>
              {language === 'ta'
                ? 'விவரங்களைக் காண புகாரைத் தொடவும்'
                : 'Tap any grievance to inspect full tracking timeline'}
            </Text>

            <View style={styles.recentList}>
              {recentComplaints.map((comp) => {
                const displayCaseId = comp.case_id || comp.tracking_id;
                return (
                  <TouchableOpacity
                    key={comp.id}
                    style={styles.recentItem}
                    activeOpacity={0.8}
                    onPress={() =>
                      navigation.navigate('Track', { trackingId: displayCaseId })
                    }
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={styles.recentTopRow}>
                        <Text style={styles.recentTrk}>{displayCaseId}</Text>
                        <Text style={styles.recentCat}>• {comp.category}</Text>
                      </View>
                      <Text style={styles.recentText} numberOfLines={2}>
                        {comp.citizen_text}
                      </Text>
                      <View style={styles.recentBadgesRow}>
                        <PriorityBadge priority={comp.priority} />
                        <StatusBadge status={comp.status} />
                      </View>
                    </View>
                    <ChevronRight size={18} color={colors.slate400} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}

        {/* Emergency Helplines Section */}
        <Card style={styles.helplineCard}>
          <View style={styles.sectionHeaderRow}>
            <PhoneCall size={18} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.sectionHeaderTitle}>{t('emergencyHelplines')}</Text>
          </View>

          <View style={styles.helplineGrid}>
            <View style={styles.helplineBox}>
              <Text style={styles.helplineNumber}>1913</Text>
              <Text style={styles.helplineName}>{t('municipalControl')}</Text>
            </View>
            <View style={styles.helplineBox}>
              <Text style={styles.helplineNumber}>100 / 103</Text>
              <Text style={styles.helplineName}>{t('policeTraffic')}</Text>
            </View>
            <View style={styles.helplineBox}>
              <Text style={styles.helplineNumber}>101</Text>
              <Text style={styles.helplineName}>Fire & Rescue</Text>
            </View>
            <View style={styles.helplineBox}>
              <Text style={styles.helplineNumber}>108</Text>
              <Text style={styles.helplineName}>Medical Ambulance</Text>
            </View>
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
  telemetryBanner: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  telemetryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.8,
  },
  resRateBadge: {
    backgroundColor: colors.tealLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resRateText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.tealDark,
  },
  bannerHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 2,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  actionIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  actionTextCol: {
    flex: 1,
  },
  actionTitleWhite: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  actionDescWhite: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  metricsSection: {
    marginBottom: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    marginHorizontal: -5,
  },
  categoryCard: {
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionHeaderSub: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 2,
    marginBottom: 14,
  },
  categoryList: {
    gap: 12,
  },
  catRow: {
    marginBottom: 4,
  },
  catTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  catLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate800,
  },
  catCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate600,
  },
  catTrack: {
    height: 6,
    backgroundColor: colors.slate200,
    borderRadius: 3,
    overflow: 'hidden',
  },
  catFill: {
    height: '100%',
    borderRadius: 3,
  },
  recentCard: {
    marginTop: 12,
  },
  recentList: {
    gap: 10,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  recentTrk: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  recentCat: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate600,
    marginLeft: 4,
  },
  recentText: {
    fontSize: 12,
    color: colors.slate700,
    lineHeight: 17,
    marginBottom: 8,
  },
  recentBadgesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  helplineCard: {
    marginTop: 12,
  },
  helplineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  helplineBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.slate100,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  helplineNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  helplineName: {
    fontSize: 11,
    color: colors.slate600,
    marginTop: 2,
    textAlign: 'center',
  },
});

export default CitizenDashboardScreen;
