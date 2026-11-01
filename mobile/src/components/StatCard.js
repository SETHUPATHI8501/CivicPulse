import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../theme/colors';

export const StatCard = ({
  title,
  value,
  subtitle,
  icon = null,
  accentColor = colors.teal,
  style = {},
}) => {
  return (
    <View style={[styles.card, { borderTopColor: accentColor }, style]}>
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {icon ? <View style={styles.iconBox}>{icon}</View> : null}
      </View>
      <Text style={[styles.value, { color: accentColor }]}>
        {value !== undefined && value !== null ? value : '—'}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    margin: 5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.slate600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1,
  },
  iconBox: {
    marginLeft: 6,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    color: colors.slate400,
    marginTop: 4,
  },
});

export default StatCard;

