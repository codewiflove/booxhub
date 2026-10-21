'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const COMPANY = {
  name: 'Perhentian Bay Chalet',
  legalName: 'Perhentian Bay Chalet Sdn. Bhd.',
  address: 'Pulau Perhentian Kecil, 22300 Besut, Terengganu',
  phone: '+60 9-691 0000',
  email: 'b2b@perhentianbay.com',
  bank: {
    name: 'Maybank',
    account: '5621 0000 0000',
    holder: 'Perhentian Bay Chalet Sdn. Bhd.',
  },
} as const;

export interface CompanyInfo {
  name: string;
  legal_name: string;
  address: string;
  phone: string;
  email: string;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
}

/** Tetapan syarikat terkini dari pangkalan data; jatuh kepada nilai lalai jika gagal. */
export function useCompany(): CompanyInfo {
  const [company, setCompany] = useState<CompanyInfo>({
    name: COMPANY.name,
    legal_name: COMPANY.legalName,
    address: COMPANY.address,
    phone: COMPANY.phone,
    email: COMPANY.email,
    bank_name: COMPANY.bank.name,
    bank_account: COMPANY.bank.account,
    bank_holder: COMPANY.bank.holder,
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('get_company_settings');
      if (error || !data) return;
      const s = data as Partial<CompanyInfo>;
      setCompany((prev) => ({
        name: s.name ?? prev.name,
        legal_name: s.legal_name ?? prev.legal_name,
        address: s.address ?? prev.address,
        phone: s.phone ?? prev.phone,
        email: s.email ?? prev.email,
        bank_name: s.bank_name ?? prev.bank_name,
        bank_account: s.bank_account ?? prev.bank_account,
        bank_holder: s.bank_holder ?? prev.bank_holder,
      }));
    })();
  }, []);

  return company;
}

export async function fetchCompanySettings(): Promise<CompanyInfo> {
  const { data, error } = await supabase.rpc('get_company_settings');
  if (error || !data) {
    return {
      name: COMPANY.name,
      legal_name: COMPANY.legalName,
      address: COMPANY.address,
      phone: COMPANY.phone,
      email: COMPANY.email,
      bank_name: COMPANY.bank.name,
      bank_account: COMPANY.bank.account,
      bank_holder: COMPANY.bank.holder,
    };
  }
  const s = data as CompanyInfo;
  return {
    name: s.name ?? COMPANY.name,
    legal_name: s.legal_name ?? COMPANY.legalName,
    address: s.address ?? COMPANY.address,
    phone: s.phone ?? COMPANY.phone,
    email: s.email ?? COMPANY.email,
    bank_name: s.bank_name ?? COMPANY.bank.name,
    bank_account: s.bank_account ?? COMPANY.bank.account,
    bank_holder: s.bank_holder ?? COMPANY.bank.holder,
  };
}