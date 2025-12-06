import React, { useEffect, useState, useMemo, useRef } from 'react';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import * as Location from 'expo-location';

type JobMarker = {
  description: any;
  pay: any;
  id: string | number;
  latitude: number;
  longitude: number;
  title?: string;
  photo?: string | null;
};

type Props = {
  jobMarkers?: JobMarker[];
  selectable?: boolean; // si true permite seleccionar un punto con long-press
  onSelectLocation?: (coords: { latitude: number; longitude: number }) => void;
  onMarkerPress?: (marker: JobMarker) => void;
  initialRegion?: any;
};

const DEFAULT_REGION = {
  latitude: 19.5703487899431,
  longitude: -101.22468581423163,
  latitudeDelta: 1.5684100866547226,
  longitudeDelta: 0.8867285773158073,
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371e3; // metres
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c; // metres
  return d; // devuelve metros
}

export default function MapViewComponent({
  jobMarkers = [],
  selectable = false,
  onSelectLocation,
  onMarkerPress,
  initialRegion,
}: Props) {
  const [region, setRegion] = useState(initialRegion ?? DEFAULT_REGION);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selected, setSelected] = useState<{ latitude: number; longitude: number } | null>(null);
  const pressLockRef = useRef<boolean>(false);

  // Código de animación/centrado eliminado por estabilidad.

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPermissionDenied(true);
          setLoadingLocation(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!mounted) return;
        const { latitude, longitude } = loc.coords;
        setUserLocation({ latitude, longitude });
        setRegion((r: any) => ({ ...r, latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }));
      } catch (e) {
        console.warn('Location error', e);
      } finally {
        if (mounted) setLoadingLocation(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLongPress = (e: any) => {
    if (!selectable) return;
    const { coordinate } = e.nativeEvent;
    setSelected({ latitude: coordinate.latitude, longitude: coordinate.longitude });
    if (onSelectLocation) onSelectLocation({ latitude: coordinate.latitude, longitude: coordinate.longitude });
  };

  const markersWithDistance = useMemo(() => {
    if (!userLocation) return jobMarkers.map((m) => ({ ...m, distance: null }));
    return jobMarkers.map((m) => ({ ...m, distance: haversineDistance(userLocation.latitude, userLocation.longitude, m.latitude, m.longitude) }));
  }, [jobMarkers, userLocation]);

  if (loadingLocation && !initialRegion) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0A3251" />
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text>No se otorgó permiso de ubicación. Activa permisos para ver tu ubicación en el mapa.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton
        region={region}
        onLongPress={handleLongPress}
      >
        {markersWithDistance.map((m) => {
          return (
            <Marker
              key={String(m.id)}
              coordinate={{ latitude: m.latitude, longitude: m.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => {
                // Prevent rapid repeated presses that may trigger native instability.
                try {
                  const lock = pressLockRef.current;
                  if (lock) {
                    // ignore rapid press
                    return;
                  }
                  // acquire lock for short debounce
                  pressLockRef.current = true;
                  setTimeout(() => {
                    pressLockRef.current = false;
                  }, 800);

                  if (onMarkerPress) onMarkerPress(m);
                } catch (err) {
                  console.warn('Error en onMarkerPress:', err);
                }
              }}
            >
              <View style={styles.markerPinContainer}>
                {/* Always render the pin (circle + triangle). Photo only in modal. */}
                <View style={styles.markerPinCircleOuter}>
                  <View style={styles.markerPinCircleInner} />
                </View>
                <View style={styles.markerPinTriangle} />
              </View>
            </Marker>
          );
        })}

        {selected && (
          <Marker
            pinColor="blue"
            coordinate={{ latitude: selected.latitude, longitude: selected.longitude }}
            title="Ubicación seleccionada"
          />
        )}
      </MapView>
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
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#eee',
  },
  markerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  callout: {
    width: 160,
  },
  calloutTitle: {
    fontWeight: '700',
    color: '#0A3251',
    marginBottom: 4,
  },
  calloutSubtitle: {
    color: '#6B7A8C',
    marginBottom: 6,
  },
  calloutImage: {
    width: 150,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#E1E8F0',
  },
  markerPinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPinCircleOuter: {
    width: 20,
    height: 18,
    borderRadius: 12,
    backgroundColor: '#15BC52',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  markerPinCircleInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  markerPinTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 5,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#15BC52',
    marginTop: -2,
  },
  
});
