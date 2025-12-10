import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../utils/mockApi';

// TypeScript interfaces for Appointment and API responses
interface Appointment {
  id: string;
  patientName: string;
  dentistName: string;
  startTime: string;
  endTime: string;
  status: 'BOOKED' | 'ARRIVED' | 'IN_TREATMENT' | 'DONE' | 'NO_SHOW' | 'CANCELLED';
  chairNumber: number | null;
}

interface TodayAppointmentsResponse {
  data: Appointment[];
}

// Status color mapping for badges and visual indicators
const statusColors: Record<Appointment['status'], { bg: string; text: string; border: string }> = {
  BOOKED: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  ARRIVED: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  IN_TREATMENT: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  DONE: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  NO_SHOW: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
};

// Status display labels
const statusLabels: Record<Appointment['status'], string> = {
  BOOKED: 'Booked',
  ARRIVED: 'Arrived',
  IN_TREATMENT: 'In Treatment',
  DONE: 'Done',
  NO_SHOW: 'No Show',
  CANCELLED: 'Cancelled',
};

// Status progression order (for queue grouping)
const statusOrder: Appointment['status'][] = ['BOOKED', 'ARRIVED', 'IN_TREATMENT', 'DONE', 'NO_SHOW', 'CANCELLED'];

// Main TodayAppointmentsPage component
export default function TodayAppointmentsPage() {
  // State management
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDentist, setSelectedDentist] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [updatingStatus, setUpdatingStatus] = useState<Set<string>>(new Set());

  // Fetch appointments from API
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch('/api/v1/appointments/today');

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        if (!isJson) {
          throw new Error(`API endpoint not found or server error (${response.status}). Please check if the API server is running at /api/v1/appointments/today`);
        }
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch appointments: ${response.statusText}`);
        } catch (parseErr) {
          throw new Error(`Failed to fetch appointments: ${response.status} ${response.statusText}`);
        }
      }

      if (!isJson) {
        throw new Error('API endpoint returned non-JSON response. Please check if the API server is running.');
      }

      const data: TodayAppointmentsResponse = await response.json();
      setAppointments(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching appointments');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch appointments on mount
  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Get unique dentists from appointments
  const dentists = useMemo(() => {
    const uniqueDentists = Array.from(new Set(appointments.map((apt) => apt.dentistName)));
    return uniqueDentists.sort();
  }, [appointments]);

  // Filter appointments based on selected filters
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const matchesDentist = selectedDentist === 'all' || apt.dentistName === selectedDentist;
      const matchesStatus = selectedStatus === 'all' || apt.status === selectedStatus;
      return matchesDentist && matchesStatus;
    });
  }, [appointments, selectedDentist, selectedStatus]);

  // Group appointments by status for queue view
  const appointmentsByStatus = useMemo(() => {
    const grouped: Record<Appointment['status'], Appointment[]> = {
      BOOKED: [],
      ARRIVED: [],
      IN_TREATMENT: [],
      DONE: [],
      NO_SHOW: [],
      CANCELLED: [],
    };

    filteredAppointments.forEach((apt) => {
      grouped[apt.status].push(apt);
    });

    // Sort each group by start time
    Object.keys(grouped).forEach((status) => {
      grouped[status as Appointment['status']].sort((a, b) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    });

    return grouped;
  }, [filteredAppointments]);

  // Handle status update
  const handleStatusUpdate = async (appointmentId: string, newStatus: Appointment['status']) => {
    // Optimistic update
    setAppointments((prev) =>
      prev.map((apt) => (apt.id === appointmentId ? { ...apt, status: newStatus } : apt))
    );
    setUpdatingStatus((prev) => new Set(prev).add(appointmentId));

    try {
      const response = await apiFetch(`/api/v1/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        if (!isJson) {
          throw new Error(`API endpoint not found or server error (${response.status})`);
        }
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to update status: ${response.statusText}`);
        } catch (parseErr) {
          throw new Error(`Failed to update status: ${response.status} ${response.statusText}`);
        }
      }

      // Refresh appointments to get latest data
      await fetchAppointments();
    } catch (err) {
      // Revert optimistic update on error
      await fetchAppointments();
      alert(err instanceof Error ? err.message : 'Failed to update appointment status');
    } finally {
      setUpdatingStatus((prev) => {
        const next = new Set(prev);
        next.delete(appointmentId);
        return next;
      });
    }
  };

  // Get next status in progression
  const getNextStatus = (currentStatus: Appointment['status']): Appointment['status'] | null => {
    const statusFlow: Record<Appointment['status'], Appointment['status'] | null> = {
      BOOKED: 'ARRIVED',
      ARRIVED: 'IN_TREATMENT',
      IN_TREATMENT: 'DONE',
      DONE: null,
      NO_SHOW: null,
      CANCELLED: null,
    };
    return statusFlow[currentStatus] || null;
  };

  // Format time for display
  const formatTime = (timeString: string): string => {
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return timeString;
    }
  };

  // Format time range
  const formatTimeRange = (startTime: string, endTime: string): string => {
    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: Appointment['status'] }) => {
    const colors = statusColors[status];
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} border`}
      >
        {statusLabels[status]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Today's Appointments</h1>
          <p className="text-gray-600 mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex flex-col sm:flex-row gap-4">
          {/* Dentist Filter */}
          <div className="flex-1">
            <label htmlFor="dentist-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Dentist
            </label>
            <select
              id="dentist-filter"
              value={selectedDentist}
              onChange={(e) => setSelectedDentist(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            >
              <option value="all">All Dentists</option>
              {dentists.map((dentist) => (
                <option key={dentist} value={dentist}>
                  {dentist}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex-1">
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Status
            </label>
            <select
              id="status-filter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            >
              <option value="all">All Statuses</option>
              {statusOrder.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading appointments...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-red-600 mb-2">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-red-600 font-medium">{error}</p>
            <button
              onClick={fetchAppointments}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Content: Table and Queue View */}
        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Appointments Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Appointments List</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? 's' : ''}
                </p>
              </div>

              {filteredAppointments.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-gray-400 mb-2">
                    <svg
                      className="mx-auto h-12 w-12"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium">No appointments found</p>
                  <p className="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Patient
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Dentist
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Chair
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAppointments.map((appointment) => {
                        const nextStatus = getNextStatus(appointment.status);
                        const isUpdating = updatingStatus.has(appointment.id);

                        return (
                          <tr key={appointment.id} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {formatTimeRange(appointment.startTime, appointment.endTime)}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{appointment.patientName}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600">{appointment.dentistName}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600">
                                {appointment.chairNumber ? `Chair ${appointment.chairNumber}` : '—'}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <StatusBadge status={appointment.status} />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {nextStatus && (
                                <button
                                  onClick={() => handleStatusUpdate(appointment.id, nextStatus)}
                                  disabled={isUpdating}
                                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isUpdating ? 'Updating...' : `Mark as ${statusLabels[nextStatus]}`}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right: Queue View */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Queue View</h2>
                <p className="text-sm text-gray-600 mt-1">Visual status overview</p>
              </div>

              <div className="p-6 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
                {/* BOOKED / ARRIVED Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                    Waiting ({appointmentsByStatus.BOOKED.length + appointmentsByStatus.ARRIVED.length})
                  </h3>
                  <div className="space-y-2">
                    {[...appointmentsByStatus.BOOKED, ...appointmentsByStatus.ARRIVED].map((appointment) => (
                      <div
                        key={appointment.id}
                        className={`p-4 rounded-lg border-2 ${statusColors[appointment.status].border} ${statusColors[appointment.status].bg} transition hover:shadow-md`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{appointment.patientName}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              {formatTimeRange(appointment.startTime, appointment.endTime)}
                            </div>
                            <div className="text-sm text-gray-600">{appointment.dentistName}</div>
                            {appointment.chairNumber && (
                              <div className="text-xs text-gray-500 mt-1">Chair {appointment.chairNumber}</div>
                            )}
                          </div>
                          <StatusBadge status={appointment.status} />
                        </div>
                        {getNextStatus(appointment.status) && (
                          <button
                            onClick={() => handleStatusUpdate(appointment.id, getNextStatus(appointment.status)!)}
                            disabled={updatingStatus.has(appointment.id)}
                            className="mt-3 w-full px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingStatus.has(appointment.id)
                              ? 'Updating...'
                              : `Mark as ${statusLabels[getNextStatus(appointment.status)!]}`}
                          </button>
                        )}
                      </div>
                    ))}
                    {appointmentsByStatus.BOOKED.length === 0 && appointmentsByStatus.ARRIVED.length === 0 && (
                      <p className="text-sm text-gray-400 italic">No patients waiting</p>
                    )}
                  </div>
                </div>

                {/* IN_TREATMENT Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                    In Treatment ({appointmentsByStatus.IN_TREATMENT.length})
                  </h3>
                  <div className="space-y-2">
                    {appointmentsByStatus.IN_TREATMENT.map((appointment) => (
                      <div
                        key={appointment.id}
                        className={`p-4 rounded-lg border-2 ${statusColors[appointment.status].border} ${statusColors[appointment.status].bg} transition hover:shadow-md`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{appointment.patientName}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              {formatTimeRange(appointment.startTime, appointment.endTime)}
                            </div>
                            <div className="text-sm text-gray-600">{appointment.dentistName}</div>
                            {appointment.chairNumber && (
                              <div className="text-xs text-gray-500 mt-1">Chair {appointment.chairNumber}</div>
                            )}
                          </div>
                          <StatusBadge status={appointment.status} />
                        </div>
                        {getNextStatus(appointment.status) && (
                          <button
                            onClick={() => handleStatusUpdate(appointment.id, getNextStatus(appointment.status)!)}
                            disabled={updatingStatus.has(appointment.id)}
                            className="mt-3 w-full px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingStatus.has(appointment.id)
                              ? 'Updating...'
                              : `Mark as ${statusLabels[getNextStatus(appointment.status)!]}`}
                          </button>
                        )}
                      </div>
                    ))}
                    {appointmentsByStatus.IN_TREATMENT.length === 0 && (
                      <p className="text-sm text-gray-400 italic">No patients in treatment</p>
                    )}
                  </div>
                </div>

                {/* DONE / NO_SHOW / CANCELLED Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                    Completed ({appointmentsByStatus.DONE.length + appointmentsByStatus.NO_SHOW.length + appointmentsByStatus.CANCELLED.length})
                  </h3>
                  <div className="space-y-2">
                    {[
                      ...appointmentsByStatus.DONE,
                      ...appointmentsByStatus.NO_SHOW,
                      ...appointmentsByStatus.CANCELLED,
                    ].map((appointment) => (
                      <div
                        key={appointment.id}
                        className={`p-4 rounded-lg border-2 ${statusColors[appointment.status].border} ${statusColors[appointment.status].bg} transition opacity-75`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{appointment.patientName}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              {formatTimeRange(appointment.startTime, appointment.endTime)}
                            </div>
                            <div className="text-sm text-gray-600">{appointment.dentistName}</div>
                            {appointment.chairNumber && (
                              <div className="text-xs text-gray-500 mt-1">Chair {appointment.chairNumber}</div>
                            )}
                          </div>
                          <StatusBadge status={appointment.status} />
                        </div>
                      </div>
                    ))}
                    {appointmentsByStatus.DONE.length === 0 &&
                      appointmentsByStatus.NO_SHOW.length === 0 &&
                      appointmentsByStatus.CANCELLED.length === 0 && (
                        <p className="text-sm text-gray-400 italic">No completed appointments</p>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

