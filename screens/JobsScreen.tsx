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

  // Estados existentes
  const [showWelcome, setShowWelcome] = useState(false); // Cambiado a false para no molestar durante desarrollo
  const [showInterestsModal, setShowInterestsModal] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [interestsText, setInterestsText] = useState('');
  const [tempInterestsText, setTempInterestsText] = useState(''); // Temporal para el modal
  const [filterMatchesProfile, setFilterMatchesProfile] = useState(false); // Cambiado a false por defecto
  const [tempFilterMatchesProfile, setTempFilterMatchesProfile] = useState(false); // Temporal para el modal
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetailVisible, setJobDetailVisible] = useState(false);

  // Nuevos estados para la BD
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar trabajos desde la base de datos
  useEffect(() => {
    loadJobsFromDatabase();
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

      // Transformar los datos de la BD al formato Job
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
          matchesProfile: true, // Por ahora todos coinciden
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

  // Función auxiliar para formatear la dirección
  const formatAddress = (lat?: number, lng?: number): string => {
    if (!lat || !lng) return 'Ubicación no especificada';
    return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
  };

  // Función auxiliar para calcular "hace cuánto"
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
    setJobDetailVisible(false);
  };

  // Aplicar filtros desde el modal
  const applyFilters = () => {
    setInterestsText(tempInterestsText);
    setFilterMatchesProfile(tempFilterMatchesProfile);
    setFiltersVisible(false);
  };

  // Limpiar filtros
  const clearFilters = () => {
    setTempInterestsText('');
    setTempFilterMatchesProfile(false);
    setInterestsText('');
    setFilterMatchesProfile(false);
    setFiltersVisible(false);
  };

  // Contar filtros activos
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
          style={[styles.filterBtn, activeFiltersCount > 0 && styles.filterBtnActive]}
          onPress={() => setFiltersVisible(true)}
        >
          <Ionicons name="options-outline" size={18} color={activeFiltersCount > 0 ? '#FFFFFF' : '#0A3251'} />
          <Text style={[styles.filterBtnText, activeFiltersCount > 0 && styles.filterBtnTextActive]}>
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
          contentContainerStyle={{ paddingBottom: 16 }}
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
                      job.matchesProfile ? styles.matchPillOn : styles.matchPillOff,
                    ]}
                  >
                    <Ionicons
                      name={job.matchesProfile ? 'checkmark-circle' : 'alert-circle'}
                      size={14}
                      color={job.matchesProfile ? '#0A3251' : '#A1A9B5'}
                    />
                    <Text
                      style={[
                        styles.matchPillText,
                        !job.matchesProfile && styles.matchPillTextOff,
                      ]}
                    >
                      {job.matchesProfile ? 'Se ajusta a tu perfil' : 'Fuera de perfil'}
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
                    <Ionicons name="chevron-forward" size={18} color="#0A3251" />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
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
              Cuéntanos en tus propias palabras en qué tipos de trabajos te interesa
              participar. Más adelante procesaremos este texto con IA.
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
              onPress={() => setShowInterestsModal(false)}
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
              {(tempInterestsText.trim().length > 0 || tempFilterMatchesProfile) && (
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
                Se buscarán empleos que contengan estas palabras en el título o descripción
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
                      tempFilterMatchesProfile && styles.profileToggleKnobOn,
                    ]}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.profileHint}>
                Este filtro usará tu perfil profesional más adelante
                (por ahora todos los trabajos se marcan como compatibles).
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
                <Text style={styles.jobDetailTitle}>{selectedJob.title}</Text>
                <Text style={styles.jobDetailType}>{selectedJob.type}</Text>

                <View style={styles.jobDetailRow}>
                  <Text style={styles.jobDetailLabel}>Pago:</Text>
                  <Text style={styles.jobDetailValue}>{selectedJob.pay}</Text>
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

  /* Welcome modal */
  overlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
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

  /* Interests modal */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
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

  /* Reusable buttons */
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
});