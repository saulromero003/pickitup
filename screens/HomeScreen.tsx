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
import * as Location from 'expo-location';

import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../types/navigation';
import MapViewComponent from '../components/MapViewComponent';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

type WorkerInfo = {
  name: string;
  avatarUrl?: string | null;
};

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

  // ===== Estados: servicio en curso (creador) =====
  const [serviceInCourseJob, setServiceInCourseJob] = useState<any | null>(null);
  const [serviceDetailVisible, setServiceDetailVisible] = useState(false);
  const [myJobs, setMyJobs] = useState<any[] | null>(null);
  const [personId, setPersonId] = useState<any | null>(null);

  // ===== Mapa y trabajos =====
  const [jobMarkers, setJobMarkers] = useState<Array<any>>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [jobDetailVisible, setJobDetailVisible] = useState(false);

  // ✅ NUEVO: flujo “trabajador finalizó + evidencia”
  // En backend: tus compas deberían setear esto cuando cambie el servicio a finalizado.
  const [serviceStage, setServiceStage] = useState<'C' | 'F' | 'P' | 'T'>('C'); // C=en curso, F=finalizado
  const [workerFinishPhotoUri, setWorkerFinishPhotoUri] = useState<string | null>(null);

  // ✅ NUEVO: modal final (calificar + pagar)
  const [closeoutVisible, setCloseoutVisible] = useState(false);
  const [workerInfo, setWorkerInfo] = useState<WorkerInfo>({
    name: 'Trabajador asignado',
    avatarUrl: null,
  });
  const [rating, setRating] = useState<number>(0);
  const [ratingTried, setRatingTried] = useState(false);
  const [reviewText, setReviewText] = useState<string>('');
  const [clientRating, setClientRating] = useState(0);  
  const [clientReviewText, setClientReviewText] = useState(''); // Lo mantendremos vacío ya que no lo usas
const [finishSummaryVisible, setFinishSummaryVisible] = useState(false);

// HomeScreen.tsx (Trabajador)

const testUpdateState = async (serviceId: number) => {
    // serviceId debe ser el ID de la fila en la tabla 'service' (ej: 32)
    console.log(`Intentando actualizar service ID: ${serviceId} a 'T' (Test)`);

    try {
        const { data, error } = await supabase
            .from('service')
            .update({ state: 'T' }) 
            .eq('id', serviceId)    // Usamos el ID de la fila de servicio
            .select();              

        if (error) {
            console.error('❌ Falló la prueba de actualización:', error);
            Alert.alert('Error de Actualización', `Fallo de la BD: ${error.message}`);
        } else if (data && data.length > 0 && data[0].state === 'T') {
            console.log('✅ Prueba de actualización EXITOSA. Estado actual: T');
            Alert.alert('Éxito', `El servicio ID ${serviceId} fue actualizado a 'T'.`);
        } else {
            console.warn('⚠️ Advertencia: Query OK, pero el estado no cambió a T. El ID podría ser incorrecto.');
            Alert.alert('Advertencia', 'El ID es incorrecto o no corresponde a una fila activa.');
        }
    } catch (e) {
        console.error('Error general en la prueba:', e);
        Alert.alert('Error', 'Error desconocido en la prueba.');
    }
};

const fetchServiceInCourse = async () => {
    try {
        // 1. Obtener la lista de trabajos creados por el cliente
        const jobIds = myJobs?.map((job) => job.id) || [];
        console.log(`DIAGNÓSTICO: Jobs creados (myJobs) IDs: ${jobIds.length}`);
        
        if (jobIds.length === 0) {
            setServiceInCourseJob(null);
            return;
        }

        // 2. Consultar la tabla 'service' por un único servicio activo ('C' o 'F')
        //    Se usa .limit(1) en lugar de .maybeSingle() para evitar el error de "multiple rows returned".
        const { data: serviceDataArray, error: serviceError } = await supabase
            .from('service')
            .select('id, service_request_id, state') 
            .in('service_request_id', jobIds)
            .in('state', ['C', 'F']) // Buscar solo estados En Curso o Finalizado
            .order('id', { ascending: false }) // Tomar el más reciente
            .limit(1); 

        if (serviceError) {
            console.warn('Error fetching service in course:', serviceError.message || serviceError);
            setServiceInCourseJob(null);
            return;
        }

        console.log(`DIAGNÓSTICO: Resultado de consulta de servicio activo: ${serviceDataArray ? serviceDataArray.length : 0}`);

        if (serviceDataArray && serviceDataArray.length > 0) {
            const serviceData = serviceDataArray[0];
            
            // 3. Buscar los detalles del trabajo original en la lista local (myJobs)
            // 🛑 CORRECCIÓN CRÍTICA: Forzar la conversión a string para evitar fallos de ===
            // (Si job.id es string y serviceData.service_request_id es int4, la igualdad falla)
            const matchedJob = myJobs?.find(
                (job) => job.id.toString() === serviceData.service_request_id.toString()
            );

            console.log(`DIAGNÓSTICO: ¿Se encontró matchedJob? ${!!matchedJob}`);


            if (matchedJob) {
                // 4. Establecer el estado del trabajo activo (Mostrar Banner)
                console.log('DIAGNÓSTICO: ✅ Se encontró todo. Estableciendo serviceInCourseJob.');

                setServiceInCourseJob({
                    id: serviceData.id, 
                    serviceRequestId: serviceData.service_request_id, 
                    title: matchedJob.name,
                    description: matchedJob.description,
                    pay: matchedJob.pay,
                    address: `${matchedJob.latitude.toFixed(4)}°, ${matchedJob.longitude.toFixed(4)}°`,
                    photo: matchedJob.photos,
                });

                // Establecer la información del trabajador (si es necesario)
                setWorkerInfo({
                    name: 'Trabajador asignado',
                    avatarUrl: null,
                });

                // 5. Establecer la fase del servicio y abrir modal (si corresponde)
                setServiceStage(serviceData.state); 
                
                if (serviceData.state === 'F') {
                    console.log('DIAGNÓSTICO: Estado "F" detectado. Abriendo modal de pago.');
                    setCloseoutVisible(true);
                }

                // Limpiar otros estados por defecto (opcional)
                setWorkerFinishPhotoUri(null);
                setRating(0);
                setReviewText('');
                setRatingTried(false);
                
            } else {
                 console.log('DIAGNÓSTICO: serviceData encontrado, pero no se encontró match en myJobs. serviceInCourseJob = null.');
                 setServiceInCourseJob(null);
            }
        } else {
            console.log('DIAGNÓSTICO: No se encontraron servicios en estado C o F. serviceInCourseJob = null.');
            setServiceInCourseJob(null);
        }
    } catch (err) {
        console.error('fetchServiceInCourse error', err);
        setServiceInCourseJob(null); // Asegurar que el estado se limpie en caso de error
    }
};

