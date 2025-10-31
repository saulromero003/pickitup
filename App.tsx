import 'react-native-url-polyfill/auto';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase'
import { StyleSheet, View, Text } from 'react-native';
import Auth from './components/Auth';
import { Session } from '@supabase/supabase-js'


export default function App() {

  const [session, setSession] = useState<Session | null>(null)
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])


  return (
    <View style={styles.container}>
      <Auth />
      {session && session.user && <Text>{session.user.id}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
