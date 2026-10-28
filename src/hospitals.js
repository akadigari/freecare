// Maryland's acute care hospitals and health systems, with each one's own policy as the
// state publishes it. Read from HSCRC's Financial Assistance Policies page; UPMC Western
// Maryland has no policy there, so its billing and collection policy from the HSCRC
// Credit and Collection page is used. No phone numbers on purpose: a wrong one does harm.

export const HOSPITALS_SOURCE = Object.freeze({
  url: 'https://hscrc.maryland.gov/Pages/hsp-fap.aspx',
  readOn: '2026-10-28',
});

export const HOSPITALS = Object.freeze([
  { id: 'adventist', name: 'Adventist HealthCare', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Adventist%20%5bALL%5d/Financial%20Assistance%20aka%20Charity%20Policy%20AHC%20%2804-2025%29.pdf', policyKind: 'financial assistance', fileType: 'pdf' },
  { id: 'ascension-st-agnes', name: 'Ascension Saint Agnes Hospital', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Ascension/FI.05_Ascension%20Saint%20Agnes_financial-assistance-policy_12.2025.pdf', policyKind: 'financial assistance', fileType: 'pdf' },
  { id: 'calverthealth', name: 'CalvertHealth Medical Center', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Calvert%20Health/BD-09_Financial%20Assistance%20Policy.doc', policyKind: 'financial assistance', fileType: 'word' },
  { id: 'union-hospital', name: 'ChristianaCare Union Hospital (Elkton)', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Christiana%20Care/Union%20Hospital%20Financial%20Assistance%20Policy_2-1-26.docx', policyKind: 'financial assistance', fileType: 'word' },
  { id: 'frederick-health', name: 'Frederick Health Hospital', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Frederick/Financial%20Assistance-%20Self%20Pay%20Collections-%20and%20Payment%20Plan%20Policy-%20FN%20100%20032026.pdf', policyKind: 'financial assistance', fileType: 'pdf' },
  { id: 'garrett-regional', name: 'Garrett Regional Medical Center', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Garrett%20Regional/GRMC%20Caring%20Program%20Policy.pdf', policyKind: 'financial assistance', fileType: 'pdf' },
  { id: 'gbmc', name: 'Greater Baltimore Medical Center (GBMC)', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/GBMC/GBMC%20-%20Financial%20Assistance%20Policy%20%28Final.10.2025%29.docx', policyKind: 'financial assistance', fileType: 'word' },
  { id: 'holy-cross', name: 'Holy Cross Health (Silver Spring, Germantown)', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Holy%20Cross/Finance_HCH%20Patient%20Financial%20Assistance.pdf', policyKind: 'financial assistance', fileType: 'pdf' },
  { id: 'johns-hopkins', name: 'Johns Hopkins Medicine (Hopkins Hospital, Bayview, Howard County, Suburban)', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Johns%20Hopkins/PFS035-Financial%20Assistance.pdf', policyKind: 'financial assistance', fileType: 'pdf' },
  { id: 'lifebridge', name: 'LifeBridge Health (Sinai, Northwest, Carroll, Grace)', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Lifebridge/Brd%20Apprvd%20Hospital%20Financial%20Assistance%20Eff%20012226%20ENGLISH.docx', policyKind: 'financial assistance', fileType: 'word' },
  { id: 'luminis', name: 'Luminis Health (Anne Arundel Medical Center, Doctors Community)', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Luminis%20Health/Luminis%20Health%20Financial%20Assistance%20Policy.docx', policyKind: 'financial assistance', fileType: 'word' },
  { id: 'medstar', name: "MedStar Health (Union Memorial, Good Samaritan, Franklin Square, Harbor, Montgomery, Southern Maryland, St. Mary's)", policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Medstar/MedStar%20Health%20Corporate%20Financial%20Assistance%20Policy_2025%20HSCRC%20distribution%2003162026.pdf', policyKind: 'financial assistance', fileType: 'pdf' },
  { id: 'mercy', name: 'Mercy Medical Center', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Mercy/MMC%20Financial%20Assistance%20Policy.pdf', policyKind: 'financial assistance', fileType: 'pdf' },
  { id: 'meritus', name: 'Meritus Medical Center', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Meritus/Meritus-FA-Policy-2026.pdf', policyKind: 'financial assistance', fileType: 'pdf' },
  { id: 'mt-washington-pediatric', name: 'Mt. Washington Pediatric Hospital', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Mt.%20Washington/Patient%20Financial%20Assistance%20Policy%202026.pdf', policyKind: 'financial assistance', fileType: 'pdf' },
  { id: 'sheppard-pratt', name: 'Sheppard Pratt', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Sheppard%20Pratt/Financial%20Assistance%20Patient%20Financial%20Services%20HS%20%283%29.docx', policyKind: 'financial assistance', fileType: 'word' },
  { id: 'tidalhealth', name: 'TidalHealth (Peninsula Regional, McCready)', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/Tidal%20Health/Financial%20Assistance%20-%20Uncompensated%20Care%20-%20Policy%20-%20%28English%29%20Final%20for%2007-01-26.docx', policyKind: 'financial assistance', fileType: 'word' },
  { id: 'umms', name: 'University of Maryland Medical System (UMMC, Midtown, St. Joseph, Shore, Capital Region, Upper Chesapeake, Charles Regional, Baltimore Washington)', policyUrl: 'https://hscrc.maryland.gov/Documents/Financial%20Assistance%20Policies/FY25%20Financial%20Assistance/UMMS/UMMS%20Financial%20Assistance%2005.11.26.pdf', policyKind: 'financial assistance', fileType: 'pdf' },
  { id: 'upmc-western-maryland', name: 'UPMC Western Maryland', policyUrl: 'https://hscrc.maryland.gov/Documents/Hannah%20T.%20Folder/Credit%20and%20Collections/FY25%20December%20Hosp/UPMCWMCreditAndCollectionsPolicy.pdf', policyKind: 'billing and collection', fileType: 'pdf' },
].map(Object.freeze));

export function hospitalById(id) {
  return HOSPITALS.find((hospital) => hospital.id === id) ?? null;
}
