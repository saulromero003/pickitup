import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();


  const [name, setName] = useState('');
  const [lNamePat, setLNamePat] = useState('');
  const [lNameMat, setLNameMat] = useState('');
  const [birthdate, setBirthdate] = useState<Date | undefined>(undefined);
  const [workProf, setWorkProf] = useState('');
  const [profilePic, setProfilePic] = useState<string | null>(null);


  const [country, setCountry] = useState('');
  const [stateMx, setStateMx] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState(''); // colonia
  const [street, setStreet] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);

  const birthdateLabel = useMemo(() => {
    if (!birthdate) return 'Seleccionar fecha';
    return birthdate.toLocaleDateString();
  }, [birthdate]);

  const onPickDate = (_: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (selected) setBirthdate(selected);
  };

  const onPickAvatar = async () => {

    Alert.alert('Cambiar foto', 'Integrar selector de imagen más adelante.');
  };

  const onSave = () => {
    if (!name.trim()) {
      Alert.alert('Falta tu nombre', 'Por favor ingresa tu nombre.');
      return;
    }
    if (newPassword || confirmPassword) {
      if (!currentPassword) {
        Alert.alert('Contraseña actual requerida', 'Para cambiar tu contraseña, ingresa la actual.');
        return;
      }
      if (newPassword.length < 6) {
        Alert.alert('Contraseña muy corta', 'La nueva contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert('No coincide', 'La confirmación no coincide con la nueva contraseña.');
        return;
      }
    }

    // Payloads listos para backend
    const personPayload = {
      // Tabla: public.person
      name: name.trim(),                  // person.name
      l_name_pat: lNamePat.trim() || null, // person.l_name_pat
      l_name_mat: lNameMat.trim() || null, // person.l_name_mat
      birthdate: birthdate ? birthdate.toISOString().slice(0, 10) : null, // YYYY-MM-DD
      profile_pic: profilePic,           // person.profile_pic (URL cuando exista)
      work_prof: workProf.trim() || null,// person.work_prof
      // Si luego geocodifican:
      // latitude: number | null,
      // longitude: number | null,
    };

    const addressPayload = {
      country: country.trim() || null,
      state: stateMx.trim() || null,
      city: city.trim() || null,
      neighborhood: neighborhood.trim() || null,
      street: street.trim() || null,
    };

    const passwordPayload = newPassword
      ? {
          current_password: currentPassword,
          new_password: newPassword,
        }
      : null;


    console.log({ personPayload, addressPayload, passwordPayload });
    Alert.alert('Listo', 'Formulario validado. Backend puede conectar aquí. SINUHE Y KEVIN');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#0A3251" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Foto de perfil</Text>
          <View style={styles.avatarRow}>
            {profilePic ? (
              <Image source={{ uri: profilePic }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={36} color="#0A3251" />
              </View>
            )}
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onPickAvatar}>
              <Ionicons name="camera" size={18} color="#0A3251" />
              <Text style={[styles.btnText, styles.btnTextSecondary]}>Cambiar foto</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos personales</Text>

          <Field label="Nombre(s)">
            <TextInput
              placeholder="Tu nombre"
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Apellido paterno">
            <TextInput
              placeholder="Paterno"
              value={lNamePat}
              onChangeText={setLNamePat}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Apellido materno">
            <TextInput
              placeholder="Materno"
              value={lNameMat}
              onChangeText={setLNameMat}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Fecha de nacimiento">
            <TouchableOpacity
              style={[styles.input, styles.inputButton]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar" size={18} color="#0A3251" />
              <Text style={birthdate ? styles.inputButtonText : styles.inputButtonPlaceholder}>
                {birthdateLabel}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                value={birthdate ?? new Date(2000, 0, 1)}
                onChange={onPickDate}
                maximumDate={new Date()}
              />
            )}
          </Field>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Domicilio</Text>

          <Field label="País">
            <TextInput
              placeholder="México"
              value={country}
              onChangeText={setCountry}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Estado">
            <TextInput
              placeholder="Michoacán"
              value={stateMx}
              onChangeText={setStateMx}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Ciudad">
            <TextInput
              placeholder="Morelia"
              value={city}
              onChangeText={setCity}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Colonia">
            <TextInput
              placeholder="Colonia"
              value={neighborhood}
              onChangeText={setNeighborhood}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Calle">
            <TextInput
              placeholder="Calle"
              value={street}
              onChangeText={setStreet}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profesión</Text>
          <Field label="Profesión u oficio">
            <TextInput
              placeholder="Ing. en Sistemas, Carpintero, etc."
              value={workProf}
              onChangeText={setWorkProf}
              style={styles.input}
              placeholderTextColor="#8FA1B3"
            />
          </Field>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Seguridad</Text>

          <Field label="Contraseña actual">
            <TextInput
              placeholder="••••••••"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              style={styles.input}
              secureTextEntry
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Nueva contraseña">
            <TextInput
              placeholder="••••••••"
              value={newPassword}
              onChangeText={setNewPassword}
              style={styles.input}
              secureTextEntry
              placeholderTextColor="#8FA1B3"
            />
          </Field>

          <Field label="Confirmar nueva contraseña">
            <TextInput
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
              secureTextEntry
              placeholderTextColor="#8FA1B3"
            />
          </Field>
        </View>

        <View style={{ height: 88 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onSave}>
          <Ionicons name="save" size={18} color="#fff" />
          <Text style={[styles.btnText, styles.btnTextPrimary]}>Guardar cambios</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E9EE',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: { color: '#0A3251', fontSize: 18, fontWeight: '700' },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  scroll: { padding: 16, gap: 14 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    gap: 8,
  },
  cardTitle: { color: '#0A3251', fontWeight: '700', marginBottom: 6 },

  field: { marginBottom: 10 },
  label: { color: '#5A6B7C', marginBottom: 6, fontSize: 13 },

  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#C7D1DF',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#0A3251',
    backgroundColor: '#F8FAFC',
  },

  inputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputButtonText: { color: '#0A3251' },
  inputButtonPlaceholder: { color: '#8FA1B3' },

  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarImg: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EEE' },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D7ECFF',
  },

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

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    paddingHorizontal: 16,
  },
});
