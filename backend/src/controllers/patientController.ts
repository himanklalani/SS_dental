import { Request, Response } from 'express';
import Patient from '../models/Patient';

// Get all patients for a business
export const getPatients = async (req: Request, res: Response) => {
    try {
        const { business_id } = req.query;
        if (!business_id) return res.status(400).json({ error: 'Business ID required' });

        const patients = await Patient.find({ business_id }).sort({ createdAt: -1 });
        res.status(200).json(patients);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch patients' });
    }
};

// Create a new patient
export const createPatient = async (req: Request, res: Response) => {
    try {
        const patient = new Patient(req.body);
        await patient.save();
        res.status(201).json(patient);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create patient', details: error });
    }
};

// Update patient
export const updatePatient = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const patient = await Patient.findByIdAndUpdate(id, req.body, { new: true });
        res.status(200).json(patient);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update patient' });
    }
};

// Delete patient
export const deletePatient = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await Patient.findByIdAndDelete(id);
        res.status(200).json({ message: 'Patient deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete patient' });
    }
};

// Get single patient
export const getPatient = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const patient = await Patient.findById(id);
        if (!patient) return res.status(404).json({ error: 'Patient not found' });
        res.status(200).json(patient);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch patient' });
    }
};
