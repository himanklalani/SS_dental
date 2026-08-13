import { Request, Response } from 'express';
import axios from 'axios';
import Template from '../models/Template';
import Business from '../models/Business';

const META_API_TOKEN = process.env.META_API_TOKEN;
const META_WABA_ID   = process.env.META_WABA_ID; // WhatsApp Business Account ID

// ── Helper: get first business ───────────────────────────────────────────────
const getDefaultBusiness = async () => Business.findOne();

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Get all templates (from local DB cache, optionally sync first)
// @route  GET /api/templates
// ─────────────────────────────────────────────────────────────────────────────
export const getTemplates = async (req: Request, res: Response) => {
    try {
        const business = await getDefaultBusiness();
        if (!business) return res.status(404).json({ error: 'Business not found' });
        const templates = await Template.find({ business_id: business._id }).sort({ createdAt: -1 });
        res.json(templates);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Sync templates from Meta → local DB
// @route  POST /api/templates/sync
// ─────────────────────────────────────────────────────────────────────────────
export const syncTemplates = async (req: Request, res: Response) => {
    try {
        if (!META_API_TOKEN || !META_WABA_ID) {
            return res.status(500).json({ error: 'META_API_TOKEN or META_WABA_ID env variable is not set' });
        }
        const business = await getDefaultBusiness();
        if (!business) return res.status(404).json({ error: 'Business not found' });

        const url = `https://graph.facebook.com/v25.0/${META_WABA_ID}/message_templates?limit=100&fields=id,name,language,category,status,components,rejected_reason`;
        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${META_API_TOKEN}` }
        });

        const metaTemplates = response.data.data || [];
        let upserted = 0;

        for (const t of metaTemplates) {
            await Template.findOneAndUpdate(
                { meta_template_id: t.id, business_id: business._id },
                {
                    meta_template_id: t.id,
                    name: t.name,
                    language: t.language,
                    category: t.category,
                    status: t.status,
                    components: t.components,
                    rejected_reason: t.rejected_reason,
                    business_id: business._id
                },
                { upsert: true, new: true }
            );
            upserted++;
        }

        console.log(`[Templates] Synced ${upserted} templates from Meta`);
        const allTemplates = await Template.find({ business_id: business._id }).sort({ createdAt: -1 });
        res.json({ synced: upserted, templates: allTemplates });

    } catch (error: any) {
        console.error('[Templates] Sync error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to sync from Meta', details: error.response?.data });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Create a new template and submit to Meta for approval
// @route  POST /api/templates
// ─────────────────────────────────────────────────────────────────────────────
export const createTemplate = async (req: Request, res: Response) => {
    try {
        if (!META_API_TOKEN || !META_WABA_ID) {
            return res.status(500).json({ error: 'META_API_TOKEN or META_WABA_ID env variable is not set' });
        }

        const { name, category, language, body_text } = req.body;
        if (!name || !category || !body_text) {
            return res.status(400).json({ error: 'name, category, and body_text are required' });
        }

        const business = await getDefaultBusiness();
        if (!business) return res.status(404).json({ error: 'Business not found' });

        // Build Meta-compatible components array
        const components = [
            {
                type: 'BODY',
                text: body_text
            }
        ];

        const url = `https://graph.facebook.com/v25.0/${META_WABA_ID}/message_templates`;
        const metaResponse = await axios.post(url, {
            name: name.toLowerCase().replace(/\s+/g, '_'),
            category,
            language: language || 'en',
            components
        }, {
            headers: {
                Authorization: `Bearer ${META_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const metaTemplateId = metaResponse.data.id;
        const metaStatus     = metaResponse.data.status || 'PENDING';

        // Save to local DB
        const template = await Template.create({
            meta_template_id: metaTemplateId,
            name: name.toLowerCase().replace(/\s+/g, '_'),
            language: language || 'en',
            category,
            status: metaStatus,
            components,
            business_id: business._id
        });

        console.log(`[Templates] Created template "${template.name}" — Status: ${metaStatus}`);
        res.status(201).json(template);

    } catch (error: any) {
        console.error('[Templates] Create error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create template', details: error.response?.data });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Delete a template from Meta and local DB
// @route  DELETE /api/templates/:id
// ─────────────────────────────────────────────────────────────────────────────
export const deleteTemplate = async (req: Request, res: Response) => {
    try {
        if (!META_API_TOKEN || !META_WABA_ID) {
            return res.status(500).json({ error: 'META_API_TOKEN or META_WABA_ID env variable is not set' });
        }

        const template = await Template.findById(req.params.id);
        if (!template) return res.status(404).json({ error: 'Template not found' });

        // Delete from Meta
        try {
            await axios.delete(`https://graph.facebook.com/v25.0/${META_WABA_ID}/message_templates?name=${template.name}`, {
                headers: { Authorization: `Bearer ${META_API_TOKEN}` }
            });
        } catch (metaErr: any) {
            console.warn('[Templates] Meta delete failed (may already be gone):', metaErr.response?.data?.error?.message);
        }

        await Template.findByIdAndDelete(req.params.id);
        console.log(`[Templates] Deleted template "${template.name}"`);
        res.json({ success: true });

    } catch (error: any) {
        console.error('[Templates] Delete error:', error.message);
        res.status(500).json({ error: 'Failed to delete template' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Handle incoming Meta webhook for template status updates
//         Called internally from reviewController webhook handler
// ─────────────────────────────────────────────────────────────────────────────
export const handleTemplateStatusUpdate = async (event: any) => {
    try {
        const { message_template_id, message_template_name, message_template_status, reason } = event;

        const updated = await Template.findOneAndUpdate(
            { meta_template_id: String(message_template_id) },
            {
                status: message_template_status,
                ...(reason ? { rejected_reason: reason } : {})
            },
            { new: true }
        );

        if (updated) {
            console.log(`[Templates] Status updated: "${message_template_name}" → ${message_template_status}`);
        } else {
            console.warn(`[Templates] Received status update for unknown template ID: ${message_template_id}`);
        }
    } catch (error) {
        console.error('[Templates] Error handling status update:', error);
    }
};
