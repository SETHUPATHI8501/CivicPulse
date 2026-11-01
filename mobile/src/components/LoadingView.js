import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import colors from '../theme/colors';
import Button from './Button';
import { API_BASE_URL, setCustomApiBaseUrl } from '../services/api';

export const LoadingView = ({ message = 'Loading...' }) => {
  return (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={colors.teal} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
};

export const ErrorView = ({ message = 'An error occurred.', onRetry = null }) => {
  const [showConfig, setShowConfig] = useState(false);
  const [customUrl, setCustomUrl] = useState(API_BASE_URL || 'http://10.46.101.115:8000/api/v1');

  const handleSaveAndRetry = async () => {
    await setCustomApiBaseUrl(customUrl);
    setShowConfig(false);
    if (onRetry) {
      onRetry();
    }
  };

  return (
    <View style={styles.centerContainer}>
      <Text style={styles.errorTitle}>Connection Issue</Text>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Button
          title="Try Again"
          onPress={onRetry}
          variant="outline"
          style={styles.retryBtn}
        />
      ) : null}

      <TouchableOpacity
        onPress={() => setShowConfig(!showConfig)}
        style={styles.configToggle}
      >
        <Text style={styles.configToggleText}>
          {showConfig ? 'Hide Server Settings' : 'Configure Backend LAN URL'}
        </Text>
      </TouchableOpacity>

      {showConfig ? (
        <View style={styles.configCard}>
          <Text style={styles.configLabel}>FastAPI Server URL (LAN IP):</Text>
          <TextInput
            style={styles.configInput}
            value={customUrl}
            onChangeText={setCustomUrl}
            placeholder="http://10.46.101.115:8000/api/v1"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            title="Save & Reconnect"
            onPress={handleSaveAndRetry}
            variant="secondary"
            size="sm"
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.slate600,
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate800,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: colors.slate500,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  retryBtn: {
    minWidth: 140,
  },
  configToggle: {
    marginTop: 18,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  configToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.tealDark,
    textDecorationLine: 'underline',
  },
  configCard: {
    width: '100%',
    marginTop: 10,
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  configLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.slate700,
    marginBottom: 6,
  },
  configInput: {
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.slate900,
    marginBottom: 10,
  },
});

export default LoadingView;
