import axios from 'axios';

export interface PhoneInfogaResult {
  country_code: number;
  international: string;
  e164: string;
  carrier: string;
  line_type: string;
  success: boolean;
}

const getFallbackDetails = (cleanPhone: string): PhoneInfogaResult => {
    let cc = 0;
    let carrier = 'Unknown';
    let line_type = 'Mobile';
    let international = '+' + cleanPhone;

    if (cleanPhone.startsWith('92')) {
        cc = 92;
        const prefix = cleanPhone.substring(2, 5);
        if (prefix.startsWith('30')) carrier = 'Jazz / Mobilink';
        else if (prefix.startsWith('31')) carrier = 'Zong / CMPak';
        else if (prefix.startsWith('32')) carrier = 'Warid / Jazz';
        else if (prefix.startsWith('33')) carrier = 'Ufone / PTML';
        else if (prefix.startsWith('34')) carrier = 'Telenor Pakistan';
        else { carrier = 'Unknown Network'; line_type = 'Landline'; }
        
        international = `+92 ${cleanPhone.substring(2, 5)} ${cleanPhone.substring(5)}`;
    } else if (cleanPhone.startsWith('1')) {
        cc = 1;
        carrier = 'US / Canada Carrier';
        international = `+1 (${cleanPhone.substring(1, 4)}) ${cleanPhone.substring(4, 7)}-${cleanPhone.substring(7)}`;
    } else if (cleanPhone.startsWith('44')) {
        cc = 44;
        carrier = 'UK Network';
        international = `+44 ${cleanPhone.substring(2, 6)} ${cleanPhone.substring(6)}`;
    }

    return {
        country_code: cc,
        international,
        e164: '+' + cleanPhone,
        carrier,
        line_type,
        success: true
    };
};

export const fetchPhoneInfoga = async (phone: string): Promise<PhoneInfogaResult> => {
    try {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        console.log(`[PhoneInfoga OSINT] Querying PhoneInfoga local scan for: ${cleanPhone}`);
        
        const response = await axios.get(`http://localhost:5050/api/numbers/${cleanPhone}/scan/local`, {
            timeout: 3000,
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
        
        // Fallback if PhoneInfoga returns success: false
        return getFallbackDetails(cleanPhone);
    } catch (e: any) {
        console.warn(`[PhoneInfoga OSINT] Failed (${e.message}). Using intelligent fallback.`);
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        return getFallbackDetails(cleanPhone);
    }
};
