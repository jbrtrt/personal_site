/**
 * Publications and presentations, from the CV.
 *
 * `cite` marks the author's own name with ** ** so the renderer can
 * embolden it without the file carrying markup. `kind` drives the
 * colour of the venue tag — patents read in potassium violet, every
 * other channel in the accent of whichever ground is active.
 */

export interface Pub {
  year: string;
  cite: string;
  venue: string;
  kind: 'journal' | 'podium' | 'abstract' | 'poster' | 'patent' | 'lecture';
}

export const publications: Pub[] = [
  {
    year: '2026',
    cite: '**Greenfield B**, Srirangapatanam S, Stoller M, Mena J, Webb S, Ho SP. Microenvironment-specific zinc enrichment and structural heterogeneity in human kidney stones.',
    venue: 'AUA New England',
    kind: 'podium',
  },
  {
    year: '2026',
    cite: 'Momodu M, **Greenfield B**, Leng L, Camargo F, Bowman M, Chi T. Post-HoLEP decisional regret: a mixed-methods analysis.',
    venue: 'AUA New England',
    kind: 'abstract',
  },
  {
    year: '2026',
    cite: 'Srirangapatanam S, **Greenfield B**, Mena J, Farzannekou D, Kang M, Ustriyana P, Webb S, Ho SP. Pathological biomineral polymorphs in the human kidney are environment-specific.',
    venue: 'Acta Biomaterialia',
    kind: 'journal',
  },
  {
    year: '2026',
    cite: '**Greenfield B**, Srirangapatanam S, Stoller M, Mena J, Webb S, Ho SP. Physicochemical remodeling of human renal papilla in calcium oxalate stone pathogenesis.',
    venue: 'AUA National',
    kind: 'podium',
  },
  {
    year: '2026',
    cite: 'Leng L, Suarez P, Momodu M, Jhandi A, **Greenfield B**, Bayne B. Identifying social determinants of health associated with same-day cancellations for urologic surgery.',
    venue: 'AUA National',
    kind: 'abstract',
  },
  {
    year: '2026',
    cite: 'Momodu M, **Greenfield B**, Leng L, Camargo F, Bowman M, Chi T. Patient decisional regret after holmium laser enucleation of the prostate (HoLEP): a mixed-methods study.',
    venue: 'AUA National',
    kind: 'abstract',
  },
  {
    year: '2026',
    cite: '**Greenfield B**, Srirangapatanam S, Stoller M, Mena J, Webb S, Ho SP. Zinc enrichment and organic–inorganic interplay in human renal plaques and stones.',
    venue: 'AUA ROCK Society',
    kind: 'podium',
  },
  {
    year: '2026',
    cite: 'Abduljaleel A, Davidowitz C, Dong G, Ghildiyal A, **Greenfield B**, Hossain M, Mistry A, Sousa M, Vallecha S, Yung Z, Zhu C, Siegel M. Historical and modern-day redlining as predictors of firearm homicide: a nationwide study.',
    venue: 'Tufts Race & Racism',
    kind: 'lecture',
  },
  {
    year: '2025',
    cite: 'Abduljaleel A, Davidowitz C, Dong G, Ghildiyal A, **Greenfield B**, Hossain M, Mistry A, Sousa M, Vallecha S, Yung Z, Zhu C, Siegel M. The impact of historical and modern-day redlining on firearm violence: a decade-long multilevel study of 38 states.',
    venue: 'J Racial Ethn Health Disparities',
    kind: 'journal',
  },
  {
    year: '2025',
    cite: 'Momodu M, Leng L, Suarez P, Jhandi A, **Greenfield B**, Bayne B. Social predictors of no-shows at an urban, safety-net urology clinic: a mixed-effects model study.',
    venue: 'AUA Western',
    kind: 'abstract',
  },
  {
    year: '2025',
    cite: 'Leng L, Suarez P, Momodu M, Jhandi A, **Greenfield B**, Bayne B. Identifying social determinants of health associated with same-day cancellations for urologic surgery.',
    venue: 'AUA Western',
    kind: 'abstract',
  },
  {
    year: '2025',
    cite: 'Abduljaleel A, Davidowitz C, Dong G, Ghildiyal A, **Greenfield B**, Hossain M, Mistry A, Sousa M, Vallecha S, Yung Z, Zhu C, Siegel M. Structural racism and firearm homicide.',
    venue: 'TUSM Guest Lecture',
    kind: 'lecture',
  },
  {
    year: '2023',
    cite: '**Greenfield JB**. Systems and methods for imaging and analyzing a microscopic sample.',
    venue: 'US20230204935A1',
    kind: 'patent',
  },
  {
    year: '2023',
    cite: '**Greenfield JB**. System and method for impact detection and analysis.',
    venue: 'US20230222795A1',
    kind: 'patent',
  },
  {
    year: '2020',
    cite: '**Greenfield B**, Leibowiz D, Perna J, Chen I; ViveSense Team. Oral presentation, Medtronic Design Competition.',
    venue: 'BMES 2020',
    kind: 'podium',
  },
  {
    year: '2020',
    cite: '**Greenfield B**, Leonard EF. Interdialytic blood volume control for ambulatory extracorporeal therapy.',
    venue: 'ASAIO 2020',
    kind: 'poster',
  },
  {
    year: '2020',
    cite: 'Faria M, **Greenfield B**, Leonard EF. Ultrafiltration of high protein concentration solutions through hollow-fiber filters.',
    venue: 'ASAIO 2020',
    kind: 'poster',
  },
  {
    year: '2017',
    cite: 'Basri N, Cuevas B, Fang J, **Greenfield B**, Kim A, Lian N, Oikomonou P, Srinivasan T, Wang H. Bacteria-mediated oncogene silencing as living cancer therapeutic.',
    venue: 'iGEM Jamboree',
    kind: 'podium',
  },
  {
    year: '2017',
    cite: 'Basri N, Cuevas B, Fang J, **Greenfield B**, Kim A, Lian N, Oikomonou P, Srinivasan T, Wang H. SilenshR: bacteria-mediated oncogene silencing as living cancer therapeutic.',
    venue: 'iGEM Jamboree',
    kind: 'poster',
  },
];
