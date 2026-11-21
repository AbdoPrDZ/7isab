/**
 * Built-in Testaments. Ayat are quoted word for word (imlaei text from the
 * quran.com API v4) and always shown in Arabic with their reference; they are
 * never translated here. Advice keys are translated (`testaments.advice.*`).
 * Athkar are recited in Arabic, so they are never translated either; the ones
 * the Athkar screen has are taken from it so the text is the same everywhere.
 */
import { BUILT_IN_ATHKAR } from '@/lib/athkar/data';
import type { TestamentCategory } from '@/lib/ledger/types';

export type AyahPreset = {
  key: string;
  category: TestamentCategory;
  kind: 'ayah';
  text: string;
  surah: number;
  /** Ayah number or range, e.g. "133" or "40–41". */
  ayat: string;
};

export type AdvicePreset = { key: string; category: TestamentCategory; kind: 'advice' };

/** A dhikr to say (Arabic only). */
export type DhikrPreset = { key: string; category: TestamentCategory; kind: 'dhikr'; text: string };

export type TestamentPreset = AyahPreset | AdvicePreset | DhikrPreset;

const ayah = (key: string, category: TestamentCategory, surah: number, ayat: string, text: string): AyahPreset => ({
  key,
  category,
  kind: 'ayah',
  surah,
  ayat,
  text,
});
const advice = (key: string, category: TestamentCategory): AdvicePreset => ({ key, category, kind: 'advice' });
const dhikr = (key: string, text: string): DhikrPreset => ({ key, category: 'athkar', kind: 'dhikr', text });

/** A dhikr from the built-in athkar lists, by its id there. */
function fromAthkar(id: string): string {
  for (const list of Object.values(BUILT_IN_ATHKAR)) {
    const found = list.find((item) => item.id === id);
    if (found) return found.text;
  }
  throw new Error(`No built-in dhikr "${id}"`);
}

