import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import colors from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getOfficerComplaints } from '../services/officerService';
import { connectLiveUpdates } from '../services/api';
import {
  getWorkerComplaints,
  listSosAlerts,
  updateSosAlertStatus,
  submitWorkerProgress,
} from '../services/advancedService';
import Header from '../components/Header';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import LoadingView, { ErrorView } from '../components/LoadingView';
import {
  Search,
  Shield,
  ChevronRight,
  MapPin,
  Layers,
  Clock,
  Siren,
} from 'lucide-react-native';

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'OPEN', label: 'Open' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'NEEDS_INFO', label: 'Needs Info' },
  { id: 'RESOLVED', label: 'Resolved' },
];

export const OfficerDashboardScreen = ({ navigation }) => {
  const { user, isAuthenticated } = useAuth();
  const { t, language } = useLanguage();

  const [complaints, setComplaints] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchQueue = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      if (user?.role === 'WORKER') {
        const res = await getWorkerComplaints({ limit: 100 });
        setComplaints(res?.items || []);
        setSosAlerts([]);
      } else {
        const [res, sosRes] = await Promise.all([
          getOfficerComplaints({ limit: 100 }),
          listSosAlerts({ limit: 10 }).catch(() => ({ items: [] })),
        ]);
        setComplaints(res?.items || []);
        setSosAlerts(sosRes?.items || []);
      }
    } catch (err) {
      setError(err.userMessage || 'Failed to load complaints queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.role]);

  const handleQuickSosUpdate = async (sosId, nextStatus) => {
    try {
      await updateSosAlertStatus(sosId, {
        status: nextStatus,
        note: `Updated to ${nextStatus} via Mobile Command Console`,
      });
      fetchQueue(true);
    } catch {
      // Ignore error
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (isAuthenticated) {
        fetchQueue();
      }
    });
    if (isAuthenticated) {
      fetchQueue();
    }
    const disconnectWs = connectLiveUpdates(() => {
      if (isAuthenticated) {
        fetchQueue(true);
      }
    });
    const pollTimer = setInterval(() => {
      if (isAuthenticated) {
        fetchQueue(true);
      }
    }, 20000);
    return () => {
      unsubscribe();
      disconnectWs();
      clearInterval(pollTimer);
    };
  }, [navigation, isAuthenticated, fetchQueue]);

  const counts = useMemo(() => {
    const c = { total: complaints.length, open: 0, inProgress: 0, needsInfo: 0, resolved: 0 };
    complaints.forEach((item) => {
      const st = String(item.status || '').toUpperCase();
      if (st === 'OPEN') c.open++;
      else if (st === 'IN_PROGRESS') c.inProgress++;
      else if (st === 'NEEDS_INFO') c.needsInfo++;
      else if (st === 'RESOLVED') c.resolved++;
    });
    return c;
  }, [complaints]);

  const filteredList = useMemo(() => {
    return complaints.filter((item) => {
      if (statusFilter !== 'ALL' && String(item.status || '').toUpperCase() !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchCase = String(item.case_id || '').toLowerCase().includes(q);
        const matchTrk = String(item.tracking_id || '').toLowerCase().includes(q);
        const matchCat = String(item.category || '').toLowerCase().includes(q);
        const matchTxt = String(item.citizen_text || '').toLowerCase().includes(q);
        return matchCase || matchTrk || matchCat || matchTxt;
      }
      return true;
    });
  }, [complaints, statusFilter, searchQuery]);

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Header title={t('officerPortal')} showLanguageToggle={true} />
        <ErrorView
          message="Please sign in with your municipal officer credentials to view your assigned queue."
          onRetry={() => navigation.navigate('OfficerLogin')}
        />
      </View>
    );
  }

  if (loading && !refreshing) {
    return <LoadingView message={t('loading')} />;
  }

  return (
    <View style={styles.container}>
      <Header
        title={user?.role === 'ADMIN' ? t('adminConsoleTitle') : t('officerConsoleTitle')}
        subtitle={`${user?.name || 'Officer'} • ${user?.department || 'Municipal'}`}
        showLanguageToggle={true}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchQueue(true)}
            colors={[colors.teal]}
          />
        }
      >
        {/* Officer Identity Banner */}
        <View style={styles.officerBanner}>
          <View style={styles.officerBadgeRow}>
            <Shield size={16} color={colors.teal} style={{ marginRight: 6 }} />
            <Text style={styles.officerRoleText}>
              {user?.role === 'ADMIN'
                ? 'MUNICIPAL ADMINISTRATOR (ALL WARDS)'
                : user?.role === 'WORKER'
                  ? `FIELD WORKER • ${String(user?.department || '').toUpperCase()}`
                  : `FIELD OFFICER • ${String(user?.department || '').toUpperCase()}`}
            </Text>
          </View>

          <View style={styles.kpiRow}>
            <View style={styles.kpiPill}>
              <Text style={styles.kpiVal}>{counts.total}</Text>
              <Text style={styles.kpiLbl}>Total</Text>
            </View>
            <View style={styles.kpiPill}>
              <Text style={[styles.kpiVal, { color: '#FBBF24' }]}>{counts.open}</Text>
              <Text style={styles.kpiLbl}>Open</Text>
            </View>
            <View style={styles.kpiPill}>
              <Text style={[styles.kpiVal, { color: '#38BDF8' }]}>{counts.inProgress}</Text>
              <Text style={styles.kpiLbl}>Active</Text>
            </View>
            <View style={styles.kpiPill}>
              <Text style={[styles.kpiVal, { color: '#4ADE80' }]}>{counts.resolved}</Text>
              <Text style={styles.kpiLbl}>Resolved</Text>
            </View>
          </View>
        </View>

        {/* Active SOS Emergency Command Feed (Officer & Admin Only) */}
        {user?.role !== 'WORKER' && sosAlerts.length > 0 && (
          <Card style={{ marginBottom: 14, backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
              <Siren size={16} color="#DC2626" />
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#991B1B' }}>
                Active SOS Emergency Command ({sosAlerts.length})
              </Text>
            </View>
            {sosAlerts.slice(0, 3).map((sos) => (
              <View
                key={sos.id}
                style={{
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderTopColor: '#FECACA',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#7F1D1D' }}>
                    {sos.case_id || sos.sos_id || sos.tracking_id} • {sos.emergency_type}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#DC2626' }}>
                    {sos.status}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: colors.slate700, marginTop: 2 }}>
                  {sos.address_text}
                </Text>
                {sos.status !== 'RESOLVED' && sos.status !== 'CANCELLED' && (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                    {['ACKNOWLEDGED', 'DISPATCHED', 'RESOLVED'].map((st) => (
                      <TouchableOpacity
                        key={st}
                        onPress={() => handleQuickSosUpdate(sos.id, st)}
                        style={{
                          backgroundColor: st === 'RESOLVED' ? '#059669' : '#DC2626',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                        }}
                      >
                        <Text style={{ color: colors.white, fontSize: 10, fontWeight: '800' }}>
                          {st}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </Card>
        )}

        {/* Search Input */}
        <View style={styles.searchBar}>
          <Search size={18} color={colors.slate400} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('searchPlaceholder')}
            placeholderTextColor={colors.slate400}
            style={styles.searchInput}
          />
        </View>

        {/* Status Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setStatusFilter(f.id)}
                style={[styles.filterPill, active && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {error && (
          <ErrorView message={error} onRetry={() => fetchQueue()} />
        )}

        {/* Complaints List */}
        {filteredList.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Matching Complaints</Text>
            <Text style={styles.emptyDesc}>
              {language === 'ta'
                ? 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டலில் புகார்கள் எதுவும் இல்லை.'
                : 'No grievances match the current status filter or search query.'}
            </Text>
          </Card>
        ) : (
          filteredList.map((item) => (
            <Card
              key={item.id}
              style={styles.complaintCard}
              onPress={() =>
                navigation.navigate('OfficerComplaintDetail', { complaintId: item.id })
              }
            >
              <View style={styles.cardTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.trkId}>{item.case_id || item.tracking_id}</Text>
                  {item.duplicate_group_id && (
                    <View style={styles.dupMiniBadge}>
                      <Layers size={10} color="#B45309" />
                      <Text style={styles.dupMiniText}>DUP</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <PriorityBadge priority={item.priority} />
                  <StatusBadge status={item.status} />
                </View>
              </View>

              <Text style={styles.catDeptText}>
                {item.category} • {item.department}
              </Text>

              <Text style={styles.descSnippet} numberOfLines={2}>
                {item.citizen_text}
              </Text>

              <View style={styles.cardBottomRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MapPin size={12} color={colors.teal} style={{ marginRight: 4 }} />
                  <Text style={styles.metaText}>
                    {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Clock size={12} color={colors.slate400} style={{ marginRight: 4 }} />
                  <Text style={styles.metaText}>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : ''}
                  </Text>
                  <ChevronRight size={16} color={colors.primary} style={{ marginLeft: 4 }} />
                </View>
              </View>
            </Card>
          ))
        )}
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
  officerBanner: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  officerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  officerRoleText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.teal,
    letterSpacing: 0.6,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
  },
  kpiPill: {
    alignItems: 'center',
    flex: 1,
  },
  kpiVal: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.white,
  },
  kpiLbl: {
    fontSize: 11,
    color: colors.slate300,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.slate900,
  },
  filterScroll: {
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate600,
  },
  filterPillTextActive: {
    color: colors.white,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 28,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.slate800,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.slate500,
    textAlign: 'center',
  },
  complaintCard: {
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  trkId: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  dupMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  dupMiniText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  catDeptText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.tealDark,
    marginBottom: 6,
  },
  descSnippet: {
    fontSize: 13,
    color: colors.slate700,
    lineHeight: 18,
    marginBottom: 10,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  metaText: {
    fontSize: 11,
    color: colors.slate500,
  },
});

export default OfficerDashboardScreen;

