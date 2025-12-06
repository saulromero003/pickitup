import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  Alert, 
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { supabase } from '../lib/supabase';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSignIn = async () => {
    Keyboard.dismiss(); 

    if (!email || !password) {
      Alert.alert('Campos faltantes', 'Ingresa tu correo y contraseña.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          Alert.alert('Verifica tu correo', 'Debes confirmar tu email antes de iniciar sesión.');
        } else {
          Alert.alert('No se pudo iniciar sesión', error.message);
        }
        return;
      }
    } catch (e: any) {
      Alert.alert('Error inesperado', e?.message ?? 'Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <Image source={require('../assets/pickitup_logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>PickItUp</Text>
        <Text style={styles.subtitle}>Inicia sesión en tu cuenta</Text>

        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color="#0A3251" style={styles.icon} />
          <TextInput
            placeholder="Correo:"
            placeholderTextColor="#0A3251AA"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="key-outline" size={20} color="#0A3251" style={styles.icon} />
          <TextInput
            placeholder="Contraseña:"
            placeholderTextColor="#0A3251AA"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity style={[styles.loginButton, loading && { opacity: 0.7 }]} onPress={onSignIn} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Iniciar sesión</Text>}
        </TouchableOpacity>

        <Text style={styles.registerText}>Si no tienes cuenta regístrate</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Register')} disabled={loading}>
          <Text style={styles.registerButton}>Registrarme</Text>
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  logo: { width: 90, height: 90, marginBottom: 10 },
  title: { fontSize: 22, color: '#0A3251', fontWeight: 'bold' },
  subtitle: { fontSize: 16, color: '#0A3251', marginTop: 10, marginBottom: 30 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', borderColor: '#0A3251', borderWidth: 1, borderRadius: 20,
    width: '100%', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 15, shadowColor: '#000',
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 2, backgroundColor: '#fff',
  },
  icon: { marginRight: 6 },
  input: { flex: 1, color: '#0A3251', fontSize: 16 },
  loginButton: {
    backgroundColor: '#31C16D', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 30, marginTop: 10,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  loginButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  registerText: { marginTop: 40, color: '#0A3251', fontSize: 13 },
  registerButton: {
    color: '#0A3251', fontWeight: 'bold', borderColor: '#0A3251', borderWidth: 1,
    paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20, marginTop: 6,
  },
});
