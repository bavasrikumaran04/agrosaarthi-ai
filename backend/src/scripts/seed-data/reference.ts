/**
 * Reference data for crops and diseases.
 * - `modelClassKeys` are the exact PlantVillage folder names used as image-model labels.
 * - Tamil names are machine-assisted and PENDING NATIVE-SPEAKER REVIEW.
 * - Causal agents are given only where well established; otherwise left empty.
 * This is reference vocabulary, not agricultural advice.
 */
import type { DiseaseType } from '../../db/models/disease.model.js';

export interface CropSeed {
  key: string;
  en: string;
  ta: string;
  synonyms?: { en?: string[]; ta?: string[] };
  scientificName?: string;
  supportedByModel: boolean;
}

export interface DiseaseSeed {
  key: string;
  cropKey: string;
  type: DiseaseType;
  en: string;
  ta: string;
  causalAgent?: string;
  modelClassKeys: string[];
}

const TAMIL_NOTE = 'Tamil names machine-assisted; pending native-speaker review.';
export const SEED_NOTES = TAMIL_NOTE;

export const CROPS: CropSeed[] = [
  { key: 'tomato', en: 'Tomato', ta: 'தக்காளி', synonyms: { en: ['thakkali'], ta: ['தக்காளிச் செடி'] }, scientificName: 'Solanum lycopersicum', supportedByModel: true },
  { key: 'potato', en: 'Potato', ta: 'உருளைக்கிழங்கு', synonyms: { en: ['urulai'], ta: ['உருளை'] }, scientificName: 'Solanum tuberosum', supportedByModel: true },
  { key: 'maize', en: 'Maize (corn)', ta: 'மக்காச்சோளம்', synonyms: { en: ['corn', 'makka cholam'], ta: ['சோளம்'] }, scientificName: 'Zea mays', supportedByModel: true },
  { key: 'pepper_bell', en: 'Bell pepper (capsicum)', ta: 'குடைமிளகாய்', synonyms: { en: ['capsicum', 'kudai milagai'] }, scientificName: 'Capsicum annuum', supportedByModel: true },
  { key: 'grape', en: 'Grape', ta: 'திராட்சை', synonyms: { en: ['thiratchai'] }, scientificName: 'Vitis vinifera', supportedByModel: true },
  { key: 'apple', en: 'Apple', ta: 'ஆப்பிள்', scientificName: 'Malus domestica', supportedByModel: true },
  { key: 'cherry', en: 'Cherry', ta: 'செர்ரி', scientificName: 'Prunus spp.', supportedByModel: true },
  { key: 'orange', en: 'Orange (citrus)', ta: 'ஆரஞ்சு', synonyms: { en: ['citrus'], ta: ['கமலா', 'சாத்துக்குடி'] }, scientificName: 'Citrus spp.', supportedByModel: true },
  { key: 'peach', en: 'Peach', ta: 'பீச்', scientificName: 'Prunus persica', supportedByModel: true },
  { key: 'strawberry', en: 'Strawberry', ta: 'ஸ்ட்ராபெர்ரி', scientificName: 'Fragaria × ananassa', supportedByModel: true },
  { key: 'squash', en: 'Squash', ta: 'பூசணி', synonyms: { ta: ['சுரை'] }, scientificName: 'Cucurbita spp.', supportedByModel: true },
  { key: 'blueberry', en: 'Blueberry', ta: 'புளுபெர்ரி', scientificName: 'Vaccinium spp.', supportedByModel: true },
  { key: 'raspberry', en: 'Raspberry', ta: 'ராஸ்பெர்ரி', scientificName: 'Rubus idaeus', supportedByModel: true },
  { key: 'soybean', en: 'Soybean', ta: 'சோயாபீன்ஸ்', scientificName: 'Glycine max', supportedByModel: true },
  // Important Tamil Nadu crops the current image model does NOT cover.
  { key: 'rice', en: 'Rice (paddy)', ta: 'நெல்', synonyms: { en: ['paddy', 'nel'], ta: ['அரிசி', 'நெற்பயிர்'] }, scientificName: 'Oryza sativa', supportedByModel: false },
  { key: 'banana', en: 'Banana', ta: 'வாழை', synonyms: { en: ['vazhai'] }, scientificName: 'Musa spp.', supportedByModel: false },
  { key: 'coconut', en: 'Coconut', ta: 'தென்னை', synonyms: { en: ['thennai'], ta: ['தேங்காய்'] }, scientificName: 'Cocos nucifera', supportedByModel: false },
  { key: 'sugarcane', en: 'Sugarcane', ta: 'கரும்பு', synonyms: { en: ['karumbu'] }, scientificName: 'Saccharum officinarum', supportedByModel: false },
  { key: 'cotton', en: 'Cotton', ta: 'பருத்தி', synonyms: { en: ['paruthi'] }, scientificName: 'Gossypium spp.', supportedByModel: false },
  { key: 'groundnut', en: 'Groundnut', ta: 'நிலக்கடலை', synonyms: { en: ['peanut', 'kadalai'], ta: ['கடலை'] }, scientificName: 'Arachis hypogaea', supportedByModel: false },
  { key: 'chilli', en: 'Chilli', ta: 'மிளகாய்', synonyms: { en: ['milagai'] }, scientificName: 'Capsicum annuum', supportedByModel: false },
  { key: 'brinjal', en: 'Brinjal (eggplant)', ta: 'கத்தரி', synonyms: { en: ['eggplant', 'kathiri'], ta: ['கத்தரிக்காய்'] }, scientificName: 'Solanum melongena', supportedByModel: false },
  { key: 'onion', en: 'Onion', ta: 'வெங்காயம்', synonyms: { en: ['vengayam'] }, scientificName: 'Allium cepa', supportedByModel: false },
  { key: 'turmeric', en: 'Turmeric', ta: 'மஞ்சள்', synonyms: { en: ['manjal'] }, scientificName: 'Curcuma longa', supportedByModel: false },
  { key: 'mango', en: 'Mango', ta: 'மா', synonyms: { en: ['maambazham'], ta: ['மாம்பழம்', 'மாமரம்'] }, scientificName: 'Mangifera indica', supportedByModel: false },
];

