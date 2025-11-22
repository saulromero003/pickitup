import React from 'react';
import MapView from 'react-native-maps';
import { StyleSheet, View } from 'react-native';
import { PROVIDER_GOOGLE } from 'react-native-maps';

const INITIAL_REGION = {"latitude": 19.5703487899431, "latitudeDelta": 1.5684100866547226, "longitude": -101.22468581423163, "longitudeDelta": 0.8867285773158073};


export default function MapViewComponent() {
  return (
    <View style={styles.container}>
      <MapView
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      showsUserLocation
      region={INITIAL_REGION}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