export const TESTAMENT_PRESETS: TestamentPreset[] = [
  // Jannah
  ayah('q3_133', 'jannah', 3, '133', 'وَسَارِعُوا إِلَىٰ مَغْفِرَةٍ مِّن رَّبِّكُمْ وَجَنَّةٍ عَرْضُهَا السَّمَاوَاتُ وَالْأَرْضُ أُعِدَّتْ لِلْمُتَّقِينَ'),
  ayah('q32_17', 'jannah', 32, '17', 'فَلَا تَعْلَمُ نَفْسٌ مَّا أُخْفِيَ لَهُم مِّن قُرَّةِ أَعْيُنٍ جَزَاءً بِمَا كَانُوا يَعْمَلُونَ'),
  ayah('q79_40', 'jannah', 79, '40–41', 'وَأَمَّا مَنْ خَافَ مَقَامَ رَبِّهِ وَنَهَى النَّفْسَ عَنِ الْهَوَىٰ ۝ فَإِنَّ الْجَنَّةَ هِيَ الْمَأْوَىٰ'),
  ayah('q57_21', 'jannah', 57, '21', 'سَابِقُوا إِلَىٰ مَغْفِرَةٍ مِّن رَّبِّكُمْ وَجَنَّةٍ عَرْضُهَا كَعَرْضِ السَّمَاءِ وَالْأَرْضِ أُعِدَّتْ لِلَّذِينَ آمَنُوا بِاللَّهِ وَرُسُلِهِ ۚ ذَٰلِكَ فَضْلُ اللَّهِ يُؤْتِيهِ مَن يَشَاءُ ۚ وَاللَّهُ ذُو الْفَضْلِ الْعَظِيمِ'),
  advice('jannahPrayer', 'jannah'),
  advice('jannahPatience', 'jannah'),

  // Nar
  ayah('q66_6', 'nar', 66, '6', 'يَا أَيُّهَا الَّذِينَ آمَنُوا قُوا أَنفُسَكُمْ وَأَهْلِيكُمْ نَارًا وَقُودُهَا النَّاسُ وَالْحِجَارَةُ عَلَيْهَا مَلَائِكَةٌ غِلَاظٌ شِدَادٌ لَّا يَعْصُونَ اللَّهَ مَا أَمَرَهُمْ وَيَفْعَلُونَ مَا يُؤْمَرُونَ'),
  ayah('q3_185', 'nar', 3, '185', 'كُلُّ نَفْسٍ ذَائِقَةُ الْمَوْتِ ۗ وَإِنَّمَا تُوَفَّوْنَ أُجُورَكُمْ يَوْمَ الْقِيَامَةِ ۖ فَمَن زُحْزِحَ عَنِ النَّارِ وَأُدْخِلَ الْجَنَّةَ فَقَدْ فَازَ ۗ وَمَا الْحَيَاةُ الدُّنْيَا إِلَّا مَتَاعُ الْغُرُورِ'),
  ayah('q74_42', 'nar', 74, '42–43', 'مَا سَلَكَكُمْ فِي سَقَرَ ۝ قَالُوا لَمْ نَكُ مِنَ الْمُصَلِّينَ'),
  advice('narSins', 'nar'),
  advice('narTongue', 'nar'),

  // Akhira
  ayah('q99_7', 'akhira', 99, '7–8', 'فَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ ۝ وَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ شَرًّا يَرَهُ'),
  ayah('q59_18', 'akhira', 59, '18', 'يَا أَيُّهَا الَّذِينَ آمَنُوا اتَّقُوا اللَّهَ وَلْتَنظُرْ نَفْسٌ مَّا قَدَّمَتْ لِغَدٍ ۖ وَاتَّقُوا اللَّهَ ۚ إِنَّ اللَّهَ خَبِيرٌ بِمَا تَعْمَلُونَ'),
  ayah('q13_28', 'akhira', 13, '28', 'الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ'),
  ayah('q2_152', 'akhira', 2, '152', 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ'),
  advice('akhiraIstighfar', 'akhira'),
  advice('akhiraQuran', 'akhira'),
  advice('akhiraParents', 'akhira'),
  advice('akhiraSadaqa', 'akhira'),

  // Dunya
  ayah('q18_46', 'dunya', 18, '46', 'الْمَالُ وَالْبَنُونَ زِينَةُ الْحَيَاةِ الدُّنْيَا ۖ وَالْبَاقِيَاتُ الصَّالِحَاتُ خَيْرٌ عِندَ رَبِّكَ ثَوَابًا وَخَيْرٌ أَمَلًا'),
  ayah('q25_67', 'dunya', 25, '67', 'وَالَّذِينَ إِذَا أَنفَقُوا لَمْ يُسْرِفُوا وَلَمْ يَقْتُرُوا وَكَانَ بَيْنَ ذَٰلِكَ قَوَامًا'),
  ayah('q17_29', 'dunya', 17, '29', 'وَلَا تَجْعَلْ يَدَكَ مَغْلُولَةً إِلَىٰ عُنُقِكَ وَلَا تَبْسُطْهَا كُلَّ الْبَسْطِ فَتَقْعُدَ مَلُومًا مَّحْسُورًا'),
  ayah('q65_2', 'dunya', 65, '2–3', '... وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا ۝ وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ ...'),
  advice('dunyaSpend', 'dunya'),
  advice('dunyaDebts', 'dunya'),
  advice('dunyaSleep', 'dunya'),
  advice('dunyaHealth', 'dunya'),

  // Added later: new keys go at the end so existing ones keep their order.
  // Jannah
  ayah('q55_46', 'jannah', 55, '46', 'وَلِمَنْ خَافَ مَقَامَ رَبِّهِ جَنَّتَانِ'),
  ayah('q18_107', 'jannah', 18, '107', 'إِنَّ الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ كَانَتْ لَهُمْ جَنَّاتُ الْفِرْدَوْسِ نُزُلًا'),
  ayah('q36_55', 'jannah', 36, '55', 'إِنَّ أَصْحَابَ الْجَنَّةِ الْيَوْمَ فِي شُغُلٍ فَاكِهُونَ'),
  ayah('q76_12', 'jannah', 76, '12', 'وَجَزَاهُم بِمَا صَبَرُوا جَنَّةً وَحَرِيرًا'),
  advice('jannahIntention', 'jannah'),
  advice('jannahHidden', 'jannah'),
  advice('jannahForgive', 'jannah'),
  advice('jannahFajr', 'jannah'),

  // Nar
  ayah('q3_131', 'nar', 3, '131', 'وَاتَّقُوا النَّارَ الَّتِي أُعِدَّتْ لِلْكَافِرِينَ'),
  ayah('q89_23', 'nar', 89, '23–24', 'وَجِيءَ يَوْمَئِذٍ بِجَهَنَّمَ ۚ يَوْمَئِذٍ يَتَذَكَّرُ الْإِنسَانُ وَأَنَّىٰ لَهُ الذِّكْرَىٰ ۝ يَقُولُ يَا لَيْتَنِي قَدَّمْتُ لِحَيَاتِي'),
  ayah('q104_1', 'nar', 104, '1', 'وَيْلٌ لِّكُلِّ هُمَزَةٍ لُّمَزَةٍ'),
  ayah('q107_4', 'nar', 107, '4–5', 'فَوَيْلٌ لِّلْمُصَلِّينَ ۝ الَّذِينَ هُمْ عَن صَلَاتِهِمْ سَاهُونَ'),
  advice('narDelay', 'nar'),
  advice('narRights', 'nar'),
  advice('narGaze', 'nar'),
  advice('narAnger', 'nar'),

  // Akhira
  ayah('q50_18', 'akhira', 50, '18', 'مَّا يَلْفِظُ مِن قَوْلٍ إِلَّا لَدَيْهِ رَقِيبٌ عَتِيدٌ'),
  ayah('q2_45', 'akhira', 2, '45', 'وَاسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ وَإِنَّهَا لَكَبِيرَةٌ إِلَّا عَلَى الْخَاشِعِينَ'),
  ayah('q39_53', 'akhira', 39, '53', 'قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ ۚ إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا ۚ إِنَّهُ هُوَ الْغَفُورُ الرَّحِيمُ'),
  ayah('q94_5', 'akhira', 94, '5–6', 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا'),
  ayah('q17_24', 'akhira', 17, '24', 'وَاخْفِضْ لَهُمَا جَنَاحَ الذُّلِّ مِنَ الرَّحْمَةِ وَقُل رَّبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا'),
  ayah('q11_114', 'akhira', 11, '114', 'وَأَقِمِ الصَّلَاةَ طَرَفَيِ النَّهَارِ وَزُلَفًا مِّنَ اللَّيْلِ ۚ إِنَّ الْحَسَنَاتِ يُذْهِبْنَ السَّيِّئَاتِ ۚ ذَٰلِكَ ذِكْرَىٰ لِلذَّاكِرِينَ'),
  ayah('q4_110', 'akhira', 4, '110', 'وَمَن يَعْمَلْ سُوءًا أَوْ يَظْلِمْ نَفْسَهُ ثُمَّ يَسْتَغْفِرِ اللَّهَ يَجِدِ اللَّهَ غَفُورًا رَّحِيمًا'),
  ayah('q3_200', 'akhira', 3, '200', 'يَا أَيُّهَا الَّذِينَ آمَنُوا اصْبِرُوا وَصَابِرُوا وَرَابِطُوا وَاتَّقُوا اللَّهَ لَعَلَّكُمْ تُفْلِحُونَ'),
  ayah('q23_115', 'akhira', 23, '115', 'أَفَحَسِبْتُمْ أَنَّمَا خَلَقْنَاكُمْ عَبَثًا وَأَنَّكُمْ إِلَيْنَا لَا تُرْجَعُونَ'),
  ayah('q102_8', 'akhira', 102, '8', 'ثُمَّ لَتُسْأَلُنَّ يَوْمَئِذٍ عَنِ النَّعِيمِ'),
  ayah('q3_134', 'akhira', 3, '134', 'الَّذِينَ يُنفِقُونَ فِي السَّرَّاءِ وَالضَّرَّاءِ وَالْكَاظِمِينَ الْغَيْظَ وَالْعَافِينَ عَنِ النَّاسِ ۗ وَاللَّهُ يُحِبُّ الْمُحْسِنِينَ'),
  ayah('q2_286', 'akhira', 2, '286', '... لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ...'),
  advice('akhiraNight', 'akhira'),
  advice('akhiraReview', 'akhira'),
  advice('akhiraDeath', 'akhira'),
  advice('akhiraKin', 'akhira'),

  // Dunya
  ayah('q2_276', 'dunya', 2, '276', 'يَمْحَقُ اللَّهُ الرِّبَا وَيُرْبِي الصَّدَقَاتِ ۗ وَاللَّهُ لَا يُحِبُّ كُلَّ كَفَّارٍ أَثِيمٍ'),
  ayah('q7_31', 'dunya', 7, '31', '... وَكُلُوا وَاشْرَبُوا وَلَا تُسْرِفُوا ...'),
  ayah('q2_280', 'dunya', 2, '280', 'وَإِن كَانَ ذُو عُسْرَةٍ فَنَظِرَةٌ إِلَىٰ مَيْسَرَةٍ ۚ وَأَن تَصَدَّقُوا خَيْرٌ لَّكُمْ ۖ إِن كُنتُمْ تَعْلَمُونَ'),
  ayah('q17_27', 'dunya', 17, '27', 'إِنَّ الْمُبَذِّرِينَ كَانُوا إِخْوَانَ الشَّيَاطِينِ ۖ وَكَانَ الشَّيْطَانُ لِرَبِّهِ كَفُورًا'),
  ayah('q62_10', 'dunya', 62, '10', 'فَإِذَا قُضِيَتِ الصَّلَاةُ فَانتَشِرُوا فِي الْأَرْضِ وَابْتَغُوا مِن فَضْلِ اللَّهِ وَاذْكُرُوا اللَّهَ كَثِيرًا لَّعَلَّكُمْ تُفْلِحُونَ'),
  ayah('q28_77', 'dunya', 28, '77', '... وَابْتَغِ فِيمَا آتَاكَ اللَّهُ الدَّارَ الْآخِرَةَ ۖ وَلَا تَنسَ نَصِيبَكَ مِنَ الدُّنْيَا ...'),
  advice('dunyaBudget', 'dunya'),
  advice('dunyaZakat', 'dunya'),
  advice('dunyaWork', 'dunya'),
  advice('dunyaLearn', 'dunya'),
  advice('dunyaPlan', 'dunya'),

  // Athkar
  dhikr('dSubhanBihamdih', fromAthkar('subhan-bihamdih')),
  dhikr('dSubhanAzim', 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ'),
  dhikr('dBaqiyat', 'سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَٰهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ'),
  dhikr('dHawqala', 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ'),
  dhikr('dTahlil', fromAthkar('tahlil')),
  dhikr('dIstighfar', fromAthkar('istighfar')),
  dhikr('dSayyid', fromAthkar('sayyid')),
  dhikr('dSalawat', 'اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَىٰ نَبِيِّنَا مُحَمَّدٍ'),
  dhikr('dHasbiyallah', fromAthkar('hasbiyallah')),
  dhikr('dRaditu', fromAthkar('raditu')),
  dhikr('dBismillah', fromAthkar('bismillah-la-yadur')),
  dhikr('dAinni', 'اللَّهُمَّ أَعِنِّي عَلَىٰ ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ'),
  ayah('q2_201', 'athkar', 2, '201', '... رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ ...'),
  ayah('q21_87', 'athkar', 21, '87', '... لَّا إِلَٰهَ إِلَّا أَنتَ سُبْحَانَكَ إِنِّي كُنتُ مِنَ الظَّالِمِينَ ...'),
  ayah('q20_114', 'athkar', 20, '114', '... رَّبِّ زِدْنِي عِلْمًا ...'),
  ayah('q3_173', 'athkar', 3, '173', '... حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ ...'),
  ayah('q7_23', 'athkar', 7, '23', '... رَبَّنَا ظَلَمْنَا أَنفُسَنَا وَإِن لَّمْ تَغْفِرْ لَنَا وَتَرْحَمْنَا لَنَكُونَنَّ مِنَ الْخَاسِرِينَ ...'),
];

export const PRESETS_BY_KEY = new Map(TESTAMENT_PRESETS.map((preset) => [preset.key, preset]));
