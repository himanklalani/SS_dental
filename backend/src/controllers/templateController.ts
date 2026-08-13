import { Request, Response } from 'express';
import axios from 'axios';
import Template from '../models/Template';
import Business from '../models/Business';
import FormData from 'form-data';

const META_API_TOKEN = process.env.META_API_TOKEN;
const META_WABA_ID         = process.env.META_WABA_ID;         // WhatsApp Business Account ID
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID; // WhatsApp Phone ID
const META_APP_ID          = process.env.META_APP_ID;          // Meta App ID (for template media uploads)

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

        const { name, category, language, header, body_text, footer_text, buttons, variable_samples, media_id } = req.body;
        if (!name || !category || !body_text) {
            return res.status(400).json({ error: 'name, category, and body_text are required' });
        }

        const business = await getDefaultBusiness();
        if (!business) return res.status(404).json({ error: 'Business not found' });

        // ── Build Meta-compatible components array ──────────────────────────────
        const components: any[] = [];

        // 1. Header (optional)
        if (header && header.type && header.type !== 'NONE') {
            if (header.type === 'TEXT' && header.text) {
                components.push({ type: 'HEADER', format: 'TEXT', text: header.text });
            } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(header.type)) {
                const headerComp: any = { type: 'HEADER', format: header.type };
                if (header.handle) {
                    headerComp.example = { header_handle: [header.handle] };
                }
                components.push(headerComp);
            }
        }

        // 2. Body (required)
        const bodyComp: any = { type: 'BODY', text: body_text };
        if (variable_samples && Array.isArray(variable_samples) && variable_samples.length > 0) {
            bodyComp.example = { body_text: [variable_samples] };
        }
        components.push(bodyComp);

        // 3. Footer (optional)
        if (footer_text && footer_text.trim()) {
            components.push({ type: 'FOOTER', text: footer_text.trim() });
        }

        // 4. Buttons (optional)
        if (buttons && buttons.length > 0) {
            const metaButtons = buttons
                .filter((b: any) => b.type && (b.text || b.url || b.phone_number))
                .map((b: any) => {
                    if (b.type === 'QUICK_REPLY')    return { type: 'QUICK_REPLY', text: b.text };
                    if (b.type === 'URL')            return { type: 'URL',         text: b.text, url: b.url };
                    if (b.type === 'PHONE_NUMBER')   return { type: 'PHONE_NUMBER',text: b.text, phone_number: b.phone_number };
                    return null;
                })
                .filter(Boolean);

            if (metaButtons.length > 0) {
                components.push({ type: 'BUTTONS', buttons: metaButtons });
            }
        }

        const url = `https://graph.facebook.com/v25.0/${META_WABA_ID}/message_templates`;
        console.log('[Templates] Sending components to Meta:', JSON.stringify(components, null, 2));
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
        const templateData: any = {
            meta_template_id: metaTemplateId,
            name: name.toLowerCase().replace(/\s+/g, '_'),
            language: language || 'en',
            category,
            status: metaStatus,
            components,
            business_id: business._id
        };
        // Persist media_id if provided (used by Smart Interceptor for free-form image sends)
        if (media_id) {
            templateData.media_id = media_id;
            templateData.media_uploaded_at = new Date();
        }
        const template = await Template.create(templateData);

        console.log(`[Templates] Created template "${template.name}" — Status: ${metaStatus}`);
        res.status(201).json(template);

    } catch (error: any) {
        console.error('[Templates] Create error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create template', details: error.response?.data });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc   Upload a media sample to Meta and return the header_handle
// @route  POST /api/templates/upload-sample
// ─────────────────────────────────────────────────────────────────────────────
export const uploadSample = async (req: Request, res: Response) => {
    try {
        if (!META_API_TOKEN || !META_APP_ID) {
            return res.status(500).json({ error: 'META_API_TOKEN or META_APP_ID env variable is not set' });
        }

        const file = (req as any).file;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        // ── Step 1: Resumable Upload → produces header_handle for template creation ──
        const sessionRes = await axios.post(
            `https://graph.facebook.com/v21.0/${META_APP_ID}/uploads`,
            null,
            {
                params: {
                    file_name:    file.originalname,
                    file_length:  file.size,
                    file_type:    file.mimetype,
                    access_token: META_API_TOKEN
                }
            }
        );

        const sessionId = sessionRes.data.id;
        if (!sessionId) {
            return res.status(500).json({ error: 'Meta did not return an upload session ID' });
        }
        console.log(`[Templates] Upload session created: ${sessionId}`);

        const uploadRes = await axios.post(
            `https://graph.facebook.com/v21.0/${sessionId}`,
            file.buffer,
            {
                headers: {
                    Authorization:  `OAuth ${META_API_TOKEN}`,
                    'Content-Type': file.mimetype,
                    'file_offset':  '0'
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            }
        );

        const handle = uploadRes.data.h;
        if (!handle) {
            return res.status(500).json({ error: 'Meta did not return a handle from upload session' });
        }
        console.log(`[Templates] Resumable upload complete. Header handle: ${handle}`);

        // ── Step 2 (parallel): Phone Media Upload → produces media_id for free-form sends ──
        // This media_id can be reused by the Smart Interceptor when the 24h window is open.
        let media_id: string | null = null;
        try {
            if (META_PHONE_NUMBER_ID) {
                const form = new FormData();
                form.append('messaging_product', 'whatsapp');
                form.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });

                const mediaRes = await axios.post(
                    `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/media`,
                    form,
                    {
                        headers: {
                            ...form.getHeaders(),
                            Authorization: `Bearer ${META_API_TOKEN}`
                        },
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity
                    }
                );
                media_id = mediaRes.data.id || null;
                console.log(`[Templates] Phone media upload complete. Media ID: ${media_id}`);
            }
        } catch (mediaErr: any) {
            // Non-fatal — interceptor will fall back to text-only if media_id is missing
            console.warn('[Templates] Phone media upload failed (non-fatal):', mediaErr.response?.data || mediaErr.message);
        }

        res.json({ handle, media_id });

    } catch (error: any) {
        console.error('[Templates] Upload sample error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to upload media sample', details: error.response?.data });
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
