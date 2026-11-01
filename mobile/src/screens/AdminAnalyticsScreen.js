import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import Svg, { Circle as SvgCircle, Line as SvgLine, Rect as SvgRect } from 'react-native-svg';
import colors from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  getAnalyticsSummary,
  getHotspots,
  listOfficers,
  createOfficer,
} from '../services/officerService';
import Header from '../components/Header';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingView, { ErrorView } from '../components/LoadingView';
import {
  Flame,
  AlertTriangle,
  Layers,
  MapPin,
  Users,
  UserPlus,
  ExternalLink,
} from 'lucide-react-native';

const DEPARTMENTS = [
  'Roads / Public Works',
  'Sanitation',
  'Water Supply',
  'Electrical',
  'Drainage / Public Works',
  'General',
];

export const AdminAnalyticsScreen = ({ navigation }) => {
  const { user, isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState('hotspots'); // 'hotspots' | 'officers'
  const [gridSize, setGridSize] = useState(500);
  const [summary, setSummary] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Create officer form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDept, setNewDept] = useState(DEPARTMENTS[0]);
  const [creatingOfficer, setCreatingOfficer] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const fetchAnalyticsData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [sumData, hotData] = await Promise.all([
          getAnalyticsSummary({ grid_size: gridSize }),
          getHotspots({ grid_size: gridSize }),
        ]);
        setSummary(sumData);
        setHotspots(hotData?.hotspots || []);

        if (isAdmin) {
          try {
            const offData = await listOfficers();
            setOfficers(offData?.items || []);
          } catch {
            // Non-blocking
          }
        }
      } catch (err) {
        setError(err.userMessage || 'Could not load spatial hotspot analytics.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [gridSize, isAdmin]
  );

  useEffect(() => {
    if (isAuthenticated) {
      fetchAnalyticsData();
    }
  }, [isAuthenticated, fetchAnalyticsData]);

  const handleCreateOfficer = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword || newPassword.length < 8) {
      Alert.alert(
        'Validation Error',
        'Please enter name, valid email, and a password of at least 8 characters.'
      );
      return;
    }

    setCreatingOfficer(true);
    try {
      await createOfficer({
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        department: newDept,
        role: 'OFFICER',
      });
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      const offData = await listOfficers();
      setOfficers(offData?.items || []);
      Alert.alert('Officer Created', 'New municipal officer account registered.');
    } catch (err) {
      Alert.alert('Creation Failed', err.userMessage || 'Could not register officer.');
    } finally {
      setCreatingOfficer(false);
    }
  };

  const openHotspotInMaps = (lat, lng) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url).catch(() => {});
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Header title="Hotspot Intelligence" showLanguageToggle={true} />
        <ErrorView
          message="Authorized officer or administrator login required."
          onRetry={() => navigation.navigate('OfficerLogin')}
        />
      </View>
    );
  }

  if (loading && !refreshing) {
    return <LoadingView message={t('loading')} />;
  }

  // Compute normalized SVG coordinates for spatial radar plot
  const renderSpatialRadar = () => {
    if (!hotspots || hotspots.length === 0) return null;

    const lats = hotspots.map((h) => Number(h.center_latitude));
    const lngs = hotspots.map((h) => Number(h.center_longitude));
    const minLat = Math.min(...lats) - 0.005;
    const maxLat = Math.max(...lats) + 0.005;
    const minLng = Math.min(...lngs) - 0.005;
    const maxLng = Math.max(...lngs) + 0.005;

    const width = 320;
    const height = 180;

    return (
      <Card style={styles.radarCard}>
        <View style={styles.radarHeader}>
          <Text style={styles.radarTitle}>GIS SPATIAL CLUSTER DENSITY MAP</Text>
          <Text style={styles.radarSub}>Grid: {gridSize}m • Satellite Projection</Text>
        </View>

        <View style={styles.svgWrapper}>
          <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            <SvgRect x="0" y="0" width={width} height={height} fill="#0F172A" rx="10" />
            {/* Grid Lines */}
            {[45, 90, 135].map((y) => (
              <SvgLine
                key={`h-${y}`}
                x1="0"
                y1={y}
                x2={width}
                y2={y}
                stroke="#1E293B"
                strokeWidth="1"
              />
            ))}
            {[80, 160, 240].map((x) => (
              <SvgLine
                key={`v-${x}`}
                x1={x}
                y1="0"
                x2={x}
                y2={height}
                stroke="#1E293B"
                strokeWidth="1"
              />
            ))}

            {hotspots.map((spot) => {
              const xNorm =
                maxLng > minLng
                  ? (Number(spot.center_longitude) - minLng) / (maxLng - minLng)
                  : 0.5;
              const yNorm =
                maxLat > minLat
                  ? 1 - (Number(spot.center_latitude) - minLat) / (maxLat - minLat)
                  : 0.5;

              const cx = 24 + xNorm * (width - 48);
              const cy = 24 + yNorm * (height - 48);
              const r = Math.min(28, Math.max(10, spot.complaint_count * 4));
              const fill =
                spot.intensity === 'HIGH'
                  ? '#EF4444'
                  : spot.intensity === 'MEDIUM'
                  ? '#F59E0B'
                  : '#14B8A6';

              return (
                <React.Fragment key={spot.cluster_id}>
                  <SvgCircle cx={cx} cy={cy} r={r} fill={fill} fillOpacity="0.35" />
                  <SvgCircle cx={cx} cy={cy} r={5} fill={fill} stroke="#FFFFFF" strokeWidth="1.5" />
                </React.Fragment>
              );
            })}
          </Svg>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendText}>High Intensity</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>Medium</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#14B8A6' }]} />
            <Text style={styles.legendText}>Low</Text>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="GIS & Admin Hub"
        subtitle="Spatial Hotspot Intelligence & Operations"
        showLanguageToggle={true}
      />

      {/* Mode Switcher Tabs */}
      {isAdmin && (
        <View style={styles.topTabs}>
          <TouchableOpacity
            style={[styles.topTabBtn, activeTab === 'hotspots' && styles.topTabActive]}
            onPress={() => setActiveTab('hotspots')}
          >
            <Flame
              size={15}
              color={activeTab === 'hotspots' ? colors.white : colors.slate600}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.topTabText,
                activeTab === 'hotspots' && styles.topTabTextActive,
              ]}
            >
              Hotspot Analytics
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.topTabBtn, activeTab === 'officers' && styles.topTabActive]}
            onPress={() => setActiveTab('officers')}
          >
            <Users
              size={15}
              color={activeTab === 'officers' ? colors.white : colors.slate600}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.topTabText,
                activeTab === 'officers' && styles.topTabTextActive,
              ]}
            >
              Officers ({officers.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAnalyticsData(true)}
            colors={[colors.teal]}
          />
        }
      >
        {error && <ErrorView message={error} onRetry={() => fetchAnalyticsData()} />}

        {activeTab === 'hotspots' ? (
          <>
            {/* Grid Resolution Selector */}
            <View style={styles.gridRow}>
              <Text style={styles.gridLabel}>Spatial Grid Resolution:</Text>
              {[250, 500, 1000].map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setGridSize(g)}
                  style={[styles.gridPill, gridSize === g && styles.gridPillActive]}
                >
                  <Text
                    style={[
                      styles.gridPillText,
                      gridSize === g && styles.gridPillTextActive,
                    ]}
                  >
                    {g}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* KPI Cards */}
            <View style={styles.kpiGrid}>
              <StatCard
                title="Detected Hotspots"
                value={summary?.total_hotspots ?? 0}
                subtitle={`${summary?.total_complaints_in_hotspots ?? 0} clustered issues`}
                icon={<Layers size={16} color={colors.primary} />}
                accentColor={colors.primary}
              />
              <StatCard
                title="High Intensity"
                value={summary?.high_intensity_count ?? 0}
                subtitle={`Med: ${summary?.medium_intensity_count ?? 0} • Low: ${summary?.low_intensity_count ?? 0}`}
                icon={<AlertTriangle size={16} color={colors.danger} />}
                accentColor={colors.danger}
              />
            </View>

            {/* SVG Spatial Radar Plot */}
            {renderSpatialRadar()}

            {/* Ranked Hotspot Clusters List */}
            <Text style={styles.listHeading}>
              RANKED SPATIAL HOTSPOT CLUSTERS ({hotspots.length})
            </Text>

            {hotspots.map((spot) => {
              const badgeBg =
                spot.intensity === 'HIGH'
                  ? '#FEE2E2'
                  : spot.intensity === 'MEDIUM'
                  ? '#FEF3C7'
                  : colors.tealLight;
              const badgeColor =
                spot.intensity === 'HIGH'
                  ? colors.danger
                  : spot.intensity === 'MEDIUM'
                  ? '#B45309'
                  : colors.tealDark;

              return (
                <Card
                  key={spot.cluster_id}
                  style={styles.spotCard}
                  onPress={() =>
                    openHotspotInMaps(spot.center_latitude, spot.center_longitude)
                  }
                >
                  <View style={styles.spotTopRow}>
                    <Text style={styles.spotId}>{spot.cluster_id}</Text>
                    <View style={[styles.intensityBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.intensityText, { color: badgeColor }]}>
                        {spot.intensity} INTENSITY
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.spotCat}>
                    Dominant Category: {spot.dominant_category} ({spot.complaint_count} cases)
                  </Text>

                  <View style={styles.spotMetaRow}>
                    <Text style={styles.spotMeta}>
                      Severity Score: {spot.severity_score} • Radius: {spot.radius_meters}m
                    </Text>
                  </View>

                  <View style={styles.spotCoordsRow}>
                    <MapPin size={13} color={colors.teal} style={{ marginRight: 4 }} />
                    <Text style={styles.spotCoordsText}>
                      {Number(spot.center_latitude).toFixed(4)}°N,{' '}
                      {Number(spot.center_longitude).toFixed(4)}°E
                    </Text>
                    <ExternalLink size={13} color={colors.primary} />
                  </View>
                </Card>
              );
            })}
          </>
        ) : (
          /* Officer Directory & Creation (Admin Only) */
          <>
            <Card>
              <View style={styles.rowCenter}>
                <UserPlus size={18} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.cardTitle}>Register New Municipal Officer</Text>
              </View>

              <Input
                label="FULL NAME"
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Karthik Subramanian"
              />
              <Input
                label="OFFICIAL EMAIL"
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="karthik.water@civicpulse.gov"
                keyboardType="email-address"
              />
              <Input
                label="INITIAL PASSWORD (MIN 8 CHARS)"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••••••"
                secureTextEntry={true}
              />

              <Text style={styles.deptLabel}>ASSIGN DEPARTMENT</Text>
              <View style={styles.deptWrap}>
                {DEPARTMENTS.map((d) => {
                  const active = newDept === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setNewDept(d)}
                      style={[styles.deptChip, active && styles.deptChipActive]}
                    >
                      <Text
                        style={[styles.deptChipText, active && styles.deptChipTextActive]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Button
                title="Create Officer Account"
                onPress={handleCreateOfficer}
                variant="teal"
                loading={creatingOfficer}
              />
            </Card>

            <Text style={styles.listHeading}>
              REGISTERED MUNICIPAL PERSONNEL ({officers.length})
            </Text>

            {officers.map((off) => (
              <Card key={off.id} style={styles.officerCard}>
                <View style={styles.spotTopRow}>
                  <Text style={styles.officerName}>{off.name}</Text>
                  <View
                    style={[
                      styles.intensityBadge,
                      {
                        backgroundColor:
                          off.role === 'ADMIN' ? '#EDE9FE' : colors.tealLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.intensityText,
                        {
                          color: off.role === 'ADMIN' ? '#6D28D9' : colors.tealDark,
                        },
                      ]}
                    >
                      {off.role}
                    </Text>
                  </View>
                </View>
                <Text style={styles.officerEmail}>{off.email}</Text>
                <Text style={styles.officerDept}>Department: {off.department}</Text>
              </Card>
            ))}
          </>
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
  topTabs: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.slate100,
  },
  topTabActive: {
    backgroundColor: colors.primary,
  },
  topTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate600,
  },
  topTabTextActive: {
    color: colors.white,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate600,
    flex: 1,
  },
  gridPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridPillActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  gridPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate700,
  },
  gridPillTextActive: {
    color: colors.white,
  },
  kpiGrid: {
    flexDirection: 'row',
    marginHorizontal: -5,
    marginBottom: 10,
  },
  radarCard: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  radarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  radarTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.teal,
    letterSpacing: 0.6,
  },
  radarSub: {
    fontSize: 10,
    color: colors.slate400,
  },
  svgWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.slate300,
  },
  listHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.slate500,
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 4,
  },
  spotCard: {
    marginBottom: 10,
  },
  spotTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  spotId: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  intensityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  intensityText: {
    fontSize: 10,
    fontWeight: '800',
  },
  spotCat: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.slate800,
    marginBottom: 4,
  },
  spotMetaRow: {
    marginBottom: 8,
  },
  spotMeta: {
    fontSize: 12,
    color: colors.slate500,
  },
  spotCoordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate100,
    padding: 8,
    borderRadius: 8,
  },
  spotCoordsText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  deptLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate700,
    marginBottom: 8,
  },
  deptWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  deptChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.slate100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deptChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  deptChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.slate700,
  },
  deptChipTextActive: {
    color: colors.white,
  },
  officerCard: {
    marginBottom: 10,
  },
  officerName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.slate900,
  },
  officerEmail: {
    fontSize: 12,
    color: colors.slate500,
    marginBottom: 2,
  },
  officerDept: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.tealDark,
  },
});

export default AdminAnalyticsScreen;

