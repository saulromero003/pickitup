import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../types/navigation';
import MapViewComponent from '../components/MapViewComponent';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      console.log("SESSION",data.session?.user.user_metadata);
    });
  }, []);

  const displayName = useMemo(() => {
    return (
      user?.user_metadata?.nombre ||
      user?.user_metadata?.full_name ||
      user?.email ||
      'Usuario'
    );
  }, [user]);

  const initials = useMemo(() => {
    const name =
      user?.user_metadata?.nombre ||
      user?.user_metadata?.full_name ||
      '';
    if (!name) return '👤';
    const parts = String(name).trim().split(/\s+/);
    const inits = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
    return inits.toUpperCase();
  }, [user]);

  const avatarUrl =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    null;

  const onSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e: any) {
      console.log('signOut error:', e?.message);
    }
  };

  useEffect(() => {
    async function fetchProfilePic() {
      if (!user?.id) return;
      try {
        const { data: profile_pic_url, error } = await supabase
          .from('person')
          .select('profile_pic')
          .eq('user_id', user.id)
          .single();

        if (error || !profile_pic_url) {
          console.error('Error fetching user data from supabase to get the image:', error);
          return;
        }
        setProfilePicUri(profile_pic_url.profile_pic);
        console.log('Fetched profile pic URL:', profilePicUri);
      } catch (error) {
        console.error('Error fetching profile pic:', error);
      }
    }

    fetchProfilePic();
  }, [user?.id]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require('../assets/pickitup_logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity
          onPress={() => setSidebarOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Abrir menú"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="menu" size={28} color="#0A3251" />
        </TouchableOpacity>
      </View>

      {/* Map placeholder */}
      <MapViewComponent />

      {/* Bottom card */}
      <View style={styles.bottomWrap} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.avatarWrap}>
            {profilePicUri ? (
                          <Image source={{ uri: profilePicUri }} style={styles.avatarImg} />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Ionicons name="person" size={36} color="#0A3251" />
                          </View>
                        )}
          </View>

          {/* Nombre del usuario */}
          <Text style={styles.displayName} numberOfLines={1}>
            {displayName}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => Alert.alert('Help!', 'Acción pendiente de integrar')}
            >
              <Ionicons name="alert-circle" size={18} color="#fff" />
              <Text style={[styles.btnText, styles.btnTextPrimary]}>Help!</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() =>
                Alert.alert('Trabajemos', 'Acción pendiente de integrar')
              }
            >
              <Ionicons name="briefcase" size={18} color="#0A3251" />
              <Text style={[styles.btnText, styles.btnTextSecondary]}>
                Trabajemos!
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Sidebar (Modal) */}
      <Modal
        visible={sidebarOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSidebarOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSidebarOpen(false)} />
        <View style={styles.sidebar}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Menú</Text>
            <TouchableOpacity onPress={() => setSidebarOpen(false)}>
              <Ionicons name="close" size={24} color="#0A3251" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.sidebarItem}
            onPress={() => {
              setSidebarOpen(false);
              navigation.navigate('Profile');
            }}
          >
            <Ionicons name="person-circle" size={22} color="#0A3251" />
            <Text style={styles.sidebarItemText}>Perfil</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sidebarItem} onPress={onSignOut}>
            <Ionicons name="log-out" size={22} color="#0A3251" />
            <Text style={styles.sidebarItemText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const CARD_WIDTH = 320;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },

  /* Header */
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E9EE',
    backgroundColor: '#FFFFFF',
  },
  logo: { width: 130, height: 32 },

  /* Map placeholder */
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapText: { color: '#9AA4B2' },

  /* Bottom card */
  bottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
  },
  card: {
    width: CARD_WIDTH,
    paddingTop: 56, // un poco más para dar aire al nombre
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'absolute',
    top: -32,
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#D7ECFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D7ECFF',
  },
  avatarText: { fontWeight: '700', color: '#0A3251' },

  displayName: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 16,
    fontWeight: '700',
    color: '#0A3251',
    maxWidth: CARD_WIDTH - 32,
  },

  actions: { width: '100%', gap: 10 },
  btn: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrimary: { backgroundColor: '#0A3251' },
  btnTextPrimary: { color: '#fff' },
  btnSecondary: {
    backgroundColor: '#F2F5F8',
    borderWidth: 1,
    borderColor: '#C7D1DF',
  },
  btnTextSecondary: { color: '#0A3251' },
  btnText: { fontWeight: '700' },

  /* Sidebar */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  sidebar: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingHorizontal: 16,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#E6E9EE',
  },
  sidebarHeader: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sidebarTitle: { fontSize: 18, fontWeight: '700', color: '#0A3251' },
  sidebarItem: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EDF1F6',
  },
  sidebarItemText: { fontSize: 16, color: '#0A3251' },
});
