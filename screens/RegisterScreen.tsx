import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Gender = 'masculino' | 'femenino' | 'otros' | null;

/* ---------- UI helpers ---------- */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{children}</Text>
    </View>
  );
}

function KeyboardAvoidingKeyboardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

function Radio({
  value,
  label,
  selected,
  onSelect,
}: {
  value: Exclude<Gender, null>;
  label: string;
  selected: boolean;
  onSelect: (v: Exclude<Gender, null>) => void;
}) {
  return (
    <TouchableOpacity style={styles.radioItem} onPress={() => onSelect(value)}>
      <View style={styles.radioOuter}>{selected && <View style={styles.radioInner} />}</View>
      <Text style={styles.radioLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function InputField({
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  secureTextEntry,
  autoCapitalize = 'none',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.inputContainer}>
      <Ionicons name={icon} size={20} color="#0A3251" style={styles.icon} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#0A3251AA"
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

/* Select simple en modal (para país/estado) */
function SelectField({
  icon,
  placeholder,
  value,
  onSelect,
  options,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onSelect: (v: string) => void;
  options: string[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.inputContainer, disabled && { opacity: 0.6 }]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
      >
        <Ionicons name={icon} size={20} color="#0A3251" style={styles.icon} />
        <Text style={[styles.input, { paddingVertical: 2, color: value ? '#0A3251' : '#0A3251AA' }]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#0A3251" style={{ opacity: 0.7 }} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{placeholder.replace(':', '')}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{item}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#eee' }} />}
              style={{ maxHeight: 300 }}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setOpen(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

/* Fecha de nacimiento con DateTimePicker */
function BirthdateField({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (d: Date) => void;
}) {
  const [open, setOpen] = useState(false);

  const minDate = new Date(1900, 0, 1);
  const maxDate = new Date(); // hoy

  const display = value
    ? new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
    : 'Fecha de nacimiento:';

  const onChangePicker = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (selected) onChange(selected);
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.inputContainer}
        onPress={() => setOpen(true)}
      >
        <Ionicons name="calendar-outline" size={20} color="#0A3251" style={styles.icon} />
        <Text style={[styles.input, { paddingVertical: 2, color: value ? '#0A3251' : '#0A3251AA' }]}>
          {display}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#0A3251" style={{ opacity: 0.7 }} />
      </TouchableOpacity>

      {open && (
        Platform.OS === 'ios' ? (
          <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Selecciona tu fecha</Text>
                <DateTimePicker
                  mode="date"
                  value={value ?? new Date(2000, 0, 1)}
                  onChange={onChangePicker}
                  maximumDate={maxDate}
                  minimumDate={minDate}
                  display="spinner"
                  themeVariant="light"
                  textColor="#000000"
                />
                <TouchableOpacity style={styles.modalClose} onPress={() => setOpen(false)}>
                  <Text style={styles.modalCloseText}>Listo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            mode="date"
            value={value ?? new Date(2000, 0, 1)}
            onChange={onChangePicker}
            maximumDate={maxDate}
            minimumDate={minDate}
          />
        )
      )}
    </>
  );
}

/* ---------- Pantalla ---------- */

export default function RegisterScreen() {
  const navigation = useNavigation<Nav>();

  // Datos personales
  const [nombre, setNombre] = useState('');
  const [apellidoP, setApellidoP] = useState('');
  const [apellidoM, setApellidoM] = useState('');
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [genero, setGenero] = useState<Gender>(null); // sin selección

  // Domicilio
  const [pais, setPais] = useState<string>('');
  const [estado, setEstado] = useState<string>('');
  const [ciudad, setCiudad] = useState('');
  const [colonia, setColonia] = useState('');
  const [calle, setCalle] = useState('');

  // Seguridad
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  // Opciones
  const paises = ['México', 'Estados Unidos', 'Canadá'];
  const estadosMX = [
    'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua','Ciudad de México',
    'Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán',
    'Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí','Sinaloa',
    'Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'
  ];
  const estadosOptions = pais === 'México' ? estadosMX : [];

  /* Utils */
  const isAdult = (d: Date) => {
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age >= 18;
  };
  const toISODate = (d: Date) => d.toISOString().split('T')[0]; // YYYY-MM-DD

  const onSubmit = async () => {
    // Validaciones básicas
    if (!email || !password) return Alert.alert('Campos faltantes', 'Correo y contraseña son obligatorios.');
    if (!birthdate) return Alert.alert('Campos faltantes', 'Selecciona tu fecha de nacimiento.');
    if (!isAdult(birthdate)) return Alert.alert('Edad mínima', 'Debes ser mayor de 18 años.');
    if (password.length < 6) return Alert.alert('Contraseña débil', 'La contraseña debe tener al menos 6 caracteres.');
    if (password !== confirm) return Alert.alert('No coincide', 'La confirmación de contraseña no coincide.');
    if (!nombre || !apellidoP || !apellidoM) return Alert.alert('Campos faltantes', 'Nombre y apellidos son obligatorios.');
    if (!genero) return Alert.alert('Campos faltantes', 'Selecciona tu género.');
    if (!pais || !estado || !ciudad || !colonia || !calle) return Alert.alert('Campos faltantes', 'Completa todos los campos de domicilio.');

    setLoading(true);
    try {
      // Normaliza campos
      const emailNorm = email.trim().toLowerCase();

      const nombreNorm = nombre.trim();
      const apellidoPNorm = apellidoP.trim();
      const apellidoMNorm = apellidoM.trim();

      const ciudadNorm = ciudad.trim();
      const coloniaNorm = colonia.trim();
      const calleNorm = calle.trim();

      // 1) Sign Up
      const { data, error } = await supabase.auth.signUp({
        email: emailNorm,
        password,
      });
      if (error) throw error;

      const user = data.user;
      if (!user) {
        // Verificación por correo habilitada
        Alert.alert('Registro exitoso', 'Te enviamos un correo para verificar tu cuenta. Ábrelo y vuelve a la app.', [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            },
          },
        ]);
        return;
      }

      // 2) Upsert del perfil en public.person  ⬅️ birthdate agregado
      const { error: upsertError } = await supabase.from('person').upsert({
        user_id: user.id,
        name: nombreNorm,
        l_name_pat: apellidoPNorm,
        l_name_mat: apellidoMNorm,
        gender:
          genero === 'masculino' ? 'M' :
          genero === 'femenino' ? 'F' :
          genero === 'otros' ? 'X' : null,
        birthdate: toISODate(birthdate), // <-- guarda YYYY-MM-DD en columna DATE
        country: pais,
        state: estado,
        city: ciudadNorm,
        area: coloniaNorm,
        street: calleNorm,
      });

      if (upsertError) throw upsertError;

      // 3) ¿Hay sesión activa? Decide navegación segura
      const { data: sessionData } = await supabase.auth.getSession();
      const hasSession = !!sessionData.session;

      Alert.alert('Registro exitoso', '¡Tu cuenta fue creada!', [
        {
          text: 'OK',
          onPress: () => {
            if (hasSession) {
              // Ya hay sesión -> ir a Home con reset para evitar errores de navegación
              navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
            } else {
              // Sin sesión (p. ej., requiere verificar correo) -> Login
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            }
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('Error al registrar', e?.message ?? 'Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingKeyboardWrapper>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* DATOS PERSONALES */}
          <SectionTitle>Datos personales</SectionTitle>

          <InputField
            icon="person-outline"
            placeholder="Nombre:"
            value={nombre}
            onChangeText={setNombre}
            autoCapitalize="words"
          />
          <InputField
            icon="person-outline"
            placeholder="Apellido paterno:"
            value={apellidoP}
            onChangeText={setApellidoP}
            autoCapitalize="words"
          />
          <InputField
            icon="person-outline"
            placeholder="Apellido materno:"
            value={apellidoM}
            onChangeText={setApellidoM}
            autoCapitalize="words"
          />

          {/* Fecha de nacimiento */}
          <BirthdateField value={birthdate} onChange={setBirthdate} />

          {/* Género */}
          <Text style={styles.sectionMiniLabel}>Género:</Text>
          <View style={styles.radioRow}>
            <Radio value="masculino" label="Masculino" selected={genero === 'masculino'} onSelect={setGenero} />
            <Radio value="femenino" label="Femenino" selected={genero === 'femenino'} onSelect={setGenero} />
            <Radio value="otros" label="Otros" selected={genero === 'otros'} onSelect={setGenero} />
          </View>

          {/* DOMICILIO */}
          <SectionTitle>Domicilio</SectionTitle>
          <SelectField
            icon="flag-outline"
            placeholder="País:"
            value={pais}
            onSelect={(v) => {
              setPais(v);
              setEstado('');
            }}
            options={paises}
          />
          <SelectField
            icon="map-outline"
            placeholder="Estado:"
            value={estado}
            onSelect={setEstado}
            options={estadosOptions}
            disabled={pais !== 'México'}
          />
          <InputField
            icon="business-outline"
            placeholder="Ciudad:"
            value={ciudad}
            onChangeText={setCiudad}
            autoCapitalize="words"
          />
          <InputField
            icon="location-outline"
            placeholder="Colonia:"
            value={colonia}
            onChangeText={setColonia}
            autoCapitalize="words"
          />
          <InputField
            icon="home-outline"
            placeholder="Calle:"
            value={calle}
            onChangeText={setCalle}
            autoCapitalize="words"
          />

          {/* SEGURIDAD */}
          <SectionTitle>Seguridad</SectionTitle>
          <InputField
            icon="mail-outline"
            placeholder="Correo:"
            value={email}
            onChangeText={(t) => setEmail(t.trim())}
            keyboardType="email-address"
          />
          <InputField
            icon="key-outline"
            placeholder="Contraseña:"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <InputField
            icon="key-outline"
            placeholder="Confirmar contraseña:"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />

          {/* BOTONES */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.pillButton, styles.secondary]}
              onPress={handleBack}
              disabled={loading}
            >
              <Text style={[styles.pillButtonText, styles.secondaryText]}>Regresar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pillButton, styles.primary]}
              onPress={onSubmit}
              disabled={loading}
            >
              <Text style={styles.pillButtonText}>{loading ? 'Registrando…' : 'Registrarse'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingKeyboardWrapper>
    </SafeAreaView>
  );
}

/* ---------- estilos ---------- */

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 28, paddingTop: 16 },

  sectionTitle: {
    alignSelf: 'flex-start',
    backgroundColor: '#093A69',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitleText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#0A3251',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    backgroundColor: '#fff',
  },
  icon: { marginRight: 8 },
  input: { flex: 1, color: '#0A3251', fontSize: 16, marginRight: 6 },

  sectionMiniLabel: { color: '#0A3251', fontSize: 14, marginBottom: 8, marginTop: 4 },

  radioRow: { flexDirection: 'row', marginBottom: 6, alignItems: 'center' },
  radioItem: { flexDirection: 'row', alignItems: 'center', marginRight: 18 },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#0A3251',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#31C16D' },
  radioLabel: { color: '#0A3251', fontSize: 14 },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 40 },
  pillButton: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 6,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  primary: { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#093A69' },
  secondary: { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#31C16D' },
  pillButtonText: { fontWeight: '700', color: '#093A69' },
  secondaryText: { color: '#31C16D' },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#093A69', marginBottom: 8 },
  optionRow: { paddingVertical: 10, paddingHorizontal: 8 },
  optionText: { fontSize: 16, color: '#0A3251' },
  modalClose: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#093A69',
  },
  modalCloseText: { color: '#093A69', fontWeight: '600' },
});
