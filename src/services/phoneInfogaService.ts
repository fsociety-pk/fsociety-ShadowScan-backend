import axios from 'axios';

export interface PhoneInfogaResult {
  country_code: number;
  international: string;
  e164: string;
  carrier: string;
  line_type: string;
  success: boolean;
}

export const fetchPhoneInfoga = async (phone: string): Promise<PhoneInfogaResult> => {
    try {
        const cleanPhone = phone.replace(/[^0-9+]/g, '').replace('+', '%2B');
        console.log(`[PhoneInfoga OSINT] Querying PhoneInfoga local scan for: ${cleanPhone}`);
        
        const response = await axios.get(`http://localhost:5000/api/numbers/${cleanPhone}/scan/local`, {
            timeout: 10000,
            validateStatus: () => true
        });

        const data = response.data;
        if (data && data.success) {
            return {
                country_code: data.result.country_code || 0,
                international: data.result.international || '',
                e164: data.result.e164 || '',
                carrier: data.result.carrier || 'Unknown (requires numverify)',
                line_type: data.result.line_type || 'Unknown',
                success: true
            };
        }
        
        return {
            country_code: 0,
            international: '',
            e164: '',
            carrier: 'Unknown',
            line_type: 'Unknown',
            success: false
        };
    } catch (e: any) {
        console.warn('[PhoneInfoga OSINT] Failed:', e.message);
        return {
            country_code: 0,
            international: '',
            e164: '',
            carrier: 'Unknown',
            line_type: 'Unknown',
            success: false
        };
    }
};