// En la Vista del Cliente: Función de Catch-up (se ejecuta al cargar la sesión)

// En la función checkJobStatusOnLoad del Cliente:

const checkJobStatusOnLoad = async (jobId: number | null) => {
    if (!jobId) return;

    try {
        // ⚠️ Simplificar el SELECT para evitar errores de columnas inexistentes
        const { data: serviceData } = await supabase
            .from('service')
            .select('state') // ✅ Solo necesitamos el estado
            .eq('service_request_id', jobId) // ✅ Usando el serviceRequestId
            .maybeSingle();

        // Condición de apertura: si el estado es 'F'
        if (serviceData?.state === 'F') {
            console.log('CLIENTE: Catch-up detectó estado F. Abriendo modal de pago.');
            
            setServiceStage('F');
            setCloseoutVisible(true); // ¡ABRIR EL MODAL!
        }
    } catch (e) {
        console.error("Error al verificar estado en el catch-up:", e);
    }
};

const closeFinishSummary = () => {
        setFinishSummaryVisible(false);
        // Opcional: limpiar estados del trabajo finalizado si es necesario
        // setActiveServiceJob(null); 
        // setServiceStage('C'); // Volver a "Consultando"
    };


    // En el useEffect del Cliente que escucha cambios en la BD:

useEffect(() => {
    // ⚠️ CRÍTICO: Usar el serviceRequestId correcto
    if (!serviceInCourseJob?.serviceRequestId) return; 
    
    const serviceRequestId = serviceInCourseJob.serviceRequestId; 

    const channel = supabase
        .channel(`service_updates_${serviceRequestId}`)
        .on(
            'postgres_changes', 
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'service', 
                // ⚠️ CRÍTICO: Filtrar por el ID de la solicitud, no por el ID de fila
                filter: `service_request_id=eq.${serviceRequestId}` 
            }, 
            (payload) => {
                try {
                    // Simplificar el tipo de payload (solo necesitamos el estado)
                    const newRow = payload.new as { state: string };
                    
                    if (newRow.state === 'F') { 
                        console.log('CLIENTE: 🔔 Realtime detectó FINALIZACIÓN. Abriendo modal.');
                        
                        setServiceStage('F');
                        setCloseoutVisible(true); // ¡ABRIR EL MODAL!
                    }
                    
                } catch (e) {
                    console.warn('Realtime handler error:', e);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
    
// ⚠️ CRÍTICO: Usar serviceRequestId como dependencia
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [serviceInCourseJob?.serviceRequestId]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  // Cargar trabajos con lat/long desde la base para mostrarlos en el mapa
  const fetchJobMarkers = async () => {
    try {
      const { data, error } = await supabase
        .from('service_request')
        .select('id, name, description, proposed_price, photos, latitude, longitude')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) {
        console.warn('Error fetching job markers:', error.message || error);
        return;
      }

      const markers = (data || []).map((r: any) => ({
        id: r.id,
        title: r.name || r.description || 'Trabajo',
        description: r.description || '',
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        photo: Array.isArray(r.photos) ? r.photos[0] : r.photos || null,
        pay: r.proposed_price != null ? `$${r.proposed_price} MXN` : undefined,
      }));

      setJobMarkers(markers);
    } catch (err) {
      console.error('fetchJobMarkers error', err);
    }
  };

// En la VISTA DEL CLIENTE, cerca de donde cargas los trabajos o manejas la sesión.

const checkCompletedJobState = async () => {
    // 1. Identificar el trabajo que está en curso (si lo hay)
    const activeJobId = serviceInCourseJob?.service_request_id; // O como obtengas el ID del servicio activo
    if (!activeJobId) return;

    // 2. Consultar la tabla 'service' directamente
    const { data: serviceData, error } = await supabase
        .from('service')
        .select('state, finish_photo')
        .eq('service_request_id', activeJobId)
        .maybeSingle();

    if (error) {
        console.error("Error al verificar estado:", error);
        return;
    }

    // 3. Si el estado ya es 'F', actualizar los estados locales del Cliente
    if (serviceData?.state === 'F' && serviceData?.finish_photo) {
        // Esto imita la acción del Realtime
        setServiceStage('F');
        setWorkerFinishPhotoUri(serviceData.finish_photo);
        
        // El 'useEffect' de apertura de modal se disparará con estos estados
    }
};

useEffect(() => {
    if (user?.id && personId) { // Asegúrate de tener el ID del cliente (personId)
        fetchServiceInCourse();
    }
}, [user?.id, personId]); // Depende del ID de autenticación y el ID de persona

// En la Vista del Cliente (donde se encuentran tus useStates y useEffects)

// Función para verificar el estado finalizado al iniciar o recargar datos
// En la Vista del Cliente/Dashboard Principal


// useEffect que llama a la función de Catch-up cuando se carga el trabajo en curso
useEffect(() => {
    // Si el trabajo activo (que creaste) se carga, verifica su estado actual.
    // ✅ USAMOS EL serviceRequestId del objeto de estado para la consulta
    if (serviceInCourseJob?.serviceRequestId) { 
        checkJobStatusOnLoad(serviceInCourseJob.serviceRequestId);
    }
// Agrega serviceInCourseJob?.serviceRequestId como dependencia
// eslint-disable-next-line react-hooks/exhaustive-deps 
}, [serviceInCourseJob?.serviceRequestId]);

// ...

// Asegúrate de llamar a esta función cuando el trabajo en curso se carga o cambia.
useEffect(() => {
    // Si tienes un trabajo en curso cargado, verifica su estado actual
    if (serviceInCourseJob?.id) {
        checkJobStatusOnLoad(serviceInCourseJob.id);
    }
// Agrega serviceInCourseJob.id como dependencia para que se dispare cuando la sesión cambie y se cargue el trabajo activo
// eslint-disable-next-line react-hooks/exhaustive-deps 
}, [serviceInCourseJob?.id]);

  const fetchMyJobs = async () => {
    try {
      const { data: personData, error: personError } = await supabase
        .from('person')
        .select('id')
        .eq('user_id', user?.id);

      if (personError || !personData) {
        console.warn('Error fetching person data:', personError);
        return;
      }

      setPersonId(personData[0]?.id || null);

      const { data, error } = await supabase
        .from('service_request')
        .select('id, name, description, proposed_price, photos, latitude, longitude, person_id')
        .eq('person_id', personData[0]?.id || null);

      if (error) {
        console.warn('Error fetching my jobs:', error.message || error);
        return;
      }

      const myJobsRecived = (data || []).map((r: any) => ({
        id: r.id,
        name: r.name || 'Trabajo',
        description: r.description || '',
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        photos: Array.isArray(r.photos) ? r.photos[0] : r.photos || null,
        pay: r.proposed_price != null ? `$${r.proposed_price} MXN` : undefined,
      }));

      setMyJobs(myJobsRecived || []);
    } catch (err) {
      console.error('fetchMyJobs error', err);
    }
  };

  useEffect(() => {
    fetchJobMarkers();
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchMyJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (myJobs && myJobs.length > 0) {
      fetchServiceInCourse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myJobs]);

// En la Vista del Cliente (donde se encuentran tus useStates y useEffects)
// ...

// En el Componente de la Vista del Cliente (Reemplaza el useEffect anterior)

useEffect(() => {
    if (!serviceInCourseJob?.id) return; 
    
    const serviceRequestId = serviceInCourseJob.id; 

    const channel = supabase
        .channel(`service_updates_${serviceRequestId}`)
        .on(
            'postgres_changes', 
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'service', 
                filter: `service_request_id=eq.${serviceRequestId}` 
            }, 
            (payload) => {
                try {
                    const newRow = payload.new as { state: string, finish_photo: string | null };
                    
                    // --- TRABAJADOR FINALIZA (Estado 'F'): Notificación Instantánea ---
                    if (newRow.state === 'F' && newRow.finish_photo) {
                        console.log('CLIENTE: 🔔 Realtime detectó FINALIZACIÓN. Abriendo modal.');
                        
                        // 1. Establecer estados
                        setServiceStage('F');
                        setWorkerFinishPhotoUri(newRow.finish_photo);
                        
                        // 2. ✅ ABRIR EL MODAL INMEDIATAMENTE
                        setCloseoutVisible(true); 
                    }
                    
                } catch (e) {
                    console.warn('Realtime handler error:', e);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
    
// Se ejecuta cuando el ID del trabajo en curso cambia.
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [serviceInCourseJob?.id]);

// ...
// ----------------------------------------------------------------------------------
// ✅ ELIMINAR EL USEEFFECT ANTERIOR CON LA LÓGICA DE 'myJobs' y ESTADO 'P'
// ----------------------------------------------------------------------------------
// El useEffect que comienza con: "useEffect(() => { if (!myJobs || myJobs.length === 0) return;" 
// DEBE ser eliminado o reemplazado por la lógica de arriba, ya que mezclaba los roles
// (Cliente reaccionando al pago 'P', que es una acción propia).

  const displayName = useMemo(() => {
    return (
      user?.user_metadata?.nombre ||
      user?.user_metadata?.full_name ||
      user?.email ||
      'Usuario'
    );
  }, [user]);

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  const onSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e: any) {
      console.log('signOut error:', e?.message);
    }
  };

// Lado del Trabajador
// Asegúrate de importar 'supabase' y de que 'expo-file-system' y 'fetch' estén disponibles.

const uploadPhotoToSupabase = async (fileUri: string, path: string): Promise<string | null> => {
    const BUCKET_NAME = 'service-photos'; 
    console.log(`DIAGNÓSTICO STORAGE: Intentando subir URI: ${fileUri} a ruta: ${path}`);
    
    try {
        // 1. Convertir la URI local a un ArrayBuffer o Blob
        //    (fetch(uri).then(res => res.blob()) es la forma estándar, pero a veces falla con ciertas URIs locales)
        
        const response = await fetch(fileUri);
        
        if (!response.ok) {
            console.error(`Error de FETCH: No se pudo obtener el archivo de la URI local. Estado: ${response.status}`);
            return null;
        }

        const blob = await response.blob();
        
        // 2. Subir el Blob a Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(path, blob, {
                cacheControl: '3600',
                upsert: true,
            });

        if (uploadError) {
            console.error('Error al subir la foto a Storage (uploadError):', uploadError);
            return null;
        }

        // 3. Obtener la URL pública del archivo
        const { data } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(path);

        if (data?.publicUrl) {
            console.log(`DIAGNÓSTICO STORAGE: ✅ Subida y URL exitosa: ${data.publicUrl}`);
            return data.publicUrl;
        }

        console.error('Error al obtener la URL pública de la foto (getPublicUrl falló).');
        return null;

    } catch (e) {
        console.error('Error general en uploadPhotoToSupabase (Catch):', e);
        return null;
    }
};



const handleWorkerFinishJob = async (currentServiceRequestId: number, photoLocalUri: string) => {
    
    // Verificación de parámetros críticos
    if (!photoLocalUri || !currentServiceRequestId) {
         console.error("Faltan parámetros críticos (ID de servicio o URI de la foto local).");
         Alert.alert("Error", "Faltan datos para finalizar el trabajo.");
         return;
    }

    // --- 1. Subir la foto al Storage y obtener la URL pública ---
    // Creamos un path único para el Storage
    const path = `services/${currentServiceRequestId}/finish_${new Date().getTime()}.jpg`;
    
    // Llamada a la función de subida que devuelve la URL pública
    const photoPublicUrl = await uploadPhotoToSupabase(photoLocalUri, path); 

    if (!photoPublicUrl) {
        Alert.alert("Error de Subida", "No se pudo subir la foto de finalización. Inténtalo de nuevo.");
        return;
    }
    
    console.log(`TRABAJADOR: Foto subida exitosamente. URL: ${photoPublicUrl}`);

    try {
        // === PASO 2: ACTUALIZAR/INSERTAR EL TICKET CON LA EVIDENCIA ===
        // Usamos upsert para asegurar que la fila exista o se cree si el trabajador la inserta primero.
        const { error: ticketError } = await supabase
            .from('ticket')
            .upsert({ 
                service_request_id: currentServiceRequestId,
                success_photo: photoPublicUrl, // ✅ GUARDA LA URL AQUÍ
                payment_confirmed: false       // El cliente aún no ha pagado
            }, { 
                onConflict: 'service_request_id' 
            })
            .select(); // Forzamos el select para mejor manejo de errores.

        if (ticketError) {
             console.error('ERROR TRABAJADOR: No se pudo guardar la URL de la foto en TICKET.', ticketError);
             Alert.alert('Error', 'La foto se subió, pero no se pudo finalizar el servicio. Contacta soporte.');
             return;
        }

        // === PASO 3: ACTUALIZAR EL SERVICIO A 'F' (Finalizado/Esperando Pago) ===
        // Esto dispara el 'catch-up' en el lado del cliente.
        const { error: serviceError } = await supabase
            .from('service')
            .update({ state: 'F' })
            .eq('service_request_id', currentServiceRequestId)
            .select();
            
        if (serviceError) {
             console.error('ERROR TRABAJADOR: No se pudo cambiar el estado a F.', serviceError);
             Alert.alert('Error', 'Fallo en la BD al cambiar el estado.');
             return;
        }

        Alert.alert("¡Trabajo Finalizado!", "El cliente ha sido notificado para el pago.");
        // Aquí deberías añadir la lógica para limpiar la UI del trabajador (ej: setWorkerJob(null))

    } catch (e) {
        console.error("Error general en la finalización del trabajador:", e);
        Alert.alert("Error", "Ocurrió un error inesperado al finalizar el proceso.");
    }
};
  // En la Vista del Cliente (donde están tus useStates y useEffects)

const checkTicketStatusOnLoad = async (serviceRequestId: number | null) => {
    if (!serviceRequestId) {
        console.log('CLIENTE: No hay Service Request ID para verificar ticket.');
        return;
    }

    try {
        const { data: ticketData, error } = await supabase
            .from('ticket')
            .select('success_photo, payment_confirmed')
            .eq('service_request_id', serviceRequestId)
            .maybeSingle();

        if (error) {
            console.error('CLIENTE: Error consultando ticket:', error);
            return;
        }

        // ⭐ CORRECCIÓN 1: Asegurar que la URL se guarde si existe, sea cual sea el estado de pago.
        if (ticketData?.success_photo) {
            console.log(`CLIENTE: Foto de evidencia encontrada: ${ticketData.success_photo}`);
            setWorkerFinishPhotoUri(ticketData.success_photo); // ✅ Guardar la URL de la foto aquí
        }

        // ⭐ CORRECCIÓN 2: Abrir el modal solo si el pago está pendiente y la foto existe.
        if (ticketData?.success_photo && ticketData.payment_confirmed === false) {
            
            console.log('CLIENTE: Catch-up detectó ticket pendiente de pago. Abriendo modal.');
            
            setServiceStage('T'); // Estado Transitorio
            // setWorkerFinishPhotoUri(ticketData.success_photo); // Esto ya se hizo arriba
            
            setCloseoutVisible(true);
            
        } else {
            console.log('CLIENTE: No hay ticket pendiente de pago o ya fue completado.');
        }

    } catch (e) {
        console.error("CLIENTE: Error general en el Catch-up de ticket:", e);
    }
};

// En la Vista del Cliente (sustituye tu useEffect anterior para el catch-up)
useEffect(() => {
    // Si el objeto del trabajo en curso está disponible
    if (serviceInCourseJob?.id) {
        checkTicketStatusOnLoad(serviceInCourseJob.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [serviceInCourseJob?.id]); // Se ejecuta al cargar o cambiar el job ID

  // Traer foto de perfil desde tabla person.profile_pic
  useEffect(() => {
    let isActive = true;

    async function fetchProfilePic() {
      if (!user?.id) return;
      try {
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
    return () => {
      isActive = false;
    };
  }, [user?.id]);

  // Ventana de 5 min para cancelar búsqueda
  useEffect(() => {
    if (helpSearchingVisible) {
      setHelpCancelEnabled(true);
      const timeout = setTimeout(() => {
        setHelpCancelEnabled(false);
      }, 5 * 60 * 1000);
      return () => clearTimeout(timeout);
    }
  }, [helpSearchingVisible]);

useEffect(() => {
    if (myJobs && myJobs.length > 0) {
        fetchServiceInCourse(); // ✅ Aquí está la llamada
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [myJobs]);

  // Auto cierre del modal de match a los 7s
  useEffect(() => {
    if (helpMatchVisible) {
      const timeout = setTimeout(() => {
        setHelpMatchVisible(false);
      }, 7000);
      return () => clearTimeout(timeout);
    }
  }, [helpMatchVisible]);

  // ✅ Helper: cerrar TODO antes de abrir modal final (para “liberar el contrato” en UI)
  const closeAllModals = () => {
    Keyboard.dismiss();
    setSidebarOpen(false);
    setHelpModalVisible(false);
    setHelpSearchingVisible(false);
    setHelpMatchVisible(false);
    setJobDetailVisible(false);
    setServiceDetailVisible(false);
  };

  // ✅ Trigger: cuando “el trabajador finaliza + sube foto”
  // (Tus compas lo conectan a realtime / polling / query del servicio)
  // ✅ Trigger: cuando “el trabajador finaliza + sube foto”
// En la Vista del Cliente (donde están definidos closeoutVisible, setCloseoutVisible, serviceStage, etc.)

useEffect(() => {
    if (!serviceInCourseJob) return;

    // Condición: El estado local indica que hay un Ticket Pendiente de Pago ('T') 
    // Y la URL de la foto del trabajador ya fue cargada.
    const shouldOpenCloseout = serviceStage === 'T' && !!workerFinishPhotoUri; 

    if (shouldOpenCloseout) {
        // Opcional: Asegurarse de que no haya otros modales abiertos
        // closeAllModals(); 
        
        // ESTA ES LA ACCIÓN CLAVE: Abrir el modal de calificación y pago
        setCloseoutVisible(true); 
    }
    
    // Las dependencias deben ser los estados que cambian al detectar el ticket
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [serviceStage, workerFinishPhotoUri, serviceInCourseJob?.id]);

  /* ===== HELP! handlers ===== */

  const openHelpModal = () => {
    Keyboard.dismiss();
    setHelpModalVisible(true);
  };

  const handlePickHelpImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos permiso para acceder a tus fotos.');
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

      const { data: personData, error: personError } = await supabase
        .from('person')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (personError || !personData) {
        Alert.alert('Error', 'No se encontró tu perfil. Intenta reiniciar la app.');
        return;
      }

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

      // Generación de embedding
      const textoParaVectorizar = helpDescription.trim();

      const { data: embeddingData, error: iaError } =
        await supabase.functions.invoke('generate_embedding', {
          body: { text: textoParaVectorizar },
        });

      if (iaError) throw iaError;
      const embeddingVector = embeddingData.embedding;

      // ubicación actual (opcional)
      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
        }
      } catch (locErr) {
        console.warn('Error obteniendo ubicación:', locErr);
      }

      // subir imagen a storage (si hay)
      let photosUrls: string | string[] | null = null;
      if (helpImageUri) {
        try {
          const uri = helpImageUri;
          const response = await fetch(uri);
          const blob = await response.blob();

          const extMatch = uri.match(/\.([a-zA-Z0-9]+)(?:$|\?)/);
          const ext = extMatch ? extMatch[1] : 'jpg';
          const filename = `job_photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const bucket = 'job-photos';

          const { error: uploadError } = await supabase.storage.from(bucket).upload(filename, blob, {
            contentType: blob.type || `image/${ext}`,
            cacheControl: '3600',
            upsert: false,
          });

          if (uploadError) {
            console.warn('Error subiendo imagen a Storage:', uploadError.message || uploadError);
          } else {
            const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filename);
            if (publicData?.publicUrl) {
              photosUrls = [publicData.publicUrl];
            }
          }
        } catch (imgErr) {
          console.warn('Error procesando o subiendo la imagen:', imgErr);
        }
      }

      const serviceData = {
        name: helpTitle.trim(),
        description: helpDescription,
        proposed_price: paymentNumber,
        photos: photosUrls ?? helpImageUri,
        latitude,
        longitude,
        datetime: new Date().toISOString(),
        person_id: personData.id,
        embedding: embeddingVector,
      };

      const { error } = await supabase
        .from('service_request')
        .insert([serviceData])
        .select();

      if (error) throw error;

      await fetchJobMarkers();

      setHelpModalVisible(false);
      setHelpDescription('');
      setHelpAddress('');
      setHelpPayment('');
      setHelpImageUri(null);
      setHelpTitle('');

      Alert.alert('¡Éxito!', 'Tu trabajito ha sido publicado');
    } catch (error) {
      console.error('Error al crear trabajito:', error);
      Alert.alert('Error', 'No se pudo publicar tu trabajito');
    }
  };

  const handleCancelSearch = () => {
    if (!helpCancelEnabled) return;
    setHelpSearchingVisible(false);
  };

  const handleChooseJob = () => {
    console.log('Trabajo elegido desde mapa:', selectedJob);
    setJobDetailVisible(false);
  };

  // ✅ UI only: simular que el trabajador ya finalizó y subió foto
  // (Esto desaparece en prod porque __DEV__ = false)
  const mockReceiveWorkerFinish = () => {
    if (!serviceInCourseJob) return;
    setServiceStage('F');
    // usa la foto del job como “evidencia” si existe, si no, null (para que veas el caso)
    setWorkerFinishPhotoUri(serviceInCourseJob.photo ?? null);

    // demo: setear worker info “realista”
    setWorkerInfo({
      name: 'Kevin Worker',
      avatarUrl: null,
    });
  };

  const openCloseoutFromBanner = () => {
    if (serviceStage === 'F' && workerFinishPhotoUri) {
      closeAllModals();
      setCloseoutVisible(true);
      return;
    }
    setServiceDetailVisible(true);
  };

const handleProcessPayment = async () => {
    // 1. Obtener el ID del servicio y la URL de la foto del estado
    const serviceRequestId = serviceInCourseJob?.serviceRequestId;
    // ✅ CRÍTICO: Acceder a la URL de la foto guardada por checkTicketStatusOnLoad
    const photoUrlToSave = workerFinishPhotoUri; 
    
    if (!serviceRequestId) return;
    
    // Asumiendo que 'rating' y 'reviewText' son estados accesibles aquí.
    if (rating <= 0) { 
        Alert.alert('Calificación Requerida', 'Por favor, califica el servicio antes de continuar.'); 
        return; 
    } 

    console.log(`PAGO: Iniciando proceso para service ID: ${serviceRequestId}`);
    console.log(`DIAGNÓSTICO PHOTO: URL de la foto del trabajador: ${photoUrlToSave}`); // VERIFICAR ESTE LOG

    try {
        // === PASO 1: ACTUALIZAR/INSERTAR TICKET (Guardar Calificación, Reseña, y FOTO) ===
        const { error: ticketError } = await supabase
            .from('ticket')
            .upsert({ 
                service_request_id: serviceRequestId,
                rate: rating, 
                review_text: reviewText, 
                success_photo: photoUrlToSave, // ✅ CORRECCIÓN: Usamos la URL del estado
                payment_confirmed: true 
            }, {
                onConflict: 'service_request_id' 
            })
            .select(); 

        if (ticketError) {
            console.error('❌ Error al actualizar TICKET con reseña:', ticketError);
            Alert.alert('Error', 'El pago fue exitoso, pero no se pudo guardar tu reseña o foto.');
        }


        // === PASO 2: ACTUALIZAR SERVICIO A 'P' (Pagado) ===
        // Esto funciona porque ya corregiste la restricción CHECK.
        const { data, error: serviceError } = await supabase
            .from('service')
            .update({ state: 'P' })
            .eq('service_request_id', serviceRequestId)
            .select(); 

        if (serviceError) {
            console.error('❌ Error al actualizar SERVICE a P:', serviceError);
            Alert.alert('Error', 'Fallo al finalizar el servicio en la BD.');
            return;
        }
        
        // ... (Lógica de limpieza de estados y UI si es exitosa) ...
        setServiceStage('P'); 
        setCloseoutVisible(false); 
        setServiceInCourseJob(null); 
        Alert.alert('¡Transacción Exitosa!', 'Tu pago, reseña y foto han sido guardados.');

    } catch (e) {
        console.error('Error general:', e);
    }
};

  const renderRatingStars = (value: number) => {
    return (
      <View style={styles.ratingStarsRow}>
        {Array.from({ length: 5 }).map((_, idx) => {
          const starValue = idx + 1;
          const filled = starValue <= value;
          return (
            <TouchableOpacity
              key={starValue}
              onPress={() => setRating(starValue)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.starTap}
              activeOpacity={0.8}
            >
              <Ionicons
                name={filled ? 'star' : 'star-outline'}
                size={22}
                color="#0A3251"
              />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const handlePayUIOnly = async () => {
    setRatingTried(true);
    if (rating <= 0) return;

    // 1. Obtener la ID del servicio
    const serviceRequestId = serviceInCourseJob?.id;
    if (!serviceRequestId) return;

    // Simulación de pago
    Alert.alert('Pago simulado', 'Se pagó con la tarjeta predeterminada ✅');
    
    try {
        // 2. ACTUALIZAR/INSERTAR EL TICKET con la Calificación y Pago
        const { error: ticketError } = await supabase
            .from('ticket')
            .upsert({ 
                service_request_id: serviceRequestId,
                rate: rating,           // <-- Sube la calificación (rate)
                
                payment_confirmed: true, // <-- Confirma el pago
            }, { 
                onConflict: 'service_request_id' 
            });

        if (ticketError) {
            console.error('Error al actualizar ticket:', ticketError);
            Alert.alert('Error', 'No se pudo registrar la calificación y el pago.');
            return;
        }
        
        // 3. ACTUALIZAR EL ESTADO DEL SERVICIO a 'P' (Pagado/Completado)
        // Esto sirve como el evento que el trabajador detectará.
        const { error: serviceError } = await supabase
            .from('service')
            .update({ state: 'P' }) // P = Pagado/Completado (lo que desbloquea al trabajador)
            .eq('service_request_id', serviceRequestId);

        if (serviceError) {
             console.error('Error al actualizar servicio a P:', serviceError);
        }
        
        // 4. Lógica de UI del Cliente (Limpiar estados)
        setCloseoutVisible(false);
        closeAllModals();
        // ... limpiar otros estados de la UI del cliente si es necesario
        
    } catch (e) {
        console.error('Error general en el pago:', e);
        Alert.alert('Error', 'Ocurrió un error inesperado al finalizar el proceso.');
    }
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
      <MapViewComponent
        jobMarkers={jobMarkers}
        onMarkerPress={(m) => {
          try {
            const job = {
              id: m.id,
              title: m.title,
              description: m.description,
              address:
                m.latitude && m.longitude
                  ? `${m.latitude.toFixed(4)}°, ${m.longitude.toFixed(4)}°`
                  : 'Ubicación no especificada',
              pay: m.pay,
              photo: m.photo ?? null,
              type: 'Trabajo temporal',
            };
            setSelectedJob(job);
            setJobDetailVisible(true);
          } catch (err) {
            console.warn('Error al manejar onMarkerPress en HomeScreen:', err);
          }
        }}
      />

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

          <Text style={styles.displayName} numberOfLines={1}>
            {displayName}
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={openHelpModal}>
              <Ionicons name="alert-circle" size={18} color="#fff" />
              <Text style={[styles.btnText, styles.btnTextPrimary]}>Help!</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => navigation.navigate('Jobs')}
            >
              <Ionicons name="briefcase" size={18} color="#0A3251" />
              <Text style={[styles.btnText, styles.btnTextSecondary]}>Trabajemos!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>


      {/* BANNER: Servicio en curso (creador) */}
      {serviceInCourseJob && serviceStage !== 'P' &&(
        <View style={styles.ownerServiceContainer}>
          <TouchableOpacity
            style={[
              styles.ownerServiceBanner,
              serviceStage === 'F' && styles.ownerServiceBannerDone,
            ]}
            activeOpacity={0.9}
            onPress={openCloseoutFromBanner}
          >
            <View style={styles.ownerServiceLeft}>
              <View
                style={[
                  styles.ownerServiceBadge,
                  serviceStage === 'F' && styles.ownerServiceBadgeDone,
                ]}
              >
                <Ionicons
                  name={serviceStage === 'F' ? 'checkmark-circle-outline' : 'time-outline'}
                  size={16}
                  color="#0A3251"
                />
                <Text style={styles.ownerServiceBadgeText}>
                  {serviceStage === 'F' ? 'Servicio finalizado' : 'Servicio en curso'}
                </Text>
              </View>
              <Text style={styles.ownerServiceTitle} numberOfLines={1}>
                {serviceInCourseJob.title || 'Tu trabajito está en curso'}
              </Text>
              <Text style={styles.ownerServiceMeta} numberOfLines={1}>
                {serviceInCourseJob.pay || ''}
                {serviceInCourseJob.pay && serviceInCourseJob.address ? ' • ' : ''}
                {serviceInCourseJob.address || ''}
              </Text>
            </View>
            <Ionicons name="chevron-up" size={20} color="#0A3251" />
          </TouchableOpacity>
        </View>
      )}

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
          <Pressable
            style={styles.backdrop}
            onPress={() => {
              Keyboard.dismiss();
              setHelpModalVisible(false);
            }}
          />

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
                    style={[styles.btn, styles.btnSecondary, { justifyContent: 'flex-start' }]}
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

              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, styles.helpSubmitButton]}
                onPress={handleSubmitHelp}
              >
                <Ionicons name="cloud-upload" size={18} color="#fff" />
                <Text style={[styles.btnText, styles.btnTextPrimary]}>Subir trabajito</Text>
              </TouchableOpacity>
            </ScrollView>
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
              <Text style={styles.helpSearchingTitle}>Buscando a personas interesadas</Text>
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

      {/* MODAL: Detalle del empleo (mapa) */}
      <Modal
        visible={jobDetailVisible && !!selectedJob}
        transparent
        animationType="slide"
        onRequestClose={() => setJobDetailVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setJobDetailVisible(false)} />
        <View style={styles.jobDetailContainer}>
          <View style={styles.jobDetailCard}>
            {selectedJob && (
              <>
                <Text style={styles.jobDetailTitle}>{selectedJob.title}</Text>
                <Text style={styles.jobDetailType}>{selectedJob.type}</Text>

                <View style={styles.jobDetailRow}>
                  <Text style={styles.jobDetailLabel}>Pago:</Text>
                  <Text style={styles.jobDetailValue}>{selectedJob.pay}</Text>
                </View>

                <View style={styles.jobDetailRow}>
                  <Text style={styles.jobDetailLabel}>Ubicación:</Text>
                  <Text style={styles.jobDetailValue}>{selectedJob.address}</Text>
                </View>

                <Text style={styles.jobDetailSectionTitle}>Descripción</Text>
                <Text style={styles.jobDetailDescription}>{selectedJob.description}</Text>

                {selectedJob.photo ? (
                  <Image source={{ uri: selectedJob.photo }} style={styles.jobDetailImage} />
                ) : null}

                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
                  onPress={handleChooseJob}
                >
                  <Text style={[styles.btnText, styles.btnTextPrimary]}>Elegir este trabajo</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MINI MODAL: Detalle de servicio en curso (creador) */}
      <Modal
        visible={serviceDetailVisible && !!serviceInCourseJob}
        transparent
        animationType="slide"
        onRequestClose={() => setServiceDetailVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setServiceDetailVisible(false)} />
        <View style={styles.ownerServiceModalContainer}>
          <View style={styles.ownerServiceCard}>
            {serviceInCourseJob && (
              <>
                <View style={styles.ownerServiceHeaderRow}>
                  <View style={styles.ownerServiceBadgeRow}>
                    <Ionicons
                      name={serviceStage === 'F' ? 'checkmark-circle-outline' : 'time-outline'}
                      size={18}
                      color="#0A3251"
                    />
                    <Text style={styles.ownerServiceStatusText}>
                      {serviceStage === 'F' ? 'Servicio finalizado' : 'Servicio en curso'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.ownerServiceTitleModal} numberOfLines={2}>
                  {serviceInCourseJob.title || 'Tu trabajito'}
                </Text>

                <View style={styles.ownerServiceRow}>
                  <Ionicons name="cash-outline" size={16} color="#6B7A8C" />
                  <Text style={styles.ownerServiceRowText}>
                    {serviceInCourseJob.pay || 'Pago no especificado'}
                  </Text>
                </View>

                <View style={styles.ownerServiceRow}>
                  <Ionicons name="location-outline" size={16} color="#6B7A8C" />
                  <Text style={styles.ownerServiceRowText} numberOfLines={2}>
                    {serviceInCourseJob.address || 'Ubicación no especificada'}
                  </Text>
                </View>

                {serviceInCourseJob.description ? (
                  <Text style={styles.ownerServiceDescription} numberOfLines={4}>
                    {serviceInCourseJob.description}
                  </Text>
                ) : null}

                {/* ✅ Si ya finalizó, mostrar evidencia */}
                {serviceStage === 'F' && workerFinishPhotoUri ? (
                  <>
                    <Text style={styles.sectionTitle}>Evidencia del trabajador</Text>
                    <Image source={{ uri: workerFinishPhotoUri }} style={styles.evidenceImg} />
                    <TouchableOpacity
                      style={[styles.btn, styles.btnPrimary, { marginTop: 10 }]}
                      onPress={() => {
                        closeAllModals();
                        setCloseoutVisible(true);
                      }}
                    >
                      <Text style={[styles.btnText, styles.btnTextPrimary]}>
                        Calificar y pagar
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.ownerServiceHint}>
                    Esperando que el trabajador finalice y suba la evidencia…
                  </Text>
                )}

                {/* DEV ONLY: simular entrega */}
                {__DEV__ && serviceStage !== 'F' && (
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSecondary, { marginTop: 10 }]}
                    onPress={mockReceiveWorkerFinish}
                  >
                    <Ionicons name="bug-outline" size={18} color="#0A3251" />
                    <Text style={[styles.btnText, styles.btnTextSecondary]}>
                      Simular entrega (DEV)
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { marginTop: 10 }]}
                  onPress={() => setServiceDetailVisible(false)}
                >
                  <Text style={[styles.btnText, styles.btnTextPrimary]}>Cerrar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Felicidades hubo match */}
      <Modal
        visible={helpMatchVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpMatchVisible(false)}
      >
        <View style={styles.helpMatchContainer}>
          <View style={styles.helpMatchCard}>
            <View style={styles.helpMatchIconCircle}>
              <Ionicons name="sparkles-outline" size={26} color="#0A3251" />
            </View>
            <Text style={styles.helpMatchTitle}>¡Felicidades, hubo match!</Text>
            <Text style={styles.helpMatchSubtitle}>
              Alguien aceptó tu trabajito. Pronto podrás coordinar los detalles del servicio.
            </Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { marginTop: 10 }]}
              onPress={() => setHelpMatchVisible(false)}
            >
              <Text style={[styles.btnText, styles.btnTextPrimary]}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ✅ MODAL FINAL: Calificar trabajador + Pagar (simulado) */}
      <Modal
        visible={closeoutVisible && !!serviceInCourseJob}
        transparent
        animationType="fade"
        onRequestClose={() => setCloseoutVisible(false)}
      >
        <View style={styles.overlayCenter}>
          <View style={styles.closeoutCard}>
            <View style={styles.closeoutTop}>
              <View style={styles.closeoutIconCircle}>
                <Ionicons name="receipt-outline" size={24} color="#0A3251" />
              </View>
              <Text style={styles.closeoutTitle}>Cierre del servicio</Text>
              <Text style={styles.closeoutSub}>
                El trabajador marcó como finalizado. Califica y paga para liberar el contrato.
              </Text>
            </View>

            <View style={styles.closeoutBox}>
              <Text style={styles.closeoutJobTitle} numberOfLines={1}>
                {serviceInCourseJob?.title || 'Trabajito'}
              </Text>

              <View style={styles.closeoutRow}>
                <Ionicons name="cash-outline" size={16} color="#6B7A8C" />
                <Text style={styles.closeoutRowLabel}>Total:</Text>
                <Text style={styles.closeoutRowValue}>{serviceInCourseJob?.pay || '$—'}</Text>
              </View>

              {workerFinishPhotoUri ? (
                <View style={styles.closeoutEvidenceRow}>
                  <Image source={{ uri: workerFinishPhotoUri }} style={styles.closeoutEvidenceImg} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.closeoutEvidenceTitle}>Evidencia</Text>
                    <Text style={styles.closeoutEvidenceSub}>Foto entregada por el trabajador</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color="#0A3251" />
                </View>
              ) : null}

              <View style={styles.workerCard}>
                <View style={styles.workerAvatar}>
                  {workerInfo.avatarUrl ? (
                    <Image source={{ uri: workerInfo.avatarUrl }} style={styles.workerAvatarImg} />
                  ) : (
                    <Ionicons name="person" size={18} color="#0A3251" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workerName}>{workerInfo.name}</Text>
                  <Text style={styles.workerHint}>Trabajador</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Califica al trabajador</Text>
              {renderRatingStars(rating)}
              {ratingTried && rating <= 0 ? (
                <Text style={styles.errorText}>La calificación es obligatoria para pagar.</Text>
              ) : null}

              <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Comentario (opcional)</Text>
              <TextInput
                style={styles.reviewInput}
                placeholder="Ej. Puntual, limpio, buena comunicación…"
                placeholderTextColor="#8FA1B3"
                value={reviewText}
                onChangeText={setReviewText}
                multiline
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { width: '100%', marginTop: 10 }]}
              onPress={handleProcessPayment}
            >
              <Ionicons name="card-outline" size={18} color="#fff" />
              <Text style={[styles.btnText, styles.btnTextPrimary]}>
                Pagar con la tarjeta predeterminada
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary, { width: '100%', marginTop: 8 }]}
              onPress={() => setCloseoutVisible(false)}
            >
              <Text style={[styles.btnText, styles.btnTextSecondary]}>Cerrar</Text>
            </TouchableOpacity>
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
    bottom: 100,
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
  btnTextPrimary: { color: '#fff', fontWeight: '700' },
  btnSecondary: {
    backgroundColor: '#F2F5F8',
    borderWidth: 1,
    borderColor: '#C7D1DF',
  },
  btnTextSecondary: { color: '#0A3251', fontWeight: '700' },
  btnText: { fontWeight: '700', fontSize: 14 },

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
    maxHeight: '85%',
  },
  helpModalScroll: {
    paddingBottom: 40,
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
    marginTop: 16,
    width: '100%',
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

  /* MODAL match */
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
    width: '100%',
    maxWidth: 360,
  },
  helpMatchIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3EFFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
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

  /* BANNER: Servicio en curso (creador) */
  ownerServiceContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    paddingHorizontal: 16,
  },
  ownerServiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E9EE',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ownerServiceBannerDone: {
    borderColor: '#C7D1DF',
    backgroundColor: '#F8FAFC',
  },
  ownerServiceLeft: {
    flex: 1,
    marginRight: 8,
  },
  ownerServiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#E3EFFC',
    gap: 4,
    marginBottom: 2,
  },
  ownerServiceBadgeDone: {
    backgroundColor: '#EAF6F0',
  },
  ownerServiceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0A3251',
  },
  ownerServiceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A3251',
  },
  ownerServiceMeta: {
    fontSize: 12,
    color: '#6B7A8C',
    marginTop: 2,
  },

  /* MINI MODAL: Detalle servicio en curso */
  ownerServiceModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  ownerServiceCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  ownerServiceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ownerServiceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerServiceStatusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A3251',
  },
  ownerServiceTitleModal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A3251',
    marginTop: 2,
  },
  ownerServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  ownerServiceRowText: {
    fontSize: 13,
    color: '#4A5A6C',
    flex: 1,
  },
  ownerServiceDescription: {
    fontSize: 13,
    color: '#4A5A6C',
    marginTop: 10,
  },
  ownerServiceHint: {
    marginTop: 10,
    fontSize: 12,
    color: '#6B7A8C',
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A3251',
    marginTop: 12,
    marginBottom: 6,
  },
  evidenceImg: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#E1E8F0',
  },

  /* Job detail modal styles */
  jobDetailContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  jobDetailCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  jobDetailTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0A3251',
  },
  jobDetailType: {
    fontSize: 13,
    color: '#6B7A8C',
    marginTop: 4,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  jobDetailLabel: {
    fontSize: 13,
    color: '#6B7A8C',
    marginRight: 8,
  },
  jobDetailValue: {
    fontSize: 13,
    color: '#0A3251',
    fontWeight: '700',
  },
  jobDetailSectionTitle: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#0A3251',
  },
  jobDetailDescription: {
    marginTop: 6,
    fontSize: 13,
    color: '#4A5A6C',
  },
  jobDetailImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: '#E1E8F0',
  },

  /* ✅ Modal final */
  overlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  closeoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  closeoutTop: {
    alignItems: 'center',
  },
  closeoutIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3EFFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  closeoutTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A3251',
    textAlign: 'center',
  },
  closeoutSub: {
    fontSize: 12,
    color: '#6B7A8C',
    textAlign: 'center',
    marginTop: 4,
  },
  closeoutBox: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6E9EE',
    backgroundColor: '#F8FAFC',
    padding: 12,
  },
  closeoutJobTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A3251',
    marginBottom: 6,
  },
  closeoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeoutRowLabel: {
    fontSize: 12,
    color: '#6B7A8C',
    fontWeight: '700',
  },
  closeoutRowValue: {
    marginLeft: 'auto',
    fontSize: 12,
    color: '#0A3251',
    fontWeight: '800',
  },
  closeoutEvidenceRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E9EE',
    padding: 10,
  },
  closeoutEvidenceImg: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#E1E8F0',
  },
  closeoutEvidenceTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A3251',
  },
  closeoutEvidenceSub: {
    fontSize: 11,
    color: '#6B7A8C',
    marginTop: 2,
  },

  workerCard: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E9EE',
    padding: 10,
  },
  workerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E3EFFC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  workerAvatarImg: {
    width: '100%',
    height: '100%',
  },
  workerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A3251',
  },
  workerHint: {
    fontSize: 11,
    color: '#6B7A8C',
    marginTop: 2,
  },

  ratingStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  starTap: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#E63946',
    fontWeight: '800',
  },

  reviewInput: {
    marginTop: 6,
    minHeight: 74,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D1DF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    fontSize: 13,
    color: '#0A3251',
  },
});
