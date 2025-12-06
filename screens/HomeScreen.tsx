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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../types/navigation';
import MapViewComponent from '../components/MapViewComponent';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);

  // ===== HELP! modals state =====
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [helpSearchingVisible, setHelpSearchingVisible] = useState(false);
  const [helpMatchVisible, setHelpMatchVisible] = useState(false); // aviso final

  const [helpDescription, setHelpDescription] = useState('');
  const [helpAddress, setHelpAddress] = useState('');
  const [helpPayment, setHelpPayment] = useState('');
  const [helpImageUri, setHelpImageUri] = useState<string | null>(null);

  const [helpCancelEnabled, setHelpCancelEnabled] = useState(true);
  const [helpTitle, setHelpTitle] = useState('');


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      // console.log('SESSION', data.session?.user?.user_metadata);
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
      // Forzar navegación al Login tras salir
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e: any) {
      console.log('signOut error:', e?.message);
    }
  };

  // Traer foto de perfil desde tabla person.profile_pic (CORREGIDO)
  useEffect(() => {
    let isActive = true; // Para evitar actualizaciones si el componente se desmonta

    async function fetchProfilePic() {
      if (!user?.id) return;
      try {
        // Usamos maybeSingle() para evitar error si no hay filas
        const { data, error } = await supabase
          .from('person')
          .select('profile_pic')
          .eq('user_id', user.id)
          .maybeSingle(); 

        if (error) {
          console.log('Error fetching profile pic (ignorable):', error.message);
          return;
        }

        if (isActive && data?.profile_pic) {
          setProfilePicUri(data.profile_pic);
        }
      } catch (error) {
        console.error('Error fetching profile pic:', error);
      }
    }

    fetchProfilePic();
    return () => { isActive = false; };
  }, [user?.id]);

  // Ventana de 5 min para cancelar búsqueda
  useEffect(() => {
    if (helpSearchingVisible) {
      setHelpCancelEnabled(true);
      const timeout = setTimeout(() => {
        setHelpCancelEnabled(false);
      }, 5 * 60 * 1000); // 5 minutos
      return () => clearTimeout(timeout);
    }
  }, [helpSearchingVisible]);

  // Auto cierre del modal de "encontraste una mano" a los 7s
  useEffect(() => {
    if (helpMatchVisible) {
      const timeout = setTimeout(() => {
        setHelpMatchVisible(false);
      }, 7000);
      return () => clearTimeout(timeout);
    }
  }, [helpMatchVisible]);

  /* ===== HELP! handlers ===== */

  const openHelpModal = () => {
    Keyboard.dismiss();
    setHelpModalVisible(true);
  };

  const handlePickHelpImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos permiso para acceder a tus fotos.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setHelpImageUri(result.assets[0].uri);
    }
  };

  const handleSubmitHelp = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      Alert.alert('Error', 'Debes iniciar sesión');
      return;
    }

    // 🔹 Buscar el person_id (int) desde la tabla person usando el user_id (uuid)
    const { data: personData, error: personError } = await supabase
      .from('person')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle(); // Cambiado a maybeSingle por seguridad

    if (personError || !personData) {
      Alert.alert('Error', 'No se encontró tu perfil. Intenta reiniciar la app.');
      return;
    }

    // Validaciones
    if (!helpDescription.trim()) {
      Alert.alert('Campo requerido', 'Por favor describe qué necesitas');
      return;
    }
    
    if (!helpAddress.trim()) {
      Alert.alert('Campo requerido', 'Por favor indica el domicilio');
      return;
    }
    
    if (!helpPayment.trim()) {
      Alert.alert('Campo requerido', 'Por favor indica el pago ofrecido');
      return;
    }

    const paymentNumber = parseFloat(helpPayment.replace(/[^0-9.]/g, ''));

    //Generación de "embedding" que es la informacion para el match con IA es AQUÍ
      const textoParaVectorizar = helpDescription.trim();

      console.log("1. Generando embedding...");
      const { data: embeddingData, error: iaError } =
        await supabase.functions.invoke("generate_embedding", {
          body: { text: textoParaVectorizar },
        });

      if (iaError) throw iaError;
      const embeddingVector = embeddingData.embedding;

    
    const serviceData = {
      name: helpTitle.trim(),
      description: helpDescription,
      proposed_price: paymentNumber,
      photos: helpImageUri,
      latitude: null,
      longitude: null,
      datetime: new Date().toISOString(),
      person_id: personData.id, // ✅ Usar el ID entero de la tabla person
      embedding: embeddingVector,
    }

    const { data, error } = await supabase
      .from('service_request')
      .insert([serviceData])
      .select();

    if (error) throw error;


    setHelpModalVisible(false);
    setHelpDescription('');
    setHelpAddress('');
    setHelpPayment('');
    setHelpImageUri(null);

    Alert.alert('¡Éxito!', 'Tu trabajito ha sido publicado');

  } catch (error) {
    console.error('Error al crear trabajito:', error);
    Alert.alert('Error', 'No se pudo publicar tu trabajito');
  }
};

  const handleCancelSearch = () => {
    if (!helpCancelEnabled) return;
    setHelpSearchingVisible(false);
    // Aquí luego pueden informar al backend que se canceló la oferta
  };

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

      {/* Mapa */}
      <MapViewComponent />

      {/* Bottom card */}
      <View style={styles.bottomWrap} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.avatarWrap}>
            {profilePicUri ? (
              <Image source={{ uri: profilePicUri }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person" size={36} color="#0A3251" />
                )}
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
              onPress={openHelpModal}
            >
              <Ionicons name="alert-circle" size={18} color="#fff" />
              <Text style={[styles.btnText, styles.btnTextPrimary]}>Help!</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => navigation.navigate('Jobs')}
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

      {/* MODAL 1: Crear trabajito */}
      <Modal
        visible={helpModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.helpModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Fondo oscuro clickeable */}
          <Pressable
            style={styles.backdrop}
            onPress={() => {
              Keyboard.dismiss();
              setHelpModalVisible(false);
            }}
          />

          {/* Tarjeta del formulario */}
          <View style={styles.helpModalCard}>
            <ScrollView
              contentContainerStyle={styles.helpModalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.helpModalTitle}>Crear trabajito</Text>
              <Text style={styles.helpModalSubtitle}>
                Publica un pequeño trabajo para que alguien te ayude.
              </Text>

              <Text style={styles.helpLabel}>¿Qué necesitas?</Text>
              <TextInput
                style={[styles.input, styles.helpTextarea]}
                placeholder='Ej. "Necesito a una persona que me ayude a pintar 4 paredes de mi casa"'
                placeholderTextColor="#8FA1B3"
                value={helpDescription}
                onChangeText={setHelpDescription}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.helpLabel}>Nombre del trabajito</Text>
              <TextInput
                style={styles.input}
                placeholder='Ej. "Pintar cuarto"'
                placeholderTextColor="#8FA1B3"
                value={helpTitle}
                onChangeText={setHelpTitle}
              />

              <Text style={styles.helpLabel}>Domicilio</Text>
              <TextInput
                style={styles.input}
                placeholder='Ej. "Col. Centro, Morelia, Mich."'
                placeholderTextColor="#8FA1B3"
                value={helpAddress}
                onChangeText={setHelpAddress}
              />

              <Text style={styles.helpLabel}>Pago ofrecido</Text>
              <TextInput
                style={styles.input}
                placeholder="$300 MXN"
                placeholderTextColor="#8FA1B3"
                value={helpPayment}
                onChangeText={setHelpPayment}
                keyboardType="numeric"
              />

              <View style={styles.helpImageRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.helpLabel}>Imagen del trabajo (opcional)</Text>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      styles.btnSecondary,
                      { justifyContent: 'flex-start' },
                    ]}
                    onPress={handlePickHelpImage}
                  >
                    <Ionicons name="image" size={18} color="#0A3251" />
                    <Text style={[styles.btnText, styles.btnTextSecondary]}>
                      {helpImageUri ? 'Cambiar imagen' : 'Subir imagen'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {helpImageUri && (
                  <Image source={{ uri: helpImageUri }} style={styles.helpImagePreview} />
                )}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, styles.helpSubmitButton]}
              onPress={handleSubmitHelp}
            >
              <Ionicons name="cloud-upload" size={18} color="#fff" />
              <Text style={[styles.btnText, styles.btnTextPrimary]}>
                Subir trabajito
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>


      {/* MINIMODAL 2: Barra "Buscando a personas interesadas" */}
      <Modal
        visible={helpSearchingVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpSearchingVisible(false)}
      >
        <View style={styles.helpSearchingContainer}>
          <View style={styles.helpSearchingBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.helpSearchingTitle}>
                Buscando a personas interesadas
              </Text>
              <Text style={styles.helpSearchingAddress} numberOfLines={1}>
                {helpAddress || 'Sin domicilio especificado'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.helpCancelButton,
                !helpCancelEnabled && styles.helpCancelButtonDisabled,
              ]}
              disabled={!helpCancelEnabled}
              onPress={handleCancelSearch}
            >
              <Text
                style={[
                  styles.helpCancelText,
                  !helpCancelEnabled && styles.helpCancelTextDisabled,
                ]}
              >
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helpSearchingHint}>
            {helpCancelEnabled
              ? 'Puedes cancelar la búsqueda durante los primeros 5 minutos.'
              : 'El tiempo para cancelar ha terminado.'}
          </Text>
        </View>
      </Modal>

      {/* MODAL 3: Felicidades encontraste una mano */}
      <Modal
        visible={helpMatchVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpMatchVisible(false)}
      >
        <View style={styles.helpMatchContainer}>
          <View style={styles.helpMatchCard}>
            <Ionicons name="hand-left" size={42} color="#0A3251" />
            <Text style={styles.helpMatchTitle}>
              Felicidades, encontraste una mano
            </Text>
            <Text style={styles.helpMatchSubtitle}>
              Te contactaremos con la persona interesada en tu trabajito.
            </Text>
          </View>
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
    paddingTop: 56,
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

  /* HELP! modal 1 */
  helpModalContainer: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  helpModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    paddingBottom: 16,
    maxHeight: '80%', // ← limita el alto del modal
  },
  helpModalScroll: {
    paddingBottom: 8,
  },
  helpModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A3251',
  },
  helpModalSubtitle: {
    fontSize: 13,
    color: '#6B7A8C',
    marginBottom: 4,
  },
  helpLabel: {
    fontSize: 13,
    color: '#5A6B7C',
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#C7D1DF',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#0A3251',
    backgroundColor: '#F8FAFC',
  },
  helpTextarea: {
    minHeight: 80,
    paddingTop: 8,
  },
  helpImageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
  },
  helpImagePreview: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#E1E8F0',
  },
  helpSubmitButton: {
    marginTop: 10,
    width: '100%', // ← botón ocupa ancho del modal, nunca se sale
  },

  /* HELP! minimodal 2 */
  helpSearchingContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  helpSearchingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  helpSearchingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A3251',
  },
  helpSearchingAddress: {
    fontSize: 12,
    color: '#6B7A8C',
    marginTop: 2,
  },
  helpCancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#0A3251',
    marginLeft: 10,
  },
  helpCancelButtonDisabled: {
    borderColor: '#C7D1DF',
    backgroundColor: '#F2F5F8',
  },
  helpCancelText: {
    fontSize: 13,
    color: '#0A3251',
    fontWeight: '600',
  },
  helpCancelTextDisabled: {
    color: '#9AA4B2',
  },
  helpSearchingHint: {
    fontSize: 11,
    color: '#6B7A8C',
    marginTop: 6,
    textAlign: 'center',
  },

  /* HELP! modal 3 */
  helpMatchContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  helpMatchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  helpMatchTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0A3251',
    textAlign: 'center',
  },
  helpMatchSubtitle: {
    fontSize: 13,
    color: '#6B7A8C',
    textAlign: 'center',
  },
});