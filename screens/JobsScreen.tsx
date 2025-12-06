import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { supabase } from '../lib/supabase';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Jobs'>;

type Job = {
  id: string;
  title: string;
  description: string;
  address: string;
  pay: string;
  type: string;
  postedAt: string;
  matchesProfile: boolean;
  latitude?: number;
  longitude?: number;
  photos?: string;
  datetime?: string;
  person_id?: number;
};

export default function JobsScreen() {
  const navigation = useNavigation<Nav>();
  const [user, setUser] = useState<any>(null);

  // Estados existentes
  const [showWelcome, setShowWelcome] = useState(true);
  const [showInterestsModal, setShowInterestsModal] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [interestsText, setInterestsText] = useState('');
  const [tempInterestsText, setTempInterestsText] = useState(''); // Temporal para el modal
  const [filterMatchesProfile, setFilterMatchesProfile] = useState(false);
  const [tempFilterMatchesProfile, setTempFilterMatchesProfile] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetailVisible, setJobDetailVisible] = useState(false);

  // Nuevos estados UI (solo estilos / front)
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [activeServiceJob, setActiveServiceJob] = useState<Job | null>(null);
  const [serviceDetailVisible, setServiceDetailVisible] = useState(false);

  // Cargar trabajos desde la base de datos
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobsFromDatabase();
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      console.log('SESSION', data.session?.user?.user_metadata);
    });
  }, []);

  // Sincronizar estados temporales cuando se abre el modal
  useEffect(() => {
    if (filtersVisible) {
      setTempInterestsText(interestsText);
      setTempFilterMatchesProfile(filterMatchesProfile);
    }
  }, [filtersVisible]);

  const loadJobsFromDatabase = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('service_request')
        .select(`
          id,
          name,
          description,
          proposed_price,
          photos,
          latitude,
          longitude,
          datetime,
          person_id
        `)
        .order('datetime', { ascending: false });

      if (error) {
        console.error('Error cargando trabajos:', error);
        setLoading(false);
        return;
      }

      const formattedJobs: Job[] = (data || []).map((job) => {
        const timeAgo = job.datetime
          ? calculateTimeAgo(new Date(job.datetime))
          : 'Reciente';

        return {
          id: job.id.toString(),
          title: job.name || 'Sin título',
          description: job.description || 'Sin descripción',
          address: formatAddress(job.latitude, job.longitude),
          pay: `$${job.proposed_price || 0} MXN`,
          type: 'Trabajo temporal',
          postedAt: timeAgo,
          matchesProfile: true,
          latitude: job.latitude,
          longitude: job.longitude,
          photos: job.photos,
          datetime: job.datetime,
          person_id: job.person_id,
        };
      });

      setJobs(formattedJobs);
    } catch (error) {
      console.error('Error al cargar trabajos:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (lat?: number, lng?: number): string => {
    if (!lat || !lng) return 'Ubicación no especificada';
    return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
  };

  const calculateTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Hace 1 día';
    return `Hace ${diffDays} días`;
  };

  // Filtrar trabajos
  const filteredJobs = jobs.filter((job) => {
    if (filterMatchesProfile && !job.matchesProfile) return false;

    if (interestsText.trim().length > 0) {
      const q = interestsText.toLowerCase();
      const blob = `${job.title} ${job.description} ${job.type}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }

    return true;
  });

  const openJobDetail = (job: Job) => {
    setSelectedJob(job);
    setJobDetailVisible(true);
  };

  const handleChooseJob = () => {
    console.log('Trabajo elegido:', selectedJob);
    // Aquí tus compas pueden:
    // - Confirmar el match
    // - Guardar el servicio en "en curso"
    // - Llamar a:
    //   setMatchModalVisible(true);
    //   setActiveServiceJob(selectedJob);
    setJobDetailVisible(false);
  };

  // Aplicar filtros desde el modal
  const applyFilters = () => {
    setInterestsText(tempInterestsText);
    setFilterMatchesProfile(tempFilterMatchesProfile);
    setFiltersVisible(false);
  };

  const clearFilters = () => {
    setTempInterestsText('');
    setTempFilterMatchesProfile(false);
    setInterestsText('');
    setFilterMatchesProfile(false);
    setFiltersVisible(false);
  };

  const handleInterestsSave = async () => {
    const textoParaVectorizar = interestsText.trim();

    console.log('1. Generando embedding...');
    const { data: embeddingData, error: iaError } =
      await supabase.functions.invoke('generate_embedding', {
        body: { text: textoParaVectorizar },
      });

    if (iaError) throw iaError;
    const embeddingVector = embeddingData.embedding;

    const updateData = {
      work_prof: interestsText.trim(),
      embedding: embeddingVector,
    };

    console.log('Datos a actualizar:', updateData);

    const { error } = await supabase
      .from('person')
      .update(updateData)
      .eq('user_id', user.id);

    if (error) {
      console.log('Error al actualizar información:', error);
      Alert.alert(
        'Error',
        'No se pudo guardar la información: ' + error.message
      );
      return;
    }

    setShowInterestsModal(false);
  };

  const activeFiltersCount =
    (interestsText.trim().length > 0 ? 1 : 0) +
    (filterMatchesProfile ? 1 : 0);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#0A3251" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trabajemos</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Barra superior: filtros */}
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>
          {loading
            ? 'Cargando...'
            : `${filteredJobs.length} de ${jobs.length} empleos`}
        </Text>
        <TouchableOpacity
          style={[
            styles.filterBtn,
            activeFiltersCount > 0 && styles.filterBtnActive,
          ]}
          onPress={() => setFiltersVisible(true)}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={activeFiltersCount > 0 ? '#FFFFFF' : '#0A3251'}
          />
          <Text
            style={[
              styles.filterBtnText,
              activeFiltersCount > 0 && styles.filterBtnTextActive,
            ]}
          >
            Filtros {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de trabajos */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0A3251" />
          <Text style={styles.loadingText}>Cargando trabajos...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 80 }}
        >
          {filteredJobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={40} color="#C7D1DF" />
              <Text style={styles.emptyTitle}>
                {jobs.length === 0
                  ? 'No hay empleos disponibles'
                  : 'No hay empleos con esos filtros'}
              </Text>
              <Text style={styles.emptyText}>
                {jobs.length === 0
                  ? 'Aún no hay trabajos publicados en tu área.'
                  : 'Ajusta tus intereses o filtros para ver más opciones.'}
              </Text>
            </View>
          ) : (
            filteredJobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={styles.jobCard}
                onPress={() => openJobDetail(job)}
              >
                <View style={styles.jobHeaderRow}>
                  <Text style={styles.jobTitle}>{job.title}</Text>
                  <View
                    style={[
                      styles.matchPill,
                      job.matchesProfile
                        ? styles.matchPillOn
                        : styles.matchPillOff,
                    ]}
                  >
                    <Ionicons
                      name={
                        job.matchesProfile
                          ? 'checkmark-circle'
                          : 'alert-circle'
                      }
                      size={14}
                      color={job.matchesProfile ? '#0A3251' : '#A1A9B5'}
                    />
                    <Text
                      style={[
                        styles.matchPillText,
                        !job.matchesProfile && styles.matchPillTextOff,
                      ]}
                    >
                      {job.matchesProfile
                        ? 'Se ajusta a tu perfil'
                        : 'Fuera de perfil'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.jobType}>{job.type}</Text>

                <View style={styles.jobInfoRow}>
                  <View style={styles.jobInfoCol}>
                    <Text style={styles.jobLabel}>Pago</Text>
                    <Text style={styles.jobPay}>{job.pay}</Text>
                  </View>
                  <View style={styles.jobInfoCol}>
                    <Text style={styles.jobLabel}>Ubicación</Text>
                    <Text style={styles.jobAddress}>{job.address}</Text>
                  </View>
                </View>

                <View style={styles.jobFooterRow}>
                  <Text style={styles.jobPostedAt}>{job.postedAt}</Text>
                  <View style={styles.jobActionRight}>
                    <Text style={styles.jobSeeMore}>Ver detalles</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#0A3251"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* BANNER: Servicio en curso (flotante) */}
      {activeServiceJob && (
        <View style={styles.activeServiceContainer}>
          <TouchableOpacity
            style={styles.activeServiceBanner}
            activeOpacity={0.9}
            onPress={() => setServiceDetailVisible(true)}
          >
            <View style={styles.activeServiceLeft}>
              <View style={styles.activeServiceBadge}>
                <Ionicons name="flash-outline" size={16} color="#0A3251" />
                <Text style={styles.activeServiceBadgeText}>
                  Servicio en curso
                </Text>
              </View>
              <Text style={styles.activeServiceTitle} numberOfLines={1}>
                {activeServiceJob.title}
              </Text>
              <Text style={styles.activeServiceMeta} numberOfLines={1}>
                {activeServiceJob.pay} • {activeServiceJob.address}
              </Text>
            </View>
            <Ionicons name="chevron-up" size={20} color="#0A3251" />
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL: Bienvenida (primera vez) */}
      <Modal
        visible={showWelcome}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWelcome(false)}
      >
        <View style={styles.overlayCenter}>
          <View style={styles.welcomeCard}>
            <Ionicons name="hand-right-outline" size={40} color="#0A3251" />
            <Text style={styles.welcomeTitle}>Bienvenido a Trabajemos</Text>
            <Text style={styles.welcomeText}>
              Aquí podrás encontrar trabajitos cerca de ti que se ajusten a tu
              perfil e intereses.
            </Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
              onPress={() => {
                setShowWelcome(false);
                setShowInterestsModal(true);
              }}
            >
              <Text style={[styles.btnText, styles.btnTextPrimary]}>
                Empezar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Intereses del trabajador (texto abierto) */}
      <Modal
        visible={showInterestsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInterestsModal(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setShowInterestsModal(false)}
        />
        <View style={styles.interestsModalContainer}>
          <View style={styles.interestsCard}>
            <Text style={styles.interestsTitle}>Tus intereses</Text>
            <Text style={styles.interestsSubtitle}>
              Cuéntanos en tus propias palabras en qué tipos de trabajos te
              interesa participar. Más adelante procesaremos este texto con IA.
            </Text>

            <TextInput
              style={styles.interestsInput}
              placeholder="Ej. Me interesa ayudar en mudanzas, pintura, limpieza de casas y trabajos sencillos de tecnología."
              placeholderTextColor="#8FA1B3"
              value={interestsText}
              onChangeText={setInterestsText}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { marginTop: 8 }]}
              onPress={handleInterestsSave}
            >
              <Text style={[styles.btnText, styles.btnTextPrimary]}>
                Guardar intereses
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Filtros */}
      <Modal
        visible={filtersVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFiltersVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setFiltersVisible(false)}
        />
        <View style={styles.filtersModalContainer}>
          <View style={styles.filtersCard}>
            <View style={styles.filtersTitleRow}>
              <Text style={styles.filtersTitle}>Filtros</Text>
              {(tempInterestsText.trim().length > 0 ||
                tempFilterMatchesProfile) && (
                <TouchableOpacity onPress={clearFilters}>
                  <Text style={styles.clearFiltersText}>Limpiar todo</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Intereses (texto abierto)</Text>
              <TextInput
                style={styles.interestsInput}
                placeholder="Ej. pintura, limpieza, tecnología..."
                placeholderTextColor="#8FA1B3"
                value={tempInterestsText}
                onChangeText={setTempInterestsText}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.filterHint}>
                Se buscarán empleos que contengan estas palabras en el título o
                descripción
              </Text>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Según tu perfil</Text>
              <View style={styles.profileFilterRow}>
                <Text style={styles.profileFilterText}>
                  Solo empleos que coincidan con tu perfil
                </Text>
                <TouchableOpacity
                  style={[
                    styles.profileToggle,
                    tempFilterMatchesProfile && styles.profileToggleOn,
                  ]}
                  onPress={() =>
                    setTempFilterMatchesProfile((prev) => !prev)
                  }
                >
                  <View
                    style={[
                      styles.profileToggleKnob,
                      tempFilterMatchesProfile &&
                        styles.profileToggleKnobOn,
                    ]}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.profileHint}>
                Este filtro usará tu perfil profesional más adelante (por ahora
                todos los trabajos se marcan como compatibles).
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={applyFilters}
            >
              <Text style={[styles.btnText, styles.btnTextPrimary]}>
                Aplicar filtros
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Detalle del empleo */}
      <Modal
        visible={jobDetailVisible && !!selectedJob}
        transparent
        animationType="slide"
        onRequestClose={() => setJobDetailVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setJobDetailVisible(false)}
        />
        <View style={styles.jobDetailContainer}>
          <View style={styles.jobDetailCard}>
            {selectedJob && (
              <>
                <Text style={styles.jobDetailTitle}>
                  {selectedJob.title}
                </Text>
                <Text style={styles.jobDetailType}>{selectedJob.type}</Text>

                <View style={styles.jobDetailRow}>
                  <Text style={styles.jobDetailLabel}>Pago:</Text>
                  <Text style={styles.jobDetailValue}>
                    {selectedJob.pay}
                  </Text>
                </View>

                <View style={styles.jobDetailRow}>
                  <Text style={styles.jobDetailLabel}>Ubicación:</Text>
                  <Text style={styles.jobDetailValue}>
                    {selectedJob.address}
                  </Text>
                </View>

                <Text style={styles.jobDetailSectionTitle}>
                  Descripción
                </Text>
                <Text style={styles.jobDetailDescription}>
                  {selectedJob.description}
                </Text>

                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
                  onPress={handleChooseJob}
                >
                  <Text style={[styles.btnText, styles.btnTextPrimary]}>
                    Elegir este trabajo
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MINI MODAL: Servicio en curso (detalle desde el banner) */}
      <Modal
        visible={serviceDetailVisible && !!activeServiceJob}
        transparent
        animationType="slide"
        onRequestClose={() => setServiceDetailVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setServiceDetailVisible(false)}
        />
        <View style={styles.miniServiceModalContainer}>
          <View style={styles.miniServiceCard}>
            {activeServiceJob && (
              <>
                <View style={styles.miniServiceHeaderRow}>
                  <View style={styles.miniServiceBadgeRow}>
                    <Ionicons
                      name="flash-outline"
                      size={18}
                      color="#0A3251"
                    />
                    <Text style={styles.miniServiceStatusText}>
                      Servicio en curso
                    </Text>
                  </View>
                  <Text style={styles.miniServiceTimeText}>
                    {activeServiceJob.postedAt}
                  </Text>
                </View>

                <Text style={styles.miniServiceTitle} numberOfLines={2}>
                  {activeServiceJob.title}
                </Text>

                <View style={styles.miniServiceRow}>
                  <Ionicons
                    name="cash-outline"
                    size={16}
                    color="#6B7A8C"
                  />
                  <Text style={styles.miniServiceRowText}>
                    {activeServiceJob.pay}
                  </Text>
                </View>

                <View style={styles.miniServiceRow}>
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color="#6B7A8C"
                  />
                  <Text
                    style={styles.miniServiceRowText}
                    numberOfLines={2}
                  >
                    {activeServiceJob.address}
                  </Text>
                </View>

                <Text
                  style={styles.miniServiceDescription}
                  numberOfLines={3}
                >
                  {activeServiceJob.description}
                </Text>

                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { marginTop: 10 }]}
                  onPress={() => setServiceDetailVisible(false)}
                >
                  <Text style={[styles.btnText, styles.btnTextPrimary]}>
                    Cerrar
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MINI MODAL: Felicidades hubo match */}
      <Modal
        visible={matchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMatchModalVisible(false)}
      >
        <View style={styles.overlayCenter}>
          <View style={styles.matchCard}>
            <View style={styles.matchIconCircle}>
              <Ionicons name="sparkles-outline" size={26} color="#0A3251" />
            </View>
            <Text style={styles.matchTitle}>¡Felicidades, hubo match!</Text>
            <Text style={styles.matchSubtitle}>
              Ya puedes coordinar los detalles del servicio con la otra
              persona.
            </Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { marginTop: 10 }]}
              onPress={() => setMatchModalVisible(false)}
            >
              <Text style={[styles.btnText, styles.btnTextPrimary]}>
                Entendido
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E9EE',
  },
  headerTitle: {
    color: '#0A3251',
    fontSize: 18,
    fontWeight: '700',
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarText: {
    flex: 1,
    marginRight: 8,
    fontSize: 13,
    color: '#6B7A8C',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#0A3251',
    gap: 6,
  },
  filterBtnActive: {
    backgroundColor: '#0A3251',
    borderColor: '#0A3251',
  },
  filterBtnText: {
    fontSize: 13,
    color: '#0A3251',
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#FFFFFF',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7A8C',
  },

  list: {
    flex: 1,
    paddingHorizontal: 16,
  },

  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  jobHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  jobTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0A3251',
  },
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
  },
  matchPillOn: {
    borderColor: '#0A3251',
    backgroundColor: '#E3EFFC',
  },
  matchPillOff: {
    borderColor: '#C7D1DF',
    backgroundColor: '#F4F6FA',
  },
  matchPillText: {
    fontSize: 10,
    color: '#0A3251',
    fontWeight: '600',
  },
  matchPillTextOff: {
    color: '#A1A9B5',
  },
  jobType: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7A8C',
  },

  jobInfoRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 16,
  },
  jobInfoCol: {
    flex: 1,
  },
  jobLabel: {
    fontSize: 11,
    color: '#9AA4B2',
  },
  jobPay: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A3251',
  },
  jobAddress: {
    fontSize: 12,
    color: '#4A5A6C',
  },

  jobFooterRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobPostedAt: {
    fontSize: 11,
    color: '#9AA4B2',
  },
  jobActionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobSeeMore: {
    fontSize: 13,
    color: '#0A3251',
    fontWeight: '600',
  },

  emptyState: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#0A3251',
  },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7A8C',
    textAlign: 'center',
  },

  /* Overlay centrado genérico */
  overlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  /* Welcome modal */
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  welcomeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0A3251',
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 13,
    color: '#6B7A8C',
    textAlign: 'center',
    marginTop: 4,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  /* Interests modal */
  interestsModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  interestsCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  interestsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A3251',
  },
  interestsSubtitle: {
    fontSize: 13,
    color: '#6B7A8C',
    marginTop: 4,
  },
  interestsInput: {
    marginTop: 10,
    minHeight: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D1DF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    fontSize: 13,
    color: '#0A3251',
  },

  /* Filters modal */
  filtersModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  filtersCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
    gap: 14,
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A3251',
  },
  filtersTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearFiltersText: {
    fontSize: 13,
    color: '#E63946',
    fontWeight: '600',
  },
  filterSection: {
    marginTop: 4,
    gap: 6,
  },
  filterLabel: {
    fontSize: 13,
    color: '#5A6B7C',
    fontWeight: '600',
  },
  filterHint: {
    fontSize: 11,
    color: '#9AA4B2',
    marginTop: 2,
  },
  profileFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileFilterText: {
    flex: 1,
    fontSize: 13,
    color: '#4A5A6C',
  },
  profileToggle: {
    width: 44,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C7D1DF',
    backgroundColor: '#F3F5F9',
    padding: 2,
    justifyContent: 'center',
  },
  profileToggleOn: {
    borderColor: '#0A3251',
    backgroundColor: '#0A3251',
  },
  profileToggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  profileToggleKnobOn: {
    alignSelf: 'flex-end',
  },
  profileHint: {
    fontSize: 11,
    color: '#9AA4B2',
    marginTop: 4,
  },

  /* Job detail modal */
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
    fontSize: 16,
    fontWeight: '700',
    color: '#0A3251',
  },
  jobDetailType: {
    fontSize: 13,
    color: '#6B7A8C',
    marginTop: 2,
  },
  jobDetailRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 6,
  },
  jobDetailLabel: {
    fontSize: 13,
    color: '#5A6B7C',
    fontWeight: '600',
  },
  jobDetailValue: {
    fontSize: 13,
    color: '#4A5A6C',
    flex: 1,
  },
  jobDetailSectionTitle: {
    fontSize: 13,
    color: '#5A6B7C',
    marginTop: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  jobDetailDescription: {
    fontSize: 13,
    color: '#4A5A6C',
  },

  /* Botones reutilizables */
  btn: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#0A3251',
  },
  btnTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  btnText: {
    fontSize: 14,
  },

  /* MINI MODAL: Match */
  matchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  matchIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3EFFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  matchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A3251',
    textAlign: 'center',
  },
  matchSubtitle: {
    fontSize: 13,
    color: '#6B7A8C',
    textAlign: 'center',
    marginTop: 4,
  },

  /* BANNER: Servicio en curso */
  activeServiceContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    paddingHorizontal: 16,
  },
  activeServiceBanner: {
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
  activeServiceLeft: {
    flex: 1,
    marginRight: 8,
  },
  activeServiceBadge: {
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
  activeServiceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0A3251',
  },
  activeServiceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A3251',
  },
  activeServiceMeta: {
    fontSize: 12,
    color: '#6B7A8C',
    marginTop: 2,
  },

  /* MINI MODAL: Detalle de servicio en curso */
  miniServiceModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  miniServiceCard: {
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
  miniServiceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  miniServiceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniServiceStatusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A3251',
  },
  miniServiceTimeText: {
    fontSize: 11,
    color: '#9AA4B2',
  },
  miniServiceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A3251',
    marginTop: 2,
  },
  miniServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  miniServiceRowText: {
    fontSize: 13,
    color: '#4A5A6C',
    flex: 1,
  },
  miniServiceDescription: {
    fontSize: 13,
    color: '#4A5A6C',
    marginTop: 10,
  },
});
