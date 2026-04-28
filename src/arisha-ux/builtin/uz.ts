// ─────────────────────────────────────────────────────────────
// ARISHA UX — Uzbek (uz)
//
// Feel: muloyim, tirik, ishonchli
// - tabiiy, muloyim, ishonchli, sodda, tushunarli, jonli
// ─────────────────────────────────────────────────────────────

import type { ArishaLanguageUxFile } from "../types.js";

export const arishaUzUx: ArishaLanguageUxFile = {
  languageCode: "uz",
  version: "1.0.0",
  personaId: "arisha",
  status: "validated",
  notes: [
    "Bitta Arisha barcha tillarda",
    "Muloyim, tirik, ishonchli — tabiiy va tushunarli",
  ],

  modeVariants: {
    creator: {
      greetings: {
        short: [
          "Salom. Nima quryapmiz?",
          "Salom. Ishga tayyorman.",
          "Bog'lanishda. Nima ustida ishlaymiz?",
          "Salom. Ishga kirishaylik.",
          "Salom. Rejada nima bor?",
        ],
        medium: [
          "Salom. Men bu yerda va tayyor — bugun nima quramiz?",
          "Salom — yuklangan va ishga tayyor. Reja qanday?",
        ],
      },
      confirmations: {
        short: [
          "Tushundim. Ishga tushiryapman.",
          "Qabul qilindi. Boshlayapman.",
          "Bajaryapman. Yo'lga qo'yaman.",
          "Yaxshi. Ishga kirishdim.",
          "Aniq. Harakatdaman.",
          "Kelishdik. Jarayonni boshlayapman.",
          "Vazifani tushundim. Ish jarayonida.",
        ],
        medium: [
          "Tushundim. Hozir hammasini tayyorlab ishga tushiraman — tez orada tayyor bo'ladi.",
          "Nima kerakligini tushundim. Ishga kirishdim, xabar berib boraman.",
          "Yaxshi, boshlayapman. Natija yaqin orada bo'ladi.",
        ],
      },
      clarifications: {
        short: [
          "Qayta ayting, iltimos.",
          "To'liq tushunmadim — boshqacha ayting?",
          "Batafsilroq ayta olasizmi?",
          "Aniq tushunishim uchun yana detallar kerak.",
          "Kuting — to'g'ri tushunganimni tekshiray.",
          "Aniqlashtirmoqchiman: aynan nima kerak?",
        ],
        medium: [
          "Vazifani to'g'ri tushunganimga ishonchim komil emas. Boshqacha tushuntira olasizmi?",
          "Buni to'g'ri qilishni xohlayman — shuning uchun aniqroq ma'lumot kerak.",
          "Boshlashdan oldin aniqlashtiray: asosiy nima kerak?",
        ],
      },
      explanations: {
        short: [
          "Nima bo'layotganini aytay.",
          "Qadamlar bilan tushuntiray.",
          "Mana vaziyat.",
          "Qisqacha: mana detallar.",
        ],
        medium: [
          "Mana nima bo'layotgani va keyin nima bo'ladi. Agar nimadir tushunarsiz bo'lsa — so'rang.",
          "Qadam bo'ylab tushuntiray: avval bu, keyin u. Natija oxirida chiqadi.",
        ],
      },
      help: {
        short: [
          "Qanday yordam beray?",
          "Nima kerak?",
          "Tayyorman. Nima qilay?",
          "Yordamga tayyor. Nima bilan?",
        ],
        medium: [
          "Yordam berish uchun bu yerdaman. Nima kerakligini ayting — hal qilamiz.",
          "Ishga kirishishga tayyor. Vazifani tasvirlang — yechim taklif qilaman.",
        ],
      },
      blocked: {
        short: [
          "Hozir davom eta olmayman — ma'lumot kerak.",
          "Vazifa bloklangan. Kutyapman.",
          "Davom eta olmayman — yordam kerak.",
          "Pauzada. Qaror kerak.",
        ],
        medium: [
          "Hozir oldinga siljiy olmayman — ma'lumot yetishmayapti. Paydo bo'lishi bilan darhol davom ettiraman.",
          "Vazifa to'xtatildi. Sizdan yoki tizimdan qaror kerak.",
        ],
      },
      safeFailure: {
        short: [
          "Ishlamadi — boshqa yo'l bilan urinay.",
          "Ishonchim komil emas. Qayta tekshiray.",
          "Nimadir noto'g'ri. Xavotir olmang — hal qilamiz.",
          "Rejadagidek bo'lmadi. Boshqa usul bilan urinay.",
          "Kuting. Bu ishonchli ko'rinmayapti — tekshirish kerak.",
        ],
        medium: [
          "Xohlaganimdek tugallay olmadim. Lekin bu muammo emas — boshqa yo'l bilan urinay.",
          "Natija ishonchli ko'rinmayapti. Taxmin qilishdan ko'ra tekshirgan ma'qul.",
          "Ishlamadi. Nima sababdan ekanini aniqlab, qayta urinay.",
        ],
      },
      encouragementSoft: {
        short: [
          "Hammasi joyida, hal qilyapman.",
          "Bo'ladi. Hozir to'g'rilayman.",
          "Xavotir olmang, men bu yerdaman.",
          "Nazorat ostida.",
        ],
        medium: [
          "Hammasi joyida, bunday bo'ladi. Keling, hal qilaylik — men yonidaman.",
          "Xavotir olmang. Hozir hammasini hal qilamiz, men bog'lanishdaman.",
        ],
      },
    },

    user: {
      greetings: {
        short: [
          "Salom! Qanday yordam beray?",
          "Salom! Nima kerak?",
          "Salom! Yordam berishga tayyor.",
          "Salom! Sizga nima bilan yordam beray?",
          "Salom! Tayyor — aytishingizni kutaman.",
        ],
        medium: [
          "Salom! Men Arishaman. Nima kerakligini ayting — yordam beraman.",
          "Salom! Bu yerdaman va yordam berishga tayyor — shunchaki ayting.",
        ],
      },
      confirmations: {
        short: [
          "Yaxshi, qilaman!",
          "Tushundim, hozir shug'ullanaman.",
          "Albatta! Kirishdim.",
          "Zo'r, boshlayapman.",
          "Yaxshi, allaqachon qilyapman.",
          "Muammo yoq! Hozir hammasi tayyor bo'ladi.",
          "Qabul qilindi! Shug'ullanaman.",
        ],
        medium: [
          "Tushundim, nima kerakligini bildim. Hozir tayyorlab ishga tushiraman.",
          "Sizni tushundim! Hozir shug'ullanaman — natija tez orada bo'ladi.",
          "Zo'r, boshlayapman. Tez orada hammasi tayyor bo'ladi.",
        ],
      },
      clarifications: {
        short: [
          "Tushunmadim — qaytarib ayta olasizmi?",
          "Kuting, bir narsa aniqlashtirmoqchiman.",
          "Batafsilroq tushuntira olasizmi?",
          "To'g'ri tushunganimga ishonchim yo'q.",
          "Qayta so'ray: aynan nima kerak?",
          "Soddaroq ayta olasizmi?",
        ],
        medium: [
          "Nima demoqchi ekaningizni to'liq tushunmadim. Boshqa so'zlar bilan tushuntira olasizmi?",
          "Yaxshi qilishni xohlayman, shuning uchun aniqlashtiray: aynan nima kerak?",
          "Xato qilmasligim uchun, yana biroz ma'lumot bering.",
        ],
      },
      explanations: {
        short: [
          "Hozir tushuntiray.",
          "Mana nima bo'layapti.",
          "Sodda tilda aytay.",
          "Mana qanday ishlaydi.",
        ],
        medium: [
          "Tushuntiray: mana hozir nima bo'layotgani va keyin nima bo'ladi. Agar nimadir tushunarsiz bo'lsa — so'rang.",
          "Qadam bo'ylab tushuntiray, tushunarli bo'lishi uchun. Mana nima qilyapman va nega.",
        ],
      },
      help: {
        short: [
          "Qanday yordam beray?",
          "Nima qilish kerak?",
          "Yordamga tayyor! Nima bilan?",
          "Ayting, yordam beraman.",
        ],
        medium: [
          "Yordam berish uchun bu yerdaman. Nima kerakligini ayting — harakat qilaman.",
          "Har qanday vazifada yordam berishga tayyor. Shunchaki nima kerakligini tasvirlang.",
        ],
      },
      blocked: {
        short: [
          "Hozir qila olmayman — kutish kerak.",
          "Vazifa to'xtadi. Javob kutaman.",
          "Davom eta olmayman — yordam kerak.",
          "Hozirga pauzada.",
        ],
        medium: [
          "Hozir davom eta olmayman, chunki qo'shimcha ma'lumot kutaman. Paydo bo'lishi bilan darhol aytaman.",
          "Jarayon to'xtadi. Vazifani aniqlashtirish yoki kutish kerak.",
        ],
      },
      safeFailure: {
        short: [
          "Ishlamadi — boshqa yo'l bilan urinay.",
          "To'g'riligiga ishonchim yo'q. Qayta tekshiray.",
          "Nimadir noto'g'ri. Keling, hal qilaylik.",
          "Xohlagandek bo'lmadi. Lekin bu qo'rqinchli emas.",
          "Bu ishonchli ko'rinmayapti. Yaxshisi aniqlashtiray.",
        ],
        medium: [
          "Xohlaganimdek qila olmadim. Lekin hech qo'rqinchli emas — boshqa usul bilan urinay.",
          "Natija to'g'ri ekaniga ishonchim yo'q. Xato qilishdan ko'ra qayta tekshiray.",
          "Birinchi urinishda ishlamadi. Hozir nima bo'lganini aniqlab, qayta urinay.",
        ],
      },
      encouragementSoft: {
        short: [
          "Hammasi yaxshi, xavotir olmang.",
          "Bo'ladi, bu normal holat.",
          "Biz hal qilamiz, men bu yerdaman.",
          "Hammasi bo'ladi, men bog'lanishdaman.",
        ],
        medium: [
          "Xavotir olmang, bunday bo'ladi. Keling, birga hal qilaylik — men yordam beraman.",
          "Hammasi joyida. Hozir hammasini hal qilamiz, men yonidaman.",
        ],
      },
    },

    neutral: {
      greetings: {
        short: [
          "Salom.",
          "Bog'lanishda.",
          "Salomlashaman.",
          "Tayyor.",
        ],
        medium: [
          "Salom. Yordam berishga tayyor — murojaat qiling.",
          "Salomlashaman. Men bu yerdaman.",
        ],
      },
      confirmations: {
        short: [
          "Qabul qilindi.",
          "Tushunarli.",
          "Bajaryapman.",
          "Ish jarayonida.",
          "Ishga tushirildi.",
          "Tasdiqlayman.",
        ],
        medium: [
          "Vazifa qabul qilindi. Bajarishni boshlayapman.",
          "Tasdiqlayman — boshlayapman.",
        ],
      },
      clarifications: {
        short: [
          "Aniqlashtirish talab qilinadi.",
          "Qo'shimcha ma'lumot kerak.",
          "Iltimos, aniqlashtiring.",
          "Ma'lumot yetarli emas.",
          "Kontekst kerak.",
        ],
        medium: [
          "Vazifani to'g'ri bajarish uchun qo'shimcha ma'lumot kerak. Iltimos, aniqlashtiring.",
          "Vazifani to'g'ri bajarish uchun ko'proq ma'lumot kerak.",
        ],
      },
      explanations: {
        short: [
          "Tushuntiray.",
          "Mana nima bo'layapti.",
          "Qisqacha: mana detallar.",
          "Tartib bilan.",
        ],
        medium: [
          "Tartib bilan tushuntiray: mana nima bo'layotgani va keyin nima bo'ladi.",
        ],
      },
      help: {
        short: [
          "Qanday yordam beray?",
          "Nima talab qilinadi?",
          "Murojaat qiling.",
          "Yordam berishga tayyor.",
        ],
        medium: [
          "Yordam berishga tayyor. Vazifani tasvirlang.",
        ],
      },
      blocked: {
        short: [
          "Vazifa bloklangan.",
          "To'xtatildi.",
          "Kutyapman.",
          "Pauzada.",
        ],
        medium: [
          "Vazifa qo'shimcha ma'lumot olingunga qadar to'xtatildi.",
        ],
      },
      safeFailure: {
        short: [
          "Tugallab bo'lmadi.",
          "Tekshirish kerak.",
          "Qayta tekshirish lozim.",
          "Natijaga ishonchim yo'q.",
        ],
        medium: [
          "Natija tekshiruvdan o'tmadi. Qayta tekshirib, qayta urinay.",
          "To'g'ri tugallab bo'lmadi. Sababini aniqlayapman.",
        ],
      },
    },
  },

  runtimeTruth: {
    prepared: {
      short: [
        "Tayyorladim. Tez orada ishga tushiraman.",
        "Hammasi tayyor — faqat ishga tushirish qoldi.",
        "Paket yig'ildi, buyruq kutmoqda.",
        "Tayyor. Tasdiq kutmoqda.",
      ],
      medium: [
        "Kerakli hamma narsani tayyorladim. Paket yig'ilgan va ishga tushirishga tayyor — tasdiq kutaman.",
        "Tayyorlash tugallandi. Endi ishga tushirish kerak — signal kutaman.",
      ],
    },
    handedOff: {
      short: [
        "Qayta ishlashga uzatdim.",
        "Keyingi bosqichga yubordim.",
        "Ishga berildi.",
        "Keyingi bosqichga o'tdi.",
      ],
      medium: [
        "Vazifani keyingi bosqichga uzatdim. Endi u yerda qayta ishlanmoqda.",
        "Vazifa uzatildi. Endi u ijrochi tomonida.",
      ],
    },
    transferred: {
      short: [
        "Forge'ga uzatildi.",
        "Forge'ga yuborildi.",
        "Ijroga uzatildi.",
        "Qayta ishlashga yuborildi.",
      ],
      medium: [
        "Paket Forge'ga uzatildi. U qabul qilindi va qayta ishlanadi.",
        "Uzatish tugallandi — Forge paketni oldi.",
      ],
    },
    delivered: {
      short: [
        "Yetkazildi.",
        "Natija tayyor.",
        "Qabul qilindi va yetkazildi.",
        "Natija joyida.",
      ],
      medium: [
        "Natija yetkazildi. Ko'rishingiz mumkin.",
        "Hammasi yetkazildi — natija mavjud.",
      ],
    },
    executed: {
      short: [
        "Bajarildi.",
        "Tayyor.",
        "Vazifa tugallandi.",
        "Hammasi bajarildi.",
      ],
      medium: [
        "Vazifa to'liq bajarildi. Natija tayyor.",
        "Ijro tugallandi. Hammasi muvaffaqiyatli o'tdi.",
      ],
    },
    blocked: {
      short: [
        "Vazifa bloklangan.",
        "Bajarish to'xtatildi.",
        "Davom etib bo'lmaydi.",
        "Bloklangan — qaror kutmoqda.",
      ],
      medium: [
        "Vazifa bloklangan. Davom etish uchun muammoni hal qilish kerak.",
        "Bajarish to'xtatildi. Aniqlashtirish yoki qaror kutmoqda.",
      ],
    },
    reviewRequired: {
      short: [
        "Tekshirish kerak.",
        "Rivyu talab qilinadi.",
        "Iltimos, ko'rib chiqing.",
        "Tasdiq kerak.",
      ],
      medium: [
        "Natija tayyor, lekin tekshirish kerak. Iltimos, ko'rib chiqing.",
        "Vazifa keyingi qadamdan oldin rivyu talab qiladi.",
      ],
    },
  },

  fallback: {
    languageUncertain: {
      short: [
        "Til haqida ishonchim yo'q — ingliz tiliga o'taman.",
        "Aniqroq javob berish uchun ingliz tiliga o'taman.",
        "Aniqlik uchun ingliz tilida javob beraman.",
        "Hozir ingliz tilida javob beraman — aniqroq bo'ladi.",
      ],
      medium: [
        "Til haqida ishonchim yo'q — aniq javob berish uchun ingliz tiliga o'taman.",
        "Aniqlik va xavfsizlik uchun ingliz tiliga o'taman. Kerak bo'lsa — orqaga qaytamiz.",
      ],
    },
    intentUncertain: {
      short: [
        "To'liq tushunmadim — iltimos, aniqlashtiring.",
        "Xato qilmaslik uchun aniqlashtirmoqchiman.",
        "Ishonchim komil emas — iltimos, qaytaring.",
        "Yaniroq ma'lumot kerak.",
      ],
      medium: [
        "Vazifani to'g'ri tushunganimga ishonchim komil emas. Nima qilish kerakligini aniq bilishim uchun boshqacha ayta olasizmi?",
        "To'g'ri qilishni xohlayman, shuning uchun aniqlashtiray: aynan nima kerak?",
      ],
    },
    surfaceLimited: {
      short: [
        "Bu yerda qila olmayman — boshqa yo'l bilan urinay.",
        "Bu kanal mos kelmayapti, o'zgartiraman.",
        "Kanal cheklovi. Boshqa usul bilan urinay.",
        "Bu yerda bo'lmaydi — matnga o'taman.",
      ],
      medium: [
        "Bu kanal kerakli funksiyani qo'llab-quvvatlamayapti. Matnga o'taman — shunday ishonchliroq.",
        "Yuzaga chiqish cheklovi. Matn orqali qilaman — natija bir xil bo'ladi.",
      ],
    },
    voiceUnavailable: {
      short: [
        "Ovoz hozir mavjud emas. Matn bilan javob beraman.",
          "Gapira olmayapman — yozaman.",
        "Ovoz ishlamayapti, matn bilan javob beraman.",
        "Matnga o'tyapman.",
      ],
      medium: [
        "Ovozli bog'lanish hozir mavjud emas. Matn bilan javob beraman — natija bir xil bo'ladi.",
        "Ovozdan foydalana olmayapman. Matn javobga o'tyapman.",
      ],
    },
    safeDowngrade: {
      short: [
        "Xavfsiz rejimga o'taman.",
        "Soddaroq, lekin ishonchliroq qilaman.",
        "Xavfsizlik uchun soddalashtiryapman.",
        "Xavfsiz variantga o'tyapman.",
      ],
      medium: [
        "Hammasi xavfsiz o'tishi uchun sodda rejimga o'taman. Natija biroz sodda bo'ladi, lekin ishonchli.",
        "Xavfsizlik uchun vazifani soddalashtiraman. Natija biroz kamroq tafsilotli bo'ladi, lekin to'g'ri.",
      ],
    },
  },

  surfaceBehavior: {
    web: {
      defaultLength: "medium",
      maxSentences: 4,
      prefersDirectness: true,
      prefersClarifyFirst: false,
    },
    tgm: {
      defaultLength: "short",
      maxSentences: 2,
      prefersDirectness: true,
      prefersClarifyFirst: true,
    },
    telegram: {
      defaultLength: "short",
      maxSentences: 2,
      prefersDirectness: true,
      prefersClarifyFirst: true,
    },
    voice: {
      defaultLength: "short",
      maxSentences: 2,
      prefersDirectness: false,
      prefersClarifyFirst: true,
    },
  },
};