const d = (
  key: string,
  cropKey: string,
  type: DiseaseType,
  en: string,
  ta: string,
  classKey: string,
  causalAgent?: string,
): DiseaseSeed => ({ key, cropKey, type, en, ta, causalAgent, modelClassKeys: [classKey] });

export const DISEASES: DiseaseSeed[] = [
  d('apple_scab', 'apple', 'FUNGAL', 'Apple scab', 'ஆப்பிள் சொறி நோய்', 'Apple___Apple_scab', 'Venturia inaequalis'),
  d('apple_black_rot', 'apple', 'FUNGAL', 'Apple black rot', 'ஆப்பிள் கருப்பு அழுகல்', 'Apple___Black_rot'),
  d('apple_cedar_rust', 'apple', 'FUNGAL', 'Cedar apple rust', 'ஆப்பிள் துரு நோய்', 'Apple___Cedar_apple_rust', 'Gymnosporangium juniperi-virginianae'),
  d('apple_healthy', 'apple', 'HEALTHY', 'Healthy apple leaf', 'ஆரோக்கியமான ஆப்பிள் இலை', 'Apple___healthy'),
  d('blueberry_healthy', 'blueberry', 'HEALTHY', 'Healthy blueberry leaf', 'ஆரோக்கியமான புளுபெர்ரி இலை', 'Blueberry___healthy'),
  d('cherry_powdery_mildew', 'cherry', 'FUNGAL', 'Cherry powdery mildew', 'செர்ரி சாம்பல் நோய்', 'Cherry_(including_sour)___Powdery_mildew'),
  d('cherry_healthy', 'cherry', 'HEALTHY', 'Healthy cherry leaf', 'ஆரோக்கியமான செர்ரி இலை', 'Cherry_(including_sour)___healthy'),
  d('maize_gray_leaf_spot', 'maize', 'FUNGAL', 'Maize gray leaf spot (Cercospora)', 'மக்காச்சோள சாம்பல் இலைப்புள்ளி நோய்', 'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot', 'Cercospora zeae-maydis'),
  d('maize_common_rust', 'maize', 'FUNGAL', 'Maize common rust', 'மக்காச்சோள துரு நோய்', 'Corn_(maize)___Common_rust_', 'Puccinia sorghi'),
  d('maize_northern_leaf_blight', 'maize', 'FUNGAL', 'Maize northern leaf blight', 'மக்காச்சோள இலைக் கருகல் நோய்', 'Corn_(maize)___Northern_Leaf_Blight', 'Exserohilum turcicum'),
  d('maize_healthy', 'maize', 'HEALTHY', 'Healthy maize leaf', 'ஆரோக்கியமான மக்காச்சோள இலை', 'Corn_(maize)___healthy'),
  d('grape_black_rot', 'grape', 'FUNGAL', 'Grape black rot', 'திராட்சை கருப்பு அழுகல்', 'Grape___Black_rot', 'Guignardia bidwellii'),
  d('grape_esca', 'grape', 'FUNGAL', 'Grape esca (black measles)', 'திராட்சை எஸ்கா நோய்', 'Grape___Esca_(Black_Measles)'),
  d('grape_leaf_blight', 'grape', 'FUNGAL', 'Grape leaf blight (Isariopsis leaf spot)', 'திராட்சை இலைக் கருகல்', 'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)'),
  d('grape_healthy', 'grape', 'HEALTHY', 'Healthy grape leaf', 'ஆரோக்கியமான திராட்சை இலை', 'Grape___healthy'),
  d('orange_huanglongbing', 'orange', 'BACTERIAL', 'Citrus greening (Huanglongbing)', 'சிட்ரஸ் பசுமை இழப்பு நோய்', 'Orange___Haunglongbing_(Citrus_greening)', "'Candidatus Liberibacter' spp."),
  d('peach_bacterial_spot', 'peach', 'BACTERIAL', 'Peach bacterial spot', 'பீச் பாக்டீரியா புள்ளி நோய்', 'Peach___Bacterial_spot', 'Xanthomonas arboricola pv. pruni'),
  d('peach_healthy', 'peach', 'HEALTHY', 'Healthy peach leaf', 'ஆரோக்கியமான பீச் இலை', 'Peach___healthy'),
  d('pepper_bell_bacterial_spot', 'pepper_bell', 'BACTERIAL', 'Bell pepper bacterial spot', 'குடைமிளகாய் பாக்டீரியா புள்ளி நோய்', 'Pepper,_bell___Bacterial_spot', 'Xanthomonas spp.'),
  d('pepper_bell_healthy', 'pepper_bell', 'HEALTHY', 'Healthy bell pepper leaf', 'ஆரோக்கியமான குடைமிளகாய் இலை', 'Pepper,_bell___healthy'),
  d('potato_early_blight', 'potato', 'FUNGAL', 'Potato early blight', 'உருளைக்கிழங்கு முன் கருகல் நோய்', 'Potato___Early_blight', 'Alternaria solani'),
  d('potato_late_blight', 'potato', 'OTHER', 'Potato late blight', 'உருளைக்கிழங்கு பின் கருகல் நோய்', 'Potato___Late_blight', 'Phytophthora infestans (oomycete)'),
  d('potato_healthy', 'potato', 'HEALTHY', 'Healthy potato leaf', 'ஆரோக்கியமான உருளைக்கிழங்கு இலை', 'Potato___healthy'),
  d('raspberry_healthy', 'raspberry', 'HEALTHY', 'Healthy raspberry leaf', 'ஆரோக்கியமான ராஸ்பெர்ரி இலை', 'Raspberry___healthy'),
  d('soybean_healthy', 'soybean', 'HEALTHY', 'Healthy soybean leaf', 'ஆரோக்கியமான சோயாபீன்ஸ் இலை', 'Soybean___healthy'),
  d('squash_powdery_mildew', 'squash', 'FUNGAL', 'Squash powdery mildew', 'பூசணி சாம்பல் நோய்', 'Squash___Powdery_mildew'),
  d('strawberry_leaf_scorch', 'strawberry', 'FUNGAL', 'Strawberry leaf scorch', 'ஸ்ட்ராபெர்ரி இலைக் கருகல்', 'Strawberry___Leaf_scorch', 'Diplocarpon earlianum'),
  d('strawberry_healthy', 'strawberry', 'HEALTHY', 'Healthy strawberry leaf', 'ஆரோக்கியமான ஸ்ட்ராபெர்ரி இலை', 'Strawberry___healthy'),
  d('tomato_bacterial_spot', 'tomato', 'BACTERIAL', 'Tomato bacterial spot', 'தக்காளி பாக்டீரியா புள்ளி நோய்', 'Tomato___Bacterial_spot', 'Xanthomonas spp.'),
  d('tomato_early_blight', 'tomato', 'FUNGAL', 'Tomato early blight', 'தக்காளி முன் கருகல் நோய்', 'Tomato___Early_blight', 'Alternaria solani'),
  d('tomato_late_blight', 'tomato', 'OTHER', 'Tomato late blight', 'தக்காளி பின் கருகல் நோய்', 'Tomato___Late_blight', 'Phytophthora infestans (oomycete)'),
  d('tomato_leaf_mold', 'tomato', 'FUNGAL', 'Tomato leaf mould', 'தக்காளி இலைப் பூஞ்சை நோய்', 'Tomato___Leaf_Mold', 'Passalora fulva'),
  d('tomato_septoria_leaf_spot', 'tomato', 'FUNGAL', 'Tomato Septoria leaf spot', 'தக்காளி செப்டோரியா இலைப்புள்ளி', 'Tomato___Septoria_leaf_spot', 'Septoria lycopersici'),
  d('tomato_spider_mite', 'tomato', 'PEST', 'Two-spotted spider mite on tomato', 'தக்காளி சிலந்திப் பேன்', 'Tomato___Spider_mites Two-spotted_spider_mite', 'Tetranychus urticae'),
  d('tomato_target_spot', 'tomato', 'FUNGAL', 'Tomato target spot', 'தக்காளி இலக்குப் புள்ளி நோய்', 'Tomato___Target_Spot', 'Corynespora cassiicola'),
  d('tomato_yellow_leaf_curl', 'tomato', 'VIRAL', 'Tomato yellow leaf curl virus', 'தக்காளி மஞ்சள் இலைச் சுருள் நோய்', 'Tomato___Tomato_Yellow_Leaf_Curl_Virus', 'Tomato yellow leaf curl virus (whitefly-transmitted)'),
  d('tomato_mosaic_virus', 'tomato', 'VIRAL', 'Tomato mosaic virus', 'தக்காளி தேமல் நோய்', 'Tomato___Tomato_mosaic_virus', 'Tomato mosaic virus'),
  d('tomato_healthy', 'tomato', 'HEALTHY', 'Healthy tomato leaf', 'ஆரோக்கியமான தக்காளி இலை', 'Tomato___healthy'),
];
