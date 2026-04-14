
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
const BUSINESS_ID = '65f1a2b3c4d5e6f7a8b9c0d1'; // From seed

async function testTrigger() {
    try {
        // 0. Create Doctor
        console.log('Creating Doctor...');
        const doctorRes = await axios.post(`${API_URL}/doctors`, {
            name: 'Test Doctor',
            specialization: 'General',
            business_id: BUSINESS_ID
        });
        const doctorId = doctorRes.data._id;
        console.log('Doctor Created:', doctorId);

        // 1. Create Patient
        console.log('Creating Patient...');
        const patientRes = await axios.post(`${API_URL}/patients`, {
            name: 'Test Trigger Patient',
            phone: '+1234567890',
            business_id: BUSINESS_ID
        });
        const patientId = patientRes.data._id;
        console.log('Patient Created:', patientId);

        // 2. Create Appointment
        console.log('Creating Appointment...');
        const apptRes = await axios.post(`${API_URL}/appointments`, {
            patient_id: patientId,
            doctor_id: doctorId,
            business_id: BUSINESS_ID,
            appointment_date: new Date(),
            service_type: 'Test Service'
        });
        const apptId = apptRes.data._id;
        console.log('Appointment Created:', apptId);

        // 3. Complete Appointment
        console.log('Completing Appointment...');
        await axios.put(`${API_URL}/appointments/${apptId}`, {
            status: 'Completed'
        });
        console.log('Appointment Completed. Waiting for logs...');

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testTrigger();
