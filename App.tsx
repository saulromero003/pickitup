import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './lib/supabase';
import { RootStackParamList } from './types/navigation';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    // suscripción a cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // cleanup
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <NavigationContainer>
      {!session ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

// Pantalla temporal de prueba para usuarios logueados
function HomeScreen() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const session = supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  const onSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e: any) {
      console.log('signOut error:', e?.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={{ fontSize: 20, color: '#0A3251', marginBottom: 8, fontWeight: '600' }}>
        ¡Sesión iniciada correctamente! 🎉
      </Text>

      <Text style={{ fontSize: 16, color: '#0A3251', marginBottom: 20 }}>
        Hola, {user?.user_metadata?.nombre ?? user?.id}
      </Text>

      <TouchableOpacity onPress={onSignOut} style={styles.signOutBtn}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  signOutBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#0A3251',
    borderRadius: 10,
  },
  signOutText: {
    color: '#0A3251',
    fontWeight: '600',
  },
});
