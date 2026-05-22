import axios from 'axios';

export interface WhatsAppProfileResult {
  phone: string;
  name: string;
  status: string;
  image: string;
  is_business: boolean;
  exists: boolean;
  source: string;
  last_updated: string;
}

export const fetchWhatsAppProfile = async (cleanPhone: string): Promise<WhatsAppProfileResult> => {
    const apiKey = process.env.RAPIDAPI_KEY;
    const apiHost1 = process.env.RAPIDAPI_HOST || 'whatsapp-data1.p.rapidapi.com';
    const apiHost2 = process.env.PROFILE_PIC_HOST || 'whatsapp-profile-pic.p.rapidapi.com';
    const apiHost3 = process.env.VALID_WHATSAPP_HOST || 'valid-whatsapp.p.rapidapi.com';

    if (!apiKey || apiKey.trim() === '' || apiKey.startsWith('your_')) {
        throw new Error('WhatsApp intelligence provider is not configured');
    }

    try {
        console.log(`[WhatsApp OSINT] Querying primary Engine 1 (whatsapp-data1) for: ${cleanPhone}`);
        const response = await axios.get(`https://${apiHost1}/number/${cleanPhone}`, {
            headers: {
                'x-rapidapi-key': apiKey,
                'x-rapidapi-host': apiHost1
            },
            timeout: 25000,
            validateStatus: () => true
        });

        const result = response.data;
        if (result && (result.number || result.exists !== undefined || result.phone)) {
            const isBusiness = !!result.isBusiness || !!result.businessProfile;
            // Prefer actual display name values; if none present, return null so frontend can show a clearer "hidden" state
            const name = result.name || result.businessProfile?.localized_display_name || result.verifiedName || null;
            const status = result.about || result.status || (isBusiness ? 'Verified WhatsApp Business Account' : 'Active WhatsApp User');
            const image = result.profilePic || result.urlImage || result.image || null;

            return {
                phone: result.phone || `+${cleanPhone}`,
                name,
                status,
                image,
                is_business: isBusiness,
                exists: result.exists !== false,
                source: 'WhatsApp Profile Engine',
                last_updated: new Date().toISOString()
            };
        }
    } catch (e: any) {
        console.warn('[WhatsApp OSINT] Primary Engine 1 failed:', e.message);
    }

    // Engine 2 fallback
    try {
        console.log(`[WhatsApp OSINT] Querying Engine 2 (whatsapp-profile-pic) for: ${cleanPhone}`);
        const response = await axios.get(`https://${apiHost2}/isbiz`, {
            headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': apiHost2 },
            params: { phone: cleanPhone },
            timeout: 15000,
            validateStatus: () => true
        });

        const result = response.data;
        if (result && result.isbiz !== undefined) {
            const isBusiness = result.isbiz !== 'Not a Business Account';
            return {
                phone: `+${cleanPhone}`,
                name: isBusiness ? 'Verified WhatsApp Business' : 'Active WhatsApp User',
                status: isBusiness ? 'Verified WhatsApp Business Account' : 'Active WhatsApp User Profile',
                image: '',
                is_business: isBusiness,
                exists: true,
                source: 'WhatsApp Profile Pic Network',
                last_updated: new Date().toISOString()
            };
        }
    } catch (e: any) {
        console.warn('[WhatsApp OSINT] Engine 2 failed:', e.message);
    }

    // Engine 3 fallback
    try {
        console.log(`[WhatsApp OSINT] Querying Engine 3 (valid-whatsapp) for: ${cleanPhone}`);
        const response = await axios.get(`https://${apiHost3}/isbiz`, {
            headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': apiHost3 },
            params: { phone: cleanPhone },
            timeout: 15000,
            validateStatus: () => true
        });

        const result = response.data;
        if (result && result.isbiz !== undefined) {
            const isBusiness = result.isbiz !== 'Not a Business Account';
            return {
                phone: `+${cleanPhone}`,
                name: isBusiness ? 'Verified WhatsApp Business' : 'Active WhatsApp User',
                status: isBusiness ? 'Verified WhatsApp Business Account' : 'Active WhatsApp User Profile',
                image: '',
                is_business: isBusiness,
                exists: true,
                source: 'WhatsApp Verification Network',
                last_updated: new Date().toISOString()
            };
        }
    } catch (e: any) {
        console.warn('[WhatsApp OSINT] Engine 3 failed:', e.message);
    }

    throw new Error('WhatsApp intelligence providers did not return usable data');
};
