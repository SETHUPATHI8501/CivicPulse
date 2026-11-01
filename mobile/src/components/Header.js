import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { ChevronLeft, Globe } from 'lucide-react-native';

export const Header = ({
  title,
  subtitle,
  showBack = false,
  onBack = null,
  showLanguageToggle = false,
  rightComponent = null,
}) => {
  const { language, setLanguage } = useLanguage();

  const toggleLang = () => {
    setLanguage(language === 'en' ? 'ta' : 'en');
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.leftRow}>
          {showBack && (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>

        <View style={styles.rightRow}>
          {showLanguageToggle && (
            <TouchableOpacity onPress={toggleLang} style={styles.langPill}>
              <Globe size={14} color={colors.tealDark} style={{ marginRight: 4 }} />
              <Text style={styles.langText}>
                {language === 'en' ? 'தமிழ்' : 'English'}
              </Text>
            </TouchableOpacity>
          )}
          {rightComponent}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 2,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tealLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  langText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.tealDark,
  },
});

export default Header;

