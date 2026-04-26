import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // Use relative path for proxy
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getAnalytics = async (businessId: string) => {
  const response = await api.get(`/analytics?business_id=${businessId}`);
  return response.data;
};

export const triggerReview = async (data: any) => {
  const response = await api.post('/trigger-review', data);
  return response.data;
};

export const sendDirectMessage = async (data: any) => {
  const response = await api.post('/send-direct', data);
  return response.data;
};

export const scheduleReview = async (data: any) => {
    const response = await api.post('/schedule', data);
    return response.data;
}

export const getBusiness = async (id: string) => {
    const response = await api.get(`/business/${id}`);
    return response.data;
}

export const updateBusiness = async (id: string, data: any) => {
    const response = await api.put(`/business/${id}`, data);
    return response.data;
}

// CRM API

export const getPatients = async (businessId: string) => {
    const response = await api.get(`/patients?business_id=${businessId}`);
    return response.data;
};

export const createPatient = async (data: any) => {
    const response = await api.post('/patients', data);
    return response.data;
};

export const updatePatient = async (id: string, data: any) => {
    const response = await api.put(`/patients/${id}`, data);
    return response.data;
};

export const deletePatient = async (id: string) => {
    const response = await api.delete(`/patients/${id}`);
    return response.data;
};

export const getAppointments = async (businessId: string, filters: any = {}) => {
    let query = `?business_id=${businessId}`;
    if (filters.date) query += `&date=${filters.date}`;
    if (filters.status) query += `&status=${filters.status}`;
    if (filters.patient_id) query += `&patient_id=${filters.patient_id}`;
    if (filters.preferred_slot) query += `&preferred_slot=${filters.preferred_slot}`;
    if (filters.search) query += `&search=${encodeURIComponent(filters.search)}`;
    if (filters.page) query += `&page=${filters.page}`;
    if (filters.limit) query += `&limit=${filters.limit}`;
    const response = await api.get(`/appointments${query}`);
    return response.data; // Will now return { data, total, page, totalPages }
};

export const createAppointment = async (data: any) => {
    const response = await api.post('/appointments', data);
    return response.data;
};

export const updateAppointment = async (id: string, data: any) => {
    const response = await api.put(`/appointments/${id}`, data);
    return response.data;
};

export const deleteAppointment = async (id: string) => {
    const response = await api.delete(`/appointments/${id}`);
    return response.data;
};

// WhatsApp API
export const getWhatsAppQR = async () => {
    const response = await api.get('/whatsapp/qr');
    return response.data;
};

export const getWhatsAppStatus = async () => {
    const response = await api.get('/whatsapp/status');
    return response.data;
};

export const resetWhatsAppInstance = async () => {
    const response = await api.post('/whatsapp/reset');
    return response.data;
};

export const getDoctors = async (businessId: string) => {
    const response = await api.get(`/doctors?business_id=${businessId}`);
    return response.data;
};

export const createDoctor = async (data: any) => {
    const response = await api.post('/doctors', data);
    return response.data;
};

export const createPublicBooking = async (data: any) => {
    const response = await api.post('/public/book', data);
    return response.data;
};

export default api;
